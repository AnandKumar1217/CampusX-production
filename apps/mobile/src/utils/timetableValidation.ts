import type { TimeSlot } from "@/types/domain";

export type TimetableReviewEntry = {
  subject?: string;
  day?: number;
  startTime?: string;
  endTime?: string;
  room?: string;
  lecturer?: string;
  needsReview?: boolean;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateReviewEntry(
  entry: TimetableReviewEntry,
): ValidationResult {
  const errors: string[] = [];
  const subject = entry.subject?.trim() ?? "";
  const startTime = entry.startTime?.trim() ?? "";
  const endTime = entry.endTime?.trim() ?? "";

  if (!subject) errors.push("Missing subject");
  if (!Number.isInteger(entry.day) || entry.day! < 1 || entry.day! > 6) {
    errors.push("Please select a day");
  }

  if (!startTime) {
    errors.push("Missing start time");
  } else if (!TIME_PATTERN.test(startTime)) {
    errors.push("Invalid start time format (HH:mm)");
  }

  if (!endTime) {
    errors.push("Missing end time");
  } else if (!TIME_PATTERN.test(endTime)) {
    errors.push("Invalid end time format (HH:mm)");
  }

  if (
    TIME_PATTERN.test(startTime) &&
    TIME_PATTERN.test(endTime) &&
    timeToMinutes(endTime) <= timeToMinutes(startTime)
  ) {
    errors.push("End time must be after start time");
  }

  if (entry.needsReview) {
    errors.push("Class timing could not be determined");
  }

  return { valid: errors.length === 0, errors };
}

export function getImportPayloadAndEffects(
  entries: TimetableReviewEntry[],
  gridTimeSlots: TimeSlot[],
) {
  const validEntries = entries.filter(
    (entry) => validateReviewEntry(entry).valid,
  );
  const invalidCount = entries.length - validEntries.length;

  if (validEntries.length === 0) {
    return { error: "No valid classes are ready to import." };
  }

  const mappedEntries = validEntries.map((entry) => ({
    subject: entry.subject!.trim(),
    days: [entry.day!],
    startTime: entry.startTime!,
    endTime: entry.endTime!,
    room: entry.room,
    lecturer: entry.lecturer,
    locationType: entry.room ? "physical" : "tbd",
    color: "#6C5CE7",
  }));
  const hasInvalidEntries = invalidCount > 0;

  return {
    payload: {
      gridTimeSlots,
      entries: mappedEntries,
    },
    onSuccessEffects: {
      stayOnReviewScreen: hasInvalidEntries,
      navigateTarget: hasInvalidEntries ? null : "Timetable",
      alertMessage: hasInvalidEntries
        ? `${validEntries.length} classes imported successfully. ${invalidCount} classes still need fixing.`
        : "Timetable imported successfully.",
      invalidateTimetable: true,
      invalidateSettings: true,
    },
  };
}
