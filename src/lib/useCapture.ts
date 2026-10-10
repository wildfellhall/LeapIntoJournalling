import { useEffect, useRef, useState } from "react";
import type { ExpressionSample, Mode } from "./types";
// The Web Speech API is not yet part of the standard TypeScript DOM definitions.
interface SpeechResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useCapture(mode: Mode, onTranscript: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null),
    streamRef = useRef<MediaStream | null>(null),
    recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<Recognition | null>(null),
    intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    contextRef = useRef<AudioContext | null>(null);
  const activeRef = useRef(false),
    mounted = useRef(true),
    samplesRef = useRef<ExpressionSample[]>([]),
    energiesRef = useRef<number[]>([]),
    startRef = useRef(0),
    transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;
  const [active, setActive] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [faceStatus, setFaceStatus] = useState("Camera off");
  const [seconds, setSeconds] = useState(0),
    [blob, setBlob] = useState<Blob | null>(null),
    [level, setLevel] = useState(0),
    [sampleCount, setSampleCount] = useState(0);
  const speechSupported = !!(
    (window as SpeechWindow).SpeechRecognition ||
    (window as SpeechWindow).webkitSpeechRecognition
  );
  function release() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    clearInterval(intervalRef.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }
  function stop() {
    activeRef.current = false;
    const recorder = recorderRef.current;
    const finishing = !!recorder && recorder.state !== "inactive";
    if (finishing) recorder!.stop();
    else release();
    setActive(false);
    setLoading(finishing);
    setLevel(0);
    setFaceStatus("Camera off");
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRef.current = false;
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      release();
    };
  }, []);
  async function trackExpressions() {
    try {
      setFaceStatus("Loading expression model…");
      const { default: Human } = await import("@vladmandic/human");
      if (!activeRef.current) return;
      const human = new Human({
        modelBasePath: "/models/",
        backend: "webgl",
        cacheSensitivity: 0,
        face: {
          enabled: true,
          detector: { rotation: false, maxDetected: 1 },
          mesh: { enabled: false },
          iris: { enabled: false },
          description: { enabled: false },
          emotion: { enabled: true },
          antispoof: { enabled: false },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        segmentation: { enabled: false },
      });
      await human.load();
      while (activeRef.current && mounted.current) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          const result = await human.detect(video);
          if (!activeRef.current) break;
          const face = result.face[0];
          if (face?.emotion?.length) {
            const scores = Object.fromEntries(
              face.emotion.map((e) => [e.emotion, e.score]),
            );
            samplesRef.current.push({
              at: (Date.now() - startRef.current) / 1000,
              scores,
            });
            setSampleCount(samplesRef.current.length);
            setFaceStatus("Expression estimates active");
          } else setFaceStatus("Looking for your face…");
        }
        await new Promise((r) => setTimeout(r, 1800));
      }
    } catch {
      if (mounted.current && activeRef.current)
        setFaceStatus(
          "Expression model unavailable. Your recording can continue.",
        );
    }
  }
  async function start({
    camera,
    transcribe,
  }: {
    camera: boolean;
    transcribe: boolean;
  }) {
    if (activeRef.current || loading) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera and microphone access require HTTPS or localhost in a supported browser.",
      );
      return;
    }
    setLoading(true);
    setError("");
    samplesRef.current = [];
    energiesRef.current = [];
    setSampleCount(0);
    setSeconds(0);
    try {
      if (mode !== "writing" && typeof MediaRecorder === "undefined")
        throw new Error(
          "Recording is unavailable in this browser. Try a current Chrome, Edge, Firefox, or Safari browser.",
        );
      const constraints = {
        video:
          mode === "video" || camera
            ? {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
              }
            : false,
        audio: mode !== "writing",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      startRef.current = Date.now();
      activeRef.current = true;
      setActive(true);
      setLoading(false);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      if (mode !== "writing") {
        const recordStream =
          mode === "voice" ? new MediaStream(stream.getAudioTracks()) : stream;
        const candidates =
          mode === "voice"
            ? ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
            : [
                "video/webm;codecs=vp9,opus",
                "video/webm;codecs=vp8,opus",
                "video/mp4",
                "video/webm",
              ];
        const mimeType = candidates.find((t) =>
          MediaRecorder.isTypeSupported(t),
        );
        const recorder = new MediaRecorder(
          recordStream,
          mimeType ? { mimeType } : undefined,
        );
        recorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        recorder.onstop = () => {
          const recording = new Blob(chunks, { type: recorder.mimeType });
          if (mounted.current) {
            setBlob(recording);
            setActive(false);
            setLoading(false);
          }
          release();
        };
        recorder.onerror = () => {
          if (mounted.current)
            setError(
              "The recording was interrupted. Check the playback before saving.",
            );
          stop();
        };
        recorder.start(1000);
        const context = new AudioContext();
        contextRef.current = context;
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        intervalRef.current = setInterval(() => {
          if (!activeRef.current) return;
          analyser.getByteTimeDomainData(data);
          const rms = Math.sqrt(
            data.reduce((s, x) => s + ((x - 128) / 128) ** 2, 0) / data.length,
          );
          energiesRef.current.push(rms);
          setLevel(Math.min(1, rms * 6));
          const duration = Math.floor((Date.now() - startRef.current) / 1000);
          setSeconds(duration);
          if (duration >= 600) {
            setError(
              "Your ten-minute recording is ready. Save this entry to start another.",
            );
            stop();
          }
        }, 150);
        if (transcribe && speechSupported) {
          const Constructor =
            (window as SpeechWindow).SpeechRecognition ||
            (window as SpeechWindow).webkitSpeechRecognition!;
          const recognition = new Constructor();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = "en-US";
          recognition.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++)
              if (e.results[i].isFinal)
                transcriptRef.current(e.results[i][0].transcript);
          };
          recognition.onerror = (e) => {
            if (e.error === "no-speech") return;
            recognition.onend = null;
            if (mounted.current)
              setError(
                `Live transcription is unavailable (${e.error}). Your recording continues; you can add a transcript below.`,
              );
          };
          recognition.onend = () => {
            if (activeRef.current)
              try {
                recognition.start();
              } catch {
                /* The recording remains available if recognition cannot restart. */
              }
          };
          try {
            recognition.start();
          } catch {
            setError(
              "Live transcription could not start. Add or paste a transcript below.",
            );
          }
        }
      }
      if (camera) void trackExpressions();
      else
        setFaceStatus(
          mode === "video"
            ? "Camera preview · expression analysis off"
            : "Camera off",
        );
    } catch (e) {
      activeRef.current = false;
      release();
      setLoading(false);
      setActive(false);
      const err = e as Error;
      setError(
        err.name === "NotAllowedError"
          ? "Camera or microphone permission was declined. You can allow access in your browser, or continue with writing."
          : err.name === "NotFoundError"
            ? "No camera or microphone was found. Connect a device, or continue with writing."
            : err.message || "Recording could not start. Please try again.",
      );
    }
  }
  function reset() {
    setBlob(null);
    setSeconds(0);
    samplesRef.current = [];
    energiesRef.current = [];
    setSampleCount(0);
    setError("");
  }
  return {
    videoRef,
    active,
    loading,
    error,
    faceStatus,
    seconds,
    blob,
    level,
    sampleCount,
    speechSupported,
    start,
    stop,
    reset,
    getExpressions: () => [...samplesRef.current],
    getVoiceEnergy: () => {
      const values = energiesRef.current;
      return values.length
        ? {
            average: values.reduce((a, b) => a + b, 0) / values.length,
            peak: values.reduce((a, b) => Math.max(a, b), 0),
            samples: values.length,
          }
        : undefined;
    },
  };
}
