// Hand-built vector art: the VROOM wordmark, the low-poly trophy, small icons. The
// wordmark's letters are polygons with chamfered corners on a 100-unit cap height;
// the same geometry is reused by scripts/icons.mjs for the app icon.

const LETTERS = [
  { w: 92, d: "M0 0H27L46 60 65 0H92L59 100H33Z" },
  { w: 82, d: "M0 0H64L82 16V47L68 59 82 100H54L43 62H26V100H0ZM26 23V40H56V23Z" },
  { w: 86, d: "M17 0H69L86 17V83L69 100H17L0 83V17ZM26 24V76H60V24Z" },
  { w: 86, d: "M17 0H69L86 17V83L69 100H17L0 83V17ZM26 24V76H60V24Z" },
  { w: 106, d: "M0 0H29L53 43 77 0H106V100H80V47L58 86H48L26 47V100H0Z" },
];

export function Wordmark({ class: cls = "" }: { class?: string }) {
  let x = 0;
  const placed = LETTERS.map((l) => {
    const at = x;
    x += l.w + 9;
    return { ...l, at };
  });
  const w = x - 9;
  const skew = 28; // the top of the wordmark leans this far right
  return (
    <svg class={`wordmark ${cls}`} viewBox={`-8 -6 ${w + skew + 34} 136`} role="img" aria-label="VROOM">
      <defs>
        <linearGradient id="wm-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" />
          <stop offset=".52" stop-color="#fff" />
          <stop offset=".53" stop-color="#ffd21f" />
          <stop offset="1" stop-color="#ff9a1f" />
        </linearGradient>
      </defs>
      <g transform={`matrix(1 0 ${-skew / 100} 1 ${skew} 0)`}>
        {placed.map((l, n) => (
          <g class="wm-letter" style={`--n:${n}`} transform={`translate(${l.at} 0)`} key={n}>
            {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((k) => (
              <path d={l.d} transform={`translate(${k * 1.1} ${k * 1.5})`} fill={k > 7 ? "#061a4a" : "#0b3cc4"} fill-rule="evenodd" />
            ))}
            <path d={l.d} fill="url(#wm-face)" fill-rule="evenodd" stroke="#0b1b3f" stroke-width="2.5" stroke-linejoin="miter" />
          </g>
        ))}
      </g>
    </svg>
  );
}

const TROPHY: [string, string][] = [
  ["#fff3b0", "30,12 50,12 50,60 38,60"],
  ["#ffd21f", "50,12 70,12 62,60 50,60"],
  ["#f0a400", "70,12 78,12 66,60 62,60"],
  ["#ffe25a", "22,12 30,12 38,60 34,60"],
  ["#d98a00", "42,60 58,60 55,76 45,76"],
  ["#ffd21f", "42,60 50,60 50,76 45,76"],
  ["#ffe25a", "32,76 50,76 50,84 28,84"],
  ["#f0a400", "50,76 68,76 72,84 50,84"],
  ["#a86a00", "28,84 72,84 76,92 24,92"],
];

/** Faceted like everything else in the world; `tint` swaps gold for silver or bronze. */
export function Trophy({ place }: { place: number }) {
  const filter = place === 2 ? "saturate(.05) brightness(1.08)" : place === 3 ? "hue-rotate(-16deg) saturate(.8) brightness(.82)" : "none";
  return (
    <svg class="trophy" viewBox="0 0 100 100" style={`filter:${filter}`} aria-hidden="true">
      <path d="M26 18H8V30L24 46" fill="none" stroke="#f0a400" stroke-width="6" stroke-linejoin="bevel" />
      <path d="M74 18H92V30L76 46" fill="none" stroke="#ffd21f" stroke-width="6" stroke-linejoin="bevel" />
      {TROPHY.map(([fill, points], i) => <polygon key={i} fill={fill} points={points} />)}
      <polygon fill="#fff" points="50,22 53,31 62,31 55,37 58,46 50,40 42,46 45,37 38,31 47,31" opacity=".95" />
    </svg>
  );
}

export const Chevron = () => (
  <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1h5l6 7-6 7H3l6-7z" fill="currentColor" /></svg>
);
export const Back = () => (
  <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 1H8L2 8l6 7h5L7 8z" fill="currentColor" /></svg>
);
export const Lock = () => (
  <svg class="ico" viewBox="0 0 16 18" aria-hidden="true">
    <path d="M4 8V5l2-3h4l2 3v3H9.8V5.4L9 4H7l-.8 1.4V8z" fill="currentColor" />
    <path d="M2 8h12v9H2zM7 11v3h2v-3z" fill="currentColor" fill-rule="evenodd" />
  </svg>
);
export const PauseIcon = () => (
  <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h4L5 14H1zM11 2h4l-3 12H8z" fill="currentColor" /></svg>
);
