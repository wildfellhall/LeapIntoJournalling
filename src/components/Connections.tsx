import { useMemo, useState } from "react";
import {
  ArrowRight,
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { type Entry, moods, moodInfo, readableDate } from "../lib/types";
import { related, similarity } from "../lib/analysis";
import { Sprout } from "./Illustrations";
export function Connections({
  entries,
  onOpen,
  onDemo,
}: {
  entries: Entry[];
  onOpen: (e: Entry) => void;
  onDemo: () => void;
}) {
  const [date, setDate] = useState(entries[0]?.date || ""),
    [selectedId, setSelectedId] = useState(entries[0]?.id || ""),
    [notice, setNotice] = useState(""),
    [zoom, setZoom] = useState(1);
  const selected = entries.find((e) => e.id === selectedId) || entries[0];
  const ranked = useMemo(
    () => (selected ? related(selected, entries) : []),
    [selected, entries],
  );
  const nodes = useMemo(() => {
    const visible = selected
      ? [selected, ...ranked.slice(0, 29).map((r) => r.entry)]
      : [];
    const positions = visible.map((entry, i) => {
      if (!i) return { entry, x: 370, y: 240 };
      const angle = (i - 1) * 2.39996,
        ring = 90 + Math.sqrt(i) * 31;
      return {
        entry,
        x: 370 + Math.cos(angle) * Math.min(285, ring) * 1.12,
        y: 240 + Math.sin(angle) * Math.min(180, ring) * 0.96,
      };
    });
    return positions;
  }, [ranked, selected]);
  function find() {
    const matches = entries.filter((e) => e.date === date);
    if (matches.length) {
      setSelectedId(matches[0].id);
      setNotice(
        matches.length > 1
          ? `${matches.length} entries on this day. Choose one below.`
          : "",
      );
    } else setNotice("No entries on that date yet. Try another day.");
  }
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <h1>Connections</h1>
          <p>Compare entries by content and mood.</p>
        </div>
        <span className="badge">
          <Network size={14} />
          {entries.length} entries
        </span>
      </div>
      {!entries.length ? (
        <div className="card empty-state">
          <Sprout />
          <h2>No connections yet</h2>
          <p>
            Save two entries to start seeing connections, or explore a sample
            journal.
          </p>
          <button className="secondary" onClick={onDemo}>
            Explore sample connections
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <section className="card graph-filter">
            <label>
              Entry date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <button className="primary" onClick={find}>
              <Search size={16} />
              Find connections
            </button>
            <label className="entry-select-label">
              Or choose an entry
              <select
                aria-label="Choose an entry to connect"
                value={selected?.id}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setDate(entries.find((x) => x.id === e.target.value)!.date);
                  setNotice("");
                }}
              >
                {entries.map((e) => (
                  <option key={e.id} value={e.id}>
                    {readableDate(e.date)} · {e.title}
                  </option>
                ))}
              </select>
            </label>
            {notice && (
              <p className="filter-notice" role="status">
                {notice}
              </p>
            )}
          </section>
          <div className="connections-layout">
            <section className="card graph-card">
              <div className="graph-header">
                <div>
                  <h3>Related entries</h3>
                  <p>Each dot is an entry. Lines show similarity.</p>
                </div>
                <span className="tiny-tag">
                  {Math.min(30, entries.length)} of {entries.length} entries
                </span>
              </div>
              <div className="graph-canvas">
                <svg
                  viewBox="0 0 740 480"
                  role="img"
                  aria-label="Interactive graph of journal entry relationships"
                >
                  <defs>
                    <pattern
                      id="dots"
                      x="0"
                      y="0"
                      width="22"
                      height="22"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="1" cy="1" r="1" fill="#dfe5db" />
                    </pattern>
                  </defs>
                  <rect width="740" height="480" fill="url(#dots)" />
                  <g
                    transform={`translate(370 240) scale(${zoom}) translate(-370 -240)`}
                  >
                    {nodes.slice(1).map((node, i) => {
                      const r = ranked[i];
                      return (
                        <line
                          key={node.entry.id}
                          x1="370"
                          y1="240"
                          x2={node.x}
                          y2={node.y}
                          stroke={i < 3 ? "#86b49a" : "#d5e1d6"}
                          strokeWidth={1 + r.score * 3}
                          strokeDasharray={i < 3 ? undefined : "5 5"}
                        >
                          <title>
                            {Math.round(r.score * 100)}% combined similarity
                          </title>
                        </line>
                      );
                    })}
                    {nodes.slice(1).flatMap((a, i) =>
                      nodes.slice(i + 2).map((b) => {
                        const s = similarity(a.entry, b.entry, entries).score;
                        return s > 0.52 ? (
                          <line
                            key={`${a.entry.id}-${b.entry.id}`}
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke="#dfe4d9"
                            strokeWidth="1"
                          />
                        ) : null;
                      }),
                    )}
                    {nodes.map(({ entry, x, y }, i) => (
                      <g
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Connect ${entry.title}`}
                        onClick={() => {
                          setSelectedId(entry.id);
                          setDate(entry.date);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(entry.id);
                            setDate(entry.date);
                          }
                        }}
                        className="graph-node"
                      >
                        <title>
                          {entry.title} · {readableDate(entry.date)}
                        </title>
                        {i === 0 && (
                          <circle cx={x} cy={y} r="42" fill="#e5f5e8" />
                        )}
                        <circle
                          cx={x}
                          cy={y}
                          r={i === 0 ? 29 : 18}
                          fill={moodInfo(entry.mood)?.color || "#dde7db"}
                          stroke={i === 0 ? "#446f51" : "#fafbf7"}
                          strokeWidth={i === 0 ? 2 : 4}
                        />
                        {i === 0 && (
                          <text
                            x={x}
                            y={y + 5}
                            textAnchor="middle"
                            fontSize="17"
                            fill="#446f51"
                          >
                            ✦
                          </text>
                        )}
                        <text
                          x={x}
                          y={y + (i === 0 ? 62 : 35)}
                          textAnchor="middle"
                          fill="#566353"
                          fontSize={i === 0 ? 13 : 11}
                        >
                          {entry.title.length > 25
                            ? entry.title.slice(0, 24) + "…"
                            : entry.title}
                        </text>
                        <text
                          x={x}
                          y={y + (i === 0 ? 80 : 50)}
                          textAnchor="middle"
                          fill="#879081"
                          fontSize="10"
                        >
                          {readableDate(entry.date)}
                        </text>
                      </g>
                    ))}
                  </g>
                </svg>
                <div className="graph-zoom">
                  <button
                    className="icon-button"
                    aria-label="Zoom in"
                    onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Zoom out"
                    onClick={() => setZoom((z) => Math.max(0.55, z - 0.15))}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Reset graph zoom"
                    onClick={() => setZoom(1)}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              <div className="graph-legend">
                {moods.map((m) => (
                  <span key={m.id}>
                    <i style={{ background: m.color }} />
                    {m.label}
                  </span>
                ))}
              </div>
            </section>
            <aside className="card related-card">
              <span className="eyebrow">SELECTED ENTRY</span>
              <h3>{selected?.title}</h3>
              <p className="subtle">
                {selected && readableDate(selected.date)}
              </p>
              <button className="text-button" onClick={() => onOpen(selected)}>
                Read this entry
                <ArrowRight size={15} />
              </button>
              <div className="divider" />
              {ranked.length ? (
                ranked.slice(0, 5).map((r, i) => (
                  <button
                    key={r.entry.id}
                    className="related-item"
                    onClick={() => onOpen(r.entry)}
                  >
                    <span className="related-number">0{i + 1}</span>
                    <div>
                      <h4>{r.entry.title}</h4>
                      <span>
                        {readableDate(r.entry.date)} ·{" "}
                        {Math.round(r.score * 100)}% similarity
                      </span>
                      <p>
                        {r.shared.length
                          ? `Shared keywords: ${r.shared.slice(0, 3).join(", ")}`
                          : "A similar emotional tone"}
                        {r.face !== null ? " · expression data included" : ""}
                      </p>
                    </div>
                    <ArrowRight size={15} />
                  </button>
                ))
              ) : (
                <p>Add one more entry to discover your first connection.</p>
              )}
              <p className="small-note">
                Connections combine word overlap (65%) and mood (35%). When both
                entries have expression estimates, they contribute 10% and mood
                contributes 25%. Similarity is a guide, not a certainty.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
