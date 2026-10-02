import { env } from "../../config/env.js";

export async function analyzeTimetable(
  buffer: Buffer,
  mimeType: string,
  sourceType: "image" | "camera",
  filename?: string,
  localOcrJson?: string
): Promise<{ cloudVisionWords?: any[]; providerSummary: any }> {
  let cloudVisionWords: any[] | undefined = undefined;
  
  const providerSummary: any = {
    cloudVision: "skipped",
    localOcr: localOcrJson ? "provided" : "none"
  };

  const useEnhanced = env.TIMETABLE_ENHANCED_IMPORT !== false;

  if (useEnhanced && env.GOOGLE_CLOUD_VISION_API_KEY) {
    try {
      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_CLOUD_VISION_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: buffer.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
          }]
        }),
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        const cloudVisionData = await response.json();
        const textAnnotations = cloudVisionData.responses?.[0]?.textAnnotations;
        if (textAnnotations && textAnnotations.length > 1) {
          // Skip index 0 (which is the full combined text)
          cloudVisionWords = textAnnotations.slice(1).map((ann: any) => {
            const vertices = ann.boundingPoly.vertices;
            const xs = vertices.map((v: any) => v.x || 0);
            const ys = vertices.map((v: any) => v.y || 0);
            return {
              text: ann.description,
              confidence: 0.9, // Cloud Vision doesn't always provide word-level confidence
              bbox: {
                x0: Math.min(...xs),
                y0: Math.min(...ys),
                x1: Math.max(...xs),
                y1: Math.max(...ys),
              }
            };
          });
        }
        providerSummary.cloudVision = "success";
      } else {
        providerSummary.cloudVision = `failed_${response.status}`;
      }
    } catch (e: any) {
      providerSummary.cloudVision = `error_${e.message}`;
    }
  }

  return { cloudVisionWords, providerSummary };
}
