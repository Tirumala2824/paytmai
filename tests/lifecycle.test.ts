import { describe, it, expect } from 'vitest';
import { RentalLifecycle } from '@prisma/client';
import {
  isValidLifecycleTransition,
  LIFECYCLE_STAGE_LABELS,
  LIFECYCLE_STAGE_DESCRIPTIONS,
} from '@/lib/rental/lifecycle';

describe('Rental Lifecycle State Machine', () => {
  describe('Valid Lifecycle Transitions', () => {
    it('allows BOOKED -> RENT_DUE', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.BOOKED, RentalLifecycle.RENT_DUE)
      ).toBe(true);
    });

    it('allows RENT_DUE -> PAYMENT and RENT_DUE -> ISSUE', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.RENT_DUE, RentalLifecycle.PAYMENT)
      ).toBe(true);
      expect(
        isValidLifecycleTransition(RentalLifecycle.RENT_DUE, RentalLifecycle.ISSUE)
      ).toBe(true);
    });

    it('allows PAYMENT -> ISSUE, PAYMENT -> RENT_DUE, and PAYMENT -> VERIFIED', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.PAYMENT, RentalLifecycle.ISSUE)
      ).toBe(true);
      expect(
        isValidLifecycleTransition(RentalLifecycle.PAYMENT, RentalLifecycle.RENT_DUE)
      ).toBe(true);
      expect(
        isValidLifecycleTransition(RentalLifecycle.PAYMENT, RentalLifecycle.VERIFIED)
      ).toBe(true);
    });

    it('allows ISSUE -> ACTION', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.ISSUE, RentalLifecycle.ACTION)
      ).toBe(true);
    });

    it('allows ACTION -> FIXED', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.ACTION, RentalLifecycle.FIXED)
      ).toBe(true);
    });

    it('allows FIXED -> VERIFIED and FIXED -> ACTION (re-work)', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.FIXED, RentalLifecycle.VERIFIED)
      ).toBe(true);
      expect(
        isValidLifecycleTransition(RentalLifecycle.FIXED, RentalLifecycle.ACTION)
      ).toBe(true);
    });

    it('allows VERIFIED -> RENT_DUE (subsequent monthly cycle)', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.VERIFIED, RentalLifecycle.RENT_DUE)
      ).toBe(true);
    });
  });

  describe('Invalid Lifecycle Transitions', () => {
    it('rejects BOOKED -> FIXED', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.BOOKED, RentalLifecycle.FIXED)
      ).toBe(false);
    });

    it('rejects BOOKED -> VERIFIED', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.BOOKED, RentalLifecycle.VERIFIED)
      ).toBe(false);
    });

    it('rejects ISSUE -> VERIFIED directly without action and fix', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.ISSUE, RentalLifecycle.VERIFIED)
      ).toBe(false);
    });

    it('rejects ACTION -> RENT_DUE directly', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.ACTION, RentalLifecycle.RENT_DUE)
      ).toBe(false);
    });

    it('rejects FIXED -> BOOKED', () => {
      expect(
        isValidLifecycleTransition(RentalLifecycle.FIXED, RentalLifecycle.BOOKED)
      ).toBe(false);
    });
  });

  describe('Stage Labels and Metadata', () => {
    it('has human-readable labels for all stages', () => {
      Object.values(RentalLifecycle).forEach((stage) => {
        expect(LIFECYCLE_STAGE_LABELS[stage]).toBeDefined();
        expect(typeof LIFECYCLE_STAGE_LABELS[stage]).toBe('string');
        expect(LIFECYCLE_STAGE_DESCRIPTIONS[stage]).toBeDefined();
      });
    });
  });
});
