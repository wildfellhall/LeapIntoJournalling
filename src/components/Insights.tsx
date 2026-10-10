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
  Heart,
  Sprout as SproutIcon,
  Type,
} from "lucide-react";
import { type Entry, localDate, moods, readableDate } from "../lib/types";
import { entryScore } from "../lib/analysis";
import { Sprout } from "./Illustrations";
export function Insights({
  entries,
  onDemo,
}: {
  entries: Entry[];
  onDemo: () => void;
}) {
  const [range, setRange] = useState("30");
  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(range) + 1);
    return entries
      .filter((e) => range === "all" || e.date >= localDate(cutoff))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, range]);
  const days = new Map<string, number[]>();
  filtered.forEach((e) =>
    days.set(e.date, [...(days.get(e.date) || []), entryScore(e)]),
  );
  const timeline = [...days].map(([date, values]) => ({
    date: readableDate(date),
    value: Math.round(
      (values.reduce((a, b) => a + b, 0) / values.length) * 100,
    ),
  }));
  const distribution = moods
    .map((m) => ({
      ...m,
      count: filtered.filter((e) => e.mood === m.id).length,
    }))
    .filter((m) => m.count > 0);
  const totalWords = filtered.reduce((sum, e) => sum + e.analysis.wordCount, 0),
    checkins = filtered.filter((e) => e.mood).length;
  const wordMoods = moods
    .map((m, i) => ({
      ...m,
      x: i,
      words: Math.round(
        filtered
          .filter((e) => e.mood === m.id)
          .reduce((s, e) => s + e.analysis.wordCount, 0) /
          (filtered.filter((e) => e.mood === m.id).length || 1),
      ),
      count: filtered.filter((e) => e.mood === m.id).length,
    }))
    .filter((m) => m.count > 0);
  const longest = wordMoods.slice().sort((a, b) => b.words - a.words)[0];
  const themes = Object.entries(
    filtered.reduce<Record<string, number>>((acc, e) => {
      e.analysis.keywords
        .slice(0, 5)
        .forEach((k) => (acc[k] = (acc[k] || 0) + 1));
      return acc;
    }, Object.create(null)),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <span className="eyebrow">GET TO KNOW YOUR INNER WEATHER</span>
          <h1>A little perspective.</h1>
          <p>Gentle observations from the days you’ve shared.</p>
        </div>
        <select
          aria-label="Insights date range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      {!filtered.length ? (
        <div className="card empty-state">
          <Sprout />
          <h2>
            {entries.length
              ? "A quiet stretch."
              : "Every little check-in adds up."}
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
                Moments captured
              </span>
              <strong>{filtered.length}</strong>
              <small>Each one a little act of care</small>
            </div>
            <div className="stat-card">
              <span>
                <Type size={17} />
                Words let out
              </span>
              <strong>{totalWords.toLocaleString()}</strong>
              <small>Room made for what’s inside</small>
            </div>
            <div className="stat-card">
              <span>
                <Heart size={17} />
                Mood check-ins
              </span>
              <strong>{checkins}</strong>
              <small>In your own words</small>
            </div>
            <div className="stat-card">
              <span>
                <SproutIcon size={17} />
                Days you showed up
              </span>
              <strong>{days.size}</strong>
              <small>At your own pace</small>
            </div>
          </div>
          <div className="insights-grid">
            <section className="card chart-card">
              <div className="section-title">
                <div>
                  <h3>Your emotional landscape</h3>
                  <p>Your mood check-ins over time</p>
                </div>
                <span className="tiny-tag">Daily average</span>
              </div>
              <div
                className="chart-wrap"
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
              </div>
              <p className="small-note">
                Your selected mood takes priority. Entries without a check-in
                use an approximate text sentiment score. These are reflections,
                not clinical measurements.
              </p>
            </section>
            <section className="card chart-card mood-chart">
              <h3>A mix of feelings</h3>
              <p>There’s room for every one of them.</p>
              {checkins ? (
                <>
                  <div className="donut-wrap">
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
                  Add a mood to your next entry to see your mix of feelings.
                </div>
              )}
            </section>
            <section className="card chart-card">
              <h3>When the words flow</h3>
              <p>Average word count for each feeling</p>
              {wordMoods.length ? (
                <>
                  <div className="chart-wrap short">
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
                    <strong>{longest?.label.toLowerCase()}</strong>. A little
                    thread to be curious about.
                  </p>
                </>
              ) : (
                <div className="chart-empty">
                  Mood check-ins will help connect your feelings with your
                  words.
                </div>
              )}
            </section>
            <section className="card themes-card">
              <span className="eyebrow">WHAT’S BEEN ON YOUR MIND</span>
              <h3>Familiar threads</h3>
              <p>Words that keep finding their way onto your pages.</p>
              <div className="theme-tags">
                {themes.length ? (
                  themes.map(([word, n], i) => (
                    <span key={word} className={`theme-${i % 3}`}>
                      {word}
                      <small>{n}</small>
                    </span>
                  ))
                ) : (
                  <p>Add a few words to see recurring themes.</p>
                )}
              </div>
              <div className="gentle-note">
                <Sprout />
                <p>
                  Patterns are invitations to notice.
                  <br />
                  You’re always more than a chart.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
