export function JournalIllustration() {
  return (
    <svg
      viewBox="0 0 460 315"
      fill="none"
      aria-hidden="true"
      className="journal-illustration"
    >
      <path
        d="M97 79C163 21 188 28 238 50c49 21 126-33 157 32 23 50 10 95-23 123-35 31-30 60-109 64-79 5-140-10-171-46C60 186 43 127 97 79Z"
        fill="#c8ebd5"
      />
      <ellipse cx="239" cy="277" rx="157" ry="12" fill="#b8d9bf" opacity=".4" />
      <g transform="translate(82 49) rotate(-9 116 100)">
        <rect x="3" y="4" width="219" height="210" rx="15" fill="#79a681" />
        <rect
          width="216"
          height="207"
          rx="14"
          fill="#fdf9e9"
          stroke="#456c50"
          strokeWidth="2"
        />
        <path d="M20 0v206" stroke="#456c50" strokeWidth="2" />
        {[23, 53, 83, 113, 143, 173].map((y) => (
          <path
            key={y}
            d={`M-7 ${y}c-14-10-14 15 0 11h17`}
            stroke="#456c50"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
        <path
          d="M47 57h134M47 88h112M47 119h134M47 150h96"
          stroke="#d8dec7"
          strokeWidth="2"
        />
        <path
          d="M122-4h51v25l-9-3-8 4-8-4-9 3-9-4-8 3Z"
          fill="#dfbbcf"
          opacity=".85"
        />
        <path
          d="m164 165 11-13 7 16 17 2-12 12 2 17-15-8-15 8 2-17-12-12Z"
          fill="#f2cd78"
          stroke="#bd9a54"
          strokeWidth="1.5"
        />
      </g>
      <g transform="translate(281 150) rotate(8)">
        <path
          d="M14 35h65l-8 69H24Z"
          fill="#dfb095"
          stroke="#8f6c53"
          strokeWidth="2"
        />
        <path
          d="M10 35h73v15H10Z"
          fill="#ebc4aa"
          stroke="#8f6c53"
          strokeWidth="2"
        />
        <path
          d="M46 36C43 7 49-9 41-32M44 19C66 6 66-13 64-24M44 0C22-9 18-24 17-38"
          stroke="#456c50"
          strokeWidth="3"
        />
        <path
          d="M41-16C13-22 16-51 18-60 42-49 48-32 41-16ZM49 15C49-12 75-29 87-29 85-3 72 13 49 15ZM42-26C27-49 37-71 43-80 64-57 60-38 42-26ZM41 16C15 12 1-4 0-17 30-19 43-3 41 16Z"
          fill="#6e9668"
        />
        <path
          d="m33 58 4 29m20-29-3 29"
          stroke="#ba8e70"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(363 74)">
        <path
          d="M0-14v28M-14 0h28"
          stroke="#577749"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="m-9-9 18 18m-18 0L9-9"
          stroke="#577749"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle r="5" fill="#efcd77" />
      </g>
      <path
        d="m62 240 4 9 10 1-7 7 1 10-9-5-9 5 2-10-8-7 11-1Z"
        fill="#f1cf81"
      />
      <path
        d="M340 41c7-12 15-2 10 4-5 6-12 10-12 10s-10-9-9-15c1-8 11-6 11 1"
        fill="#dda993"
      />
      <path
        d="m397 197 5 4m-10 6 5 5m3-18 5-4"
        stroke="#7c9874"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Sprout({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M51 83V39"
        stroke="#4f7455"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M50 57C24 60 17 39 21 27c25 0 33 13 29 30Z"
        fill="#a9ce9e"
        stroke="#658b5f"
        strokeWidth="2"
      />
      <path
        d="M51 42c-1-27 18-33 33-30 1 26-15 34-33 30Z"
        fill="#c4dfb8"
        stroke="#658b5f"
        strokeWidth="2"
      />
      <path d="m30 37 20 20m1-15 23-20" stroke="#658b5f" strokeWidth="2" />
      <path
        d="M26 85c15-8 37-8 51 0"
        stroke="#4f7455"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function MoodFace({ mood, size = 32 }: { mood: string; size?: number }) {
  const colors: Record<string, string> = {
    joyful: "#f7df98",
    calm: "#c5e6cf",
    reflective: "#dcd9ef",
    low: "#cadfea",
    overwhelmed: "#f2ccbb",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle
        cx="20"
        cy="20"
        r="18"
        fill={colors[mood]}
        stroke="#536654"
        strokeWidth="1.2"
      />
      {mood === "calm" ? (
        <path
          d="m11 17 3 2 3-2m6 0 3 2 3-2"
          fill="none"
          stroke="#536654"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx="14" cy="17" r="1.6" fill="#536654" />
          <circle cx="26" cy="17" r="1.6" fill="#536654" />
        </>
      )}
      {mood === "joyful" ? (
        <path
          d="M12 23q8 13 16 0Z"
          fill="#fff8e4"
          stroke="#536654"
          strokeWidth="1.2"
        />
      ) : mood === "calm" ? (
        <path
          d="M15 25q5 5 10 0"
          fill="none"
          stroke="#536654"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : mood === "low" ? (
        <path
          d="M15 28q5-6 10 0"
          fill="none"
          stroke="#536654"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : mood === "overwhelmed" ? (
        <path
          d="m12 26 4-2 4 3 4-3 4 2"
          fill="none"
          stroke="#536654"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16 26h8"
          stroke="#536654"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
