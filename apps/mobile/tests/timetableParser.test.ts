import { describe, it, expect } from "vitest";
import { parseTimetableImage, OCRWord } from "../src/services/timetableImageParser";

describe("Timetable Image Parser (Cell-First OCR Deterministic)", () => {
  it("Physical Fixture Regression (Real Timetable)", () => {
    // Exact columns from user request:
    // 08:00-09:00 (x: 100-180)
    // 09:00-10:00 (x: 200-280)
    // 10:00-10:20 (x: 300-330) SHORT BREAK
    // 10:20-11:20 (x: 350-430)
    // 11:20-12:20 (x: 450-530)
    // 12:20-13:00 (x: 550-580) LUNCH BREAK
    // 13:00-14:00 (x: 600-680)
    // 14:00-15:00 (x: 700-780)
    // 15:00-16:00 (x: 800-880)

    // Y coords:
    // Headers: y=10-50
    // Monday: y=100-150
    // Tuesday: y=200-250
    // Wednesday: y=300-350
    // Thursday: y=400-450
    // Friday: y=500-550
    // Saturday: y=600-650

    const words: OCRWord[] = [
      // ---------------- HEADERS ----------------
      { text: "08:00", confidence: 99, bbox: { x0: 100, y0: 10, x1: 130, y1: 30 } },
      { text: "-", confidence: 99, bbox: { x0: 135, y0: 10, x1: 140, y1: 30 } },
      { text: "09:00", confidence: 99, bbox: { x0: 145, y0: 10, x1: 175, y1: 30 } },

      { text: "09:00 - 10:00", confidence: 99, bbox: { x0: 200, y0: 10, x1: 275, y1: 30 } },

      { text: "10:00-10:20", confidence: 99, bbox: { x0: 300, y0: 10, x1: 330, y1: 30 } },

      { text: "10:20", confidence: 99, bbox: { x0: 350, y0: 10, x1: 380, y1: 30 } },
      { text: "-", confidence: 99, bbox: { x0: 385, y0: 10, x1: 390, y1: 30 } },
      { text: "11:20", confidence: 99, bbox: { x0: 395, y0: 10, x1: 425, y1: 30 } },

      { text: "11:20 - 12:20", confidence: 99, bbox: { x0: 450, y0: 10, x1: 525, y1: 30 } },

      { text: "12:20-13:00", confidence: 99, bbox: { x0: 550, y0: 10, x1: 580, y1: 30 } },

      { text: "13:00 - 14:00", confidence: 99, bbox: { x0: 600, y0: 10, x1: 675, y1: 30 } },
      { text: "14:00 - 15:00", confidence: 99, bbox: { x0: 700, y0: 10, x1: 775, y1: 30 } },
      { text: "15:00 - 16:00", confidence: 99, bbox: { x0: 800, y0: 10, x1: 875, y1: 30 } },

      // Breaks Vertical Labels (spanning multiple rows)
      { text: "SHORT", confidence: 99, bbox: { x0: 305, y0: 100, x1: 325, y1: 120 } },
      { text: "BREAK", confidence: 99, bbox: { x0: 305, y0: 130, x1: 325, y1: 150 } },
      { text: "10:20 AM", confidence: 99, bbox: { x0: 305, y0: 200, x1: 325, y1: 220 } },

      { text: "LUNCH", confidence: 99, bbox: { x0: 555, y0: 100, x1: 575, y1: 120 } },
      { text: "BREAK", confidence: 99, bbox: { x0: 555, y0: 130, x1: 575, y1: 150 } },

      // ---------------- DAYS ----------------
      { text: "MONDAY", confidence: 99, bbox: { x0: 10, y0: 110, x1: 80, y1: 130 } },
      { text: "TUESDAY", confidence: 99, bbox: { x0: 10, y0: 210, x1: 80, y1: 230 } },
      { text: "WEDNESDAY", confidence: 99, bbox: { x0: 10, y0: 310, x1: 80, y1: 330 } },
      { text: "THURSDAY", confidence: 99, bbox: { x0: 10, y0: 410, x1: 80, y1: 430 } },
      { text: "FRIDAY", confidence: 99, bbox: { x0: 10, y0: 510, x1: 80, y1: 530 } },
      { text: "SATURDAY", confidence: 99, bbox: { x0: 10, y0: 610, x1: 80, y1: 630 } },

      // ---------------- MONDAY ----------------
      // CN LAB[C1] [DL001]
      // DV LAB[C2] [DI003] (Merged 08:00-10:00)
      { text: "CN LAB[C1]", confidence: 99, bbox: { x0: 110, y0: 105, x1: 175, y1: 115 } },
      { text: "[DL001]", confidence: 99, bbox: { x0: 180, y0: 105, x1: 220, y1: 115 } },
      { text: "DV LAB[C2]", confidence: 99, bbox: { x0: 110, y0: 125, x1: 175, y1: 135 } },
      { text: "[DI003]", confidence: 99, bbox: { x0: 180, y0: 125, x1: 220, y1: 135 } },

      // SOFT SKILLS TYL S3 MOUNA (10:20-11:20)
      { text: "SOFT", confidence: 99, bbox: { x0: 360, y0: 105, x1: 390, y1: 115 } },
      { text: "SKILLS", confidence: 99, bbox: { x0: 395, y0: 105, x1: 420, y1: 115 } },
      { text: "TYL S3", confidence: 99, bbox: { x0: 360, y0: 118, x1: 400, y1: 128 } },
      { text: "MOUNA", confidence: 99, bbox: { x0: 360, y0: 135, x1: 400, y1: 145 } },

      { text: "TOC", confidence: 99, bbox: { x0: 460, y0: 115, x1: 490, y1: 125 } },
      { text: "SEPM", confidence: 99, bbox: { x0: 610, y0: 115, x1: 640, y1: 125 } },
      { text: "IR", confidence: 99, bbox: { x0: 710, y0: 115, x1: 730, y1: 125 } },
      { text: "MINI-PROJECT", confidence: 99, bbox: { x0: 810, y0: 115, x1: 870, y1: 125 } },

      // ---------------- TUESDAY ----------------
      { text: "TECHNICAL", confidence: 99, bbox: { x0: 105, y0: 205, x1: 160, y1: 215 } },
      { text: "TRAINING", confidence: 99, bbox: { x0: 105, y0: 220, x1: 160, y1: 230 } },
      { text: "RICKY", confidence: 99, bbox: { x0: 105, y0: 235, x1: 140, y1: 245 } },

      { text: "IR", confidence: 99, bbox: { x0: 210, y0: 215, x1: 230, y1: 225 } },
      { text: "SEPM", confidence: 99, bbox: { x0: 360, y0: 215, x1: 390, y1: 225 } },

      { text: "TYL", confidence: 99, bbox: { x0: 460, y0: 205, x1: 480, y1: 215 } },
      { text: "APTITUDE", confidence: 99, bbox: { x0: 460, y0: 220, x1: 520, y1: 230 } },
      { text: "HARIKRISHNAN", confidence: 99, bbox: { x0: 460, y0: 235, x1: 530, y1: 245 } },

      { text: "Agentic AI/FSD", confidence: 99, bbox: { x0: 610, y0: 215, x1: 670, y1: 225 } },

      // CN LAB[C2] [DL001]
      // DV LAB[C3] [DL003] (Merged 14:00-16:00)
      { text: "CN LAB[C2]", confidence: 99, bbox: { x0: 710, y0: 205, x1: 775, y1: 215 } },
      { text: "[DL001]", confidence: 99, bbox: { x0: 780, y0: 205, x1: 820, y1: 215 } },
      { text: "DV LAB[C3]", confidence: 99, bbox: { x0: 710, y0: 225, x1: 775, y1: 235 } },
      { text: "[DL003]", confidence: 99, bbox: { x0: 780, y0: 225, x1: 820, y1: 235 } },

      // ---------------- WEDNESDAY ----------------
      // CN LAB[C3] [DL001]
      // DV LAB[C1] [DL003] (Merged 08:00-10:00)
      { text: "CN LAB[C3]", confidence: 99, bbox: { x0: 110, y0: 305, x1: 175, y1: 315 } },
      { text: "[DL001]", confidence: 99, bbox: { x0: 180, y0: 305, x1: 220, y1: 315 } },
      { text: "DV LAB[C1]", confidence: 99, bbox: { x0: 110, y0: 325, x1: 175, y1: 335 } },
      { text: "[DL003]", confidence: 99, bbox: { x0: 180, y0: 325, x1: 220, y1: 335 } },

      { text: "TOC", confidence: 99, bbox: { x0: 360, y0: 315, x1: 390, y1: 325 } },
      { text: "CN", confidence: 99, bbox: { x0: 460, y0: 315, x1: 480, y1: 325 } },
      { text: "Agentic AI/FSD", confidence: 99, bbox: { x0: 610, y0: 315, x1: 670, y1: 325 } },

      // CLUB ACTIVITY/MENTORING (Merged 14:00-16:00)
      { text: "CLUB ACTIVITY/", confidence: 99, bbox: { x0: 710, y0: 310, x1: 850, y1: 320 } },
      { text: "MENTORING", confidence: 99, bbox: { x0: 710, y0: 325, x1: 850, y1: 335 } },

      // ---------------- THURSDAY ----------------
      { text: "SEPM", confidence: 99, bbox: { x0: 110, y0: 415, x1: 140, y1: 425 } },
      { text: "TECHNICAL TRAINING", confidence: 99, bbox: { x0: 210, y0: 415, x1: 270, y1: 425 } },
      { text: "CN", confidence: 99, bbox: { x0: 360, y0: 415, x1: 380, y1: 425 } },
      { text: "IR", confidence: 99, bbox: { x0: 460, y0: 415, x1: 480, y1: 425 } },
      { text: "Agentic AI/FSD", confidence: 99, bbox: { x0: 610, y0: 415, x1: 670, y1: 425 } },

      // YOGA/MUSIC (Merged 14:00-16:00)
      { text: "YOGA/MUSIC", confidence: 99, bbox: { x0: 710, y0: 415, x1: 850, y1: 425 } },

      // ---------------- FRIDAY ----------------
      { text: "IR", confidence: 99, bbox: { x0: 110, y0: 515, x1: 130, y1: 525 } },
      { text: "SEPM", confidence: 99, bbox: { x0: 210, y0: 515, x1: 240, y1: 525 } },
      { text: "TOC", confidence: 99, bbox: { x0: 360, y0: 515, x1: 390, y1: 525 } },
      { text: "RMIPR", confidence: 99, bbox: { x0: 460, y0: 515, x1: 490, y1: 525 } },
      { text: "TYL APTITUDE", confidence: 99, bbox: { x0: 610, y0: 515, x1: 670, y1: 525 } },
      { text: "CN", confidence: 99, bbox: { x0: 710, y0: 515, x1: 730, y1: 525 } },
      { text: "9LPA Training", confidence: 99, bbox: { x0: 810, y0: 515, x1: 870, y1: 525 } },

      // ---------------- SATURDAY ----------------
      { text: "CN", confidence: 99, bbox: { x0: 110, y0: 615, x1: 130, y1: 625 } },
      { text: "Agentic AI/FSD", confidence: 99, bbox: { x0: 210, y0: 615, x1: 270, y1: 625 } },

      // EVENTS (Merged 10:20-12:20) Note: The span from the user says "determine merged span from visual geometry", we'll put it bounding 10:20 to 12:20.
      { text: "EVENTS", confidence: 99, bbox: { x0: 360, y0: 615, x1: 500, y1: 625 } },

      { text: "TOC", confidence: 99, bbox: { x0: 610, y0: 615, x1: 640, y1: 625 } },
      { text: "ES", confidence: 99, bbox: { x0: 710, y0: 615, x1: 730, y1: 625 } },
      { text: "9LPA Training", confidence: 99, bbox: { x0: 810, y0: 615, x1: 870, y1: 625 } },
    ];

    const result = parseTimetableImage(words);

    // Assert exactly 9 slots
    expect(result.gridTimeSlots).toHaveLength(9);
    expect(result.gridTimeSlots[2].break).toBe(true); // 10:00-10:20
    expect(result.gridTimeSlots[5].break).toBe(true); // 12:20-13:00

    // No zero-duration slots, no 16:00-17:00
    expect(result.gridTimeSlots.some(s => s.start === s.end)).toBe(false);
    expect(result.gridTimeSlots.some(s => s.end === "17:00")).toBe(false);
    expect(result.gridTimeSlots[8].end).toBe("16:00");

    const entries = result.entries;

    // No Break/Lunch Fragments as classes
    expect(entries.some(e => e.subject.includes("BREAK"))).toBe(false);
    expect(entries.some(e => e.subject.includes("LUNC"))).toBe(false);
    expect(entries.some(e => e.subject.includes("SHORT"))).toBe(false);

    // Monday
    const monday = entries.filter(e => e.day === 1);
    const mLab = monday.find(e => e.subject.includes("CN LAB[C1]"));
    expect(mLab).toBeDefined();
    expect(mLab?.startTime).toBe("08:00");
    expect(mLab?.endTime).toBe("10:00"); // Merged lab

    const softSkills = monday.find(e => e.subject.includes("SOFT SKILLS"));
    expect(softSkills).toBeDefined();
    expect(softSkills?.startTime).toBe("10:20");
    expect(softSkills?.endTime).toBe("11:20");
    // Assert 1 entry for the whole cell block
    expect(monday.some(e => e.subject === "MOUNA")).toBe(false);

    expect(monday.find(e => e.subject === "TOC")?.startTime).toBe("11:20");
    expect(monday.find(e => e.subject === "SEPM")?.startTime).toBe("13:00");
    expect(monday.find(e => e.subject === "IR")?.startTime).toBe("14:00");
    expect(monday.find(e => e.subject === "MINI-PROJECT")?.endTime).toBe("16:00");

    // Tuesday
    const tuesday = entries.filter(e => e.day === 2);
    const techTraining = tuesday.find(e => e.subject.includes("TECHNICAL TRAINING"));
    expect(techTraining).toBeDefined();
    // Faculty should not be independent
    expect(tuesday.some(e => e.subject === "RICKY")).toBe(false);

    const tLab = tuesday.find(e => e.subject.includes("CN LAB[C2]"));
    expect(tLab).toBeDefined();
    expect(tLab?.startTime).toBe("14:00");
    expect(tLab?.endTime).toBe("16:00"); // Merged lab

    const tylAptitude = tuesday.find(e => e.subject.includes("TYL APTITUDE"));
    expect(tylAptitude).toBeDefined();
    expect(tuesday.some(e => e.subject === "HARIKRISHNAN")).toBe(false);

    // Wednesday
    const wednesday = entries.filter(e => e.day === 3);
    const wLab = wednesday.find(e => e.subject.includes("CN LAB[C3]"));
    expect(wLab).toBeDefined();
    expect(wLab?.startTime).toBe("08:00");
    expect(wLab?.endTime).toBe("10:00");

    const club = wednesday.find(e => e.subject.includes("CLUB ACTIVITY"));
    expect(club).toBeDefined();
    expect(club?.startTime).toBe("14:00");
    expect(club?.endTime).toBe("16:00");

    // Thursday
    const thursday = entries.filter(e => e.day === 4);
    const yoga = thursday.find(e => e.subject.includes("YOGA/MUSIC"));
    expect(yoga).toBeDefined();
    expect(yoga?.startTime).toBe("14:00");
    expect(yoga?.endTime).toBe("16:00");

    // Friday
    const friday = entries.filter(e => e.day === 5);
    const cn = friday.find(e => e.subject === "CN");
    expect(cn).toBeDefined();
    expect(cn?.startTime).toBe("14:00");
    expect(cn?.endTime).toBe("15:00");

    const lpa = friday.find(e => e.subject.includes("9LPA"));
    expect(lpa).toBeDefined();
    expect(lpa?.startTime).toBe("15:00");
    expect(lpa?.endTime).toBe("16:00"); // Should not stretch

    // Saturday
    const saturday = entries.filter(e => e.day === 6);
    const events = saturday.find(e => e.subject === "EVENTS");
    expect(events).toBeDefined();
    expect(events?.startTime).toBe("10:20");
    expect(events?.endTime).toBe("12:20");
  });
});
