export type OCRWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

export type DraftTimetableEntry = {
  day: number;
  subject: string;
  startTime: string;
  endTime: string;
  room: string | null;
  lecturer: string | null;
  needsReview: boolean;
  confidence: number;
  sourceBounds: { x0: number; y0: number; x1: number; y1: number };
  columnStartIndex: number;
  columnEndIndex: number;
};

export type MissingTimetableCell = {
  day: number;
  startTime: string;
  endTime: string;
  reason: "possible_missing_class";
};

export type TimetableParseResult = {
  isTimetable: boolean;
  entries: DraftTimetableEntry[];
  gridTimeSlots: { id: string; label: string; start: string; end: string; break: boolean }[];
  warnings: string[];
  missingCells: MissingTimetableCell[];
};

const DAY_MAPPING: Record<string, number> = {
  "monday": 1, "mon": 1,
  "tuesday": 2, "tue": 2, "tues": 2,
  "wednesday": 3, "wed": 3,
  "thursday": 4, "thu": 4, "thur": 4, "thurs": 4,
  "friday": 5, "fri": 5,
  "saturday": 6, "sat": 6,
  "sunday": 0, "sun": 0
};

const NON_CLASS_KEYWORDS = ["lunch", "break", "recess", "free", "period", "tea break", "short break"];
const ROOM_REGEX = /\b([a-z]-\d{3}|[a-z]{2}\d{3}|room\s*\d{3})\b/i; // Matches A-204, DL001, Room 205

function cleanText(text: string): string {
  return text.trim().replace(/[\[\]{}|\\]/g, "").trim();
}

function getDayValue(text: string): number | null {
  const normalized = text.toLowerCase().replace(/[^a-z]/g, "");
  return DAY_MAPPING[normalized] !== undefined ? DAY_MAPPING[normalized] : null;
}

