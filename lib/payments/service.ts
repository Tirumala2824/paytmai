import { PaymentStatus, RentalLifecycle } from '@prisma/client';
import prisma from '@/lib/db';
import { createAuditEvent } from '@/lib/audit/service';
import { advanceRentalLifecycle } from '@/lib/rental/service';

export interface ProcessPaymentParams {
  rentScheduleId: string;
  amount: number;
  paymentMethod?: string;
  actor: { id: string; role: string; email?: string };
}

export async function processPayment(params: ProcessPaymentParams) {
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

  // Generate a mock/Paytm transaction reference
  const transactionRef = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Execute payment and updates in transaction
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        rentScheduleId: params.rentScheduleId,
        amount: params.amount,
        currency: 'INR',
        status: PaymentStatus.SUCCESS,
        paymentMethod: params.paymentMethod || 'PAYTM',
        transactionRef,
        paidAt: new Date(),
        metadata: {
          provider: 'PAYTM_MOCK_GATEWAY',
          gatewayResponse: 'SUCCESS',
          payerEmail: params.actor.email,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await tx.rentSchedule.update({
      where: { id: params.rentScheduleId },
      data: {
        status: PaymentStatus.SUCCESS,
      },
    });

    // Notify owner of received payment
    await tx.notification.create({
      data: {
        userProfileId: rentSchedule.tenancy.property.owner.userProfile.id,
        title: 'Rent Payment Received',
        message: `Received ₹${params.amount} from ${rentSchedule.tenancy.tenant.userProfile.name} for ${rentSchedule.billingMonth}. Ref: ${transactionRef}`,
        type: 'PAYMENT_RECEIVED',
        link: `/payments`,
      },
    });

    return payment;
  });

  // Advance rental lifecycle to PAYMENT
  try {
    await advanceRentalLifecycle(
      rentSchedule.tenancyId,
      RentalLifecycle.PAYMENT,
      params.actor,
      `Payment received: ₹${params.amount} (Ref: ${transactionRef})`
    );
  } catch (err) {
    console.warn('Could not advance lifecycle to PAYMENT:', err);
  }

  // Create audit event
  await createAuditEvent({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    action: 'PAYMENT_PROCESSED',
    resourceType: 'PAYMENT',
    resourceId: result.id,
    metadata: {
      amount: params.amount,
      rentScheduleId: params.rentScheduleId,
      tenancyId: rentSchedule.tenancyId,
      transactionRef,
      paymentMethod: params.paymentMethod || 'PAYTM',
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
