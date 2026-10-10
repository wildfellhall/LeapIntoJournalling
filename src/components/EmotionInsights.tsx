import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { emotionDefinitions } from "../lib/emotions";
import type { InsightsSummary } from "../lib/insights";
import { readableDate } from "../lib/types";

export function EmotionInsights({ summary }: { summary: InsightsSummary }) {
  const { emotionDistribution, emotionEntries, textEntries } = summary;
  const timeline = summary.emotionTimeline.map((day) => ({ ...day, date: readableDate(day.date) }));
  const tooltip = { borderRadius: 12, borderColor: "#dfe5d9" };
  return <>
    <section className="card chart-card emotion-timeline">
      <div className="section-title">
        <h3>Text emotions over time</h3>
        <span className="tiny-tag">Writing, transcripts & your labels</span>
      </div>
      {emotionEntries ? <>
        <div className="chart-wrap" role="img" aria-label="Daily counts of entries expressing joy, sadness, anger, fear, disgust and surprise">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline} margin={{ top: 15, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid vertical={false} stroke="#e7eae2" strokeDasharray="4 4" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltip} />
              {emotionDefinitions.map(({ id, label, color }) =>
                <Line key={id} name={label} dataKey={id} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />,
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="graph-legend">{emotionDefinitions.map(({ id, label, color }) =>
          <span key={id}><i style={{ background: color }} />{label}</span>,
        )}</div>
      </> : <div className="chart-empty">No clear text emotions in this date range.</div>}
      <p className="small-note">
        {summary.correctedEntries ? `${emotionEntries} of ${summary.emotionEligibleEntries} entries have emotion labels. ${summary.correctedEntries} reviewed by you; your labels take priority.` : `${emotionEntries} of ${textEntries} entries with text have an emotion estimate.`}
        {" "}Mixed entries can appear in several categories.
      </p>
      <details className="option-details"><summary>About these labels</summary><p>Labels come from your writing, transcripts, or corrections. Uncertain text stays unlabeled. These estimates are separate from mood check-ins.</p></details>
    </section>
    <section className="card chart-card">
      <h3>Text emotion distribution</h3>
      <p>Entries containing each estimated emotion</p>
      {emotionEntries ? <div className="chart-wrap" role="img" aria-label="Entry counts by estimated text emotion">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={emotionDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid horizontal={false} stroke="#e7eae2" strokeDasharray="4 4" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={62} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltip} />
            <Bar dataKey="count" name="Entries" radius={[0, 5, 5, 0]} isAnimationActive={false}>
              {emotionDistribution.map(({ id, color }) => <Cell key={id} fill={color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div> : <div className="chart-empty">Save writing or a transcript with emotional context to see estimates.</div>}
    </section>
    <section className="card chart-card">
      <h3>Words by text emotion</h3>
      <p>Average words per entry; mixed entries appear in each matching category</p>
      {emotionEntries ? <table className="emotion-words-table">
        <thead><tr><th scope="col">Emotion</th><th scope="col">Entries</th><th scope="col">Avg. words</th></tr></thead>
        <tbody>{emotionDistribution.filter(({ count }) => count).map(({ id, label, count, words, color }) =>
          <tr key={id}><th scope="row"><i style={{ background: color }} />{label}</th><td>{count}</td><td>{words}</td></tr>,
        )}</tbody>
      </table> : <div className="chart-empty">No classified text to compare yet.</div>}
    </section>
  </>;
}
