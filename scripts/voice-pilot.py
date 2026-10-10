"""Small, maintainer-only CREMA-D pilot. Never run by npm or Vercel.

python3 scripts/voice-pilot.py --data /tmp/leap-voice-pilot --download
Downloads at most 12 MB total; each WAV is capped at 200 KB. Requires existing numpy/scipy.
The actor-disjoint pilot is intentionally NOT a production validation gate.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import subprocess
import wave

import numpy as np
from scipy.fft import dct
from scipy.optimize import minimize
from scipy.special import softmax

ROOT = Path(__file__).resolve().parents[1]
REVISION = "1658cd342dff90010aa843eaeebd53610a08b1dc"
BASE = f"https://raw.githubusercontent.com/CheyneyComputerScience/CREMA-D/{REVISION}"
LABELS = ["anger", "disgust", "fear", "joy", "neutral", "sadness"]
MAP = dict(zip(["ANG", "DIS", "FEA", "HAP", "NEU", "SAD"], LABELS))


def fetch(url, destination, limit):
    temporary = destination.with_suffix(destination.suffix + ".part")
    try:
        subprocess.run(["curl", "--fail", "--silent", "--show-error", "--max-time", "30", "--max-filesize", str(limit), url, "-o", str(temporary)], check=True)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def features(audio, rate):
    # Gain-normalized MFCC statistics plus temporal dynamics; not RMS labels.
    audio = audio / max(np.max(np.abs(audio)), 1e-6)
    size, hop = int(rate * .025), int(rate * .010)
    frames = np.array([audio[i:i + size] for i in range(0, len(audio) - size, hop)])
    energy = np.mean(frames ** 2, axis=1)
    active = frames[energy > max(.002, np.max(energy) * .02)]
    if len(active) < 2:
        return np.zeros(29)
    fft = 512
    spectrum = np.abs(np.fft.rfft(active * np.hanning(size), n=fft)) ** 2
    mel = np.linspace(0, 2595 * np.log10(1 + rate / 2 / 700), 28)
    bins = np.floor((fft + 1) * (700 * (10 ** (mel / 2595) - 1)) / rate).astype(int)
    filters = np.zeros((26, fft // 2 + 1))
    for i in range(26):
        left, center, right = bins[i:i + 3]
        for j in range(left, center): filters[i, j] = (j - left) / max(center - left, 1)
        for j in range(center, min(right, fft // 2 + 1)): filters[i, j] = (right - j) / max(right - center, 1)
    mfcc = dct(np.log(np.maximum(spectrum @ filters.T, 1e-10)), type=2, axis=1, norm="ortho")[:, 1:14]
    # 26 MFCC mean/std values + quiet fraction, energy variability and ZCR.
    return np.r_[mfcc.mean(axis=0), mfcc.std(axis=0), 1 - len(active) / len(frames), np.std(energy), np.mean(np.diff(np.sign(active), axis=1) != 0)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    args.data.mkdir(parents=True, exist_ok=True)
    index = args.data / "SentenceFilenames.csv"
    if args.download:
        fetch(BASE + "/SentenceFilenames.csv", index, 500000)
        fetch(BASE + "/LICENSE.txt", args.data / "LICENSE.txt", 100000)
    names = sorted(row["Filename"] for row in csv.DictReader(io.StringIO(index.read_text())) if int(row["Filename"][:4]) < 1019 and "_DFA_" in row["Filename"])
    assert len(names) == 108
    if args.download:
        for path in (args.data / (name + ".wav") for name in names):
            if not path.exists(): continue
            try:
                with wave.open(str(path)) as file:
                    if len(file.readframes(file.getnframes())) != file.getnframes() * file.getsampwidth() * file.getnchannels(): path.unlink()
            except (wave.Error, EOFError): path.unlink()
        for name in names:
            path = args.data / (name + ".wav")
            if not path.exists():
                remaining = 12_000_000 - sum(p.stat().st_size for p in args.data.glob("*.wav"))
                if remaining <= 0: raise RuntimeError("Download budget reached")
                fetch(f"https://media.githubusercontent.com/media/CheyneyComputerScience/CREMA-D/{REVISION}/AudioWAV/{name}.wav", path, min(200000, remaining))
    x, noisy, labels, actors, manifest = [], [], [], [], []
    rng = np.random.default_rng(41)
    for name in names:
        path = args.data / (name + ".wav")
        with wave.open(str(path)) as file:
            assert file.getsampwidth() == 2 and file.getnchannels() == 1
            rate = file.getframerate()
            audio = np.frombuffer(file.readframes(file.getnframes()), dtype="<i2").astype(float) / 32768
        x.append(features(audio, rate))
        # A synthetic gain/noise stress test is not evidence across microphones.
        noisy.append(features(audio * .35 + rng.normal(0, .005, len(audio)), rate))
        labels.append(LABELS.index(MAP[name.split("_")[2]]))
        actors.append(int(name[:4]))
        manifest.append({"file": name + ".wav", "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    x, noisy, labels, actors = np.array(x), np.array(noisy), np.array(labels), np.array(actors)
    train, dev, test = actors <= 1012, (actors > 1012) & (actors <= 1015), actors > 1015
    center, scale = x[train].mean(axis=0), np.maximum(x[train].std(axis=0), .01)
    def normalize(values): return np.c_[(values - center) / scale, np.ones(len(values))]
    z = normalize(x)
    target = np.eye(len(LABELS))[labels[train]]
    candidates = []
    for penalty in (.1, 1, 10):
        def loss(flat):
            w = flat.reshape(z.shape[1], len(LABELS))
            p = softmax(z[train] @ w, axis=1)
            value = -np.sum(target * np.log(np.maximum(p, 1e-12))) + penalty * np.sum(w[:-1] ** 2) / 2
            grad = z[train].T @ (p - target)
            grad[:-1] += penalty * w[:-1]
            return value, grad.ravel()
        fit = minimize(loss, np.zeros(z.shape[1] * len(LABELS)), jac=True, method="L-BFGS-B", options={"maxiter": 500})
        if not fit.success: raise RuntimeError(fit.message)
        w = fit.x.reshape(z.shape[1], len(LABELS))
        candidates.append((np.mean((z[dev] @ w).argmax(axis=1) == labels[dev]), penalty, w))
    _, penalty, w = max(candidates, key=lambda item: (item[0], item[1]))
    def evaluate(values, split):
        predicted = (normalize(values[split]) @ w).argmax(axis=1)
        actual = labels[split]
        confusion = np.zeros((6, 6), dtype=int)
        for a, p in zip(actual, predicted): confusion[a, p] += 1
        f1 = [2 * confusion[i, i] / max(confusion[i].sum() + confusion[:, i].sum(), 1) for i in range(6)]
        return {"examples": int(split.sum()), "accuracy": round(float(np.mean(predicted == actual)), 4), "macroF1": round(float(np.mean(f1)), 4), "confusionMatrix": confusion.tolist()}
    report = {"dataset": "CREMA-D", "revision": REVISION, "license": "ODbL-1.0 database; DbCL-1.0 individual contents", "labels": LABELS,
              "split": {"trainActors": list(range(1001, 1013)), "devActors": list(range(1013, 1016)), "testActors": list(range(1016, 1019))},
              "bytesDownloaded": sum(row["bytes"] for row in manifest), "features": 29, "parameters": int(w.size), "penaltySelectedOnDev": penalty,
              "validation": evaluate(x, dev), "test": evaluate(x, test), "gainNoiseStress": evaluate(noisy, test),
              "productionEnabled": False, "limitations": "Pilot on 18 actors reading one sentence; only 3 held-out actors. Acted labels, not natural journal feelings. Synthetic noise is not real microphone validation. No surprise label. Insufficient evidence for deployment; weights are not bundled in the app.", "files": manifest}
    (ROOT / "docs/voice-pilot.json").write_text(json.dumps(report, indent=2) + "\n")
    (args.data / "candidate.json").write_text(json.dumps({"labels": LABELS, "center": center.tolist(), "scale": scale.tolist(), "weights": w.tolist()}))
    print(json.dumps({key: report[key] for key in ("bytesDownloaded", "parameters", "test", "gainNoiseStress", "productionEnabled")}, indent=2))


if __name__ == "__main__": main()
