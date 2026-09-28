import { describe, it, expect } from 'vitest';
import {
  ORDER_PRIORITIES,
  DISPATCH_STATUSES,
  CLINICAL_NOTE_STATUSES,
  LAB_RESULT_FLAGS,
} from '@ehr/shared';

describe('StatusChip Constants & Helpers', () => {
  it('exposes order priorities correctly', () => {
    expect(ORDER_PRIORITIES.STAT).toBe('STAT');
    expect(ORDER_PRIORITIES.URGENT).toBe('URGENT');
    expect(ORDER_PRIORITIES.ROUTINE).toBe('ROUTINE');
  });

  it('exposes dispatch statuses properly', () => {
    expect(DISPATCH_STATUSES.CREATED).toBe('CREATED');
    expect(DISPATCH_STATUSES.DISPATCHED).toBe('DISPATCHED');
    expect(DISPATCH_STATUSES.ACKNOWLEDGED).toBe('ACKNOWLEDGED');
    expect(DISPATCH_STATUSES.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(DISPATCH_STATUSES.COMPLETED).toBe('COMPLETED');
  });

  it('exposes clinical note statuses correctly', () => {
    expect(CLINICAL_NOTE_STATUSES.DRAFT).toBe('DRAFT');
    expect(CLINICAL_NOTE_STATUSES.SIGNED).toBe('SIGNED');
    expect(CLINICAL_NOTE_STATUSES.AMENDED).toBe('AMENDED');
  });

  it('exposes lab result critical flags', () => {
    expect(LAB_RESULT_FLAGS.NORMAL).toBe('N');
    expect(LAB_RESULT_FLAGS.CRITICAL).toBe('CRIT');
  });
});
