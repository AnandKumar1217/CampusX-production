import { OCRWord } from './timetableImageParser';

export async function processTimetableImageLocal(imageUri: string): Promise<{ words: OCRWord[], rawText: string, blocksCount: number, linesCount: number }> {
  const startTime = Date.now();
  console.log("[TT MLKIT] scan started");

  const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
  const result = await TextRecognition.recognize(imageUri);

  const words: OCRWord[] = [];
  let linesCount = 0;

  for (const block of result.blocks) {
    for (const line of block.lines) {
      linesCount++;
      // If elements exist, use them. If not (or if we prefer joining), we can use lines.
      // But for timetable grid parsing, line-level is often safer if elements are fragmented,
      // or element-level if words are spaced widely. Let's try to extract elements,
      // fallback to line if elements array is empty.

      const parts = line.elements && line.elements.length > 0 ? line.elements : [line];

      for (const part of parts) {
        if (!part.text || part.text.trim().length === 0) continue;

        // frame is typically { top, left, width, height } or similar bounding struct
        const frame = (part as any).frame || (part as any).boundingBox;

        if (frame) {
          const left = frame.left ?? frame.x ?? 0;
          const top = frame.top ?? frame.y ?? 0;
          const width = frame.width ?? 0;
          const height = frame.height ?? 0;

          const rawConfidence = (part as any).confidence ?? (line as any).confidence ?? (block as any).confidence;
          const normalizedConfidence = typeof rawConfidence === "number"
            ? (rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence)
            : 80;

          words.push({
            text: part.text,
            // Some native ML Kit wrappers omit confidence. Treat omission as
            // uncertain instead of manufacturing high confidence.
            confidence: Math.max(0, Math.min(100, normalizedConfidence)),
            bbox: {
              x0: left,
              y0: top,
              x1: left + width,
              y1: top + height
            }
          });
        }
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[TT MLKIT] full text length=${result.text?.length || 0}`);
  console.log(`[TT MLKIT] blocks=${result.blocks?.length || 0}`);
  console.log(`[TT MLKIT] lines=${linesCount}`);
  console.log(`[TT MLKIT] scan completed ${duration}ms`);

  return {
    words,
    rawText: result.text || "",
    blocksCount: result.blocks?.length || 0,
    linesCount
  };
}
