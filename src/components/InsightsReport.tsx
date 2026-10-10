import { useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import { Modal } from "./Modal";
import type { InsightsSummary } from "../lib/insights";
import { readableDate } from "../lib/types";

export function InsightsReport({
  summary,
  onClose,
}: {
  summary: InsightsSummary;
  onClose: () => void;
}) {
  const [includeEntries, setIncludeEntries] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    setDownloaded(false);
    try {
      const { downloadInsightsReport } = await import("../lib/insightsPdf");
      await downloadInsightsReport(summary, { includeEntries, note });
      setDownloaded(true);
    } catch {
      setError(
        "The PDF couldn't be created. Reload the page to try again. Your journal is still saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  const fullDate = (date: string) =>
    readableDate(date, { month: "short", day: "numeric", year: "numeric" });
  return (
    <Modal
      title="Download insights report"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>
        A readable report for a therapist, someone you trust, or an AI
        conversation. Text stays selectable and charts include their exact
        values.
      </p>
      <div className="report-scope">
        <FileText size={23} aria-hidden="true" />
        <div>
          <strong>
            {summary.sample ? "Sample journal report" : summary.rangeLabel}
          </strong>
          <span>
            {fullDate(summary.start)} – {fullDate(summary.end)}
          </span>
          <span>
            {summary.filtered.length}{" "}
            {summary.filtered.length === 1 ? "entry" : "entries"} ·{" "}
            {summary.days} {summary.days === 1 ? "day" : "days"} with entries
          </span>
        </div>
      </div>
      <p className="report-contents">
        Includes mood check-ins, text emotions, trends, recurring words, daily values, and an
        explanation of how the estimates work.
      </p>
      <label className="report-option">
        <input
          type="checkbox"
          checked={includeEntries}
          disabled={busy}
          onChange={(event) => setIncludeEntries(event.target.checked)}
        />
        <span>
          <strong>Include journal entries and transcripts</strong>
          <small>
            Adds the full titles and text from this date range. Recordings,
            camera data, and decorative notes stay out of the report.
          </small>
        </span>
      </label>
      <label className="report-note" htmlFor="report-note">
        Note for the reader <span>(optional)</span>
      </label>
      <textarea
        id="report-note"
        rows={3}
        maxLength={600}
        value={note}
        disabled={busy}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What would you like to explore together? Add any context that the numbers might miss."
      />
      <p className="report-local">
        Created on your device. You choose where to share the downloaded file.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <p className="report-status" role="status">
        {busy
          ? "Preparing your PDF…"
          : downloaded
            ? "Your PDF is ready. Check your downloads."
            : ""}
      </p>
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Close
        </button>
        <button className="primary" disabled={busy} onClick={download}>
          {busy ? (
            <LoaderCircle size={17} className="report-spinner" />
          ) : (
            <Download size={17} />
          )}
          {busy ? "Preparing PDF…" : "Download PDF"}
        </button>
      </div>
    </Modal>
  );
}
