import type { EmotionStatus } from "./emotions";
export type Mode = "writing" | "video" | "voice";
export type Mood = "joyful" | "calm" | "reflective" | "low" | "overwhelmed";
export const moods: {
  id: Mood;
  label: string;
  face: string;
  color: string;
  value: number;
}[] = [
  { id: "joyful", label: "Joyful", face: "☀", color: "#f5dea2", value: 1 },
  { id: "calm", label: "Calm", face: "❀", color: "#c4e7d4", value: 0.55 },
  {
    id: "reflective",
    label: "Reflective",
    face: "☁",
    color: "#d8d8ed",
    value: 0,
  },
  { id: "low", label: "Low", face: "☂", color: "#cbddeb", value: -0.55 },
  {
    id: "overwhelmed",
    label: "Overwhelmed",
    face: "〰",
    color: "#f0cbbd",
    value: -0.85,
  },
];
export interface ExpressionSample {
  at: number;
  scores: Record<string, number>;
}
export interface Analysis {
  score: number;
  wordCount: number;
  keywords: string[];
  emotions: Record<string, number>;
  emotionStatus?: EmotionStatus;
  polarity?: { positive: number; negative: number; neutral: number };
  method: "local-lexicon" | "local-vader" | "local-vader-emotion";
  version?: string;
}
export interface Sticker {
  id: string;
  emoji: string;
  // Fractions of the available travel, keeping the whole sticker on the page.
  x: number;
  y: number;
  size: number;
  rotation: number;
}
export interface Decoration {
  font: string;
  paper: string;
  highlight: string;
  stickers: Sticker[];
  note: string;
}
export interface Entry {
  id: string;
  title: string;
  text: string;
  date: string;
  createdAt: string;
  mode: Mode;
  mood: Mood | null;
  analysis: Analysis;
  expressions: ExpressionSample[];
  decoration: Decoration;
  prompt?: string;
  duration?: number;
  voiceEnergy?: { average: number; peak: number; samples: number };
  recording?: Blob;
  demo?: boolean;
}
export const defaultDecoration: Decoration = {
  font: "serif",
  paper: "cream",
  highlight: "none",
  stickers: [],
  note: "",
};
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const readableDate = (date: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(date.length === 10 ? date + "T12:00:00" : date).toLocaleDateString(
    "en-US",
    opts || { month: "short", day: "numeric" },
  );
export const moodInfo = (mood: Mood | null) => moods.find((m) => m.id === mood);
