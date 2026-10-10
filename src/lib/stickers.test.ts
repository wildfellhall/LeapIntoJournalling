import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  createSticker,
  moveSticker,
  normalizeStickers,
  resizeSticker,
  validStoredStickers,
} from "./stickers";
import { defaultDecoration, type Entry } from "./types";
import { analyze } from "./analysis";
import { deleteEntry, getEntries, importEntries, saveEntries } from "./storage";

describe("sticker layouts", () => {
  it("keeps dragging and resizing within the paper on desktop and mobile", () => {
    for (const [width, height] of [
      [600, 500],
      [270, 400],
    ]) {
      const s = createSticker("🌼", 0);
      expect(moveSticker(s, 10000, -10000, width, height)).toMatchObject({
        x: 1,
        y: 0,
      });
      expect(resizeSticker(s, -10, width, height).size).toBe(40);
      expect(resizeSticker(s, 10000, width, height).size).toBe(144);
      const resized = resizeSticker(
        { ...s, x: 0.3, y: 0.4 },
        100,
        width,
        height,
      );
      expect(resized.x * (width - 100)).toBeCloseTo(0.3 * (width - s.size));
      expect(resized.y * (height - 100)).toBeCloseTo(0.4 * (height - s.size));
      expect(
        resizeSticker({ ...s, x: 1, y: 1 }, 144, width, height),
      ).toMatchObject({ x: 1, y: 1 });
    }
  });

  it("preserves repeated legacy stickers with stable, unique IDs", () => {
    const old = ["🌼", "🌼", "🌿"];
    const migrated = normalizeStickers(old);
    expect(migrated.map((s) => s.emoji)).toEqual(old);
    expect(new Set(migrated.map((s) => s.id)).size).toBe(3);
    expect(normalizeStickers(old)).toEqual(migrated);
    expect(normalizeStickers(migrated)).toEqual(migrated);
    const mixed = normalizeStickers([
      "🌼",
      { ...createSticker("🌷", 0), id: "legacy-sticker-0" },
    ]);
    expect(new Set(mixed.map((s) => s.id)).size).toBe(2);
  });

  it("rejects invalid geometry and duplicate IDs in backups", () => {
    const s = createSticker("🌼", 0);
    expect(validStoredStickers([s, "🌿"])).toBe(true);
    for (const patch of [
      { size: 0 },
      { size: 200 },
      { x: Infinity },
      { x: -1 },
      { y: 2 },
      { rotation: NaN },
      { emoji: "" },
      { id: "" },
    ]) {
      expect(validStoredStickers([{ ...s, ...patch }])).toBe(false);
    }
    expect(validStoredStickers([s, s])).toBe(false);
  });

  it("migrates old saved entries and restores old and new backups without losing layout", async () => {
    const legacy = {
      id: "legacy-stickers",
      title: "Old stickers",
      text: "A quiet day.",
      date: "2026-10-01",
      createdAt: "2026-10-01T12:00:00Z",
      mode: "writing",
      mood: null,
      analysis: analyze("A quiet day."),
      expressions: [],
      decoration: { ...defaultDecoration, stickers: ["🌼", "🌿"] },
    };
    // Simulate data already saved by the previous app version.
    await saveEntries([legacy as unknown as Entry]);
    const migrated = (await getEntries()).find((e) => e.id === legacy.id)!;
    expect(migrated.decoration.stickers.map((s) => s.emoji)).toEqual([
      "🌼",
      "🌿",
    ]);
    for (const [version, item] of [
      [1, legacy],
      [
        2,
        {
          ...migrated,
          decoration: {
            ...migrated.decoration,
            stickers: [
              {
                ...migrated.decoration.stickers[0],
                x: 0.8,
                y: 0.25,
                size: 130,
              },
            ],
          },
        },
      ],
    ] as const) {
      await importEntries(
        new File(
          [
            JSON.stringify({
              format: "leap-journal",
              version,
              entries: [item],
            }),
          ],
          "backup.json",
        ),
      );
      expect(
        (await getEntries()).find((e) => e.id === item.id)?.decoration.stickers,
      ).toEqual(normalizeStickers(item.decoration.stickers));
    }
    const bad = {
      ...migrated,
      id: "invalid-stickers",
      decoration: {
        ...migrated.decoration,
        stickers: [{ ...migrated.decoration.stickers[0], x: 50 }],
      },
    };
    await expect(
      importEntries(
        new File(
          [
            JSON.stringify({
              format: "leap-journal",
              version: 2,
              entries: [bad],
            }),
          ],
          "invalid.json",
        ),
      ),
    ).rejects.toThrow("invalid decoration");
    expect((await getEntries()).some((e) => e.id === bad.id)).toBe(false);
    await deleteEntry(legacy.id);
  });
});
