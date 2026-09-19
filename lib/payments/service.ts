import { PaymentStatus, RentalLifecycle } from '@prisma/client';
import prisma from '@/lib/db';
import { createAuditEvent } from '@/lib/audit/service';
import { advanceRentalLifecycle } from '@/lib/rental/service';
import { getPaymentProvider } from '@/lib/adapters/payment';
import { getNotificationProvider } from '@/lib/adapters/notifications';

export interface ProcessPaymentParams {
  rentScheduleId: string;
  amount: number;
  paymentMethod?: string;
  actor: { id: string; role: string; email?: string; name?: string };
  forceMock?: boolean;
}

export async function processPayment(params: ProcessPaymentParams) {
  const startTime = Date.now();

  const rentSchedule = await prisma.rentSchedule.findUnique({
    where: { id: params.rentScheduleId },
    include: {
      tenancy: {
        include: {
          tenant: { include: { userProfile: true } },
          property: { include: { owner: { include: { userProfile: true } } } },
        },
      },
    },
  });

  if (!rentSchedule) {
    throw new Error('Rent schedule not found');
  }

  // 1. Execute payment through authorized provider adapter (Paytm or Mock)
  const provider = getPaymentProvider(params.forceMock);
  const paymentResult = await provider.processPayment({
    rentScheduleId: params.rentScheduleId,
    amount: params.amount,
    currency: 'INR',
    payerId: params.actor.id,
    payerEmail: params.actor.email || rentSchedule.tenancy.tenant.userProfile.email,
    payerName: params.actor.name || rentSchedule.tenancy.tenant.userProfile.name,
    tenancyId: rentSchedule.tenancyId,
    propertyId: rentSchedule.tenancy.propertyId,
    billingMonth: rentSchedule.billingMonth,
  });

  if (!paymentResult.success) {
    // Audit failed payment attempt
    await createAuditEvent({
      actorId: params.actor.id,
      actorRole: params.actor.role,
      action: 'PAYMENT_FAILED',
      resourceType: 'PAYMENT',
      resourceId: params.rentScheduleId,
      tool: 'processPayment',
      status: 'FAILED',
      latency: Date.now() - startTime,
      error: paymentResult.error,
      metadata: {
        amount: params.amount,
        rentScheduleId: params.rentScheduleId,
        provider: provider.name,
        error: paymentResult.error,
      },
    });

    throw new Error(paymentResult.error || 'Payment transaction failed');
  }

  // 2. Persist Payment and update RentSchedule in database transaction
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        rentScheduleId: params.rentScheduleId,
        amount: params.amount,
        currency: paymentResult.currency || 'INR',
        status: paymentResult.status,
        paymentMethod: params.paymentMethod || (provider.isMock ? 'MOCK' : 'PAYTM'),
        transactionRef: paymentResult.transactionRef,
        paidAt: paymentResult.paidAt || new Date(),
        metadata: {
          provider: provider.name,
          gatewayResponse: paymentResult.gatewayResponse,
          payerEmail: params.actor.email,
          rawResponse: paymentResult.rawResponse,
          timestamp: new Date().toISOString(),
        } as any,
      },
    });

    await tx.rentSchedule.update({
      where: { id: params.rentScheduleId },
      data: {
        status: PaymentStatus.SUCCESS,
      },
    });

    return payment;
  });

  // 3. Dispatch Notification via NotificationProvider
  try {
    const notificationProvider = getNotificationProvider();
    await notificationProvider.send({
      recipientUserProfileId: rentSchedule.tenancy.property.owner.userProfile.id,
      title: 'Rent Payment Received',
      message: `Received ₹${params.amount.toLocaleString('en-IN')} from ${rentSchedule.tenancy.tenant.userProfile.name} for ${rentSchedule.billingMonth}. Ref: ${paymentResult.transactionRef}`,
      type: 'PAYMENT_RECEIVED',
      link: '/payments',
    });
  } catch (notifErr) {
    console.warn('Notification dispatch warning:', notifErr);
  }

  // 4. Advance rental lifecycle to PAYMENT
  try {
    await advanceRentalLifecycle(
      rentSchedule.tenancyId,
      RentalLifecycle.PAYMENT,
      params.actor,
      `Payment received: ₹${params.amount.toLocaleString('en-IN')} (Ref: ${paymentResult.transactionRef})`
    );
  } catch (err) {
    console.warn('Could not advance lifecycle to PAYMENT:', err);
  }

  // 5. Create structured AuditEvent with observability fields
  await createAuditEvent({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    action: 'PAYMENT_PROCESSED',
    resourceType: 'PAYMENT',
    resourceId: result.id,
    tool: 'processPayment',
    status: 'SUCCESS',
    latency: Date.now() - startTime,
    metadata: {
      amount: params.amount,
      rentScheduleId: params.rentScheduleId,
      tenancyId: rentSchedule.tenancyId,
      transactionRef: paymentResult.transactionRef,
      paymentMethod: params.paymentMethod || (provider.isMock ? 'MOCK' : 'PAYTM'),
      provider: provider.name,
      status: 'SUCCESS',
    },
  });

  return result;
}

export async function getTenancyPayments(tenancyId: string) {
  return await prisma.payment.findMany({
    where: {
      rentSchedule: {
        tenancyId,
      },
    },
    include: {
      rentSchedule: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
