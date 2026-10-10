import { analyze } from "./analysis";
import { createSticker } from "./stickers";
import { defaultDecoration, localDate, type Entry, type Mood } from "./types";
export function demoEntries(): Entry[] {
  const stories: [string, string, Mood, number][] = [
    [
      "Finding joy in the ordinary",
      "A slow morning, warm coffee, and sunlight through the kitchen window. I walked through the garden and noticed new flowers. I am grateful for the small things, for a peaceful home and a little room to breathe. Sometimes a good day is just an ordinary one that I actually notice.",
      "calm",
      0,
    ],
    [
      "A little braver than yesterday",
      "I finally shared my creative project with a friend. I was nervous and worried, but she was so kind and supportive. We talked about art and our dreams for an hour. I feel proud that I tried. Making things and sharing them feels like a tiny adventure.",
      "joyful",
      1,
    ],
    [
      "Giving myself a softer landing",
      "Work was overwhelming today. Too many deadlines and not enough time. I felt anxious and exhausted by the end. I am learning that rest is not something I need to earn. A cup of tea and a walk in the garden helped me slow down.",
      "overwhelmed",
      2,
    ],
    [
      "The people who feel like home",
      "Dinner with my oldest friend. We laughed about childhood adventures and talked about our creative dreams. I love how safe I feel with her. Feeling grateful for friendship, honest conversations and people who make ordinary evenings beautiful.",
      "joyful",
      3,
    ],
    [
      "Room for all of it",
      "A quiet day. I miss my family and the garden at home. There is a sadness I cannot quite explain. I took a walk and let myself feel it without trying to fix anything. It helped to write. Tomorrow can be different.",
      "low",
      5,
    ],
    [
      "Taking the scenic route",
      "I took the long way home through the park. The sunlight on the flowers was beautiful. After a busy week at work I finally felt calm. I am grateful for the garden, the trees, and the chance to slow down and rest.",
      "calm",
      6,
    ],
    [
      "A work in progress",
      "I have been thinking about my creative project and the fear of getting it wrong. There are so many possibilities. I want to spend less time worrying about a perfect result and more time enjoying making art.",
      "reflective",
      8,
    ],
    [
      "Sunday, slowly",
      "Coffee with a friend, a long walk through the garden, and a peaceful evening at home. I am happy and rested. A beautiful reminder that connection and rest are both things I need.",
      "calm",
      10,
    ],
    [
      "Making space for possibility",
      "Today I signed up for an art class. I feel excited and hopeful about learning something new. My creative project is finally starting to take shape and I am proud of my progress.",
      "joyful",
      12,
    ],
    [
      "An honest check-in",
      "The deadlines at work are hard right now. I feel stressed and tired. I asked for support and my team helped me make a plan. The conversation was a relief. I need to remember that asking for help is allowed.",
      "reflective",
      14,
    ],
  ];
  return stories.map(([title, text, mood, ago], i) => {
    const d = new Date();
    d.setDate(d.getDate() - ago);
    return {
      id: `demo-${i}`,
      title,
      text,
      mood,
      date: localDate(d),
      createdAt: d.toISOString(),
      mode: "writing",
      analysis: analyze(text),
      expressions: [],
      decoration: {
        ...defaultDecoration,
        stickers: i === 0 ? [createSticker("🌼", 0, "demo-flower")] : [],
        note: "",
      },
      demo: true,
    };
  });
}
