import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
const source = path.resolve("node_modules/@vladmandic/human/models");
await mkdir("public/models", { recursive: true });
for (const name of [
  "blazeface.json",
  "blazeface.bin",
  "emotion.json",
  "emotion.bin",
  "README.md",
])
  await copyFile(path.join(source, name), path.join("public/models", name));
