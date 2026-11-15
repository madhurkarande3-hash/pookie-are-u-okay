import type { Companion } from "@/lib/types";

/**
 * Original illustrations of the three companions. Colours come from the
 * active theme's CSS variables, so every companion fits every theme
 * (Sweet or Cool) — the theme is never what decides the character.
 */
const C = {
  main: { fill: "var(--c-primary)" },
  soft: { fill: "var(--c-accent)" },
  ink: "var(--c-ink)",
};
const SKIN = "#FBE3D2";
const HAIR = "#F2EEF0";

function Glasses() {
  return (
    <>
      <circle
        cx="82"
        cy="98"
        r="13"
        fill="#fff"
        fillOpacity="0.55"
        stroke={C.ink}
        strokeWidth="3"
      />
      <circle
        cx="118"
        cy="98"
        r="13"
        fill="#fff"
        fillOpacity="0.55"
        stroke={C.ink}
        strokeWidth="3"
      />
      <path d="M95 97h10" stroke={C.ink} strokeWidth="3" />
    </>
  );
}

function SmilingEyes({ y = 99 }: { y?: number }) {
  return (
    <path
      d={`M77 ${y}c3-4 7-4 10 0M113 ${y}c3-4 7-4 10 0`}
      stroke={C.ink}
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Cheeks() {
  return (
    <>
      <circle cx="70" cy="116" r="7" style={C.main} opacity="0.45" />
      <circle cx="130" cy="116" r="7" style={C.main} opacity="0.45" />
    </>
  );
}

function Granny() {
  return (
    <>
      <path d="M40 196c4-34 28-50 60-50s56 16 60 50z" style={C.main} />
      <path d="M82 150c6 10 30 10 36 0l-4 16H86z" fill="#fff" opacity="0.9" />
      <circle cx="100" cy="170" r="4" fill={C.ink} opacity="0.5" />
      <circle
        cx="100"
        cy="34"
        r="20"
        fill={HAIR}
        stroke={C.ink}
        strokeWidth="2.5"
      />
      <path
        d="M48 96c-4-38 22-58 52-58s56 20 52 58c-8-18-22-30-52-30S56 78 48 96z"
        fill={HAIR}
        stroke={C.ink}
        strokeWidth="2.5"
      />
      <circle
        cx="100"
        cy="100"
        r="46"
        fill={SKIN}
        stroke={C.ink}
        strokeWidth="2.5"
      />
      <path
        d="M58 80c10-12 28-16 42-14 14-2 32 2 42 14"
        fill="none"
        stroke={HAIR}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <Glasses />
      <SmilingEyes />
      <Cheeks />
      <path
        d="M88 122c7 8 17 8 24 0"
        stroke={C.ink}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

function Kaka() {
  return (
    <>
      {/* sweater vest over a collared shirt */}
      <path d="M40 196c4-34 28-50 60-50s56 16 60 50z" style={C.main} />
      <path
        d="M84 148l16 22 16-22"
        fill="#fff"
        stroke={C.ink}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M100 170v26" stroke={C.ink} strokeWidth="2" opacity="0.4" />
      {/* face, then grey hair at the sides of a mostly bald head */}
      <circle
        cx="100"
        cy="98"
        r="48"
        fill={SKIN}
        stroke={C.ink}
        strokeWidth="2.5"
      />
      <path
        d="M53 100c-4-14 0-26 8-32M147 100c4-14 0-26-8-32"
        stroke={HAIR}
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M53 100c-4-14 0-26 8-32M147 100c4-14 0-26-8-32"
        stroke={C.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M82 60c8-4 22-5 32-1"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
        fill="none"
      />
      {/* bushy eyebrows */}
      <path
        d="M70 80c6-4 14-4 20 0M110 80c6-4 14-4 20 0"
        stroke={HAIR}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M70 80c6-4 14-4 20 0M110 80c6-4 14-4 20 0"
        stroke={C.ink}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      />
      <Glasses />
      <SmilingEyes />
      <Cheeks />
      {/* moustache and smile */}
      <path
        d="M78 120c8-8 15-4 22-1 7-3 14-7 22 1-6 9-15 9-22 4-7 5-16 5-22-4z"
        fill={HAIR}
        stroke={C.ink}
        strokeWidth="2"
      />
      <path
        d="M90 132c6 5 14 5 20 0"
        stroke={C.ink}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

/** Pookie: a soft round friend with a knitted scarf and a little heart sprout — no age or gender. */
function Pookie() {
  return (
    <>
      <path
        d="M100 30c-2-10 4-18 12-16"
        stroke={C.ink}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M112 16c-4-7-14-2-10 5l10 9 10-9c4-7-6-12-10-5z"
        style={C.main}
        stroke={C.ink}
        strokeWidth="2"
      />
      <ellipse
        cx="100"
        cy="112"
        rx="66"
        ry="68"
        style={C.soft}
        stroke={C.ink}
        strokeWidth="2.5"
      />
      <ellipse cx="100" cy="126" rx="44" ry="40" fill="#fff" opacity="0.55" />
      {/* scarf */}
      <path
        d="M44 146c34 14 78 14 112 0l-4 16c-34 12-70 12-104 0z"
        style={C.main}
        stroke={C.ink}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M126 156l6 30h16l-6-32"
        style={C.main}
        stroke={C.ink}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M70 152v8M88 154v8M106 154v8"
        stroke="#fff"
        strokeWidth="2.5"
        opacity="0.6"
      />
      <SmilingEyes y={104} />
      <Cheeks />
      <path
        d="M88 122c7 8 17 8 24 0"
        stroke={C.ink}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

const DRAW: Record<Companion, () => JSX.Element> = {
  pookie: Pookie,
  granny: Granny,
  kaka: Kaka,
};

export function PookieAvatar({
  companion,
  size = 160,
  animate = false,
  title,
}: {
  companion: Companion;
  size?: number;
  animate?: boolean;
  title?: string;
}) {
  const Figure = DRAW[companion];
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={animate ? "pookie-float" : undefined}
    >
      <circle cx="100" cy="104" r="92" style={C.soft} opacity="0.55" />
      <Figure />
      {companion === "pookie" ? null : (
        <path
          d="M158 44c-5-9-18-3-12 7l12 11 12-11c6-10-7-16-12-7z"
          style={C.main}
          stroke={C.ink}
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
