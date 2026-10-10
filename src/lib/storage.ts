import { type Entry, moods } from "./types";
import { normalizeStickers, validStoredStickers } from "./stickers";
import { analyze, upgradeAnalysis } from "./analysis";
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("leap-journal", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("entries", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = undefined;
      reject(request.error);
    };
  }));
}
export async function getEntries(): Promise<Entry[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction("entries").objectStore("entries").getAll();
    req.onsuccess = () =>
      resolve(
        req.result
          .map((e: Entry) => ({
            ...e,
            analysis: upgradeAnalysis(e),
            decoration: {
              ...e.decoration,
              stickers: normalizeStickers(e.decoration.stickers),
            },
          }))
          .sort(
            (a: Entry, b: Entry) =>
              b.date.localeCompare(a.date) ||
              b.createdAt.localeCompare(a.createdAt),
          ),
      );
    req.onerror = () => reject(req.error);
  });
}
export async function saveEntries(entries: Entry[]) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("entries", "readwrite");
    entries.forEach((e) => tx.objectStore("entries").put(e));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Saving was interrupted."));
  });
}
export async function deleteEntry(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("entries", "readwrite");
    tx.objectStore("entries").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
const blobToData = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
export async function exportEntries(entries: Entry[]) {
  const records = await Promise.all(
    entries.map(async ({ recording, ...rest }) => ({
      ...rest,
      recording: recording ? await blobToData(recording) : null,
    })),
  );
  const blob = new Blob(
    [
      JSON.stringify({
        format: "leap-journal",
        version: 2,
        exportedAt: new Date().toISOString(),
        entries: records,
      }),
    ],
    { type: "application/json" },
  );
  downloadBlob(
    blob,
    `leap-journal-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function validateEntry(e: Omit<Entry, "recording">) {
  if (
    !e ||
    typeof e.id !== "string" ||
    e.id.length > 100 ||
    typeof e.title !== "string" ||
    typeof e.text !== "string" ||
    !["writing", "video", "voice"].includes(e.mode) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
    !Number.isFinite(Date.parse(e.date)) ||
    !Number.isFinite(Date.parse(e.createdAt)) ||
    (e.mood !== null && !moods.some((m) => m.id === e.mood))
  )
    throw new Error("The backup contains an invalid entry.");
  if (
    !e.analysis ||
    !Number.isFinite(e.analysis.score) ||
    Math.abs(e.analysis.score) > 1 ||
    !Number.isInteger(e.analysis.wordCount) ||
    e.analysis.wordCount < 0 ||
    !Array.isArray(e.analysis.keywords) ||
    !e.analysis.keywords.every((k) => typeof k === "string")
  )
    throw new Error("The backup contains invalid analysis.");
  if (
    !Array.isArray(e.expressions) ||
    !e.expressions.every(
      (s) =>
        s &&
        Number.isFinite(s.at) &&
        s.scores &&
        Object.values(s.scores).every(
          (n) =>
            typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
        ),
    )
  )
    throw new Error("The backup contains invalid expression data.");
  if (
    !e.decoration ||
    !["serif", "sans", "handwritten", "mono"].includes(e.decoration.font) ||
    !["cream", "mint", "lavender", "rose"].includes(e.decoration.paper) ||
    !["none", "yellow", "green", "pink"].includes(e.decoration.highlight) ||
    typeof e.decoration.note !== "string" ||
    !validStoredStickers(e.decoration.stickers)
  )
    throw new Error("The backup contains invalid decoration data.");
}
export async function importEntries(file: File) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Please choose a backup smaller than 100 MB.");
  const data = JSON.parse(await file.text());
  if (
    data.format !== "leap-journal" ||
    ![1, 2].includes(data.version) ||
    !Array.isArray(data.entries) ||
    data.entries.length > 10000
  )
    throw new Error("Please choose a Leap journal backup.");
  const entries: Entry[] = await Promise.all(
    data.entries.map(
      async (raw: Omit<Entry, "recording"> & { recording?: string }) => {
        validateEntry(raw);
        const { recording, ...rest } = raw;
        if (
          recording &&
          (typeof recording !== "string" ||
            !/^data:(audio|video)\/[a-z0-9.+;-]+;base64,/i.test(recording))
        )
          throw new Error("The backup has an unsupported recording.");
        let blob: Blob | undefined;
        if (recording) {
          const split = recording.indexOf(","),
            type = recording.slice(5, recording.indexOf(";base64,"));
          const bytes = Uint8Array.from(atob(recording.slice(split + 1)), (c) =>
            c.charCodeAt(0),
          );
          blob = new Blob([bytes], { type });
        }
        return {
          ...rest,
          // Derive current labels from the original text, not imported scores.
          analysis: analyze(rest.text),
          decoration: {
            ...rest.decoration,
            stickers: normalizeStickers(rest.decoration.stickers),
          },
          demo: false,
          recording: blob,
        };
      },
    ),
  );
  // Validate the entire file before opening the atomic write transaction.
  await saveEntries(entries);
  return entries.length;
}
