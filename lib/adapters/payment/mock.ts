import { PaymentStatus } from '@prisma/client';
import { PaymentProvider, PaymentRequest, PaymentResult, PaymentVerificationResult } from './types';

/**
 * MockPaymentProvider
 * Deterministic hackathon demonstration adapter.
 * Simulates instantaneous, reliable payment processing without requiring Paytm live credentials.
 */
export class MockPaymentProvider implements PaymentProvider {
  public readonly name = 'MOCK_PAYMENT_PROVIDER';
  public readonly isMock = true;

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Validate request constraints
    if (request.amount <= 0) {
      return {
        success: false,
        transactionRef: `TXN_ERR_${Date.now()}`,
        status: PaymentStatus.FAILED,
        amount: request.amount,
        currency: request.currency || 'INR',
        provider: this.name,
        error: 'Invalid payment amount: must be greater than zero',
      };
    }

    const transactionRef = `TXN_MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    return {
      success: true,
      transactionRef,
      status: PaymentStatus.SUCCESS,
      amount: request.amount,
      currency: request.currency || 'INR',
      paidAt: new Date(),
      provider: this.name,
      gatewayResponse: 'SUCCESS_SIMULATED',
      rawResponse: {
        mid: 'MOCK_MERCHANT_ID',
        txnId: transactionRef,
        resultStatus: 'TXN_SUCCESS',
        resultMsg: 'Txn Success (Mock Demo Mode)',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async verifyPayment(transactionRef: string): Promise<PaymentVerificationResult> {
    const isSuccess = !transactionRef.includes('ERR') && !transactionRef.includes('FAIL');
    return {
      verified: isSuccess,
      transactionRef,
      status: isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
      amount: 18000,
      provider: this.name,
      message: isSuccess
        ? 'Payment verified successfully via MockPaymentProvider'
        : 'Payment verification failed',
    };
  }
}
