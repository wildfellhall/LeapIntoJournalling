import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Heart,
  LayoutGrid,
  Leaf,
  LockKeyhole,
  Menu,
  Mic,
  Network,
  PenLine,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Sprout,
  Trash2,
  TrendingUp,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Editor } from "./components/Editor";
import { Insights } from "./components/Insights";
import { Connections } from "./components/Connections";
import { EntryCard } from "./components/EntryCard";
import { Modal } from "./components/Modal";
import {
  JournalIllustration,
  MoodFace,
  Sprout as SproutArt,
} from "./components/Illustrations";
import {
  type Entry,
  type Mode,
  type Mood,
  localDate,
  moodInfo,
  moods,
  readableDate,
} from "./lib/types";
import {
  deleteEntry,
  downloadBlob,
  exportEntries,
  getEntries,
  importEntries,
  saveEntries,
} from "./lib/storage";
import { demoEntries } from "./lib/demo";
import { nextPrompt } from "./lib/prompts";
type Page = "home" | "journal" | "connections" | "insights";
const pageNames: Record<Page, string> = {
  home: "Your space",
  journal: "Your journal",
  connections: "Connections",
  insights: "Insights",
};
const modes: {
  id: Mode;
  title: string;
  description: string;
  tag: string;
  Icon: typeof PenLine;
}[] = [
  {
    id: "writing",
    title: "Put pen to page",
    description: "Let your thoughts find their own rhythm.",
    tag: "Writing journal",
    Icon: PenLine,
  },
  {
    id: "video",
    title: "Show up as you are",
    description: "Your story, your expressions, your way.",
    tag: "Video journal",
    Icon: Video,
  },
  {
    id: "voice",
    title: "Say it out loud",
    description: "Sometimes it feels better to just talk.",
    tag: "Voice memo",
    Icon: Mic,
  },
];
export default function App() {
  const [page, setPage] = useState<Page>("home"),
    [editor, setEditor] = useState<Mode | null>(null),
    [entries, setEntries] = useState<Entry[]>([]),
    [loading, setLoading] = useState(true),
    [storageError, setStorageError] = useState("");
  const [sample, setSample] = useState(false),
    [sampleEntries] = useState(demoEntries),
    [mood, setMood] = useState<Mood | null>(null),
    [prompt, setPrompt] = useState(
      "What’s one small thing that made today feel a little lighter?",
    ),
    [initialPrompt, setInitialPrompt] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false),
    [modePicker, setModePicker] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [toast, setToast] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [moodFilter, setMoodFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [settingsMessage, setSettingsMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = sample ? sampleEntries : entries;
  async function refresh() {
    const loaded = await getEntries();
    setEntries(loaded);
  }
  useEffect(() => {
    refresh()
      .catch(() =>
        setStorageError(
          "Browser storage is unavailable. Enable storage for this site before saving entries.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(next: Page) {
    if (editor) return;
    setPage(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function start(mode: Mode, withPrompt = "") {
    setSample(false);
    setInitialPrompt(withPrompt);
    setEditor(mode);
    setModePicker(false);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function save(entry: Entry) {
    await saveEntries([entry]);
    await refresh();
    setEditor(null);
    setPage("journal");
    setToast("A little piece of your day, safely kept.");
    setMood(null);
  }
  const totalWords = shown.reduce((s, e) => s + e.analysis.wordCount, 0),
    days = new Set(shown.map((e) => e.date)).size;
  const filtered = shown.filter(
    (e) =>
      (filter === "all" || e.mode === filter) &&
      (moodFilter === "all" || e.mood === moodFilter) &&
      `${e.title} ${e.text}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function backup() {
    setBusy(true);
    setSettingsMessage("");
    try {
      await exportEntries(entries);
      setSettingsMessage(
        "Your backup includes entries and recordings. Keep it somewhere private.",
      );
    } catch {
      setSettingsMessage(
        "The backup could not be created. Try again with more available memory.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function restore(file: File) {
    setBusy(true);
    setSettingsMessage("");
    try {
      const n = await importEntries(file);
      await refresh();
      setSettingsMessage(
        `Restored ${n} ${n === 1 ? "entry" : "entries"}. Matching entry IDs were updated.`,
      );
      setSample(false);
    } catch (e) {
      setSettingsMessage(
        (e as Error).message || "The backup could not be read.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("home")}
          disabled={!!editor}
          aria-label="Leap home"
        >
          <span className="brand-icon">
            <Leaf size={29} strokeWidth={1.6} />
          </span>
          <span>
            <strong>
              leap<span className="brand-period">.</span>
            </strong>
            <small>into journalling</small>
          </span>
        </button>
        <div className="sidebar-label">YOUR LITTLE CORNER</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "home", Icon: LayoutGrid },
              { id: "journal", Icon: BookOpen },
              { id: "connections", Icon: Network },
              { id: "insights", Icon: TrendingUp },
            ] as const
          ).map(({ id, Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id && !editor ? "active" : ""}`}
              aria-current={page === id && !editor ? "page" : undefined}
              disabled={!!editor}
              title={
                editor
                  ? "Use Back to your space to leave the editor"
                  : undefined
              }
              onClick={() => navigate(id)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{pageNames[id]}</span>
              {id === "journal" && entries.length > 0 && (
                <b>{entries.length}</b>
              )}
              {page === id && !editor && <i />}
            </button>
          ))}
        </nav>
        <button
          className="sidebar-new"
          disabled={!!editor}
          onClick={() => setModePicker(true)}
        >
          <Plus size={18} />A new little moment
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <SproutArt />
            <p>
              Small moments.
              <br />
              Meaningful beginnings.
            </p>
            <span>grow at your own pace.</span>
          </div>
          <button
            className="nav-item"
            disabled={!!editor}
            onClick={() => setSettings(true)}
          >
            <Settings2 size={18} />
            <span>Settings & your data</span>
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            <span>A little guidance</span>
          </button>
          <div className="privacy-label">
            <LockKeyhole size={13} />A space that’s only yours
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={22} />
            </button>
            <span>Your journal, your journey</span>
            <ChevronRight size={13} />
            <strong>
              {editor
                ? modes.find((m) => m.id === editor)?.tag
                : pageNames[page]}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="today-date">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="profile-avatar" aria-label="Your personal space">
              <Leaf size={20} />
            </span>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {storageError && (
            <div className="error-message" role="alert">
              {storageError}
            </div>
          )}
          {sample && !editor && (
            <div className="sample-banner">
              <span>
                <Sparkles size={15} />
                You’re exploring a sample journal. These moments are just
                examples.
              </span>
              <button onClick={() => setSample(false)}>
                Back to my journal
                <X size={14} />
              </button>
            </div>
          )}
          {editor ? (
            <Editor
              key={editor}
              mode={editor}
              initialMood={mood}
              initialPrompt={initialPrompt}
              onBack={() => setEditor(null)}
              onSave={save}
            />
          ) : loading ? (
            <div className="empty-state">
              <SproutArt />
              <p>Making a little room for you…</p>
            </div>
          ) : page === "home" ? (
            <div className="page-enter">
              <div className="welcome-line">
                <span>
                  <i /> A FRESH PAGE, A NEW POSSIBILITY
                </span>
                <button
                  className="text-button sample-link"
                  onClick={() => setSample((s) => !s)}
                >
                  {sample ? "Return to my journal" : "Explore a sample journal"}
                  <ArrowRight size={14} />
                </button>
              </div>
              <section className="welcome-card">
                <div className="welcome-copy">
                  <span className="eyebrow">WELCOME TO YOUR LITTLE CORNER</span>
                  <h1>
                    A little space.
                    <br />A lot of <em>you.</em>
                  </h1>
                  <p>
                    For the messy thoughts, the quiet wins, and everything
                    <br className="desktop-only" /> in between. You can put it
                    all here.
                  </p>
                  <button className="primary" onClick={() => start("writing")}>
                    <PenLine size={17} />
                    Let’s make a little room
                    <ArrowRight size={17} />
                  </button>
                  <span className="welcome-footnote">
                    No right words. No wrong feelings. Just you.
                  </span>
                </div>
                <div className="welcome-art">
                  <JournalIllustration />
                  <span className="art-caption handwritten">
                    a place to begin, again & again
                  </span>
                </div>
              </section>
              <section className="start-section">
                <div className="section-heading">
                  <div>
                    <h2>How would you like to show up?</h2>
                    <p>There’s more than one way to let it out.</p>
                  </div>
                  <span className="handwritten small-handwriting">
                    come as you are ↙
                  </span>
                </div>
                <div className="mode-grid">
                  {modes.map(({ id, title, description, tag, Icon }) => (
                    <button
                      key={id}
                      className={`mode-card mode-${id}`}
                      onClick={() => start(id)}
                    >
                      <div className="mode-card-top">
                        <span className="mode-icon">
                          <Icon size={24} strokeWidth={1.5} />
                        </span>
                        <ArrowRight size={20} />
                      </div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                      <span className="mode-tag">{tag}</span>
                      <span className="mode-doodle" aria-hidden="true">
                        {id === "writing" ? "✎" : id === "video" ? "✧" : "〰"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="home-middle">
                <section className="card check-in-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">A LITTLE CHECK-IN</span>
                      <h3>What’s your inner weather?</h3>
                    </div>
                    <Heart size={20} strokeWidth={1.5} />
                  </div>
                  <div className="mood-options horizontal">
                    {moods.map((m) => (
                      <button
                        key={m.id}
                        className={mood === m.id ? "selected" : ""}
                        aria-pressed={mood === m.id}
                        onClick={() => setMood(mood === m.id ? null : m.id)}
                      >
                        <MoodFace mood={m.id} size={42} />
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="small-note">
                    {mood
                      ? `${moodInfo(mood)?.label} — we’ll carry this check-in into your next entry.`
                      : "Whatever it is, there’s room for it here."}
                  </p>
                </section>
                <section className="card daily-prompt">
                  <div className="prompt-heading">
                    <span className="eyebrow">
                      <Sparkles size={15} /> A THOUGHT TO START WITH
                    </span>
                    <button
                      className="icon-button"
                      aria-label="Shuffle daily prompt"
                      onClick={() => setPrompt(nextPrompt("writing", prompt))}
                    >
                      <Shuffle size={17} />
                    </button>
                  </div>
                  <p className="prompt-text">{prompt}</p>
                  <button
                    className="text-button"
                    onClick={() => start("writing", prompt)}
                  >
                    Follow this thought
                    <ArrowRight size={16} />
                  </button>
                  <span className="prompt-flower" aria-hidden="true">
                    ✳
                  </span>
                </section>
              </div>
              <section className="recent-section">
                <div className="section-heading">
                  <div>
                    <h2>Your little collection of days</h2>
                    <p>Every moment you keep is part of your story.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("journal")}
                  >
                    View your journal
                    <ArrowRight size={16} />
                  </button>
                </div>
                {shown.length ? (
                  <div className="entry-grid">
                    {shown.slice(0, 3).map((e) => (
                      <EntryCard key={e.id} entry={e} onOpen={setSelected} />
                    ))}
                  </div>
                ) : (
                  <div className="first-entry-card">
                    <span className="first-entry-icon">
                      <BookOpen size={27} strokeWidth={1.4} />
                    </span>
                    <div>
                      <h3>Your first page is waiting.</h3>
                      <p>
                        It doesn’t have to be a big day to be worth remembering.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => start("writing")}
                    >
                      Begin your story
                      <ArrowRight size={17} />
                    </button>
                  </div>
                )}
              </section>
              <footer className="page-footer">
                <Leaf size={14} />
                <span>A little reflection goes a long way.</span>
                <span className="footer-private">
                  <LockKeyhole size={12} />
                  Stored on this device
                </span>
              </footer>
            </div>
          ) : page === "journal" ? (
            <div className="page-enter">
              <div className="page-heading">
                <div>
                  <span className="eyebrow">A COLLECTION OF YOU</span>
                  <h1>Your little collection of days.</h1>
                  <p>
                    {shown.length} moments · {days} days ·{" "}
                    {totalWords.toLocaleString()} words, each one yours.
                  </p>
                </div>
                <button className="primary" onClick={() => setModePicker(true)}>
                  <Plus size={18} />
                  New entry
                </button>
              </div>
              <div className="journal-filters">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search your journal"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find a thought, a feeling, a day…"
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                </label>
                <div className="filter-tabs" aria-label="Journal mode filter">
                  {["all", "writing", "video", "voice"].map((m) => (
                    <button
                      key={m}
                      aria-pressed={filter === m}
                      className={filter === m ? "active" : ""}
                      onClick={() => setFilter(m)}
                    >
                      {m === "all"
                        ? "All moments"
                        : m === "voice"
                          ? "Voice"
                          : m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
                <select
                  aria-label="Filter by mood"
                  value={moodFilter}
                  onChange={(e) => setMoodFilter(e.target.value)}
                >
                  <option value="all">Every feeling</option>
                  {moods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {filtered.length ? (
                <div className="entry-grid journal-grid">
                  {filtered.map((e) => (
                    <EntryCard key={e.id} entry={e} onOpen={setSelected} />
                  ))}
                </div>
              ) : (
                <div className="card empty-state">
                  <SproutArt />
                  <h2>
                    {shown.length
                      ? "No moments found."
                      : "A fresh start, just for you."}
                  </h2>
                  <p>
                    {shown.length
                      ? "Try a different word, feeling, or journal mode."
                      : "Write it, film it, or say it out loud. Your story starts wherever you are."}
                  </p>
                  {shown.length ? (
                    <button
                      className="secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                        setMoodFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => setModePicker(true)}
                    >
                      <Plus size={17} />
                      Create your first entry
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : page === "connections" ? (
            <Connections
              key={sample ? "sample" : "personal"}
              entries={shown}
              onOpen={setSelected}
              onDemo={() => setSample(true)}
            />
          ) : (
            <Insights entries={shown} onDemo={() => setSample(true)} />
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modePicker && (
        <Modal
          title="Make a little room for yourself."
          onClose={() => setModePicker(false)}
        >
          <p>How would you like to capture this moment?</p>
          <div className="mode-picker">
            {modes.map(({ id, title, description, Icon }) => (
              <button
                key={id}
                className={`mode-picker-item mode-${id}`}
                onClick={() => start(id)}
              >
                <Icon size={25} />
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <ArrowRight size={19} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {selected && (
        <EntryDetail
          entry={selected}
          onClose={() => setSelected(null)}
          onDelete={async () => {
            await deleteEntry(selected.id);
            await refresh();
            setSelected(null);
            setToast("Entry deleted from this device.");
          }}
        />
      )}
      {settings && (
        <Modal
          title="Your space, your choices."
          onClose={() => {
            if (!busy) setSettings(false);
          }}
        >
          <div className="settings-privacy">
            <ShieldCheck size={28} />
            <div>
              <h3>Your journal stays on this device.</h3>
              <p>
                Entries, expression estimates, and recordings are stored in this
                browser. Clearing site data removes them. Download a backup to
                keep a separate copy.
              </p>
            </div>
          </div>
          <div className="settings-stat">
            <span>Saved in your journal</span>
            <strong>{entries.length} entries</strong>
          </div>
          <div className="settings-actions">
            <button
              className="secondary"
              disabled={busy || !entries.length}
              onClick={backup}
            >
              <ArrowDownToLine size={18} />
              {busy ? "Working…" : "Download full backup"}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={18} />
              Restore a backup
            </button>
            <input
              className="sr-only"
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void restore(file);
              }}
            />
          </div>
          <p className="small-note">
            Backups include recordings and are not encrypted. Restoring merges
            entries and updates matching IDs. Keep your backup private. Maximum
            import size: 100 MB.
          </p>
          {settingsMessage && (
            <p className="settings-message" role="status">
              {settingsMessage}
            </p>
          )}
          <div className="divider" />
          <h3>A few things to know</h3>
          <ul className="help-list">
            <li>
              No account or cloud sync is needed. This journal belongs to this
              browser and device.
            </li>
            <li>
              The app does not request camera or microphone access until you
              choose to enable it.
            </li>
            <li>
              Expression analysis runs here. Optional live transcription may use
              your browser’s speech service.
            </li>
            <li>
              Sentiment uses a small English word lexicon. It can miss nuance,
              sarcasm, and other languages; your selected mood takes priority.
            </li>
            <li>
              Voice energy measures loudness, not emotion. We do not infer
              feelings from your voice.
            </li>
          </ul>
        </Modal>
      )}
      {help && (
        <Modal
          title="There’s no right way to begin."
          onClose={() => setHelp(false)}
        >
          <div className="help-intro">
            <SproutArt />
            <p>
              A few honest words. A voice memo on a walk. A quiet conversation
              with your camera. It all counts.
            </p>
          </div>
          <div className="help-step">
            <span>01</span>
            <div>
              <h3>Choose how you show up</h3>
              <p>
                Write, record a video, or make a voice memo. Shuffle through
                prompts when you need a starting point.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span>02</span>
            <div>
              <h3>Make it feel like you</h3>
              <p>
                Add a mood, change your paper, or leave a little note in the
                margin. Camera analysis and transcription are always optional.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span>03</span>
            <div>
              <h3>Notice the threads</h3>
              <p>
                Your connections and insights grow with your journal. They’re
                gentle prompts for reflection, never a diagnosis.
              </p>
            </div>
          </div>
          <button
            className="secondary full-width"
            onClick={() => {
              setHelp(false);
              if (!editor) {
                setSample(true);
                setPage("connections");
              }
            }}
            disabled={!!editor}
          >
            Explore a sample journal
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </div>
  );
}

function EntryDetail({
  entry,
  onClose,
  onDelete,
}: {
  entry: Entry;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [url, setUrl] = useState(""),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!entry.recording) return;
    const u = URL.createObjectURL(entry.recording);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [entry]);
  const mood = moodInfo(entry.mood),
    expressionAverages = Object.entries(
      entry.expressions.reduce<Record<string, number>>((acc, s) => {
        Object.entries(s.scores).forEach(
          ([k, v]) => (acc[k] = (acc[k] || 0) + v / entry.expressions.length),
        );
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);
  return (
    <Modal title={entry.title} onClose={onClose} wide>
      <div className="detail-meta">
        <span>
          <CalendarDays size={14} />
          {readableDate(entry.date, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span>
          {entry.mode === "writing"
            ? "Writing journal"
            : entry.mode === "video"
              ? "Video journal"
              : "Voice memo"}
        </span>
        {entry.demo && <span className="badge">Sample entry</span>}
      </div>
      {url &&
        (entry.mode === "video" ? (
          <video src={url} controls className="detail-video" />
        ) : (
          <audio src={url} controls className="detail-audio" />
        ))}
      {entry.prompt && (
        <blockquote className="detail-prompt">{entry.prompt}</blockquote>
      )}
      <div
        className={`detail-paper paper-${entry.decoration.paper} font-${entry.decoration.font}`}
      >
        <p className={`detail-text highlight-${entry.decoration.highlight}`}>
          {entry.text || "This moment lives in your recording."}
        </p>
        {entry.decoration.stickers.length > 0 && (
          <div className="detail-stickers">
            {entry.decoration.stickers.join(" ")}
          </div>
        )}
        {entry.decoration.note && (
          <div className="sticky-note">{entry.decoration.note}</div>
        )}
      </div>
      <div className="detail-summary">
        {mood && (
          <span className="mood-label">
            <MoodFace mood={mood.id} size={26} />
            You felt {mood.label.toLowerCase()}
          </span>
        )}
        <span>{entry.analysis.wordCount} words</span>
        {entry.duration && (
          <span>
            {Math.floor(entry.duration / 60)}m {entry.duration % 60}s recorded
          </span>
        )}
      </div>
      <details className="analysis-details">
        <summary>Explore this entry’s signals</summary>
        <p>
          Text sentiment:{" "}
          <strong>
            {entry.analysis.score > 0.15
              ? "Leaning positive"
              : entry.analysis.score < -0.15
                ? "Leaning negative"
                : "Mixed or neutral"}
          </strong>
          . Local English lexicon estimate.{" "}
          {entry.mood
            ? "Your own mood check-in takes priority."
            : "Add a mood in your next entry for a personal check-in."}
        </p>
        <p>
          Keywords:{" "}
          {entry.analysis.keywords.join(", ") || "No recurring keywords yet."}
        </p>
        <p>
          {entry.expressions.length
            ? `${entry.expressions.length} expression samples. Average estimates: ${expressionAverages
                .slice(0, 4)
                .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
                .join(", ")}. These do not establish how you felt.`
            : "No facial-expression samples collected."}
        </p>
        {entry.voiceEnergy && (
          <p>
            Average voice energy: {entry.voiceEnergy.average.toFixed(3)} RMS ·
            peak {entry.voiceEnergy.peak.toFixed(3)}. This is an acoustic
            measurement, not emotion recognition.
          </p>
        )}
      </details>
      <div className="detail-actions">
        {entry.recording && (
          <button
            className="secondary"
            onClick={() =>
              downloadBlob(
                entry.recording!,
                `leap-${entry.date}.${entry.recording!.type.includes("mp4") ? "mp4" : "webm"}`,
              )
            }
          >
            <ArrowDownToLine size={16} />
            Download recording
          </button>
        )}
        {!entry.demo && (
          <button
            className="text-button danger-text"
            onClick={() => setConfirm(true)}
          >
            <Trash2 size={15} />
            Delete entry
          </button>
        )}
      </div>
      {confirm && (
        <div className="delete-confirm" role="alert">
          <p>
            Delete this entry and its recording from this device? This cannot be
            undone.
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Keep entry
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                } catch {
                  setError("Could not delete this entry. Please try again.");
                  setBusy(false);
                }
              }}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
