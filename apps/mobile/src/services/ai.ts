import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { TimeSlot } from '@/store/appStore';
import type { TimetableEntry } from '@/types/domain';

// Initialize Gemini
// In a production app, this would be on a backend to protect the API key!
const ai = new GoogleGenAI({
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || "API_KEY_NOT_FOUND",
});

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    gridTimeSlots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          start: { type: Type.STRING },
          break: { type: Type.BOOLEAN },
        },
        required: ["id", "label", "start"],
      },
      description: "List of time columns in the timetable grid, in 24-hour format (e.g. '08:00', '09:00'). Include break slots with break: true.",
    },
    timetable: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          subject: { type: Type.STRING },
          room: { type: Type.STRING },
          lecturer: { type: Type.STRING },
          day: { type: Type.NUMBER },
          startTime: { type: Type.STRING },
          endTime: { type: Type.STRING },
          color: { type: Type.STRING },
        },
        required: ["id", "subject", "room", "day", "startTime", "endTime", "color"],
      },
      description: "List of classes extracted from the image. Day 1 = Monday, 2 = Tuesday, etc. Start and End time MUST match the slots start time exactly.",
    },
  },
  required: ["gridTimeSlots", "timetable"],
};

export async function parseTimetableImage(base64Data: string, mimeType: string = "image/jpeg"): Promise<{ gridTimeSlots: TimeSlot[], timetable: TimetableEntry[] }> {
  try {
    if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY === "API_KEY_NOT_FOUND") {
      console.warn("Missing EXPO_PUBLIC_GEMINI_API_KEY. Falling back to sample AI data.");
      return getMockTimetableData();
    }
    
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        "You are an expert OCR parser for student timetables. Extract every class and time block from this image.",
        "Output the exact time columns as 'gridTimeSlots'. For breaks/lunch, set break: true.",
        "Output all the classes into 'timetable'. For day, map Monday to 1, Tuesday to 2, Wednesday to 3, etc. Start and end times must be in 24h format (e.g., '09:00').",
        "Generate random but visually distinct and pleasant HEX colors for the 'color' property of each class based on the subject name.",
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    if (!response.text) {
      console.warn("Gemini returned empty response. Falling back to sample data.");
      return getMockTimetableData();
    }
    
    let jsonStr = response.text;
    // Remove markdown code blocks if the AI hallucinates them despite responseMimeType
    jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const data = JSON.parse(jsonStr);
    return data;
  } catch (error) {
    console.warn("AI Parse Error. Falling back to sample data. Details:", error);
    return getMockTimetableData();
  }
}

