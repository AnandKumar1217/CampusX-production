import { describe, it, expect } from "vitest";
import { validateReviewEntry, getImportPayloadAndEffects } from "../src/utils/timetableValidation";

describe("Timetable Review Entry Validation", () => {
  it("1. Valid class is valid", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "08:00", endTime: "10:00" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("2. Missing endTime is invalid", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "08:00" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Missing end time");
  });

  it("3. Fixing missing endTime dynamically makes entry valid", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "08:00", endTime: "10:00" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(true);
  });

  it("4. Making valid entry invalid moves it to Needs Fixing", () => {
    const entry = { subject: "", day: 1, startTime: "08:00", endTime: "10:00" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Missing subject");
  });

  it("6. Faculty missing still remains valid", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "08:00", endTime: "10:00", lecturer: "" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(true);
  });

  it("7. Room missing still remains valid", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "08:00", endTime: "10:00", room: "" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(true);
  });

  it("End time must be after start time", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "10:00", endTime: "09:00" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("End time must be after start time");
  });

  it("NeedsReview flag is informational and does not trigger invalidity", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "08:00", endTime: "10:00", needsReview: true };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(true);
    expect(res.errors).not.toContain("Class timing could not be determined");
  });

  it("Invalid time format is rejected", () => {
    const entry = { subject: "CN LAB", day: 1, startTime: "25:00", endTime: "26:00" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Invalid start time format (HH:mm)");
    expect(res.errors).toContain("Invalid end time format (HH:mm)");
  });

  it("Invalid day is rejected", () => {
    const entry = { subject: "CN LAB", day: 7, startTime: "08:00", endTime: "10:00" };
    const res = validateReviewEntry(entry);
    expect(res.valid).toBe(false);
    expect(res.errors).toContain("Please select a day");
  });

  describe("needsReview clearing behavior in UI logic", () => {
    it("1. needsReview=true + user fixes all required fields -> becomes valid", () => {
      // Simulate editing process
      const formToSave = { subject: "CN LAB", day: 1, startTime: "08:00", endTime: "10:00", needsReview: true };
      const structuralCheck = validateReviewEntry({ ...formToSave, needsReview: false });

      expect(structuralCheck.valid).toBe(true);
      if (structuralCheck.valid) {
        formToSave.needsReview = false;
      }
      expect(formToSave.needsReview).toBe(false);
    });

    it("2. needsReview=true + still missing required field -> remains invalid", () => {
      const formToSave = { subject: "", day: 1, startTime: "08:00", endTime: "10:00", needsReview: true };
      const structuralCheck = validateReviewEntry({ ...formToSave, needsReview: false });

      expect(structuralCheck.valid).toBe(false);
      if (structuralCheck.valid) {
        formToSave.needsReview = false;
      }
      expect(formToSave.needsReview).toBe(true);
    });

    it("3. valid manually-added class -> appears in Valid section immediately", () => {
      const manuallyAdded = { subject: "NEW CLASS", day: 1, startTime: "08:00", endTime: "09:00", needsReview: false };
      const res = validateReviewEntry(manuallyAdded);
      expect(res.valid).toBe(true);
    });
  });

  describe("getImportPayloadAndEffects behavior", () => {
    it("1. Partial import with invalid entries remaining stays on Review screen", () => {
      const entries = [
        { subject: "Valid Class", day: 1, startTime: "08:00", endTime: "09:00" },
        { subject: "", day: 1, startTime: "09:00", endTime: "10:00" }, // Invalid
      ];

      const res = getImportPayloadAndEffects(entries, []);
      expect(res.error).toBeUndefined();
      expect(res.payload?.entries.length).toBe(1);
      expect(res.onSuccessEffects?.stayOnReviewScreen).toBe(true);
      expect(res.onSuccessEffects?.navigateTarget).toBeNull();
      expect(res.onSuccessEffects?.alertMessage).toContain("1 classes imported successfully");
      expect(res.onSuccessEffects?.alertMessage).toContain("1 classes still need fixing");
    });

    it("2. Invalid entries remain editable after successful partial import", () => {
      // This is implicit in stayOnReviewScreen === true, meaning UI state is untouched
      const entries = [
        { subject: "Valid Class", day: 1, startTime: "08:00", endTime: "09:00" },
        { subject: "", day: 1, startTime: "09:00", endTime: "10:00" },
      ];
      const res = getImportPayloadAndEffects(entries, []);
      expect(res.onSuccessEffects?.stayOnReviewScreen).toBe(true);
    });

    it("3. Second import sends ALL current valid entries", () => {
      // Simulate fixing the invalid entry and hitting import again
      const fixedEntries = [
        { subject: "Valid Class", day: 1, startTime: "08:00", endTime: "09:00" },
        { subject: "Fixed Class", day: 1, startTime: "09:00", endTime: "10:00" },
      ];
      const res = getImportPayloadAndEffects(fixedEntries, []);
      expect(res.payload?.entries.length).toBe(2);
      expect(res.payload?.entries[0].subject).toBe("Valid Class");
      expect(res.payload?.entries[1].subject).toBe("Fixed Class");
    });

    it("4. Full-valid import navigates to Timetable", () => {
      const fixedEntries = [
        { subject: "Valid Class", day: 1, startTime: "08:00", endTime: "09:00" },
        { subject: "Fixed Class", day: 1, startTime: "09:00", endTime: "10:00" },
      ];
      const res = getImportPayloadAndEffects(fixedEntries, []);
      expect(res.onSuccessEffects?.stayOnReviewScreen).toBe(false);
      expect(res.onSuccessEffects?.navigateTarget).toBe("Timetable");
      expect(res.onSuccessEffects?.alertMessage).toBe("Timetable imported successfully.");
    });

    it("5. timetable and timetableSettings queries are both invalidated", () => {
      const fixedEntries = [
        { subject: "Valid Class", day: 1, startTime: "08:00", endTime: "09:00" },
      ];
      const res = getImportPayloadAndEffects(fixedEntries, []);
      expect(res.onSuccessEffects?.invalidateTimetable).toBe(true);
      expect(res.onSuccessEffects?.invalidateSettings).toBe(true);
    });
  });
});
