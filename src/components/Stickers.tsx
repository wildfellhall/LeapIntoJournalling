import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { MoveDiagonal2, Trash2 } from "lucide-react";
import type { Sticker } from "../lib/types";
import {
  MAX_STICKERS,
  MAX_STICKER_SIZE,
  MIN_STICKER_SIZE,
  moveSticker,
  resizeSticker,
  stickerSets,
} from "../lib/stickers";

export function StickerPicker({
  count,
  onAdd,
}: {
  count: number;
  onAdd: (emoji: string) => void;
}) {
  const [category, setCategory] = useState(0);
  return (
    <div className="sticker-picker">
      <div
        className="sticker-categories"
        role="group"
        aria-label="Sticker categories"
      >
        {stickerSets.map((set, i) => (
          <button
            key={set.name}
            aria-pressed={category === i}
            onClick={() => setCategory(i)}
          >
            {set.name}
          </button>
        ))}
      </div>
      <div
        className="sticker-options"
        role="group"
        aria-label={`${stickerSets[category].name} stickers`}
      >
        {stickerSets[category].emojis.map((emoji) => (
          <button
            key={emoji}
            className="sticker-option"
            aria-label={`Add ${emoji} sticker`}
            disabled={count >= MAX_STICKERS}
            onClick={() => onAdd(emoji)}
          >
            <span className="sticker-art" aria-hidden="true">
              {emoji}
            </span>
          </button>
        ))}
      </div>
      <div className="sticker-picker-caption">
        <span>Drag to move · drag the corner to resize</span>
        <span role="status">
          {count}/{MAX_STICKERS}
        </span>
      </div>
    </div>
  );
}

export function StickerControls({
  selected,
  onChange,
  onRemove,
}: {
  selected?: Sticker;
  onChange: (sticker: Sticker) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="sticker-controls"
      aria-label="Sticker controls"
      role="group"
    >
      {selected ? (
        <>
          <span className="selected-sticker-preview" aria-hidden="true">
            {selected.emoji}
          </span>
          <label>
            Size
            <input
              aria-label="Sticker size"
              type="range"
              min={MIN_STICKER_SIZE}
              max={MAX_STICKER_SIZE}
              value={selected.size}
              onChange={(e) =>
                onChange({ ...selected, size: Number(e.target.value) })
              }
            />
          </label>
          <output aria-label="Sticker size in pixels">{selected.size}px</output>
          <button
            className="text-button"
            aria-label="Remove selected sticker"
            onClick={() => onRemove(selected.id)}
          >
            <Trash2 size={15} />
            <span>Remove</span>
          </button>
        </>
      ) : (
        <span>Select a sticker to resize or remove it.</span>
      )}
    </div>
  );
}

interface Editing {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (sticker: Sticker) => void;
  onRemove: (id: string) => void;
}
interface Gesture {
  sticker: Sticker;
  mode: "move" | "resize";
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
}

export function StickerLayer({
  stickers,
  editing,
}: {
  stickers: Sticker[];
  editing?: Editing;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const helpId = useId();

  function start(
    e: PointerEvent<HTMLButtonElement>,
    sticker: Sticker,
    mode: Gesture["mode"],
  ) {
    if (!editing || e.button !== 0 || !e.isPrimary || !layer.current) return;
    e.preventDefault();
    editing.onSelect(sticker.id);
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const { width, height } = layer.current.getBoundingClientRect();
    gesture.current = {
      sticker,
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      width,
      height,
    };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId || !editing) return;
    const dx = e.clientX - g.startX,
      dy = e.clientY - g.startY;
    editing.onChange(
      g.mode === "move"
        ? moveSticker(g.sticker, dx, dy, g.width, g.height)
        : resizeSticker(
            g.sticker,
            g.sticker.size + (dx + dy) / 2,
            g.width,
            g.height,
          ),
    );
  }
  function key(
    e: KeyboardEvent<HTMLButtonElement>,
    s: Sticker,
    resizing = false,
  ) {
    if (!editing || !layer.current) return;
    const { width, height } = layer.current.getBoundingClientRect();
    const step = e.shiftKey ? 10 : 2;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (directions[e.key]) {
      e.preventDefault();
      const [dx, dy] = directions[e.key];
      editing.onChange(
        resizing
          ? resizeSticker(s, s.size + dx + dy, width, height)
          : moveSticker(s, dx, dy, width, height),
      );
    } else if (["+", "=", "-"].includes(e.key)) {
      e.preventDefault();
      editing.onChange(
        resizeSticker(s, s.size + (e.key === "-" ? -4 : 4), width, height),
      );
    } else if (["Delete", "Backspace"].includes(e.key)) {
      e.preventDefault();
      editing.onRemove(s.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      editing.onSelect(null);
      e.currentTarget.blur();
    }
  }
  const pointerHandlers = {
    onPointerMove: move,
    onPointerUp: () => {
      gesture.current = null;
    },
    onPointerCancel: () => {
      if (gesture.current) editing?.onChange(gesture.current.sticker);
      gesture.current = null;
    },
    onLostPointerCapture: () => {
      gesture.current = null;
    },
  };

  return (
    <div className="sticker-layer" ref={layer}>
      {editing && (
        <span id={helpId} className="sr-only">
          Drag to move. Use arrow keys to move, Shift for larger steps, plus or
          minus to resize, and Delete to remove.
        </span>
      )}
      {stickers.map((s) => {
        const selected = editing?.selectedId === s.id;
        const art = (
          <span
            className="sticker-art"
            aria-hidden="true"
            style={{ transform: `rotate(${s.rotation}deg)` }}
          >
            {s.emoji}
          </span>
        );
        return (
          <div
            key={s.id}
            className={`sticker-node${selected ? " selected" : ""}`}
            data-sticker-id={s.id}
            style={
              {
                left: `calc(${s.x * 100}% - ${s.x * s.size}px)`,
                top: `calc(${s.y * 100}% - ${s.y * s.size}px)`,
                "--sticker-size": `${s.size}px`,
              } as CSSProperties
            }
          >
            {editing ? (
              <>
                <button
                  className="sticker-move"
                  aria-label={`${s.emoji} sticker`}
                  aria-pressed={selected}
                  aria-describedby={helpId}
                  onFocus={() => editing.onSelect(s.id)}
                  onClick={() => editing.onSelect(s.id)}
                  onPointerDown={(e) => start(e, s, "move")}
                  {...pointerHandlers}
                  onKeyDown={(e) => key(e, s)}
                >
                  {art}
                </button>
                {selected && (
                  <button
                    className="sticker-resize"
                    aria-label={`Resize ${s.emoji} sticker`}
                    aria-describedby={helpId}
                    onPointerDown={(e) => start(e, s, "resize")}
                    {...pointerHandlers}
                    onKeyDown={(e) => key(e, s, true)}
                  >
                    <MoveDiagonal2 size={15} />
                  </button>
                )}
              </>
            ) : (
              <span
                className="sticker-display"
                role="img"
                aria-label={`${s.emoji} sticker`}
              >
                {art}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
