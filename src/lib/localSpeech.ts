// Experimental Web Speech types, isolated so unsupported browsers fail closed.
export interface Recognition {
  processLocally: boolean;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Options = { langs: string[]; processLocally: true };
interface Constructor {
  new (): Recognition;
  available?: (options: Options) => Promise<string>;
  install?: (options: Options) => Promise<boolean>;
}
export type SpeechAvailability = "checking" | "available" | "downloadable" | "downloading" | "unavailable";
export const speechOptions: Options = { langs: ["en-US"], processLocally: true };
function constructor(): Constructor | undefined {
  const w = window as Window & { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}
export function localRecognition() {
  const Ctor = constructor();
  if (!Ctor?.available) return null;
  const recognition = new Ctor();
  if (!("processLocally" in recognition)) return null;
  recognition.processLocally = true;
  if (recognition.processLocally !== true) return null;
  recognition.lang = "en-US";
  return recognition;
}
export async function speechAvailability(): Promise<SpeechAvailability> {
  try {
    if (!localRecognition()) return "unavailable";
    const status = await constructor()!.available!(speechOptions);
    return ["available", "downloadable", "downloading"].includes(status) ? status as SpeechAvailability : "unavailable";
  } catch { return "unavailable"; }
}
export async function installSpeechPack() {
  const Ctor = constructor();
  if (!Ctor?.install || !localRecognition()) return false;
  return Ctor.install(speechOptions);
}
