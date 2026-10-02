import { expect, test, describe } from 'vitest';
import { parseTimetableImage, OCRWord } from '../src/services/timetableImageParser';

describe('Timetable Geometry Parser', () => {
  test('1 & 3. Academic + short break with overlap leak prevention', () => {
    // 09:00-10:00, gap, 10:20-11:20
    const words: OCRWord[] = [
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "09:00-10:00", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      { text: "10:20-11:20", confidence: 100, bbox: { x0: 300, y0: 0, x1: 400, y1: 20 } },
      // Break text overlaps out to x0:150 and x1:350 (over 9:00-10:00 and 10:20-11:20)
      // but its center is inside the gap. The gap is 200-300.
      { text: "SHORT", confidence: 100, bbox: { x0: 150, y0: 100, x1: 240, y1: 120 } },
      { text: "BREAK", confidence: 100, bbox: { x0: 250, y0: 100, x1: 350, y1: 120 } },
      { text: "OS", confidence: 100, bbox: { x0: 110, y0: 100, x1: 140, y1: 120 } },
      { text: "DBMS", confidence: 100, bbox: { x0: 360, y0: 100, x1: 390, y1: 120 } }
    ];

    const result = parseTimetableImage(words);
    
    // Should have 3 columns: 09:00-10:00, 10:00-10:20 (break), 10:20-11:20
    expect(result.gridTimeSlots).toHaveLength(3);
    expect(result.gridTimeSlots[0].start).toBe("09:00");
    expect(result.gridTimeSlots[0].break).toBe(false);
    expect(result.gridTimeSlots[1].start).toBe("10:00");
    expect(result.gridTimeSlots[1].break).toBe(true);
    expect(result.gridTimeSlots[2].start).toBe("10:20");
    expect(result.gridTimeSlots[2].break).toBe(false);
  });

  test('2. Lunch narrow column', () => {
    const words: OCRWord[] = [
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "11:20-12:20", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      { text: "12:20-13:00", confidence: 100, bbox: { x0: 200, y0: 0, x1: 250, y1: 20 } },
      { text: "13:00-14:00", confidence: 100, bbox: { x0: 250, y0: 0, x1: 350, y1: 20 } },
      // Lunch text strictly inside 12:20-13:00
      { text: "LUNCH", confidence: 100, bbox: { x0: 210, y0: 100, x1: 240, y1: 120 } }
    ];

    const result = parseTimetableImage(words);
    
    expect(result.gridTimeSlots[1].break).toBe(true);
    expect(result.gridTimeSlots[0].break).toBe(false);
    expect(result.gridTimeSlots[2].break).toBe(false);
  });

  test('4. Variable-width academic columns', () => {
    const words: OCRWord[] = [
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "09:00-10:00", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } }, // 100px wide
      { text: "10:00-11:30", confidence: 100, bbox: { x0: 200, y0: 0, x1: 400, y1: 20 } }, // 200px wide
      { text: "11:30-12:30", confidence: 100, bbox: { x0: 400, y0: 0, x1: 500, y1: 20 } }  // 100px wide
    ];

    const result = parseTimetableImage(words);
    expect(result.gridTimeSlots).toHaveLength(3);
    expect(result.gridTimeSlots[1].start).toBe("10:00");
  });

  test('5. Empty OCR-missed class (returns MissingCell)', () => {
    const words: OCRWord[] = [
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "09:00-10:00", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      { text: "10:00-11:00", confidence: 100, bbox: { x0: 200, y0: 0, x1: 300, y1: 20 } },
      { text: "11:00-12:00", confidence: 100, bbox: { x0: 300, y0: 0, x1: 400, y1: 20 } },
      // Class in col 1 and 3, col 2 is missed
      { text: "AI", confidence: 100, bbox: { x0: 110, y0: 100, x1: 190, y1: 120 } },
      { text: "ML", confidence: 100, bbox: { x0: 310, y0: 100, x1: 390, y1: 120 } }
    ];

    const result = parseTimetableImage(words);
    expect(result.missingCells).toHaveLength(1);
    expect(result.missingCells[0].startTime).toBe("10:00");
    expect(result.missingCells[0].endTime).toBe("11:00");
  });

  test('6. Two-period merged LAB', () => {
    const words: OCRWord[] = [
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "09:00-10:00", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      { text: "10:00-11:00", confidence: 100, bbox: { x0: 200, y0: 0, x1: 300, y1: 20 } },
      // LAB spans both columns horizontally, within distance of 30px
      { text: "CN", confidence: 100, bbox: { x0: 120, y0: 100, x1: 180, y1: 120 } },
      { text: "LAB", confidence: 100, bbox: { x0: 205, y0: 100, x1: 280, y1: 120 } }
    ];

    const result = parseTimetableImage(words);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].columnStartIndex).toBe(0);
    expect(result.entries[0].columnEndIndex).toBe(1); // Merged!
  });

  test('7. Multi-line class text inside one cell', () => {
    const words: OCRWord[] = [
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "09:00-10:00", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      // Stacked lines inside same column region
      { text: "TECHNICAL", confidence: 100, bbox: { x0: 110, y0: 90, x1: 190, y1: 100 } },
      { text: "TRAINING", confidence: 100, bbox: { x0: 110, y0: 105, x1: 190, y1: 115 } },
      { text: "RICKY", confidence: 100, bbox: { x0: 110, y0: 120, x1: 190, y1: 130 } }
    ];

    const result = parseTimetableImage(words);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].subject).toBe("TECHNICAL TRAINING RICKY");
  });

  test('8. Monday-Saturday rows preserved', () => {
    const words: OCRWord[] = [
      { text: "09:00-10:00", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "Tuesday", confidence: 100, bbox: { x0: 0, y0: 200, x1: 50, y1: 220 } },
      { text: "Wednesday", confidence: 100, bbox: { x0: 0, y0: 300, x1: 50, y1: 320 } },
      { text: "Thursday", confidence: 100, bbox: { x0: 0, y0: 400, x1: 50, y1: 420 } },
      { text: "Friday", confidence: 100, bbox: { x0: 0, y0: 500, x1: 50, y1: 520 } },
      { text: "Saturday", confidence: 100, bbox: { x0: 0, y0: 600, x1: 50, y1: 620 } },
      // Only one class on Saturday
      { text: "AI", confidence: 100, bbox: { x0: 110, y0: 600, x1: 190, y1: 620 } }
    ];

    const result = parseTimetableImage(words);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].day).toBe(6);
  });

  test('9. No hard rejection for partial parsed input', () => {
    const words: OCRWord[] = [
      // Only 1 column header
      { text: "09:00-10:00", confidence: 100, bbox: { x0: 100, y0: 0, x1: 200, y1: 20 } },
      { text: "Monday", confidence: 100, bbox: { x0: 0, y0: 100, x1: 50, y1: 120 } },
      { text: "AI", confidence: 100, bbox: { x0: 110, y0: 100, x1: 190, y1: 120 } }
    ];

    const result = parseTimetableImage(words);
    expect(result.isTimetable).toBe(true);
    expect(result.entries).toHaveLength(1);
  });
});
