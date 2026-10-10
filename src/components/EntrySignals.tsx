import { useState } from "react";
import { analyze } from "../lib/analysis";
import { emotionDefinitions, emotionDescription, emotionLabels, type Emotion } from "../lib/emotions";
import { entryEmotions, entryEmotionDescription, joinPassages, signalWindows, transcriptAligned } from "../lib/signals";
import { summarizeAcoustics } from "../lib/mediaSignals";
import type { Entry } from "../lib/types";

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function EntrySignals({ entry, onUpdate, onSeek }: { entry: Entry; onUpdate: (entry: Entry) => Promise<void>; onSeek: (seconds: number) => void }) {
  const [editing, setEditing] = useState(false), [reviewing, setReviewing] = useState(false);
  const [labels, setLabels] = useState<Emotion[]>([]), [text, setText] = useState(entry.text);
  const [passages, setPassages] = useState(entry.transcript?.passages ?? []);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const evidence = entry.analysis.evidence;
  const aligned = transcriptAligned(entry);
  const windows = signalWindows(entry);
  const acoustic = summarizeAcoustics(entry.acoustics ?? []);
  async function update(next: Entry) {
    setBusy(true); setError("");
    try { await onUpdate(next); setEditing(false); setReviewing(false); }
    catch { setError("Your changes could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="entry-signals" aria-label="Emotion review">
    <div className="section-title"><h3>Emotions</h3><span className="tiny-tag">{entry.emotionCorrection ? "Confirmed by you" : "Text estimate"}</span></div>
    <p><strong>{entryEmotionDescription(entry)}</strong></p>
    {!entry.demo && !editing && <button className="secondary" onClick={() => { setLabels(emotionLabels(entryEmotions(entry)).map((e) => e.id)); setEditing(true); }}>Review emotion labels</button>}
    {editing && <fieldset disabled={busy} className="emotion-review"><legend>Which emotions fit this entry?</legend>
      <div className="emotion-options">{emotionDefinitions.map(({ id, label }) => <button key={id} type="button" className={`emotion-option ${labels.includes(id) ? "selected" : ""}`} aria-pressed={labels.includes(id)} onClick={() => setLabels((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}>{label}</button>)}</div>
      <p className="small-note">Choose several or clear all. Your labels replace automatic estimates in Insights, Connections, and reports.</p>
      <div className="signal-actions"><button className="text-button" onClick={() => setLabels([])}>Clear all</button><button className="primary" onClick={() => void update({ ...entry, emotionCorrection: { labels, updatedAt: new Date().toISOString() } })}>Save emotion labels</button><button className="text-button" onClick={() => setEditing(false)}>Cancel</button></div>
      {entry.emotionCorrection && <button className="text-button" onClick={() => void update({ ...entry, emotionCorrection: undefined })}>Use automatic estimates</button>}
    </fieldset>}
    {evidence && <details className="signal-evidence"><summary>Text evidence</summary>
      <p className="small-note">Evidence covers {Math.round(evidence.coverage * 100)}% of the words. Model / rule strength: {Math.round(evidence.strength * 100)}%. These measure support in the text, not the probability of how you feel. Sparse evidence has less influence on connections.</p>
      <ul className="passage-list">{evidence.segments.map((segment) => <li key={segment.start}><q>{segment.text}</q><span className="small-note">{segment.excluded ? `Excluded: ${segment.excluded.replaceAll("-", " ")}` : `${emotionDescription({ emotions: segment.emotions })} · ${segment.subject} · ${segment.time}`}</span></li>)}</ul>
    </details>}
    {entry.mode !== "writing" && !entry.demo && <>
      {!reviewing ? <button className="secondary" onClick={() => { setText(entry.text); setPassages(entry.transcript?.passages ?? []); setReviewing(true); }}>Review transcript</button> : <fieldset disabled={busy} className="transcript-review"><legend>Review transcript</legend>
        {aligned ? <><p className="small-note">Times approximate when speech was recognized. Check the recording before editing.</p>{passages.map((passage, index) => <label key={passage.id} className="transcript-passage"><span><button type="button" className="text-button" onClick={() => onSeek(passage.start)}>Play {time(passage.start)}–{time(passage.end)}</button></span><textarea aria-label={`Transcript passage ${index + 1}`} value={passage.text} onChange={(event) => setPassages((current) => current.map((p, i) => i === index ? { ...p, text: event.target.value } : p))} /></label>)}</> : <label>Transcript<textarea aria-label="Edit transcript" value={text} onChange={(event) => setText(event.target.value)} /></label>}
        <div className="signal-actions"><button className="primary" onClick={() => {
          const nextText = aligned ? joinPassages(passages) : text.trim();
          void update({ ...entry, text: nextText, analysis: analyze(nextText), transcript: aligned ? { passages, text: nextText } : undefined });
        }}>Save transcript</button><button className="text-button" onClick={() => setReviewing(false)}>Cancel</button></div>
      </fieldset>}
      {entry.transcript && !aligned && <p className="small-note">Text was edited outside its recorded passages. Timing comparisons are disabled for this transcript.</p>}
    </>}
    {!!windows.length && <details className="signal-evidence"><summary>Signals by passage</summary><ul className="passage-list">{windows.map((window) => <li key={window.passage.id}>
      <button className="text-button" onClick={() => onSeek(window.passage.start)}>{time(window.passage.start)}–{time(window.passage.end)} · approximate</button>
      <span>Text: {emotionDescription(window.analysis)}</span>
      <span>Expression: {window.faceQuality ? emotionDescription({ emotions: window.faces }) : "No usable sample"}</span>
      {window.disagreement && <span className="small-note">Signals differ. The expression estimate does not influence connections for this passage.</span>}
    </li>)}</ul></details>}
    {!!acoustic.frames && <p className="small-note">Voice measurements: {acoustic.medianPitch ? `${Math.round(acoustic.medianPitch)} Hz median pitch · ${Math.round(acoustic.pitchRange!)} Hz central pitch range · ` : ""}{Math.round(acoustic.unvoicedShare * 100)}% of sampled frames unvoiced or unclear. These measurements do not classify emotion.</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}
