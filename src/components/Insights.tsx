import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  ArrowRight,
  BookOpen,
  Download,
  Heart,
  Sprout as SproutIcon,
  Type,
} from "lucide-react";
import { type Entry, moods, readableDate } from "../lib/types";
import { summarizeInsights, type InsightsRange } from "../lib/insights";
import { InsightsReport } from "./InsightsReport";
import { EmotionInsights } from "./EmotionInsights";
import { Sprout } from "./Illustrations";
export function Insights({
  entries,
  onDemo,
}: {
  entries: Entry[];
  onDemo: () => void;
}) {
  const [range, setRange] = useState<InsightsRange>("30");
  const [reportOpen, setReportOpen] = useState(false);
  const summary = useMemo(
    () => summarizeInsights(entries, range),
    [entries, range],
  );
  const { filtered, distribution, totalWords, checkins, wordMoods, themes } =
    summary;
  const timeline = summary.timeline.map((day) => ({
    ...day,
    date: readableDate(day.date),
  }));
  const longest = wordMoods.slice().sort((a, b) => b.words - a.words)[0];
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <h1>Insights</h1>
        </div>
        <div className="insights-actions">
          <select
            aria-label="Insights date range"
            value={range}
            onChange={(e) => setRange(e.target.value as InsightsRange)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button
            className="secondary"
            onClick={() => setReportOpen(true)}
            disabled={!filtered.length}
          >
            <Download size={16} />
            Download report
          </button>
        </div>
      </div>
      {reportOpen && (
        <InsightsReport
          summary={summary}
          onClose={() => setReportOpen(false)}
        />
      )}
      {!filtered.length ? (
        <div className="card empty-state">
          <Sprout />
          <h2>
            {entries.length
              ? "No entries in this date range"
              : "No insights yet"}
          </h2>
          <p>
            {entries.length
              ? "There are no entries in this date range. Try a longer view."
              : "Your mood patterns and writing habits will appear as you journal."}
          </p>
          {entries.length ? (
            <button className="secondary" onClick={() => setRange("all")}>
              See all time
            </button>
          ) : (
            <button className="secondary" onClick={onDemo}>
              Explore sample insights
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>
                <BookOpen size={17} />
                Entries
              </span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="stat-card">
              <span>
                <Type size={17} />
                Words
              </span>
              <strong>{totalWords.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <span>
                <Heart size={17} />
                Mood check-ins
              </span>
              <strong>{checkins}</strong>
            </div>
            <div className="stat-card">
              <span>
                <SproutIcon size={17} />
                Days with entries
              </span>
              <strong>{summary.days}</strong>
            </div>
          </div>
          <div className="insights-grid">
            <EmotionInsights summary={summary} />
            <section className="card chart-card">
              <div className="section-title">
                <div>
                  <h3>Mood over time</h3>
                </div>
                <span className="tiny-tag">Daily average</span>
              </div>
              {timeline.some((day) => day.value !== null) ? <div
                className="chart-wrap"
                role="img"
                aria-label="Line chart of daily mood scores"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={timeline}
                    margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#e7eae2"
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#7b8576" }}
                    />
                    <YAxis
                      domain={[-100, 100]}
                      ticks={[-100, 0, 100]}
                      tickFormatter={(n) =>
                        n === 100
                          ? "Lighter"
                          : n === 0
                            ? "In between"
                            : "Heavier"
                      }
                      width={77}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "#7b8576" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "#dfe5d9",
                      }}
                      formatter={(value) => [`${value} / 100`, "Mood tone"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#729d7b"
                      fill="#e6f2e6"
                      strokeWidth={2.5}
                      dot={{
                        r: 4,
                        fill: "#719a78",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div> : <div className="chart-empty">Add a mood check-in, writing, or a transcript to see this timeline.</div>}
              <p className="small-note">
                Uses your mood check-in, or text tone when no mood was selected.
                Entries without either are unscored.
              </p>
            </section>
            <section className="card chart-card mood-chart">
              <h3>Mood distribution</h3>
              {checkins ? (
                <>
                  <div className="donut-wrap" role="img" aria-label="Distribution of mood check-ins">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distribution}
                          dataKey="count"
                          nameKey="label"
                          innerRadius={67}
                          outerRadius={91}
                          paddingAngle={5}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {distribution.map((m) => (
                            <Cell key={m.id} fill={m.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            borderColor: "#dfe5d9",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <strong>{checkins}</strong>
                      <span>check-ins</span>
                    </div>
                  </div>
                  <div className="donut-legend">
                    {distribution.map((m) => (
                      <span key={m.id}>
                        <i style={{ background: m.color }} />
                        {m.label}
                        <b>{Math.round((m.count / checkins) * 100)}%</b>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="chart-empty">
                  Add mood check-ins to see their distribution.
                </div>
              )}
            </section>
            <section className="card chart-card">
              <h3>Words by mood</h3>
              <p>Average word count per entry</p>
              {wordMoods.length ? (
                <>
                  <div className="chart-wrap short" role="img" aria-label="Average word counts by mood check-in">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 25, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid
                          vertical={false}
                          stroke="#e7eae2"
                          strokeDasharray="4 4"
                        />
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={[-0.5, 4.5]}
                          ticks={[0, 1, 2, 3, 4]}
                          tickFormatter={(v) => moods[v]?.label || ""}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#7b8576" }}
                        />
                        <YAxis
                          type="number"
                          dataKey="words"
                          name="Average words"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#7b8576" }}
                        />
                        <ZAxis
                          type="number"
                          dataKey="count"
                          range={[180, 550]}
                          name="Entries"
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
                            const point = payload?.[0]?.payload;
                            return active && point ? (
                              <div className="chart-tooltip">
                                {point.label}: {point.words} words on average
                                <br />
                                {point.count}{" "}
                                {point.count === 1 ? "entry" : "entries"}
                              </div>
                            ) : null;
                          }}
                        />
                        <Scatter data={wordMoods} isAnimationActive={false}>
                          {wordMoods.map((m) => (
                            <Cell key={m.id} fill={m.color} stroke="#8c9e82" />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="insight-note">
                    You’ve written the most, on average, when feeling{" "}
                    <strong>{longest?.label.toLowerCase()}</strong>.
                  </p>
                </>
              ) : (
                <div className="chart-empty">
                  Add mood check-ins to compare word counts.
                </div>
              )}
            </section>
            <section className="card themes-card">
              <h3>Recurring words</h3>
              <p>Number of entries containing each keyword</p>
              <div className="theme-tags">
                {themes.length ? (
                  themes.map(([word, n], i) => (
                    <span key={word} className={`theme-${i % 3}`}>
                      {word}
                      <small>{n}</small>
                    </span>
                  ))
                ) : (
                  <p>No keywords available.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
