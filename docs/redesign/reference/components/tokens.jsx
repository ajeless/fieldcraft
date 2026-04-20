// Design tokens for FieldCraft redesign
// Dark-first game engine / DCC aesthetic, with a proper light companion.

const FC_TOKENS_DARK = {
  // Chrome layers — near-black to elevated
  bg0: '#0a0e12',        // window / deepest
  bg1: '#0f151b',        // app chrome
  bg2: '#151c24',        // panel
  bg3: '#1c242d',        // elevated / input
  bg4: '#242e39',        // hover / active

  // Rules
  line: '#22303d',       // hairline
  lineStrong: '#2d3d4d', // stronger divider

  // Ink
  ink: '#dbe6f0',        // primary text
  inkMuted: '#8a99a8',   // secondary
  inkDim: '#5b6a78',     // tertiary / placeholders
  inkBright: '#f1f6fb',  // headers

  // Accent — teal (signature), amber (warn), red (destructive)
  accent: 'oklch(0.72 0.09 180)',
  accentDim: 'oklch(0.58 0.08 180)',
  accentWash: 'oklch(0.72 0.09 180 / 0.12)',
  accentInk: '#041613',

  amber: 'oklch(0.78 0.12 70)',
  amberWash: 'oklch(0.78 0.12 70 / 0.14)',

  red: 'oklch(0.65 0.16 25)',
  redWash: 'oklch(0.65 0.16 25 / 0.14)',

  // Board
  boardBg: '#0d131a',
  boardGrid: '#1e2a36',
  boardGridStrong: '#2a3a4a',
  tileA: '#4a7891',  // checker dark (from screenshot)
  tileB: '#dce4e8',  // checker light
  marker: '#e06a5e',
  markerRing: '#8a2e24',

  stageGradient: 'radial-gradient(ellipse at center, #0f151b 0%, #070a0d 100%)',
  overlayBg: 'rgba(15,21,27,0.88)',
  panelBg: 'rgba(21,28,36,0.94)',

  // Type
  fontUi: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

  // Radii
  r1: 3,
  r2: 5,
  r3: 8,

  // Shadows
  shadow1: '0 1px 0 rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.2)',
  shadow2: '0 10px 30px rgba(0,0,0,0.45)',
};

const FC_TOKENS_LIGHT = {
  // Warm near-white chrome — off-white paper, not pure white
  bg0: '#f5f6f4',        // window / deepest (surrounds)
  bg1: '#fbfbf9',        // app chrome (menubar, rail)
  bg2: '#ffffff',        // panel
  bg3: '#f0f1ee',        // elevated / input
  bg4: '#e6e8e3',        // hover / active

  line: '#d9dcd6',
  lineStrong: '#b8bcb4',

  ink: '#1c2326',
  inkMuted: '#586068',
  inkDim: '#8a9098',
  inkBright: '#0b0f12',

  accent: 'oklch(0.48 0.08 180)',
  accentDim: 'oklch(0.58 0.08 180)',
  accentWash: 'oklch(0.48 0.08 180 / 0.10)',
  accentInk: '#ffffff',

  amber: 'oklch(0.58 0.14 60)',
  amberWash: 'oklch(0.58 0.14 60 / 0.12)',

  red: 'oklch(0.55 0.18 25)',
  redWash: 'oklch(0.55 0.18 25 / 0.10)',

  boardBg: '#e8ebe6',
  boardGrid: '#c4c8c0',
  boardGridStrong: '#9ea29a',
  tileA: '#7a99a8',
  tileB: '#f0f2ee',
  marker: '#c85448',
  markerRing: '#7a2a22',

  stageGradient: 'radial-gradient(ellipse at center, #eeefec 0%, #d9dcd6 100%)',
  overlayBg: 'rgba(255,255,255,0.92)',
  panelBg: 'rgba(255,255,255,0.96)',

  fontUi: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

  r1: 3,
  r2: 5,
  r3: 8,

  shadow1: '0 1px 0 rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.06)',
  shadow2: '0 10px 30px rgba(0,0,0,0.12)',
};

// Mutable token object — swap keys in place so existing code that captured
// `const T = window.FC_TOKENS` at module-load time still sees updates when
// theme changes (because we mutate the same object reference).
const FC_TOKENS = { ...FC_TOKENS_DARK };

function applyTheme(name) {
  const resolved = name === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : name;
  const src = resolved === 'light' ? FC_TOKENS_LIGHT : FC_TOKENS_DARK;
  // Wipe + refill keys of the live object so all references update.
  for (const k of Object.keys(FC_TOKENS)) delete FC_TOKENS[k];
  Object.assign(FC_TOKENS, src);
  document.documentElement.dataset.theme = resolved;
  document.body && (document.body.style.background = src.bg0);
}

window.FC_TOKENS = FC_TOKENS;
window.FC_TOKENS_DARK = FC_TOKENS_DARK;
window.FC_TOKENS_LIGHT = FC_TOKENS_LIGHT;
window.applyTheme = applyTheme;
