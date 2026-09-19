import { RentalLifecycle } from '@prisma/client';

export interface LifecycleTransitionRule {
  from: RentalLifecycle;
  allowedTo: RentalLifecycle[];
  description: string;
}

export const LIFECYCLE_TRANSITIONS: Record<RentalLifecycle, RentalLifecycle[]> = {
  BOOKED: [RentalLifecycle.RENT_DUE],
  RENT_DUE: [RentalLifecycle.PAYMENT, RentalLifecycle.ISSUE],
  PAYMENT: [RentalLifecycle.ISSUE, RentalLifecycle.RENT_DUE, RentalLifecycle.VERIFIED],
  ISSUE: [RentalLifecycle.ACTION],
  ACTION: [RentalLifecycle.FIXED],
  FIXED: [RentalLifecycle.VERIFIED, RentalLifecycle.ACTION], // Can go back to ACTION if fix is unsatisfactory
  VERIFIED: [RentalLifecycle.RENT_DUE, RentalLifecycle.ISSUE],
};

export const LIFECYCLE_STAGE_LABELS: Record<RentalLifecycle, string> = {
  BOOKED: 'Booked',
  RENT_DUE: 'Rent Due',
  PAYMENT: 'Payment',
  ISSUE: 'Issue',
  ACTION: 'Action',
  FIXED: 'Fixed',
  VERIFIED: 'Verified',
};

export const LIFECYCLE_STAGE_DESCRIPTIONS: Record<RentalLifecycle, string> = {
  BOOKED: 'Tenancy created and confirmed. Ready for occupancy.',
  RENT_DUE: 'Monthly rent cycle active and payment is due.',
  PAYMENT: 'Rent payment processed or in transaction.',
  ISSUE: 'Maintenance issue or tenant request reported.',
  ACTION: 'Action initiated; task assigned to vendor or manager.',
  FIXED: 'Maintenance work completed by technician.',
  VERIFIED: 'Work and tenancy condition verified by tenant and owner.',
};

export function isValidLifecycleTransition(
  from: RentalLifecycle,
  to: RentalLifecycle
): boolean {
  const allowed = LIFECYCLE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
