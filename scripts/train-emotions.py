"""Rebuild the small browser classifier. Requires numpy/scipy, not a neural runtime.

python3 scripts/train-emotions.py --data /tmp/leap-emotion-training
See docs/emotion-model.md for the pinned public dataset and reproduction steps.
Training is a maintainer task; npm/Vercel builds only bundle the resulting JSON.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import re

import numpy as np
from scipy import sparse
from scipy.optimize import minimize
from scipy.special import expit

ROOT = Path(__file__).resolve().parents[1]
LABELS = ["anger", "disgust", "fear", "joy", "sadness", "surprise", "neutral"]
VERSION = "goemotions-linear-1"
REVISION = "2adf640a14f11025ae5a9d0ec493b78530d276d3"


def tokens(text):
    # Keep this tokenizer identical to src/lib/emotions.ts.
    text = text.lower().replace("’", "'").replace("‘", "'")
    return re.findall(r"[a-z]+(?:'[a-z]+)?", text)


def features(text):
    words = tokens(text)
    return words + [a + " " + b for a, b in zip(words, words[1:])]


def metrics(actual, predicted):
    tp = (actual * predicted).sum(axis=0)
    fp = ((1 - actual) * predicted).sum(axis=0)
    fn = (actual * (1 - predicted)).sum(axis=0)
    precision = tp / np.maximum(tp + fp, 1)
    recall = tp / np.maximum(tp + fn, 1)
    f1 = 2 * precision * recall / np.maximum(precision + recall, 1e-10)
    return {
        "macroF1": round(float(f1.mean()), 4),
        "microF1": round(float(2 * tp.sum() / max(2 * tp.sum() + fp.sum() + fn.sum(), 1)), 4),
        "perLabel": {label: {"precision": round(float(precision[i]), 4),
                             "recall": round(float(recall[i]), 4),
                             "f1": round(float(f1[i]), 4)} for i, label in enumerate(LABELS)},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, required=True)
    args = parser.parse_args()
    source_labels = (args.data / "emotions.txt").read_text().splitlines()
    mapping = json.loads((args.data / "ekman_mapping.json").read_text())
    mapping["neutral"] = ["neutral"]
    mapped = {name: LABELS.index(label) for label, names in mapping.items() for name in names}

    def read(split):
        texts, labels = [], []
        for line in (args.data / f"{split}.tsv").read_text().splitlines():
            text, ids, _ = line.split("\t")
            target = np.zeros(len(LABELS))
            for i in ids.split(","):
                target[mapped[source_labels[int(i)]]] = 1
            texts.append(text)
            labels.append(target)
        return texts, np.array(labels)

    train, y_train = read("train")
    dev, y_dev = read("dev")
    test, y_test = read("test")
    frequency = Counter()
    for text in train:
        frequency.update(set(features(text)))
    # Preserve uncommon emotional vocabulary instead of letting common phrases
    # consume the entire feature budget. Select only from the training split.
    unigrams = [term for term, count in frequency.items() if " " not in term and count >= 3]
    bigrams = [term for term, count in sorted(frequency.items(), key=lambda item: (-item[1], item[0]))
               if " " in term and count >= 3]
    vocab = sorted(unigrams + bigrams[:max(0, 12000 - len(unigrams))])
    index = {term: i for i, term in enumerate(vocab)}
    idf = np.round([np.log((1 + len(train)) / (1 + frequency[term])) + 1 for term in vocab], 5)

    def matrix(texts):
        rows, cols, data = [], [], []
        for row, text in enumerate(texts):
            counts = Counter(features(text))
            values = {index[term]: (1 + np.log(count)) * idf[index[term]] for term, count in counts.items() if term in index}
            norm = np.sqrt(sum(value * value for value in values.values())) or 1
            for col, value in values.items():
                rows.append(row)
                cols.append(col)
                data.append(value / norm)
        x = sparse.csr_matrix((data, (rows, cols)), shape=(len(texts), len(vocab)))
        return sparse.hstack([x, np.ones((len(texts), 1))], format="csr")

    x_train, x_dev, x_test = [matrix(texts) for texts in (train, dev, test)]
    weights = []
    for i, label in enumerate(LABELS):
        target = y_train[:, i]

        def objective(w):
            z = x_train @ w
            # Independent binary logistic models preserve multi-label annotations.
            loss = np.logaddexp(0, z).sum() - target @ z + (w[:-1] @ w[:-1]) / 16
            gradient = np.asarray(x_train.T @ (expit(z) - target))
            gradient[:-1] += w[:-1] / 8
            return loss, gradient

        result = minimize(objective, np.zeros(x_train.shape[1]), jac=True, method="L-BFGS-B",
                          options={"maxiter": 300, "ftol": 1e-8})
        print(label, "iterations", result.nit, "converged", result.success, flush=True)
        if not result.success:
            raise RuntimeError(f"Training did not converge: {result.message}")
        weights.append(result.x)

    # Quantize before threshold selection/evaluation: these are the shipped weights.
    quantized = np.rint(np.array(weights).T * 256).astype(int)
    weights = quantized / 256
    dev_scores = expit(x_dev @ weights)
    thresholds = []
    for i in range(len(LABELS)):
        best = (0, 0.5)
        for threshold in np.arange(0.3, 0.96, 0.01):
            predicted = dev_scores[:, i] >= threshold
            tp = (predicted * y_dev[:, i]).sum()
            fp = (predicted * (1 - y_dev[:, i])).sum()
            fn = ((1 - predicted) * y_dev[:, i]).sum()
            # F0.5 gives precision more weight for user-facing estimates.
            f = 1.25 * tp / max(1.25 * tp + fp + 0.25 * fn, 1)
            if tp / max(tp + fp, 1) >= 0.7:
                best = max(best, (f, float(threshold)))
        thresholds.append(round(best[1], 2))

    model = {"version": VERSION, "labels": LABELS, "scale": 256, "thresholds": thresholds,
             "bias": quantized[-1].tolist(),
             "terms": {term: [float(idf[i]), *quantized[i].tolist()] for i, term in enumerate(vocab)}}
    payload = json.dumps(model, separators=(",", ":")).encode()
    destination = ROOT / "src/lib/emotion-model.json"
    destination.write_bytes(payload)
    test_scores = expit(x_test @ weights)
    evaluation = {
        "version": VERSION, "dataset": "Google Research GoEmotions, official Ekman mapping",
        "revision": REVISION, "trainExamples": len(train), "validationExamples": len(dev), "testExamples": len(test),
        "features": len(vocab), "bytes": len(payload), "gzipBytes": len(gzip.compress(payload, mtime=0)),
        "thresholds": dict(zip(LABELS, thresholds)),
        "validation": metrics(y_dev, dev_scores >= thresholds),
        "test": metrics(y_test, test_scores >= thresholds),
        "notes": "Held-out Reddit comment metrics, not journal accuracy. Single-segment classifier only; app segmentation/abstention is tested separately. Test data is not used for vocabulary, training, or thresholds.",
        "sha256": {name: hashlib.sha256((args.data / name).read_bytes()).hexdigest()
                   for name in ["train.tsv", "dev.tsv", "test.tsv", "emotions.txt", "ekman_mapping.json"]},
    }
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs/emotion-evaluation.json").write_text(json.dumps(evaluation, indent=2) + "\n")
    # Cross-language parity fixtures verify the JS feature extraction and inference.
    examples = ["I feel happy and grateful.", "I am angry and frustrated.", "I am sad and lonely.",
                "I am afraid and nervous.", "That is disgusting and gross.", "Wow, what a surprise!",
                "I don't feel happy.", "I filed the document."]
    fixture = [{"text": text, "scores": scores.tolist()} for text, scores in zip(examples, expit(matrix(examples) @ weights))]
    (ROOT / "scripts/emotion-parity.json").write_text(json.dumps(fixture, indent=2) + "\n")
    print(json.dumps(evaluation, indent=2))


if __name__ == "__main__":
    main()
