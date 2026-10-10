const writingSubjects = [
  "a small moment that made you smile",
  "a place where you feel at home",
  "something you are learning to let go of",
  "a conversation that stayed with you",
  "a part of yourself you are getting to know",
  "an ordinary thing you are grateful for",
  "a boundary you want to honor",
  "a memory that feels warm",
  "a change you are moving through",
  "a hope you are holding quietly",
  "a time you surprised yourself",
  "someone who makes you feel understood",
  "a ritual that helps you slow down",
  "something you wish you could say",
  "a mistake you are learning to forgive",
  "a brave thing you did recently",
  "a feeling you have not found words for",
  "a way you have grown",
  "a part of today you want to remember",
  "something you need more of",
  "something you need less of",
  "a dream you keep returning to",
  "an unexpected act of kindness",
  "a small step you could take tomorrow",
];
const writingFrames = [
  (s: string) =>
    `Write about ${s}. Start with the first detail that comes to mind.`,
  (s: string) =>
    `Think of ${s}. What does it tell you about what matters to you?`,
  (s: string) =>
    `Make a little room for ${s}. What feelings come up when you sit with it?`,
  (s: string) =>
    `Describe ${s} using sounds, textures, and colors. Where does the memory take you?`,
  (s: string) =>
    `Write a note to your future self about ${s}. What would you like them to remember?`,
];
export const writingPrompts = writingSubjects.flatMap((s) =>
  writingFrames.map((f) => f(s)),
);
const spokenSubjects = [
  "a recent moment of joy",
  "your relationship with rest",
  "a friendship that has changed you",
  "what home means to you",
  "a challenge you are facing",
  "a decision you are sitting with",
  "the expectations you place on yourself",
  "something that gives you energy",
  "a loss or goodbye",
  "a new beginning",
  "your relationship with creativity",
  "a person you miss",
  "a place you want to return to",
  "something you are proud of",
  "a time you felt truly heard",
  "the way you talk to yourself",
  "a habit you are building",
  "an adventure you still think about",
  "your relationship with work",
  "a lesson from your childhood",
  "a hope for the next year",
  "the support you need right now",
  "something you are curious about",
  "a fear you are learning to face",
  "an everyday comfort",
  "a moment of unexpected connection",
];
const spokenFrames = [
  (s: string) => `Tell the story of ${s}. Where would you begin?`,
  (s: string) =>
    `Imagine talking to a trusted friend about ${s}. What would you tell them?`,
  (s: string) =>
    `When you think about ${s}, what is the first feeling you notice? Talk through it.`,
  (s: string) => `What has ${s} taught you about yourself?`,
  (s: string) =>
    `Take us back to a specific scene connected to ${s}. What could you see and hear?`,
  (s: string) => `How has your perspective on ${s} changed over time?`,
  (s: string) => `What is something you rarely say out loud about ${s}?`,
  (s: string) =>
    `If ${s} were a chapter in your life, what would its title be? Why?`,
  (s: string) => `What would your younger self want to know about ${s}?`,
  (s: string) =>
    `Talk about an assumption you have made about ${s}. Does it still feel true?`,
  (s: string) => `What feels unfinished when you think about ${s}?`,
  (s: string) => `What kind of support would help you explore ${s}?`,
  (s: string) =>
    `Describe the smallest detail you remember about ${s}. Why has it stayed?`,
  (s: string) => `What would you like to celebrate about ${s}?`,
  (s: string) =>
    `Give yourself permission to be honest about ${s}. What comes up?`,
  (s: string) =>
    `Imagine a future conversation about ${s}. What do you hope to say?`,
  (s: string) =>
    `What would kindness toward yourself look like in relation to ${s}?`,
  (s: string) => `How does ${s} connect to the person you want to become?`,
  (s: string) => `Describe both the easy and difficult parts of ${s}.`,
  (s: string) =>
    `If you could make one small change related to ${s}, what would it be?`,
];
export const spokenPrompts = spokenSubjects.flatMap((s) =>
  spokenFrames.map((f) => f(s)),
);
export function nextPrompt(mode: "writing" | "video" | "voice", previous = "") {
  const prompts = mode === "writing" ? writingPrompts : spokenPrompts;
  const options = prompts.filter((p) => p !== previous);
  return options[Math.floor(Math.random() * options.length)];
}
