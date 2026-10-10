import type {
  Content,
  ContentTable,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { InsightsSummary } from "./insights";
import { localDate, moodInfo, readableDate } from "./types";
import { downloadBlob } from "./storage";
import { reportText } from "./reportText";
import { entryEmotionDescription } from "./signals";

export interface ReportOptions {
  includeEntries: boolean;
  note: string;
}

const ink = "#253C35";
const muted = "#57685F";
const sage = "#476E59";
const pale = "#EFF5EF";
const line = "#D8E2DA";
const modeNames = { writing: "Writing", voice: "Voice memo", video: "Video" };
const fullDate = (date: string) =>
  readableDate(date, { month: "short", day: "numeric", year: "numeric" });
const heading = (text: string): Content => ({
  text,
  style: "section",
  headlineLevel: 1,
});
const paragraph = (text: string): Content => ({ text, margin: [0, 0, 0, 9] });

function table(
  headers: string[],
  rows: (string | number)[][],
  widths: (number | "*" | "auto")[],
  compact = false,
): ContentTable {
  return {
    table: {
      widths,
      headerRows: 1,
      dontBreakRows: true,
      keepWithHeaderRows: 1,
      body: [
        headers.map((text) => ({
          text,
          bold: true,
          fillColor: pale,
          color: ink,
          fontSize: 9,
        })),
        ...rows.map((row) =>
          row.map((value) => ({
            text: String(value),
            fontSize: 10,
            lineHeight: compact ? 1.1 : 1.25,
          })),
        ),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => line,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => (compact ? 3 : 6),
      paddingBottom: () => (compact ? 3 : 6),
    },
    margin: [0, 0, 0, 9],
  };
}

function timelineChart(summary: InsightsSummary): Content {
  // Vector marks stay sharp in print. The following table supplies all exact values.
  const width = 500,
    height = 105,
    left = 42,
    right = 490,
    top = 12,
    bottom = 80;
  const first = Date.parse(summary.timeline[0].date + "T12:00:00Z");
  const last = Date.parse(summary.timeline.at(-1)!.date + "T12:00:00Z");
  const x = (date: string) =>
    last === first
      ? (left + right) / 2
      : left +
        ((Date.parse(date + "T12:00:00Z") - first) / (last - first)) *
          (right - left);
  const y = (value: number) => top + ((100 - value) / 200) * (bottom - top);
  const grid = [-100, 0, 100]
    .map(
      (value) =>
        `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" stroke="${line}"/><text x="0" y="${y(value) + 3}" font-size="9" fill="${muted}">${value > 0 ? "+" : ""}${value}</text>`,
    )
    .join("");
  let previous: { date: string; value: number } | null = null;
  const marks = summary.timeline
    .map((day) => {
      if (day.value === null) {
        previous = null;
        return "";
      }
      const join = previous
        ? `<line x1="${x(previous.date)}" y1="${y(previous.value)}" x2="${x(day.date)}" y2="${y(day.value)}" stroke="${sage}" stroke-width="1.5"/>`
        : "";
      previous = { date: day.date, value: day.value };
      return `${join}<circle cx="${x(day.date)}" cy="${y(day.value)}" r="2.5" fill="${sage}"/>`;
    })
    .join("");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Roboto">${grid}${marks}<text x="${left}" y="100" font-size="9" fill="${muted}">${summary.timeline[0].date}</text>${last !== first ? `<text x="${right}" y="100" text-anchor="end" font-size="9" fill="${muted}">${summary.timeline.at(-1)!.date}</text>` : ""}</svg>`,
    width: 500,
    margin: [0, 3, 0, 7],
  };
}

export function createReportDefinition(
  summary: InsightsSummary,
  options: ReportOptions,
  now = new Date(),
): TDocumentDefinitions {
  if (!summary.filtered.length)
    throw new Error("There are no entries in this date range.");
  const note = options.note.trim();
  const sourceStrings = [
    note,
    ...summary.themes.map(([word]) => word),
    ...(options.includeEntries
      ? summary.filtered.flatMap((entry) => [entry.title, entry.text])
      : []),
  ];
  const hasEscapedCharacters = sourceStrings.some(
    (value) => reportText(value) !== value.normalize("NFC"),
  );
  const n = summary.filtered.length;
  const modeCounts = Object.entries(modeNames)
    .map(
      ([mode, label]) =>
        `${summary.filtered.filter((entry) => entry.mode === mode).length} ${label.toLowerCase()}`,
    )
    .join(" / ");
  const content: Content[] = [
    { text: "LEAP INTO JOURNALLING", style: "eyebrow", margin: [0, 0, 0, 10] },
    {
      text: summary.sample ? "Sample insights report" : "Journal insights",
      style: "title",
    },
    {
      text: `${fullDate(summary.start)} - ${fullDate(summary.end)}`,
      fontSize: 13,
      color: sage,
      margin: [0, 6, 0, 7],
    },
    {
      text: `${summary.rangeLabel} | Generated ${fullDate(localDate(now))} | ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
      style: "small",
      margin: [0, 0, 0, 14],
    },
    ...(summary.sample
      ? [
          {
            text: "SAMPLE DATA - This report contains fictional example entries, not a person's journal history.",
            bold: true,
            color: sage,
            margin: [0, 0, 0, 12],
          } as Content,
        ]
      : []),
    {
      text: "A personal reflection record for shared understanding",
      fontSize: 12,
      bold: true,
      margin: [0, 0, 0, 6],
    },
    paragraph(
      "This report describes saved journal entries in the selected period. Mood check-ins are self-reported; text estimates are automated. It is not a clinical assessment or a complete record of daily wellbeing.",
    ),
    {
      table: {
        widths: ["*", "*", "*", "*"],
        body: [
          [
            [String(n), "Entries"],
            [String(summary.days), "Days with entries"],
            [String(summary.checkins), "Mood check-ins"],
            [summary.totalWords.toLocaleString("en-US"), "Words / transcripts"],
          ].map(([value, label]) => ({
            stack: [
              { text: value, fontSize: 23, bold: true, color: ink },
              { text: label, fontSize: 9, color: muted, margin: [0, 4, 0, 0] },
            ],
            fillColor: pale,
            margin: [10, 10, 5, 10],
          })),
        ],
      },
      layout: "noBorders",
      margin: [0, 5, 0, 12],
    },
    {
      text: `Entry formats: ${modeCounts}.`,
      style: "small",
      margin: [0, 0, 0, 8],
    },
    ...(note
      ? [heading("Context from the journal owner"), paragraph(reportText(note))]
      : []),
    heading("Self-reported moods"),
    paragraph(
      `${summary.checkins} of ${n} entries include a mood check-in. ${n - summary.checkins} have no selected mood. Percentages below use only the ${summary.checkins} check-ins; averages use saved text or transcripts, including entries with zero words.`,
    ),
    ...(summary.checkins
      ? [
          table(
            ["Selected mood", "Entries", "Share of check-ins", "Average words"],
            summary.distribution.map((mood) => [
              mood.label,
              mood.count,
              `${Math.round((mood.count / summary.checkins) * 100)}%`,
              mood.words,
            ]),
            ["*", 52, 110, 85],
          ),
        ]
      : [
          paragraph(
            "No mood check-ins were recorded in this period. Automated estimates are not substituted for self-reported moods here.",
          ),
        ]),
    {
      unbreakable: true,
      stack: [
        heading("Emotion labels"),
        paragraph(
          `${summary.emotionEntries} of ${summary.emotionEligibleEntries} eligible entries have emotion labels. Entries reviewed by the user: ${summary.correctedEntries}. User labels override automatic text estimates. Automatic labels describe language; user labels reflect their own report. Mixed entries count in each matching category, so totals can exceed the number of entries. Neutral and uncertain text remain unlabeled.`,
        ),
        ...(summary.emotionEntries ? [table(
          ["Emotion", "User labels", "Text estimates", "Total entries", "Avg. words"],
          summary.emotionDistribution.filter((emotion) => emotion.count).map((emotion) => [emotion.label, emotion.confirmed, emotion.estimated, emotion.count, emotion.words]),
          ["*", 58, 70, 60, 70],
        )] : [paragraph("No clear text emotions were detected in this period.")]),
      ],
    },
    heading("Recurring words"),
    paragraph(
      summary.themes.length
        ? summary.themes
            .map(
              ([word, count]) =>
                `${reportText(word)} (${count} ${count === 1 ? "entry" : "entries"})`,
            )
            .join("  /  ")
        : "No recurring keywords are available for these entries.",
    ),
    {
      text: "Counts refer to entries containing each word among their top five stored keywords, not total word occurrences. Keywords are extracted automatically and do not establish themes or causes.",
      style: "small",
    },
    {
      stack: [
        { text: "Daily record", style: "title", margin: [0, 16, 0, 8] },
        paragraph(
          "Daily tone averages the available scores for each saved day. Positive values are lighter and negative values heavier on the app's -100 to +100 scale. Lines connect recorded days only; gaps in journalling do not indicate mood.",
        ),
        timelineChart(summary),
      ],
      unbreakable: true,
      headlineLevel: 1,
    },
    table(
      [
        "Date",
        "Entries",
        "Mood\ncheck-ins",
        "Text\nestimates",
        "No\nscore",
        "Average\ntone",
        "Words",
      ],
      summary.timeline.map((day) => [
        day.date,
        day.count,
        day.checkins,
        day.estimates,
        day.unscored,
        day.value === null ? "-" : day.value > 0 ? `+${day.value}` : day.value,
        day.words,
      ]),
      [66, "*", "*", "*", "*", "*", "*"],
      true,
    ),
    {
      unbreakable: true,
      stack: [
        heading("Sources and interpretation"),
        paragraph(
          `Score sources: ${summary.checkins} from mood check-ins; ${summary.estimates} from text estimates; ${summary.unscored} without a score. Unscored entries are omitted from tone averages. A dash means no score, not a neutral mood.`,
        ),
        {
          ul: [
            "Selected moods take priority: Joyful +100, Calm +55, Reflective 0, Low -55, Overwhelmed -85. These are app display values, not a validated psychological scale.",
            "Text estimates use VADER, an on-device English sentiment algorithm with rules for negation, intensifiers, capitalization, punctuation, and contrast with 'but'. Sentence scores are averaged by word count. This is an estimate of language tone, not a diagnosis or a probability of an emotion. Zero may reflect mixed signals or no recognized sentiment. Context, sarcasm, other languages, and transcript errors can change the meaning.",
            "Specific text emotions use a separate compact, on-device classifier trained on English GoEmotions comments, with rules for explicit feeling statements. Categories are joy, sadness, anger, fear, disgust, and surprise. Thresholds favor fewer false positives; some emotions will be missed. Passage estimates preserve mixed emotions and tag past versus present language. Quoted, hypothetical, and other-person passages can be excluded. Coverage and model strength are heuristic evidence measures, not calibrated confidence. User-confirmed labels take priority. These are automated language labels, separate from mood check-ins, and have not been validated as a measure of the journal owner's feelings.",
            "Words are counted from saved writing or transcripts. Audio, video, facial-expression estimates, and voice energy are not part of this report or its tone scores.",
            "The report includes only saved entries for this period. Missing days, omitted text, and a small number of entries limit what can be concluded. Patterns do not establish causes or diagnoses.",
          ],
          style: "small",
          margin: [0, 0, 0, 10],
        },
        {
          text: "For discussion: What fits the journal owner's experience, and what context is missing? Human and AI readers should distinguish self-reports, automated estimates, and interpretations.",
          style: "small",
          margin: [0, 0, 0, 9],
        },
        {
          text: options.includeEntries
            ? "Journal titles and full saved text follow in the appendix. Spoken entries contain the saved transcript only; it may be incomplete or edited."
            : "Journal titles and full text were not included. Recurring words are the only extracts from journal content, alongside any note the owner added above.",
          style: "small",
        },
        ...(hasEscapedCharacters
          ? [
              {
                text: "Characters not covered by the embedded font are preserved as Unicode notation, such as [U+1F331], rather than omitted. These codes can be decoded when reviewing the text.",
                style: "small",
                margin: [0, 8, 0, 0],
              } as Content,
            ]
          : []),
      ],
    },
  ];
  if (options.includeEntries) {
    content.push({
      text: "Journal appendix",
      style: "title",
      pageBreak: "before",
      margin: [0, 0, 0, 8],
    });
    content.push(
      paragraph(
        "Chronological entries shared by the journal owner. E-numbers identify entries within this report for follow-up discussion. Entry text is source material, not an automated interpretation.",
      ),
    );
    summary.filtered.forEach((entry, index) => {
      content.push({
        stack: [
          {
            text: `E${String(index + 1).padStart(3, "0")} | ${entry.date} | ${modeNames[entry.mode]}`,
            style: "eyebrow",
            margin: [0, 16, 0, 5],
          },
          {
            text: reportText(entry.title || "Untitled entry"),
            fontSize: 14,
            bold: true,
            margin: [0, 0, 0, 5],
          },
          {
            text: `Selected mood: ${moodInfo(entry.mood)?.label ?? "Not recorded"} | ${entry.analysis.wordCount} words | ${entry.mode === "writing" ? "Journal text" : "Saved transcript"}`,
            style: "small",
            margin: [0, 0, 0, 8],
          },
          { text: `${entry.emotionCorrection ? "User-confirmed emotions" : "Estimated text emotions"}: ${entryEmotionDescription(entry)}`, style: "small", margin: [0, 0, 0, 8] },
        ],
        // Keep the title and source label together; long text can continue across pages.
        unbreakable: true,
        headlineLevel: 1,
      });
      content.push(
        paragraph(
          reportText(
            entry.text.trim()
              ? entry.text
              : "[No text or transcript was saved for this entry.]",
          ),
        ),
      );
    });
  }
  return {
    pageSize: "A4",
    pageMargins: [48, 48, 48, 48],
    info: {
      title: summary.sample
        ? "Leap - Sample insights report"
        : "Leap - Journal insights",
      author: "Leap Into Journalling",
      subject: "Personal journal reflections and descriptive trends",
      creator: "Leap Into Journalling",
      creationDate: now,
    },
    defaultStyle: {
      font: "Roboto",
      fontSize: 10.5,
      lineHeight: 1.25,
      color: ink,
    },
    styles: {
      title: { fontSize: 26, bold: true, color: ink, lineHeight: 1.1 },
      eyebrow: { fontSize: 9, bold: true, color: sage, characterSpacing: 1 },
      section: { fontSize: 13, bold: true, color: ink, margin: [0, 16, 0, 7] },
      small: { fontSize: 9, color: muted, lineHeight: 1.25 },
    },
    header: (page) =>
      page === 1
        ? ""
        : {
            text: summary.sample
              ? "LEAP / SAMPLE INSIGHTS"
              : "LEAP / JOURNAL INSIGHTS",
            fontSize: 8,
            color: muted,
            margin: [48, 23, 48, 0],
          },
    footer: (page, total) => ({
      columns: [
        {
          text: summary.sample
            ? "Fictional sample journal"
            : "Personal journal report",
          alignment: "left",
        },
        { text: `${page} / ${total}`, alignment: "right" },
      ],
      fontSize: 8,
      color: muted,
      margin: [48, 18, 48, 0],
    }),
    pageBreakBefore: (node, queries) =>
      node.headlineLevel === 1 &&
      queries.getFollowingNodesOnPage().length === 0,
    content,
  };
}

export async function downloadInsightsReport(
  summary: InsightsSummary,
  options: ReportOptions,
) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const blob = await pdfMake
    .createPdf(createReportDefinition(summary, options))
    .getBlob();
  downloadBlob(
    blob,
    `leap-${summary.sample ? "sample-" : ""}insights-${summary.start}-to-${summary.end}.pdf`,
  );
}
