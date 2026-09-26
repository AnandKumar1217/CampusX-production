import { describe, it, expect } from 'vitest';
import { hasPositiveOverlap, parseTimeToMins, getSlotRenderType } from '../src/utils/timetable';

describe('Timetable Utility Functions', () => {
  describe('parseTimeToMins', () => {
    it('parses standard HH:mm times', () => {
      expect(parseTimeToMins('09:00')).toBe(540);
      expect(parseTimeToMins('14:30')).toBe(870);
      expect(parseTimeToMins('08:15')).toBe(495);
    });
  });

  describe('hasPositiveOverlap', () => {
    it('returns true for positively overlapping intervals', () => {
      // 09:00-11:00 and 10:00-10:20
      expect(hasPositiveOverlap('09:00', '11:00', '10:00', '10:20')).toBe(true);
      // 08:00-10:00 and 09:00-10:00
      expect(hasPositiveOverlap('08:00', '10:00', '09:00', '10:00')).toBe(true);
      // 10:00-11:00 and 09:30-10:30
      expect(hasPositiveOverlap('10:00', '11:00', '09:30', '10:30')).toBe(true);
    });

    it('strictly rejects touching boundaries', () => {
      // Class ends EXACTLY when break starts
      expect(hasPositiveOverlap('09:00', '10:00', '10:00', '10:20')).toBe(false);
      // Break ends EXACTLY when class starts
      expect(hasPositiveOverlap('10:20', '11:20', '10:00', '10:20')).toBe(false);
      // Class starts exactly when another ends
      expect(hasPositiveOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
    });

    it('returns false for completely disjoint intervals', () => {
      expect(hasPositiveOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
      expect(hasPositiveOverlap('11:00', '12:00', '08:00', '09:00')).toBe(false);
    });
  });

  describe('getSlotRenderType', () => {
    it('TEST A: returns blank for non-break missing class', () => {
      expect(getSlotRenderType({ break: false }, null)).toBe('blank');
    });

    it('TEST B: returns break for explicit break missing class', () => {
      expect(getSlotRenderType({ break: true }, null)).toBe('break');
    });

    it('TEST C: returns blank for another non-break missing class', () => {
      expect(getSlotRenderType({ break: false }, undefined)).toBe('blank');
    });

    it('TEST D: returns class for non-break existing class', () => {
      expect(getSlotRenderType({ break: false }, { subject: 'SEPM' })).toBe('class');
    });

    it('TEST: returns break even if class exists during an explicit break', () => {
      // (Optional edge case) if parser gave a class but slot is explicitly a break
      expect(getSlotRenderType({ break: true }, { subject: 'IR' })).toBe('break');
    });
  });
});
