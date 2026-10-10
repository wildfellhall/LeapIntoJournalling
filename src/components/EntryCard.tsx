import { ArrowUpRight, Mic, PenLine, Video } from "lucide-react";
import { type Entry, moodInfo, readableDate } from "../lib/types";
import { emotionLabels } from "../lib/emotions";
import { entryEmotions, entryEmotionDescription } from "../lib/signals";
import { MoodFace } from "./Illustrations";
export function EntryCard({
  entry,
  onOpen,
}: {
  entry: Entry;
  onOpen: (entry: Entry) => void;
}) {
  const Icon =
      entry.mode === "video" ? Video : entry.mode === "voice" ? Mic : PenLine,
    mood = moodInfo(entry.mood),
    emotions = emotionLabels(entryEmotions(entry));
  return (
    <button
      className={`entry-card paper-${entry.decoration.paper}`}
      onClick={() => onOpen(entry)}
    >
      <div className="entry-card-meta">
        <span>
          {readableDate(entry.date, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <Icon size={16} />
      </div>
      <h3>{entry.title}</h3>
      <p>{entry.text || "No text or transcript saved."}</p>
      <div className="entry-card-footer">
        {mood ? (
          <span className="mood-label">
            <MoodFace mood={mood.id} size={21} />
            {mood.label}
          </span>
        ) : (
          <span className="mood-label">
            {emotions.length > 0 &&
              `${entry.emotionCorrection ? "Your labels" : "Text estimate"}: `}
            {entryEmotionDescription(entry)}
          </span>
        )}
        <ArrowUpRight size={18} />
      </div>
    </button>
  );
}