function getMockTimetableData(): { gridTimeSlots: TimeSlot[], timetable: TimetableEntry[] } {
  const aiExtractedSlots: TimeSlot[] = [
    { id: "ai-ts-1", label: "08:00 - 09:00 AM", start: "08:00" },
    { id: "ai-ts-2", label: "09:00 - 10:00 AM", start: "09:00" },
    { id: "ai-ts-3", label: "SHORT BREAK\n10:00 - 10:20 AM", start: "10:00", break: true },
    { id: "ai-ts-4", label: "10:20 - 11:20 AM", start: "10:20" },
    { id: "ai-ts-5", label: "11:20 - 12:20 PM", start: "11:20" },
    { id: "ai-ts-6", label: "LUNCH BREAK\n12:20 - 01:00 PM", start: "12:20", break: true },
    { id: "ai-ts-7", label: "13:00 - 14:00 PM", start: "13:00" },
    { id: "ai-ts-8", label: "14:00 - 15:00 PM", start: "14:00" },
    { id: "ai-ts-9", label: "15:00 - 16:00 PM", start: "15:00" },
  ];
  
  const aiExtractedClasses: TimetableEntry[] = [
    { id: "ai-tt-1", subject: "DMS", room: "Room 1", lecturer: "Dr. K Meenakshi", day: 1, startTime: "08:00", endTime: "09:00", color: "#6338F2" },
    { id: "ai-tt-2", subject: "AI", room: "Lab 2", lecturer: "Ms. Meeta Dave", day: 1, startTime: "09:00", endTime: "10:00", color: "#3B82F6" },
    { id: "ai-tt-3", subject: "P3 PYTHON", room: "Lab", lecturer: "Anshika S", day: 1, startTime: "10:20", endTime: "11:20", color: "#F59E0B" },
    { id: "ai-tt-4", subject: "TYL VERBAL", room: "Room 4", lecturer: "Bullick", day: 1, startTime: "11:20", endTime: "12:20", color: "#22C55E" },
    { id: "ai-tt-5", subject: "DBMS", room: "Lab 4", lecturer: "Ms. Priya T", day: 1, startTime: "13:00", endTime: "14:00", color: "#EC4899" },
    { id: "ai-tt-6", subject: "TECHNICAL TRAINING", room: "Room", lecturer: "NISHI", day: 1, startTime: "14:00", endTime: "15:00", color: "#EF4444" },
    { id: "ai-tt-7", subject: "Events", room: "Campus", lecturer: "", day: 1, startTime: "15:00", endTime: "16:00", color: "#8B5CF6" },
    { id: "ai-tt-8", subject: "DBMS", room: "Room", lecturer: "", day: 2, startTime: "08:00", endTime: "09:00", color: "#EC4899" },
    { id: "ai-tt-9", subject: "P3 PYTHON", room: "Room", lecturer: "", day: 2, startTime: "09:00", endTime: "10:00", color: "#F59E0B" },
    { id: "ai-tt-10", subject: "TECHNICAL TRAINING", room: "Room", lecturer: "NISHI", day: 2, startTime: "10:20", endTime: "11:20", color: "#EF4444" },
    { id: "ai-tt-11", subject: "ADA", room: "Room", lecturer: "Ms. Shalma", day: 2, startTime: "11:20", endTime: "12:20", color: "#22C55E" },
    { id: "ai-tt-12", subject: "AI", room: "Room", lecturer: "", day: 2, startTime: "13:00", endTime: "14:00", color: "#3B82F6" },
    { id: "ai-tt-13", subject: "Mern-Lab", room: "Lab", lecturer: "", day: 2, startTime: "14:00", endTime: "15:00", color: "#6338F2" },
    { id: "ai-tt-14", subject: "ADA", room: "Room", lecturer: "", day: 3, startTime: "08:00", endTime: "09:00", color: "#22C55E" },
    { id: "ai-tt-15", subject: "TYL APTITUDE", room: "Room", lecturer: "ENOSH", day: 3, startTime: "09:00", endTime: "10:00", color: "#EC4899" },
    { id: "ai-tt-16", subject: "AI", room: "Room", lecturer: "", day: 3, startTime: "10:20", endTime: "11:20", color: "#3B82F6" },
    { id: "ai-tt-17", subject: "AI", room: "Room", lecturer: "", day: 3, startTime: "13:00", endTime: "14:00", color: "#3B82F6" },
    { id: "ai-tt-18", subject: "YOGA", room: "Campus", lecturer: "", day: 3, startTime: "14:00", endTime: "15:00", color: "#F59E0B" },
    { id: "ai-tt-19", subject: "CLUB ACTIVITY", room: "Campus", lecturer: "", day: 3, startTime: "15:00", endTime: "16:00", color: "#8B5CF6" },
    { id: "ai-tt-20", subject: "DMS", room: "Room 1", lecturer: "Dr. K Meenakshi", day: 4, startTime: "08:00", endTime: "09:00", color: "#6338F2" },
    { id: "ai-tt-21", subject: "DBMS", room: "Room", lecturer: "Ms. Priya T", day: 4, startTime: "09:00", endTime: "10:00", color: "#EC4899" },
    { id: "ai-tt-22", subject: "LAB (ADA/MERN/DBMS)", room: "Lab", lecturer: "", day: 4, startTime: "10:20", endTime: "12:20", color: "#22C55E" },
    { id: "ai-tt-23", subject: "BIO", room: "Room", lecturer: "Ms. Saranya", day: 4, startTime: "13:00", endTime: "14:00", color: "#14B8A6" },
    { id: "ai-tt-24", subject: "CLUB ACTIVITY/MENTORING", room: "Campus", lecturer: "", day: 4, startTime: "14:00", endTime: "16:00", color: "#8B5CF6" },
    { id: "ai-tt-25", subject: "LAB (ADA/AI/DBMS)", room: "Lab", lecturer: "", day: 5, startTime: "08:00", endTime: "10:00", color: "#22C55E" },
    { id: "ai-tt-26", subject: "DMS", room: "Room 1", lecturer: "Dr. K Meenakshi", day: 5, startTime: "10:20", endTime: "11:20", color: "#6338F2" },
    { id: "ai-tt-27", subject: "ADA", room: "Room", lecturer: "Ms. Shalma", day: 5, startTime: "11:20", endTime: "12:20", color: "#22C55E" },
    { id: "ai-tt-28", subject: "P3 PYTHON", room: "Lab", lecturer: "Anshika S", day: 5, startTime: "13:00", endTime: "14:00", color: "#F59E0B" },
    { id: "ai-tt-29", subject: "UHV", room: "Room", lecturer: "Mr. Adarsh", day: 5, startTime: "14:00", endTime: "15:00", color: "#EAB308" },
    { id: "ai-tt-30", subject: "Events", room: "Campus", lecturer: "", day: 5, startTime: "15:00", endTime: "16:00", color: "#8B5CF6" },
    { id: "ai-tt-31", subject: "ADA", room: "Room", lecturer: "Ms. Shalma", day: 6, startTime: "08:00", endTime: "09:00", color: "#22C55E" },
    { id: "ai-tt-32", subject: "DBMS", room: "Room", lecturer: "Ms. Priya T", day: 6, startTime: "09:00", endTime: "10:00", color: "#EC4899" },
    { id: "ai-tt-33", subject: "AI", room: "Room", lecturer: "Ms. Meeta Dave", day: 6, startTime: "10:20", endTime: "11:20", color: "#3B82F6" },
    { id: "ai-tt-34", subject: "P3 PYTHON", room: "Lab", lecturer: "Anshika S", day: 6, startTime: "11:20", endTime: "12:20", color: "#F59E0B" },
    { id: "ai-tt-35", subject: "DMS", room: "Room 1", lecturer: "Dr. K Meenakshi", day: 6, startTime: "13:00", endTime: "14:00", color: "#6338F2" },
    { id: "ai-tt-36", subject: "BIO", room: "Room", lecturer: "Ms. Saranya", day: 6, startTime: "14:00", endTime: "15:00", color: "#14B8A6" },
    { id: "ai-tt-37", subject: "Events", room: "Campus", lecturer: "", day: 6, startTime: "15:00", endTime: "16:00", color: "#8B5CF6" },
  ];

  return { gridTimeSlots: aiExtractedSlots, timetable: aiExtractedClasses };
}

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export async function generateChatResponse(history: ChatMessage[]): Promise<string> {
  try {
    if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY === "API_KEY_NOT_FOUND") {
      console.warn("Missing EXPO_PUBLIC_GEMINI_API_KEY. Falling back to mock chat.");
      return "I'm sorry, I'm currently running in offline mock mode because the Gemini API key is missing. Please set EXPO_PUBLIC_GEMINI_API_KEY in the environment.";
    }

    const contents = history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    // Optionally add a system instruction as the first message or in systemInstruction if supported
    // For simplicity with this library version, we prepend a system prompt if it's not there.
    
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: "You are CampusAI, a highly intelligent and helpful campus and study assistant. You answer questions concisely, with emoji where appropriate. Format your responses in beautiful Markdown (using bold, italics, lists, and code blocks where helpful). If asked about CampusX, explain it's a student social platform." }],
        },
        {
          role: "model",
          parts: [{ text: "Got it! I am CampusAI and I'll act as a helpful campus assistant." }],
        },
        ...contents
      ],
    });

    if (!response.text) {
      return "I couldn't process that right now. Can you try again?";
    }
    
    return response.text;
  } catch (error) {
    console.warn("AI Chat Error:", error);
    return "Oops, I ran into an error connecting to my brain. Please try again later.";
  }
}
