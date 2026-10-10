import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Flower2,
  Highlighter,
  LockKeyhole,
  Mic,
  Shuffle,
  Sparkles,
  Square,
  StickyNote,
  Video,
  Camera,
  X,
  PauseCircle,
  Save,
} from "lucide-react";
import {
  type Decoration,
  type Entry,
  type Mode,
  type Mood,
  defaultDecoration,
  localDate,
  moods,
} from "../lib/types";
import { analyze } from "../lib/analysis";
import { nextPrompt } from "../lib/prompts";
import { useCapture } from "../lib/useCapture";
import { MoodFace } from "./Illustrations";
import { Modal } from "./Modal";

interface Draft {
  title: string;
  text: string;
  date: string;
  mood: Mood | null;
  decoration: Decoration;
  prompt: string;
}
function loadDraft(mode: Mode): Draft {
  const fallback = {
    title: "",
    text: "",
    date: localDate(),
    mood: null,
    decoration: { ...defaultDecoration, stickers: [] },
    prompt: "",
  };
  try {
    const raw = JSON.parse(
      localStorage.getItem(`leap-draft-${mode}`) || "null",
    );
    if (
      raw &&
      typeof raw.text === "string" &&
      typeof raw.title === "string" &&
      raw.decoration &&
      Array.isArray(raw.decoration.stickers)
    )
      return { ...fallback, ...raw };
  } catch {
    /* Start fresh if a draft cannot be read. */
  }
  return fallback;
}
export function Editor({
  mode,
  onBack,
  onSave,
  initialMood,
  initialPrompt,
}: {
  mode: Mode;
  onBack: () => void;
  onSave: (e: Entry) => Promise<void>;
  initialMood: Mood | null;
  initialPrompt?: string;
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    const d = loadDraft(mode);
    return {
      ...d,
      mood: initialMood || d.mood,
      prompt: initialPrompt || d.prompt,
    };
  });
  const [draftStatus, setDraftStatus] = useState("Draft saved on this device"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [camera, setCamera] = useState(false),
    [transcribe, setTranscribe] = useState(false),
    [tool, setTool] = useState(""),
    [confirmLeave, setConfirmLeave] = useState(false),
    [confirmRedo, setConfirmRedo] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const savedRef = useRef(false);
  const capture = useCapture(mode, (text) =>
    setDraft((d) => ({ ...d, text: d.text + (d.text ? " " : "") + text })),
  );
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const decorate = (patch: Partial<Decoration>) =>
    setDraft((d) => ({ ...d, decoration: { ...d.decoration, ...patch } }));
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`leap-draft-${mode}`, JSON.stringify(draft));
        setDraftStatus("Draft saved on this device");
      } catch {
        setDraftStatus(
          "Draft could not autosave. Complete your entry to save it.",
        );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, mode]);
  useEffect(() => {
    if (!capture.blob) {
      setRecordingUrl("");
      return;
    }
    const url = URL.createObjectURL(capture.blob);
    setRecordingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [capture.blob]);
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if ((capture.active || capture.blob) && !savedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [capture.active, capture.blob]);
  const save = async () => {
    if (saving || capture.active || capture.loading) return;
    if (!draft.text.trim() && !capture.blob) {
      setError(
        mode === "writing"
          ? "Add a few words before completing your entry."
          : "Make a recording or add a transcript before completing your entry.",
      );
      return;
    }
    if (!draft.date || draft.date > localDate()) {
      setError("Choose today or a past date for your entry.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const entry: Entry = {
        id: crypto.randomUUID(),
        title: draft.title.trim() || "Untitled entry",
        text: draft.text.trim(),
        date: draft.date,
        createdAt: new Date().toISOString(),
        mode,
        mood: draft.mood,
        analysis: analyze(draft.text),
        expressions: capture.getExpressions(),
        decoration: draft.decoration,
        prompt: draft.prompt || undefined,
        recording: capture.blob || undefined,
        duration: capture.seconds || undefined,
        voiceEnergy: capture.getVoiceEnergy(),
      };
      await onSave(entry);
      savedRef.current = true;
      try {
        localStorage.removeItem(`leap-draft-${mode}`);
      } catch {
        /* The entry itself was saved successfully. */
      }
    } catch {
      setError(
        "Your entry could not be saved. Your draft is still here. Free up some browser storage and try again.",
      );
      setSaving(false);
    }
  };
  function back() {
    try {
      localStorage.setItem(`leap-draft-${mode}`, JSON.stringify(draft));
    } catch {
      setError(
        "Your draft could not be saved. Complete your entry before leaving this page.",
      );
      return;
    }
    if (capture.active || capture.blob) setConfirmLeave(true);
    else onBack();
  }
  const count = draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0;
  return (
    <div className="editor-page page-enter">
      <div className="editor-heading">
        <button className="text-button" onClick={back}>
          <ArrowLeft size={17} />
          Back to your space
        </button>
        <span className="subtle desktop-only">
          <LockKeyhole size={13} />
          {draftStatus}
        </span>
      </div>
      <div className="page-heading">
        <div>
          <h1>
            {mode === "writing"
              ? "Writing journal"
              : mode === "video"
                ? "Video journal"
                : "Voice memo"}
          </h1>
        </div>
        <button
          className="primary"
          onClick={save}
          disabled={saving || capture.active || capture.loading}
        >
          <Check size={18} />
          {saving ? "Saving…" : "Complete entry"}
        </button>
      </div>
      <div className="editor-layout">
        <div className="editor-main">
          <div className="prompt-ribbon">
            <Sparkles size={19} />
            <div>
              <span className="eyebrow">JOURNAL PROMPT</span>
              <p>
                {draft.prompt ||
                  "What’s taking up a little space in your mind today?"}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Shuffle journal prompt"
              onClick={() => set({ prompt: nextPrompt(mode, draft.prompt) })}
            >
              <Shuffle size={18} />
            </button>
          </div>
          {mode === "writing" ? (
            <div className="writing-toolbar" aria-label="Decorate your journal">
              <label className="font-picker">
                <span className="sr-only">Journal font</span>
                <select
                  value={draft.decoration.font}
                  onChange={(e) => decorate({ font: e.target.value })}
                >
                  <option value="serif">Aa · Storybook</option>
                  <option value="sans">Aa · Everyday</option>
                  <option value="handwritten">Aa · Handwritten</option>
                  <option value="mono">Aa · Typewriter</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <span className="toolbar-divider" />
              <button
                className={tool === "highlight" ? "tool active" : "tool"}
                onClick={() => setTool(tool === "highlight" ? "" : "highlight")}
              >
                <Highlighter size={17} />
                <span>Highlight</span>
              </button>
              <button
                className={tool === "stickers" ? "tool active" : "tool"}
                onClick={() => setTool(tool === "stickers" ? "" : "stickers")}
              >
                <Flower2 size={17} />
                <span>Stickers</span>
              </button>
              <button
                className={tool === "note" ? "tool active" : "tool"}
                onClick={() => {
                  setTool(tool === "note" ? "" : "note");
                }}
              >
                <StickyNote size={17} />
                <span>Sticky note</span>
              </button>
              <div className="paper-swatches">
                {["cream", "mint", "lavender", "rose"].map((c) => (
                  <button
                    key={c}
                    className={`swatch ${c} ${draft.decoration.paper === c ? "selected" : ""}`}
                    aria-label={`${c} paper`}
                    aria-pressed={draft.decoration.paper === c}
                    onClick={() => decorate({ paper: c })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <section className="recording-card">
              <div
                className={`camera-stage ${mode === "voice" ? "voice-stage" : ""}`}
              >
                <video
                  ref={
                    mode === "video" || camera ? capture.videoRef : undefined
                  }
                  muted
                  autoPlay
                  playsInline
                  className={
                    capture.active && (mode === "video" || camera)
                      ? "live-video"
                      : "hidden-video"
                  }
                  aria-label="Live camera preview"
                />
                {!capture.active && !recordingUrl && (
                  <div className="recording-idle">
                    <span className="recording-icon">
                      {mode === "video" ? (
                        <Video size={36} />
                      ) : (
                        <Mic size={36} />
                      )}
                    </span>
                    <h2>Ready to record</h2>
                  </div>
                )}
                {capture.active && mode === "voice" && !camera && (
                  <div
                    className="voice-wave"
                    aria-label="Microphone input level"
                  >
                    {Array.from({ length: 35 }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          height:
                            12 +
                            capture.level *
                              120 *
                              (0.3 + Math.abs(Math.sin(i * 2.4))),
                        }}
                      />
                    ))}
                  </div>
                )}
                {recordingUrl &&
                  (mode === "video" ? (
                    <video
                      controls
                      src={recordingUrl}
                      className="recording-playback"
                      aria-label="Review your video recording"
                    />
                  ) : (
                    <div className="audio-playback">
                      <Mic size={40} />
                      <h2>Your words, held here.</h2>
                      <audio
                        controls
                        src={recordingUrl}
                        aria-label="Review your voice recording"
                      />
                    </div>
                  ))}
                {capture.active && (
                  <span className="recording-badge">
                    <i />
                    Recording · {Math.floor(capture.seconds / 60)}:
                    {String(capture.seconds % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
              <div className="recording-controls">
                <span className="subtle">
                  {capture.blob
                    ? "Listen back before you save."
                    : "Up to 10 minutes · saved on this device"}
                </span>
                {capture.active ? (
                  <button className="stop-button" onClick={capture.stop}>
                    <Square size={15} fill="currentColor" />
                    Stop recording
                  </button>
                ) : capture.blob ? (
                  <button
                    className="secondary"
                    onClick={() => setConfirmRedo(true)}
                  >
                    Record again
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={capture.loading}
                    onClick={() => capture.start({ camera, transcribe })}
                  >
                    {mode === "video" ? <Video size={17} /> : <Mic size={17} />}{" "}
                    {capture.loading ? "Connecting…" : "Start recording"}
                  </button>
                )}
              </div>
            </section>
          )}
          {tool && mode === "writing" && (
            <div className="tool-tray">
              {tool === "highlight" ? (
                <>
                  <span>Highlight your page text</span>
                  {["none", "yellow", "green", "pink"].map((c) => (
                    <button
                      key={c}
                      onClick={() => decorate({ highlight: c })}
                      className={`color-option highlight-${c} ${draft.decoration.highlight === c ? "selected" : ""}`}
                    >
                      {c === "none" ? "None" : c}
                    </button>
                  ))}
                </>
              ) : tool === "stickers" ? (
                <>
                  <span>Decorations</span>
                  {[
                    "🌼",
                    "🌿",
                    "🍓",
                    "✨",
                    "🦋",
                    "🌷",
                    "🍋",
                    "💌",
                    "🌙",
                    "🍄",
                  ].map((s) => (
                    <button
                      key={s}
                      className="sticker-option"
                      aria-label={`Add ${s} sticker`}
                      disabled={draft.decoration.stickers.length >= 8}
                      onClick={() =>
                        decorate({
                          stickers: [...draft.decoration.stickers, s],
                        })
                      }
                    >
                      {s}
                    </button>
                  ))}
                </>
              ) : (
                <label className="note-editor">
                  A note in the margin
                  <textarea
                    maxLength={250}
                    value={draft.decoration.note}
                    onChange={(e) => decorate({ note: e.target.value })}
                    placeholder="Something worth keeping close…"
                  />
                </label>
              )}
            </div>
          )}
          <div
            className={`journal-paper paper-${draft.decoration.paper} font-${draft.decoration.font}`}
          >
            <div className="paper-meta">
              <span>
                {mode === "writing"
                  ? "DEAR JOURNAL"
                  : "YOUR TRANSCRIPT & NOTES"}
              </span>
              <label>
                <span className="sr-only">Entry date</span>
                <input
                  type="date"
                  value={draft.date}
                  max={localDate()}
                  onChange={(e) => set({ date: e.target.value })}
                />
              </label>
            </div>
            <input
              className="entry-title-input"
              aria-label="Entry title"
              placeholder="Entry title"
              maxLength={150}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            <textarea
              className={`entry-textarea highlight-${draft.decoration.highlight}`}
              aria-label={
                mode === "writing" ? "Journal entry" : "Transcript and notes"
              }
              placeholder={
                mode === "writing"
                  ? "Write your entry…"
                  : "Your live transcript will appear here if enabled. You can also type or paste a transcript, or add a few notes…"
              }
              value={draft.text}
              onChange={(e) => set({ text: e.target.value })}
            />
            {draft.decoration.stickers.length > 0 && (
              <div className="paper-stickers">
                {draft.decoration.stickers.map((s, i) => (
                  <button
                    key={i}
                    aria-label={`Remove ${s} sticker`}
                    onClick={() =>
                      decorate({
                        stickers: draft.decoration.stickers.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                    style={{ transform: `rotate(${i % 2 ? -9 : 8}deg)` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {draft.decoration.note && (
              <div className="sticky-note">{draft.decoration.note}</div>
            )}
            <div className="paper-footer">
              <span>
                {count} {count === 1 ? "word" : "words"}
              </span>
            </div>
          </div>
          {(error || capture.error) && (
            <div className="error-message" role="alert">
              {error || capture.error}
            </div>
          )}
        </div>
        <aside className="editor-aside">
          <section className="card feeling-card">
            <h3>Mood (optional)</h3>
            <div className="mood-options vertical">
              {moods.map((m) => (
                <button
                  key={m.id}
                  aria-pressed={draft.mood === m.id}
                  className={draft.mood === m.id ? "selected" : ""}
                  onClick={() =>
                    set({ mood: draft.mood === m.id ? null : m.id })
                  }
                >
                  <MoodFace mood={m.id} size={30} />
                  <span>{m.label}</span>
                  {draft.mood === m.id && <Check size={16} />}
                </button>
              ))}
            </div>
          </section>
          <section className="card expression-card">
            <div className="section-title">
              <Camera size={19} />
              <h3>Camera analysis</h3>
            </div>
            <p>Add optional facial-expression estimates to this entry.</p>
            <label className="toggle-label">
              <span>Expression tracking</span>
              <input
                type="checkbox"
                checked={camera}
                disabled={capture.active || capture.loading}
                onChange={(e) => setCamera(e.target.checked)}
              />
            </label>
            {mode === "writing" && camera && (
              <>
                <video
                  ref={capture.videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={
                    capture.active ? "expression-preview" : "hidden-video"
                  }
                  aria-label="Expression tracking preview"
                />
                <button
                  className="secondary full-width"
                  disabled={capture.loading}
                  onClick={() =>
                    capture.active
                      ? capture.stop()
                      : capture.start({ camera: true, transcribe: false })
                  }
                >
                  {capture.active ? (
                    <>
                      <PauseCircle size={16} />
                      Stop camera
                    </>
                  ) : (
                    <>
                      <Camera size={16} />
                      {capture.loading ? "Connecting…" : "Enable camera"}
                    </>
                  )}
                </button>
              </>
            )}
            {(camera || capture.sampleCount > 0) && (
              <span className="capture-status">
                {capture.faceStatus}
                {capture.sampleCount > 0
                  ? ` · ${capture.sampleCount} samples`
                  : ""}
              </span>
            )}
            <p className="small-note">
              Processed on your device. Expressions are imperfect signals, not a
              reading of how you feel.{" "}
              {mode === "voice"
                ? "Camera video is not saved with voice memos."
                : ""}
            </p>
            {mode !== "writing" && (
              <>
                <div className="divider" />
                <label className="toggle-label">
                  <span>Live transcription</span>
                  <input
                    type="checkbox"
                    checked={transcribe}
                    disabled={
                      capture.active ||
                      capture.loading ||
                      !capture.speechSupported
                    }
                    onChange={(e) => setTranscribe(e.target.checked)}
                  />
                </label>
                <p className="small-note">
                  {capture.speechSupported
                    ? "Opt-in: your browser may send audio to its speech service. English transcription; edit it before saving."
                    : "Live transcription is not supported here. You can add a transcript manually."}
                </p>
              </>
            )}
          </section>
        </aside>
      </div>
      {confirmLeave && (
        <Modal title="Leave this entry?" onClose={() => setConfirmLeave(false)}>
          <p>
            {mode === "writing"
              ? "Your text draft is saved. Leave now to discard the expression samples from this camera session, or keep journalling to complete the entry."
              : "Your text draft is saved, but this recording has not been saved as an entry. Leaving will discard the recording."}
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() => setConfirmLeave(false)}
            >
              Keep journalling
            </button>
            <button
              className="danger"
              onClick={() => {
                capture.stop();
                onBack();
              }}
            >
              {mode === "writing"
                ? "Discard samples & leave"
                : "Discard recording & leave"}
            </button>
          </div>
        </Modal>
      )}
      {confirmRedo && (
        <Modal
          title="Make another recording?"
          onClose={() => setConfirmRedo(false)}
        >
          <p>
            This will replace the unsaved recording and clear its transcript.
            Your title, mood, and decorations will stay.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setConfirmRedo(false)}>
              Keep this recording
            </button>
            <button
              className="primary"
              onClick={() => {
                capture.reset();
                set({ text: "" });
                setConfirmRedo(false);
              }}
            >
              Record again
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
