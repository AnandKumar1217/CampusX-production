import type { TimetableEntry } from "@/types/domain";

export function parseTimeToMins(timeStr: string | undefined): number {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)/);
  if (!match) return 0;
  let h = parseInt(match[1] as string, 10);
  const m = parseInt(match[2] as string, 10);
  if (timeStr.toLowerCase().includes("pm") && h < 12) h += 12;
  if (timeStr.toLowerCase().includes("am") && h === 12) h = 0;
  return h * 60 + m;
}

export function hasPositiveOverlap(startA: string | undefined, endA: string | undefined, startB: string | undefined, endB: string | undefined): boolean {
  const sA = parseTimeToMins(startA);
  const eA = parseTimeToMins(endA);
  const sB = parseTimeToMins(startB);
  const eB = parseTimeToMins(endB);
  return sA < eB && eA > sB;
}

export function getSlotRenderType(slot: { break?: boolean }, entry: any | null | undefined): "break" | "class" | "blank" {
  if (slot.break === true) return "break";
  if (entry) return "class";
  return "blank";
}

export function getUpcomingClass(timetable: TimetableEntry[]) {
  if (!timetable || timetable.length === 0) return null;

  const now = new Date();
  const currentDayIndex = now.getDay(); // 0 (Sun) to 6 (Sat)

  const currentHour = now.getHours().toString().padStart(2, '0');
  const currentMinute = now.getMinutes().toString().padStart(2, '0');
  const currentTimeStr = `${currentHour}:${currentMinute}`;

  for (let offset = 0; offset < 7; offset++) {
    const checkDay = (currentDayIndex + offset) % 7;

    const dayClasses = timetable.filter(c => c.days && c.days.includes(checkDay));
    if (dayClasses.length === 0) continue;

    dayClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (offset === 0) {
      const currentClass = dayClasses.find(
        c => c.startTime <= currentTimeStr && c.endTime > currentTimeStr
      );
      if (currentClass) {
        return {
          entry: currentClass,
          status: "current",
          timeContext: "Happening Now",
        };
      }

      const nextClass = dayClasses.find(c => c.startTime > currentTimeStr);
      if (nextClass) {
        return {
          entry: nextClass,
          status: "upcoming",
          timeContext: "Later Today",
        };
      }
    } else {
      const nextClass = dayClasses[0];
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const timeContext = offset === 1 ? "Tomorrow" : daysOfWeek[checkDay]!;

      return {
        entry: nextClass,
        status: "upcoming",
        timeContext,
      };
    }
  }

  return null;
}
