import { describe, expect, it } from "vitest";

import {
  dayOfWeekForDate,
  timesOverlap,
  timeToMinutes,
} from "../src/services/scheduleResolver.js";

describe("schedule resolver primitives", () => {
  it("maps local date keys to the expected weekday", () => {
    expect(dayOfWeekForDate("2026-09-28")).toBe(1);
    expect(dayOfWeekForDate("2026-10-03")).toBe(6);
    expect(dayOfWeekForDate("2026-10-04")).toBe(0);
  });

  it("detects true overlaps but permits touching boundaries", () => {
    expect(timesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
    expect(timesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
  });

  it("normalizes HH:MM values to minutes", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("13:45")).toBe(825);
  });
});
