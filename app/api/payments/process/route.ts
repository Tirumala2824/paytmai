import { NextRequest, NextResponse } from 'next/server';
import { processPayment } from '@/lib/payments/service';
import { getAuthenticatedUser } from '@/lib/auth/rbac';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rentScheduleId, amount, paymentMethod, demoActorId } = body;

    if (!rentScheduleId || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: rentScheduleId, amount' },
        { status: 400 }
      );
    }

    const authContext = await getAuthenticatedUser();
    let actor = authContext?.userProfile;

    if (!actor && demoActorId) {
      actor = (await prisma.userProfile.findUnique({
        where: { id: demoActorId },
      })) || undefined;
    }

    if (!actor) {
      const defaultTenant = await prisma.userProfile.findFirst({
        where: { role: 'TENANT' },
      });
      if (defaultTenant) actor = defaultTenant;
    }

    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payment = await processPayment({
      rentScheduleId,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'PAYTM',
      actor: { id: actor.id, role: actor.role, email: actor.email },
    });

    return NextResponse.json({
      success: true,
      payment,
      message: 'Payment processed successfully via Paytm mock gateway',
    });
  } catch (error: any) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment failed' },
      { status: 400 }
    );
  }
}
