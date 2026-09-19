import { PaymentStatus } from '@prisma/client';

export interface PaymentRequest {
  rentScheduleId: string;
  amount: number;
  currency?: string;
  payerId: string;
  payerEmail?: string;
  payerName?: string;
  tenancyId: string;
  propertyId: string;
  billingMonth: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionRef: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt?: Date;
  provider: string;
  gatewayResponse?: string;
  error?: string;
  rawResponse?: Record<string, unknown>;
}

export interface PaymentVerificationResult {
  verified: boolean;
  transactionRef: string;
  status: PaymentStatus;
  amount: number;
  provider: string;
  message: string;
}

export interface PaymentProvider {
  name: string;
  isMock: boolean;
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyPayment(transactionRef: string): Promise<PaymentVerificationResult>;
}
