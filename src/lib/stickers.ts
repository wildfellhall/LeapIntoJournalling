import type { Sticker } from "./types";

export const MIN_STICKER_SIZE = 40;
export const MAX_STICKER_SIZE = 144;
export const MAX_STICKERS = 24;

export const stickerSets = [
  {
    name: "Nature",
    emojis: [
      "🌼",
      "🌿",
      "🦋",
      "🌷",
      "🍄",
      "🌻",
      "🌸",
      "🌵",
      "🍀",
      "🐝",
      "🐌",
      "🐸",
    ],
  },
  {
    name: "Food",
    emojis: [
      "🍓",
      "🍋",
      "🍒",
      "🍊",
      "🍑",
      "🥑",
      "🥐",
      "🍰",
      "🍪",
      "🍯",
      "☕",
      "🍵",
    ],
  },
  {
    name: "Little things",
    emojis: [
      "💌",
      "🎀",
      "🧸",
      "🧶",
      "📚",
      "🎨",
      "📷",
      "🎧",
      "🕯️",
      "🗝️",
      "🪴",
      "🐚",
    ],
  },
  {
    name: "Sky & hearts",
    emojis: [
      "✨",
      "🌙",
      "☀️",
      "☁️",
      "🌈",
      "⭐",
      "🪐",
      "🌎",
      "🩷",
      "💛",
      "💚",
      "💜",
    ],
  },
];

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export function createSticker(
  emoji: string,
  index: number,
  id: string = crypto.randomUUID(),
): Sticker {
  return {
    id,
    emoji,
    x: 0.04 + (index % 4) * 0.3,
    y: 0.92 - (Math.floor(index / 4) % 6) * 0.15,
    size: 64,
    rotation: index % 2 ? -8 : 8,
  };
}

function validEmoji(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= 32
  );
}

export function isSticker(value: unknown): value is Sticker {
  if (!value || typeof value !== "object") return false;
  const s = value as Sticker;
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    s.id.length <= 100 &&
    validEmoji(s.emoji) &&
    Number.isFinite(s.x) &&
    s.x >= 0 &&
    s.x <= 1 &&
    Number.isFinite(s.y) &&
    s.y >= 0 &&
    s.y <= 1 &&
    Number.isFinite(s.size) &&
    s.size >= MIN_STICKER_SIZE &&
    s.size <= MAX_STICKER_SIZE &&
    Number.isFinite(s.rotation) &&
    Math.abs(s.rotation) <= 180
  );
}

// Version 1 backups and older IndexedDB entries/drafts used bare emoji strings.
export function validStoredStickers(
  value: unknown,
): value is (Sticker | string)[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((s) => {
    if (validEmoji(s)) return true;
    if (!isSticker(s) || ids.has(s.id)) return false;
    ids.add(s.id);
    return true;
  });
}

export function normalizeStickers(value: unknown): Sticker[] {
  if (!Array.isArray(value)) return [];
  const used = new Set(value.filter(isSticker).map((s) => s.id));
  const seen = new Set<string>();
  return value.flatMap((s, i) => {
    if (validEmoji(s)) {
      let id = `legacy-sticker-${i}`;
      while (used.has(id)) id += "-";
      used.add(id);
      return [createSticker(s, i, id)];
    }
    if (!isSticker(s) || seen.has(s.id)) return [];
    seen.add(s.id);
    return [s];
  });
}

export function moveSticker(
  s: Sticker,
  dx: number,
  dy: number,
  width: number,
  height: number,
): Sticker {
  return {
    ...s,
    x: clamp(s.x + dx / Math.max(1, width - s.size), 0, 1),
    y: clamp(s.y + dy / Math.max(1, height - s.size), 0, 1),
  };
}

export function resizeSticker(
  s: Sticker,
  size: number,
  width: number,
  height: number,
): Sticker {
  // Keep the top-left corner steady while dragging the bottom-right handle.
  const next = clamp(
    Math.round(size),
    MIN_STICKER_SIZE,
    Math.min(MAX_STICKER_SIZE, width, height),
  );
  return {
    ...s,
    size: next,
    x: clamp((s.x * (width - s.size)) / Math.max(1, width - next), 0, 1),
    y: clamp((s.y * (height - s.size)) / Math.max(1, height - next), 0, 1),
  };
}
