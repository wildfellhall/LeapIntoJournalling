import type { AcousticSample, ExpressionSample } from "./types";

export function acousticSample(data: Float32Array, sampleRate: number, at: number): AcousticSample {
  let energy = 0, crossing = 0, clipped = 0;
  for (let i = 0; i < data.length; i++) {
    energy += data[i] ** 2;
    if (i && (data[i] >= 0) !== (data[i - 1] >= 0)) crossing++;
    if (Math.abs(data[i]) >= 0.98) clipped++;
  }
  const rms = Math.sqrt(energy / (data.length || 1));
  const clipping = clipped / (data.length || 1);
  // Downsample only for autocorrelation. No inference from volume to emotion.
  const step = Math.max(1, Math.floor(sampleRate / 8000)), rate = sampleRate / step;
  const wave = Array.from({ length: Math.floor(data.length / step) }, (_, i) => {
    let sum = 0; for (let j = 0; j < step; j++) sum += data[i * step + j];
    return sum / step;
  });
  const mean = wave.reduce((s, x) => s + x, 0) / (wave.length || 1);
  for (let i = 0; i < wave.length; i++) wave[i] -= mean;
  let best = 0, lag = 0;
  const correlations: number[] = [];
  for (let shift = Math.floor(rate / 450); shift <= Math.min(Math.ceil(rate / 70), wave.length / 2); shift++) {
    let dot = 0, a = 0, b = 0;
    for (let i = 0; i < wave.length - shift; i++) { dot += wave[i] * wave[i + shift]; a += wave[i] ** 2; b += wave[i + shift] ** 2; }
    correlations[shift] = a * b > 1e-10 ? dot / Math.sqrt(a * b) : 0;
  }
  // Pick the first strong local maximum, avoiding octave-down multiples.
  for (let shift = Math.floor(rate / 450) + 1; shift < correlations.length - 1; shift++) {
    const c = correlations[shift];
    if (c >= correlations[shift - 1] && c > correlations[shift + 1] && c > best) { best = c; lag = shift; if (best > 0.9) break; }
  }
  const voiced = rms >= 0.008 && best >= 0.65 && clipping < 0.03;
  return { at, rms, pitchHz: voiced && lag ? rate / lag : null, periodicity: Math.max(0, Math.min(1, best)),
    zeroCrossingRate: crossing / (data.length || 1), clipping,
    quality: voiced ? Math.max(0, Math.min(1, best * (1 - clipping * 10))) : 0 };
}

export function summarizeAcoustics(samples: AcousticSample[]) {
  const voiced = samples.filter((s) => s.pitchHz !== null && s.quality >= 0.5);
  const pitches = voiced.map((s) => s.pitchHz!).sort((a, b) => a - b);
  return { frames: samples.length, voiced: voiced.length,
    medianPitch: pitches.length ? pitches[Math.floor(pitches.length / 2)] : null,
    pitchRange: pitches.length ? pitches[Math.floor((pitches.length - 1) * 0.9)] - pitches[Math.floor((pitches.length - 1) * 0.1)] : null,
    // Unvoiced frames can be silence, noise or unvoiced consonants, not sadness.
    unvoicedShare: samples.length ? 1 - voiced.length / samples.length : 0,
    quality: samples.length ? samples.reduce((sum, s) => sum + s.quality, 0) / samples.length : 0 };
}

export interface FaceGeometry { box: number[]; boxScore: number; mesh: number[][] }
export function faceQuality(pixels: Uint8ClampedArray, width: number, height: number, face: FaceGeometry, videoWidth: number, videoHeight: number) {
  const fail = (reason: string) => ({ quality: 0, reason });
  const [x, y, w, h] = face.box;
  if (face.boxScore < 0.8 || w < 70 || h < 70) return fail("Move closer and keep your face visible");
  if (x < 2 || y < 2 || x + w > videoWidth - 2 || y + h > videoHeight - 2) return fail("Keep your whole face in view");
  const [eye1, eye2, nose] = face.mesh;
  if (!eye1 || !eye2 || !nose || ![...eye1.slice(0, 2), ...eye2.slice(0, 2), ...nose.slice(0, 2)].every(Number.isFinite)) return fail("Face landmarks unavailable");
  const eyeSpan = Math.abs(eye2[0] - eye1[0]);
  if (eyeSpan < w * 0.22 || Math.abs(eye2[1] - eye1[1]) / eyeSpan > 0.45 || Math.abs(nose[0] - (eye1[0] + eye2[0]) / 2) / eyeSpan > 0.4) return fail("Face the camera more directly");
  const gray = new Float32Array(width * height);
  let light = 0, dark = 0, bright = 0;
  for (let i = 0; i < gray.length; i++) { gray[i] = pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114; light += gray[i]; if (gray[i] < 15) dark++; if (gray[i] > 245) bright++; }
  light /= gray.length;
  if (light < 35 || dark / gray.length > 0.55) return fail("More light needed");
  if (light > 235 || bright / gray.length > 0.65) return fail("Reduce glare on your face");
  let lap = 0, square = 0, n = 0;
  for (let row = 1; row < height - 1; row++) for (let col = 1; col < width - 1; col++) {
    const i = row * width + col, value = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
    lap += value; square += value * value; n++;
  }
  const sharpness = square / n - (lap / n) ** 2;
  if (sharpness < 12) return fail("Hold still for a clearer image");
  return { quality: Math.min(face.boxScore, Math.min(1, sharpness / 80)), reason: "Expression estimates active" };
}

export function smoothExpressions(previous: ExpressionSample | undefined, current: ExpressionSample): ExpressionSample {
  if (!previous || current.at - previous.at > 5 || current.at <= previous.at) return current;
  const alpha = 1 - Math.exp(-(current.at - previous.at) / 2);
  const scores: Record<string, number> = {};
  for (const key of new Set([...Object.keys(previous.scores), ...Object.keys(current.scores)])) scores[key] = (previous.scores[key] || 0) * (1 - alpha) + (current.scores[key] || 0) * alpha;
  return { ...current, rawScores: current.scores, scores };
}
