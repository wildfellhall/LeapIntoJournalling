import { entryEmotions, entryEmotionDescription } from "../lib/signals";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { type Entry, moods, moodInfo, readableDate } from "../lib/types";
import { createConnectionIndex } from "../lib/analysis";
import { emotionDefinitions, emotionLabels } from "../lib/emotions";
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
  const [colorBy, setColorBy] = useState("emotion");
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousZoom = useRef(1);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      const ratio = zoom / previousZoom.current;
      viewport.scrollLeft = (viewport.scrollLeft + viewport.clientWidth / 2) * ratio - viewport.clientWidth / 2;
      viewport.scrollTop = (viewport.scrollTop + viewport.clientHeight / 2) * ratio - viewport.clientHeight / 2;
    }
    previousZoom.current = zoom;
  }, [zoom]);
  const selected = entries.find((e) => e.id === selectedId) || entries[0];
  useEffect(() => {
    if ((selected?.id ?? "") !== selectedId) {
      setSelectedId(selected?.id ?? "");
      setDate(selected?.date ?? "");
      setNotice("");
      setZoom(1);
    }
  }, [selected, selectedId]);
  const index = useMemo(() => createConnectionIndex(entries), [entries]);
  const ranked = useMemo(() => selected ? index.rank(selected) : [], [selected, index]);
  const nodes = useMemo(() => {
    if (!selected) return [];
    const matches = ranked.slice(0, 8);
    return [{ entry: selected, x: 370, y: 240 }, ...matches.map((match, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(3, matches.length);
      const distance = 175 + (1 - match.content) * 70;
      return { entry: match.entry, x: 370 + Math.cos(angle) * distance, y: 240 + Math.sin(angle) * distance * 0.7 };
    })];
  }, [ranked, selected]);
  const crossLinks = useMemo(() => {
    const candidates = nodes.slice(1).flatMap((a, i) => nodes.slice(i + 2).map((b) => ({ a, b, match: index.compare(a.entry, b.entry) })))
      .filter(({ match }) => match.eligible && match.content >= 0.25).sort((a, b) => b.match.score - a.match.score);
    const degree = new Map<string, number>();
    return candidates.filter(({ a, b }) => {
      if ((degree.get(a.entry.id) ?? 0) >= 2 || (degree.get(b.entry.id) ?? 0) >= 2) return false;
      degree.set(a.entry.id, (degree.get(a.entry.id) ?? 0) + 1);
      degree.set(b.entry.id, (degree.get(b.entry.id) ?? 0) + 1);
      return true;
    });
  }, [nodes, index]);
  function selectEntry(entry: Entry) {
    setSelectedId(entry.id);
    setDate(entry.date);
    setNotice("");
    setZoom(1);
  }
  function find() {
    const matches = entries.filter((e) => e.date === date);
    if (matches.length) {
      selectEntry(matches[0]);
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
          <p>Find shared topics and recurring experiences in your entries.</p>
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
                  selectEntry(entries.find((x) => x.id === e.target.value)!);
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
                  <p>Lines show shared topics in writing or transcripts.</p>
                </div>
                <span className="tiny-tag">
                  {ranked.length} content {ranked.length === 1 ? "match" : "matches"}
                </span>
                <select aria-label="Color graph nodes by" value={colorBy} onChange={(event) => setColorBy(event.target.value)}>
                  <option value="emotion">Text emotion</option>
                  <option value="mood">Mood check-in</option>
                </select>
              </div>
              <div className="graph-canvas" ref={viewportRef} tabIndex={0} role="group" aria-label="Scrollable journal connections">
                <svg
                  viewBox="0 0 740 480"
                  style={{ width: `${zoom * 100}%`, height: `calc(var(--graph-height) * ${zoom})` }}
                  role="group"
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
                  <g>
                    {nodes.slice(1).map((node, i) => {
                      const r = ranked[i];
                      return (
                        <line
                          key={node.entry.id}
                          x1="370"
                          y1="240"
                          x2={node.x}
                          y2={node.y}
                          stroke="#86b49a"
                          strokeWidth={1.5 + r.content * 2}
                          vectorEffect="non-scaling-stroke"
                          className="connection-edge"
                          data-source={selected.id}
                          data-target={node.entry.id}
                        >
                          <title>
                            Shared topics: {r.shared.slice(0, 4).join(", ")}
                          </title>
                        </line>
                      );
                    })}
                    {crossLinks.map(({ a, b, match }) => (
                      <line key={JSON.stringify([a.entry.id, b.entry.id])} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#aabdad" strokeWidth="1.25" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" className="connection-edge connection-edge-secondary" data-source={a.entry.id} data-target={b.entry.id}>
                        <title>Shared topics: {match.shared.slice(0, 4).join(", ")}</title>
                      </line>
                    ))}
                    {nodes.map(({ entry, x, y }, i) => (
                      <g
                        key={entry.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Connect ${entry.title}`}
                        aria-pressed={i === 0}
                        onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
                        onClick={() => selectEntry(entry)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectEntry(entry);
                          }
                        }}
                        className="graph-node"
                        data-entry-id={entry.id}
                      >
                        <title>
                          {entry.title} · {readableDate(entry.date)} · {entry.emotionCorrection ? "Your labels" : "Text estimate"}: {entryEmotionDescription(entry)}
                        </title>
                        <rect x={x - 48} y={y - 48} width="96" height="96" fill="transparent" aria-hidden="true" />
                        {i === 0 && (
                          <circle cx={x} cy={y} r="42" fill="#e5f5e8" />
                        )}
                        <circle
                          cx={x}
                          cy={y}
                          r={i === 0 ? 34 : 25}
                          fill={(colorBy === "emotion" ? emotionLabels(entryEmotions(entry))[0]?.color : moodInfo(entry.mood)?.color) || "#dde7db"}
                          stroke={i === 0 ? "#446f51" : "#fafbf7"}
                          strokeWidth={i === 0 ? 2 : 4}
                        />
                        <text x={x} y={y + 5} textAnchor="middle" fontSize={i === 0 ? 17 : 14} fill="#344d3e" fontWeight="600">{i === 0 ? "✦" : i}</text>
                        <text className="graph-node-label" x={x} y={y + (i === 0 ? 60 : 38)} textAnchor="middle" fill="#566353" fontSize="12">
                          {i === 0 ? "Selected entry" : entry.title.length > 22 ? entry.title.slice(0, 21) + "…" : entry.title}
                        </text>
                      </g>
                    ))}
                  </g>
                </svg>
              </div>
              <div className="graph-zoom">
                {zoom > 1 && <span>Scroll to explore</span>}
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  disabled={zoom >= 2}
                  onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  disabled={zoom <= 1}
                  onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
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
              <div className="graph-legend">
                {(colorBy === "emotion" ? emotionDefinitions : moods).map((m) => (
                  <span key={m.id}>
                    <i style={{ background: m.color }} />
                    {m.label}
                  </span>
                ))}
                <span><i style={{ background: "#dde7db" }} />{colorBy === "emotion" ? "No clear estimate" : "No check-in"}</span>
              </div>
            </section>
            <aside className="card related-card">
              <span className="eyebrow">SELECTED ENTRY</span>
              <h3>{selected?.title}</h3>
              <p className="subtle">
                {selected && readableDate(selected.date)}
              </p>
              <p className="subtle">{selected?.emotionCorrection ? "Your labels" : "Text estimate"}: {selected && entryEmotionDescription(selected)}</p>
              <button className="text-button" onClick={() => onOpen(selected)}>
                Read this entry
                <ArrowRight size={15} />
              </button>
              <div className="divider" />
              {ranked.length ? (
                ranked.slice(0, 8).map((r, i) => (
                  <button key={r.entry.id} className="related-item" onClick={() => onOpen(r.entry)}>
                    <span className="related-number">{i + 1}</span>
                    <div>
                      <h4>{r.entry.title}</h4>
                      <span>{readableDate(r.entry.date)} · {r.content >= 0.5 ? "Strong" : "Some"} content overlap</span>
                      <p>Shared topics: {r.shared.slice(0, 3).join(", ")}</p>
                      {r.sharedEmotions.length > 0 && <p className="related-emotions">Also: {r.sharedEmotions.join(", ")}</p>}
                    </div>
                    <ArrowRight size={15} />
                  </button>
                ))
              ) : (
                <p className="connection-empty">{entries.length < 2 ? "Add another entry to look for shared topics." : "No clear content connections yet. A shared mood alone does not create a link."}</p>
              )}
              {ranked.length > 8 && <p className="small-note">Showing the 8 closest matches. Choose any entry above to explore another part of your journal.</p>}
              <details className="connection-method">
                <summary>How connections work</summary>
                <p>Solid lines connect the selected entry; dashed lines connect other matches. Thicker lines indicate more shared content.</p>
                <p>Shared words, phrases, and common word variants form the links. Titles provide context; writing or a transcript is required. Emotions and check-ins can refine a content match, but cannot create one.</p>
                <p>Content has at least 80% of the weight; check-ins have at most 5%. Colors show emotion or mood, not the reason for a link. These are text patterns, not causes or clinical findings.</p>
              </details>
            </aside>
          </div>
          <section className="card recurring-patterns" aria-label="Recurring topics">
            <div className="section-title"><h3>Recurring topics</h3><span className="tiny-tag">Across 3 or more days</span></div>
            {index.patterns.length ? <div className="pattern-grid">{index.patterns.map((pattern) => (
              <details key={pattern.term} className="pattern-item">
                <summary><strong>{pattern.term}</strong><span>{pattern.entries.length} entries · {pattern.days} days</span></summary>
                <p className="small-note">{readableDate(pattern.firstDate)} – {readableDate(pattern.lastDate)} · Related words are grouped. Repeated mentions do not establish a cause.</p>
                <div className="pattern-entries">{pattern.entries.map((entry) => <button key={entry.id} className="text-button" onClick={() => onOpen(entry)}><span>{entry.title}</span><small>{readableDate(entry.date)}</small><ArrowRight size={14} /></button>)}</div>
              </details>
            ))}</div> : <p className="small-note">Topics will appear when they recur in writing or transcripts on at least three different days.</p>}
          </section>
        </>
      )}
    </div>
  );
}