function parseAllTimes(text: string): string[] {
  const times: string[] = [];
  const normalizedText = text.toLowerCase();

  // Match forms like 08:30, 8:30, 8.30, 08:30 AM, 12:45 PM
  const timeRegex = /\b(\d{1,2})[:.](\d{2})(?:\s*(am|pm))?\b/gi;
  let match;
  while ((match = timeRegex.exec(normalizedText)) !== null) {
    let hours = parseInt(match[1]!, 10);
    const mins = match[2];
    const modifier = match[3]?.toLowerCase();

    if (modifier === 'pm' && hours < 12) {
      hours += 12;
    } else if (modifier === 'am' && hours === 12) {
      hours = 0;
    } else if (!modifier) {
      if (hours >= 1 && hours <= 7) {
        hours += 12; // Assume afternoon
      }
    }
    times.push(`${hours.toString().padStart(2, '0')}:${mins}`);
  }

  // Fallback for purely "8 AM" or "9 PM" without minutes
  if (times.length === 0) {
    const hourRegex = /\b(\d{1,2})\s*(am|pm)\b/gi;
    while ((match = hourRegex.exec(normalizedText)) !== null) {
      let hours = parseInt(match[1]!, 10);
      const modifier = match[2]!.toLowerCase();
      if (modifier === 'pm' && hours < 12) hours += 12;
      if (modifier === 'am' && hours === 12) hours = 0;
      times.push(`${hours.toString().padStart(2, '0')}:00`);
    }
  }

  // Compact timetable headers often omit minutes entirely ("9-10",
  // "12–1"). Preserve the two boundaries without inventing minutes.
  if (times.length === 0) {
    const range = normalizedText.match(/\b(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\b/i);
    if (range) {
      const normalizeBareHour = (raw: string) => {
        let hour = Number(raw);
        if (hour >= 1 && hour <= 7) hour += 12;
        return `${String(hour).padStart(2, "0")}:00`;
      };
      times.push(normalizeBareHour(range[1]!), normalizeBareHour(range[2]!));
    }
  }

  return times;
}

type Rect = { left: number; right: number; top: number; bottom: number };

function getIntersectionWidth(r1: Rect, r2: Rect): number {
  return Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
}

export function parseTimetableImage(rawWords: OCRWord[]): TimetableParseResult {
  const warnings: string[] = [];
  const words = rawWords; // Remove normalizeLetterSpacing up here, we do it in cells

  // 1. Find table boundaries to ignore metadata below
  const dayWords = words.filter(w => getDayValue(cleanText(w.text)) !== null);
  const firstDayTop = dayWords.length ? Math.min(...dayWords.map((word) => word.bbox.y0)) : Number.POSITIVE_INFINITY;
  const timeWords = words.filter((word) => {
    const text = cleanText(word.text);
    return parseAllTimes(text).length > 0
      || (/^\d{1,2}(?:\s*(?:am|pm))?$/i.test(text) && word.bbox.y0 < firstDayTop);
  });

  if (dayWords.length === 0 && timeWords.length === 0) {
    return { isTimetable: false, entries: [], gridTimeSlots: [], warnings: ["No text structure found."], missingCells: [] };
  }

  dayWords.sort((a, b) => (a.bbox.y0 + a.bbox.y1) / 2 - (b.bbox.y0 + b.bbox.y1) / 2);
  const lastDayY = dayWords.length > 0 ? dayWords[dayWords.length - 1]!.bbox.y1 : 0;
  const tableBottomY = dayWords.length > 0 ? lastDayY + 100 : Math.max(...words.map(w => w.bbox.y1)) + 100;

  const tableWords = words.filter(w => (w.bbox.y0 + w.bbox.y1) / 2 < tableBottomY);

  // 2. Identify header row Y-band
  const timeWordCenters = timeWords.filter(w => (w.bbox.y0 + w.bbox.y1) / 2 < tableBottomY).map(w => (w.bbox.y0 + w.bbox.y1) / 2);
  timeWordCenters.sort((a, b) => a - b);

  let headerCenterY = timeWordCenters[0] || 0;
  for (let i = 0; i < timeWordCenters.length; i++) {
     const band = timeWordCenters.filter(y => Math.abs(y - timeWordCenters[i]!) < 40);
     if (band.length > timeWordCenters.filter(y => Math.abs(y - headerCenterY) < 40).length) {
       headerCenterY = timeWordCenters[i]!;
     }
  }

  const headerWords = tableWords.filter(w => Math.abs((w.bbox.y0 + w.bbox.y1) / 2 - headerCenterY) < 60);
  const headerBottomY = headerWords.length > 0 ? Math.max(...headerWords.map(w => w.bbox.y1)) : 0;

  // 3. Group header chunks by X overlap
  type HeaderCandidate = { left: number; right: number; top: number; bottom: number; text: string; times: string[] };
  let headerCandidates: HeaderCandidate[] = [];

  for (const hw of headerWords) {
    const hwTimes = parseAllTimes(cleanText(hw.text));
    const isBareHeaderPart = /^\d{1,2}(?:\s*(?:am|pm))?$/i.test(hw.text.trim());
    if (hwTimes.length === 0 && hw.text !== "-" && hw.text !== "–" && hw.text !== "—" && hw.text.toLowerCase() !== "to" && !isBareHeaderPart) continue;

    const match = headerCandidates.find(c => {
       const overlap = getIntersectionWidth({ left: c.left, right: c.right, top: c.top, bottom: c.bottom }, { left: hw.bbox.x0, right: hw.bbox.x1, top: hw.bbox.y0, bottom: hw.bbox.y1 });
       const gap = Math.max(0, Math.max(c.left, hw.bbox.x0) - Math.min(c.right, hw.bbox.x1));
       const verticalCenter1 = (c.top + c.bottom) / 2;
       const verticalCenter2 = (hw.bbox.y0 + hw.bbox.y1) / 2;
       
       if (overlap > 0) return true;
       // Only merge by gap if they are on the same line and don't already have conflicting full times
       if (gap < 15 && Math.abs(verticalCenter1 - verticalCenter2) < 15) {
         if (c.times.length >= 2 && hwTimes.length >= 2) return false;
         return true;
       }
       return false;
    });

    if (match) {
      match.left = Math.min(match.left, hw.bbox.x0);
      match.right = Math.max(match.right, hw.bbox.x1);
      match.top = Math.min(match.top, hw.bbox.y0);
      match.bottom = Math.max(match.bottom, hw.bbox.y1);
      match.text += " " + hw.text;
      match.times = parseAllTimes(match.text);
    } else {
      headerCandidates.push({
        left: hw.bbox.x0,
        right: hw.bbox.x1,
        top: hw.bbox.y0,
        bottom: hw.bbox.y1,
        text: hw.text,
        times: hwTimes
      });
    }
  }

  const columns: { centerX: number; left: number; right: number; startTime: string; endTime: string }[] = [];
  for (const hc of headerCandidates) {
    if (hc.times.length < 2) continue; // STRICT VALIDATION: must have exactly start and end time.
    const startTime = hc.times[0]!;
    const endTime = hc.times[1]!;

    // Validate times
    if (startTime === endTime) continue;

    const startParts = startTime.split(":");
    const sh = Number(startParts[0]);
    const sm = Number(startParts[1]);
    const endParts = endTime.split(":");
    const eh = Number(endParts[0]);
    const em = Number(endParts[1]);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (endMins <= startMins) continue;

    const centerX = (hc.left + hc.right) / 2;
    const isDup = columns.some(c => c.startTime === startTime && c.endTime === endTime && Math.abs(c.centerX - centerX) < 100);
    if (!isDup) {
      columns.push({
        centerX,
        left: hc.left,
        right: hc.right,
        startTime,
        endTime
      });
    }
  }

  columns.sort((a, b) => a.centerX - b.centerX);

  const columnRegions: { startTime: string; endTime: string; xStart: number; xEnd: number; break: boolean }[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    const prevCol = columns[i - 1];

    if (prevCol) {
      const pMins = Number(prevCol.endTime.split(":")[0]) * 60 + Number(prevCol.endTime.split(":")[1]);
      const cMins = Number(col.startTime.split(":")[0]) * 60 + Number(col.startTime.split(":")[1]);
      if (cMins > pMins) {
        // Gap exists. Synthesize a break column.
        const gapStart = (prevCol.right + prevCol.centerX) / 2;
        const gapEnd = (col.left + col.centerX) / 2;
        
        // Adjust the prev column's end
        if (columnRegions.length > 0) {
           columnRegions[columnRegions.length - 1]!.xEnd = gapStart;
        }
        
        columnRegions.push({
          startTime: prevCol.endTime,
          endTime: col.startTime,
          xStart: gapStart,
          xEnd: gapEnd,
          break: true
        });
      }
    }

    let xStart = columnRegions.length > 0 ? columnRegions[columnRegions.length - 1]!.xEnd : col.left - 100;
    const nextCol = columns[i + 1];
    let xEnd = nextCol ? (col.right + nextCol.left) / 2 : col.right + 100;

    columnRegions.push({
      startTime: col.startTime,
      endTime: col.endTime,
      xStart,
      xEnd,
      break: false
    });
  }

  if (columnRegions.length === 0) {
      return { isTimetable: false, entries: [], gridTimeSlots: [], warnings: ["No valid headers detected."], missingCells: [] };
  }

  // 4. Resolve row boundaries
  const uniqueDays: { day: number; centerY: number }[] = [];
  for (const dw of dayWords) {
    if (dw.bbox.y0 < headerBottomY) continue; // Must be below header

    const dVal = getDayValue(cleanText(dw.text));
    if (dVal === null) continue;
    const centerY = (dw.bbox.y0 + dw.bbox.y1) / 2;

    const existing = uniqueDays.find(ud => ud.day === dVal && Math.abs(ud.centerY - centerY) < 40);
    if (!existing) uniqueDays.push({ day: dVal, centerY });
  }

  uniqueDays.sort((a, b) => a.centerY - b.centerY);

  const rowRegions: { day: number; yStart: number; yEnd: number }[] = [];
  for (let i = 0; i < uniqueDays.length; i++) {
    const d = uniqueDays[i]!;
    const prevD = uniqueDays[i - 1];
    const nextD = uniqueDays[i + 1];

    const yStart = prevD ? (d.centerY + prevD.centerY) / 2 : headerBottomY + 10;
    const yEnd = nextD ? (d.centerY + nextD.centerY) / 2 : tableBottomY;

    rowRegions.push({ day: d.day, yStart, yEnd });
    console.log(`[timetable-parser] row: Day ${d.day} y=[${yStart}, ${yEnd}]`);
  }

  // EARLY BREAK DETECTION MASK
  const nonHeaderWords = tableWords.filter(w => !headerWords.includes(w) && !dayWords.includes(w) && (w.bbox.y0 + w.bbox.y1) / 2 > headerBottomY);

  const breakWords = nonHeaderWords.filter(w => NON_CLASS_KEYWORDS.some(k => w.text.toLowerCase().includes(k)));
  for (const cr of columnRegions) {
      if (cr.break) continue; // Already synthesized as a break

      // Find break words that are primarily located within this column's X bounds
      const breaksInCol = breakWords.filter(bw => {
         const overlap = getIntersectionWidth({ left: bw.bbox.x0, right: bw.bbox.x1, top: 0, bottom: 0 }, { left: cr.xStart, right: cr.xEnd, top: 0, bottom: 0 });
         const wordWidth = bw.bbox.x1 - bw.bbox.x0;
         return wordWidth > 0 ? (overlap / wordWidth) > 0.6 : false;
      });

      // If a column explicitly contains break/lunch words mostly inside its bounds, mark the entire column as a break.
      if (breaksInCol.length > 0) {
          cr.break = true;
      }
  }

  const entries: DraftTimetableEntry[] = [];
  const gridTimeSlots = columnRegions.map((cr, i) => ({
    id: `slot-${i}`,
    label: `${cr.startTime} - ${cr.endTime}`,
    start: cr.startTime,
    end: cr.endTime,
    break: cr.break
  }));

  // CELL-FIRST PARSING
  for (const row of rowRegions) {
    // 1. collect all OCR text elements in the row
    let rowWords = nonHeaderWords.filter(w => {
       const cy = (w.bbox.y0 + w.bbox.y1) / 2;
       return cy >= row.yStart && cy < row.yEnd;
    });

    // 2. exclude break/lunch columns geometrically
    rowWords = rowWords.filter(rw => {
        let inBreak = false;
        for (const cr of columnRegions) {
            if (cr.break) {
                const overlap = getIntersectionWidth({ left: rw.bbox.x0, right: rw.bbox.x1, top: 0, bottom: 0 }, { left: cr.xStart, right: cr.xEnd, top: 0, bottom: 0 });
                const ratio = overlap / (rw.bbox.x1 - rw.bbox.x0);
                if (ratio > 0.4) inBreak = true;
            }
        }
        return !inBreak;
    });

    // 3 & 4. Assign elements to canonical column regions AND cluster them into ONE visual cell
    type CellCluster = {
        words: OCRWord[];
        left: number;
        right: number;
        top: number;
        bottom: number;
        startColIndex: number;
        endColIndex: number;
    };

    const clusters: CellCluster[] = [];

    for (const rw of rowWords) {
        // Find which columns this word intersects
        const intersects = columnRegions.map((cr, i) => {
            const overlap = getIntersectionWidth({ left: rw.bbox.x0, right: rw.bbox.x1, top: 0, bottom: 0 }, { left: cr.xStart, right: cr.xEnd, top: 0, bottom: 0 });
            return { index: i, overlap };
        }).filter(x => x.overlap > 0);

        if (intersects.length === 0) continue;
        const sortedIntersects = [...intersects].sort((a, b) => b.overlap - a.overlap);
        const mainColIndex = sortedIntersects[0]!.index;
        
        const significantIntersects = intersects.filter(x => x.overlap > 20);
        const wordStartCol = significantIntersects.length > 0 ? Math.min(...significantIntersects.map(x => x.index)) : mainColIndex;
        const wordEndCol = significantIntersects.length > 0 ? Math.max(...significantIntersects.map(x => x.index)) : mainColIndex;

        // Find existing cluster spanning this column, or adjacent
        let added = false;
        for (const cluster of clusters) {
            // Is it in the same column span, or very close horizontally?
            const colOverlap = (wordStartCol <= cluster.endColIndex && wordEndCol >= cluster.startColIndex);

            // Or horizontally very close (e.g. part of merged lab spanning columns)
            const distance = Math.max(0, Math.max(cluster.left, rw.bbox.x0) - Math.min(cluster.right, rw.bbox.x1));
            const isNear = distance < 30; // Close enough to cluster

            if (colOverlap || isNear) {
                cluster.words.push(rw);
                cluster.left = Math.min(cluster.left, rw.bbox.x0);
                cluster.right = Math.max(cluster.right, rw.bbox.x1);
                cluster.top = Math.min(cluster.top, rw.bbox.y0);
                cluster.bottom = Math.max(cluster.bottom, rw.bbox.y1);
                cluster.startColIndex = Math.min(cluster.startColIndex, wordStartCol);
                cluster.endColIndex = Math.max(cluster.endColIndex, wordEndCol);
                added = true;
                break;
            }
        }

        if (!added) {
            clusters.push({
                words: [rw],
                left: rw.bbox.x0, right: rw.bbox.x1, top: rw.bbox.y0, bottom: rw.bbox.y1,
                startColIndex: wordStartCol, endColIndex: wordEndCol
            });
        }
    }

    // 5. Build ONE TimetableEntry per cell cluster
    for (const cluster of clusters) {
        // Read order: top to bottom, left to right
        cluster.words.sort((a, b) => {
            if (Math.abs(a.bbox.y0 - b.bbox.y0) > 10) return a.bbox.y0 - b.bbox.y0; // different lines
            return a.bbox.x0 - b.bbox.x0; // same line
        });

        let fullText = "";
        for (const w of cluster.words) {
            if (fullText.endsWith("/") || fullText.endsWith("-") || fullText === "") {
                fullText += w.text;
            } else {
                fullText += " " + w.text;
            }
        }
        fullText = fullText.trim();

        // Apply letter spacing normalizer on the full cell text
        if (fullText.length > 2 && fullText.includes(" ")) {
           const parts = fullText.split(" ");
           if (parts.every(p => p.length === 1)) fullText = parts.join("");
           // Also normalize if there are mixed parts e.g. "D S A" -> "DSA"
           fullText = fullText.replace(/\b([A-Z])\s+(?=[A-Z]\b)/g, "$1");
           fullText = fullText.replace(/\b([A-Z])\s+(?=[A-Z]\b)/g, "$1"); // run twice for chains
        }

        let room: string | null = null;
        const roomMatch = fullText.match(ROOM_REGEX);
        if (roomMatch && roomMatch[1]) {
           room = roomMatch[1];
           fullText = fullText.replace(roomMatch[0], "").trim();
        }

        // Check for meaningful intersection with canonical regions for MERGED cells
        const coveredColumns = columnRegions.map((cr, i) => {
            const overlap = getIntersectionWidth({ left: cluster.left, right: cluster.right, top: 0, bottom: 0 }, { left: cr.xStart, right: cr.xEnd, top: 0, bottom: 0 });
            const crWidth = cr.xEnd - cr.xStart;
            const clusterWidth = cluster.right - cluster.left;
            const ratio = overlap / Math.min(crWidth, clusterWidth);
            return { index: i, cr, ratio, overlap };
        }).filter(x => x.ratio > 0.25 && !x.cr.break); // Significant coverage, ignore breaks

        if (coveredColumns.length === 0) continue;

        coveredColumns.sort((a, b) => a.index - b.index);
        const startCol = coveredColumns[0]!.cr;
        const endCol = coveredColumns[coveredColumns.length - 1]!.cr;

        const averageConfidence = cluster.words.reduce((a,b) => a+b.confidence, 0) / cluster.words.length;
        const needsReview = averageConfidence < 85 || fullText.length < 2;

        entries.push({
            day: row.day,
            subject: fullText,
            startTime: startCol.startTime,
            endTime: endCol.endTime, // Use the end of the last covered column!
            room,
            lecturer: null, // Left as null for now, hard to safely separate faculty without risking subject destruction
            needsReview,
            confidence: Math.max(0, Math.min(1, averageConfidence / 100)),
            sourceBounds: { x0: cluster.left, y0: cluster.top, x1: cluster.right, y1: cluster.bottom },
            columnStartIndex: coveredColumns[0]!.index,
            columnEndIndex: coveredColumns[coveredColumns.length - 1]!.index,
        });

        console.log(`[timetable-parser] cell: "${fullText}" -> Day ${row.day} -> ${startCol.startTime}-${endCol.endTime} [review=${needsReview}]`);
    }
  }

  const uniqueEntries = entries.filter((e, idx, self) =>
    idx === self.findIndex(t =>
      t.day === e.day && t.startTime === e.startTime && t.subject === e.subject
    )
  );

  // Empty slots between the first and last detected class are more likely OCR
  // misses than genuine free periods. Edge slots remain unflagged to avoid
  // treating a shorter college day as an error.
  const missingCells: MissingTimetableCell[] = [];
  for (const row of rowRegions) {
    const rowEntries = uniqueEntries.filter((entry) => entry.day === row.day);
    if (rowEntries.length < 2) continue;
    const first = Math.min(...rowEntries.map((entry) => entry.columnStartIndex));
    const last = Math.max(...rowEntries.map((entry) => entry.columnEndIndex));
    for (let columnIndex = first; columnIndex <= last; columnIndex += 1) {
      const column = columnRegions[columnIndex];
      if (!column || column.break) continue;
      const covered = rowEntries.some((entry) => columnIndex >= entry.columnStartIndex && columnIndex <= entry.columnEndIndex);
      if (!covered) {
        missingCells.push({
          day: row.day,
          startTime: column.startTime,
          endTime: column.endTime,
          reason: "possible_missing_class",
        });
      }
    }
  }

  if (missingCells.length) warnings.push(`${missingCells.length} possible missing ${missingCells.length === 1 ? "class" : "classes"} detected.`);

  return {
    isTimetable: true,
    entries: uniqueEntries,
    gridTimeSlots,
    warnings,
    missingCells,
  };
}
