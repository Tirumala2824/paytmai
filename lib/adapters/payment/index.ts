import { PaymentProvider } from './types';
import { MockPaymentProvider } from './mock';
import { PaytmPaymentProvider } from './paytm';

export * from './types';
export * from './mock';
export * from './paytm';

let currentPaymentProvider: PaymentProvider | null = null;

export function getPaymentProvider(forceMock: boolean = false): PaymentProvider {
  if (forceMock || process.env.DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return new MockPaymentProvider();
  }

  if (currentPaymentProvider) {
    return currentPaymentProvider;
  }

  const paytm = new PaytmPaymentProvider();
  if (paytm.isConfigured()) {
    currentPaymentProvider = paytm;
  } else {
    // Fallback to deterministic MockPaymentProvider for hackathon demo reliability
    currentPaymentProvider = new MockPaymentProvider();
  }

  return currentPaymentProvider;
}
