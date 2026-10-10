import { useEffect, useRef, useState } from "react";
import type { AcousticSample, ExpressionSample, Mode, TranscriptPassage } from "./types";
import { acousticSample, faceQuality, smoothExpressions } from "./mediaSignals";
import { localRecognition, speechAvailability, installSpeechPack, type Recognition, type SpeechAvailability } from "./localSpeech";
export function useCapture(mode: Mode, onTranscript: (passage: TranscriptPassage) => void) {
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
    acousticRef = useRef<AcousticSample[]>([]),
    generation = useRef(0),
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
  const [speechStatus, setSpeechStatus] = useState<SpeechAvailability>("checking");
  const speechSupported = speechStatus === "available";
  useEffect(() => {
    let cancelled = false;
    if (mode !== "writing") void speechAvailability().then((status) => { if (!cancelled) setSpeechStatus(status); });
    return () => { cancelled = true; };
  }, [mode]);
  async function installSpeech() {
    setSpeechStatus("downloading");
    try {
      const installed = await installSpeechPack();
      const status = installed ? await speechAvailability() : "downloadable";
      if (mounted.current) { setSpeechStatus(status); if (!installed) setError("The English speech pack could not be installed. You can add a transcript manually."); }
    } catch { if (mounted.current) { setSpeechStatus("downloadable"); setError("Speech pack installation failed. You can try again or add a transcript manually."); } }
  }
  function release() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    clearInterval(intervalRef.current);
    if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.onresult = null; try { recognitionRef.current.stop(); } catch { /* Already stopped. */ } }
    recognitionRef.current = null;
  }
  function stop() {
    generation.current++;
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
      generation.current++;
      activeRef.current = false;
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      release();
    };
  }, []);
  async function trackExpressions(session: number) {
    try {
      setFaceStatus("Loading expression model…");
      const { default: Human } = await import("@vladmandic/human");
      if (!activeRef.current || session !== generation.current) return;
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
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let previous: ExpressionSample | undefined;
      while (activeRef.current && mounted.current && session === generation.current) {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          const result = await human.detect(video);
          if (!activeRef.current || session !== generation.current) break;
          const face = result.face[0];
          if (face?.emotion?.length && ctx) {
            const [x, y, width, height] = face.box;
            ctx.drawImage(video, x, y, width, height, 0, 0, 64, 64);
            const quality = faceQuality(ctx.getImageData(0, 0, 64, 64).data, 64, 64, { ...face, mesh: face.mesh.map((point) => [point[0], point[1]]) }, video.videoWidth, video.videoHeight);
            if (quality.quality >= 0.5) {
              const current: ExpressionSample = {
                at: (Date.now() - startRef.current) / 1000,
                scores: Object.fromEntries(face.emotion.map((e) => [e.emotion, e.score])),
                quality: quality.quality, model: "human/default-emotion",
              };
              const sample = smoothExpressions(previous, current);
              previous = sample;
              samplesRef.current.push(sample);
              setSampleCount(samplesRef.current.length);
              setFaceStatus("Expression estimates active");
            } else { previous = undefined; setFaceStatus(quality.reason); }
          } else { previous = undefined; setFaceStatus("Looking for your face…"); }
        }
        await new Promise((r) => setTimeout(r, 1800));
      }
    } catch {
      if (mounted.current && activeRef.current && session === generation.current)
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
    const session = ++generation.current;
    setLoading(true);
    setError("");
    samplesRef.current = [];
    energiesRef.current = [];
    acousticRef.current = [];
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
      if (!mounted.current || session !== generation.current) {
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
      if (!activeRef.current || session !== generation.current) return;
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
        analyser.fftSize = 2048;
        await context.resume().catch(() => {});
        if (!activeRef.current || session !== generation.current) return;
        context.createMediaStreamSource(stream).connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        intervalRef.current = setInterval(() => {
          if (!activeRef.current) return;
          analyser.getFloatTimeDomainData(data);
          const sample = acousticSample(data, context.sampleRate, (Date.now() - startRef.current) / 1000);
          acousticRef.current.push(sample);
          const rms = sample.rms;
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
        }, 250);
        if (transcribe) {
          const status = await speechAvailability();
          if (!activeRef.current || session !== generation.current) return;
          const recognition = status === "available" ? localRecognition() : null;
          if (!recognition) {
            setSpeechStatus(status);
            setError("On-device transcription is unavailable. Your recording continues; add a transcript below.");
          } else {
            recognitionRef.current = recognition;
            recognition.continuous = true;
            recognition.interimResults = false;
            let passageStart = (Date.now() - startRef.current) / 1000;
            const current = () => activeRef.current && mounted.current && session === generation.current;
            recognition.onspeechstart = () => { passageStart = (Date.now() - startRef.current) / 1000; };
            recognition.onresult = (e) => {
              if (!current()) return;
              const text: string[] = [];
              for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text.push(e.results[i][0].transcript.trim());
              if (text.some(Boolean)) {
                const end = (Date.now() - startRef.current) / 1000;
                transcriptRef.current({ id: crypto.randomUUID(), start: Math.min(passageStart, end), end, text: text.join(" "), timing: "approximate" });
                passageStart = end;
              }
            };
            recognition.onerror = (e) => {
              if (e.error === "no-speech") return;
              recognition.onend = null;
              if (current()) setError(`On-device transcription is unavailable (${e.error}). Your recording continues; add a transcript below.`);
            };
            recognition.onend = () => {
              if (current()) try { passageStart = (Date.now() - startRef.current) / 1000; recognition.start(); }
              catch { setError("On-device transcription stopped. Your recording continues; add a transcript below."); }
            };
            try { recognition.start(); }
            catch { setError("On-device transcription could not start. Add or paste a transcript below."); }
          }
        }
      }
      if (camera && activeRef.current && session === generation.current) void trackExpressions(session);
      else
        setFaceStatus(
          mode === "video"
            ? "Camera preview · expression analysis off"
            : "Camera off",
        );
    } catch (e) {
      if (!mounted.current || session !== generation.current) return;
      activeRef.current = false;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
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
    generation.current++;
    setBlob(null);
    setSeconds(0);
    samplesRef.current = [];
    energiesRef.current = [];
    acousticRef.current = [];
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
    speechStatus,
    installSpeech,
    start,
    stop,
    reset,
    getAcoustics: () => [...acousticRef.current],
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
