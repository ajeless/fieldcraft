// Design tokens for the editor. Values track docs/redesign/reference/components/tokens.jsx;
// see docs/redesign/BRIEF.md for the token system spec.
//
// Tokens are written to document.documentElement as CSS custom properties prefixed
// with `--fc-`. styles.css references these properties directly.

export type Theme = "light" | "dark";

export type DesignTokens = {
  // Chrome layers — window through elevated surfaces
  bg0: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;

  // Rules
  line: string;
  lineStrong: string;

  // Ink
  ink: string;
  inkMuted: string;
  inkDim: string;
  inkBright: string;

  // Accents: teal signature, amber warn, red destructive — each with a wash.
  accent: string;
  accentDim: string;
  accentWash: string;
  accentInk: string;
  amber: string;
  amberWash: string;
  red: string;
  redWash: string;

  // Board
  boardBg: string;
  boardGrid: string;
  boardGridStrong: string;
  marker: string;
  markerRing: string;
  // Editor-specific selection indication read by the board viewport canvas;
  // not present in reference/components/tokens.jsx but preserved from the
  // current editor's board rendering.
  markerSelectionGlow: string;
  markerSelectionRing: string;

  // Stage / overlay surfaces
  stageGradient: string;
  overlayBg: string;
  panelBg: string;

  // Typography
  fontUi: string;
  fontMono: string;

  // Radii (pixels)
  r1: number;
  r2: number;
  r3: number;

  // Shadows
  shadow1: string;
  shadow2: string;
};

export const darkTokens: DesignTokens = {
  bg0: "#0a0e12",
  bg1: "#0f151b",
  bg2: "#151c24",
  bg3: "#1c242d",
  bg4: "#242e39",

  line: "#22303d",
  lineStrong: "#2d3d4d",

  ink: "#dbe6f0",
  inkMuted: "#8a99a8",
  inkDim: "#5b6a78",
  inkBright: "#f1f6fb",

  accent: "oklch(0.72 0.09 180)",
  accentDim: "oklch(0.58 0.08 180)",
  accentWash: "oklch(0.72 0.09 180 / 0.12)",
  accentInk: "#041613",
  amber: "oklch(0.78 0.12 70)",
  amberWash: "oklch(0.78 0.12 70 / 0.14)",
  red: "oklch(0.65 0.16 25)",
  redWash: "oklch(0.65 0.16 25 / 0.14)",

  boardBg: "#0d131a",
  boardGrid: "#1e2a36",
  boardGridStrong: "#2a3a4a",
  marker: "#e06a5e",
  markerRing: "#8a2e24",
  markerSelectionGlow: "rgba(184, 243, 227, 0.22)",
  markerSelectionRing: "#b8f3e3",

  stageGradient: "radial-gradient(ellipse at center, #0f151b 0%, #070a0d 100%)",
  overlayBg: "rgba(15, 21, 27, 0.88)",
  panelBg: "rgba(21, 28, 36, 0.94)",

  fontUi: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

  r1: 3,
  r2: 5,
  r3: 8,

  shadow1: "0 1px 0 rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)",
  shadow2: "0 10px 30px rgba(0, 0, 0, 0.45)"
};

export const lightTokens: DesignTokens = {
  bg0: "#f5f6f4",
  bg1: "#fbfbf9",
  bg2: "#ffffff",
  bg3: "#f0f1ee",
  bg4: "#e6e8e3",

  line: "#d9dcd6",
  lineStrong: "#b8bcb4",

  ink: "#1c2326",
  inkMuted: "#586068",
  inkDim: "#8a9098",
  inkBright: "#0b0f12",

  accent: "oklch(0.48 0.08 180)",
  accentDim: "oklch(0.58 0.08 180)",
  accentWash: "oklch(0.48 0.08 180 / 0.10)",
  accentInk: "#ffffff",
  amber: "oklch(0.58 0.14 60)",
  amberWash: "oklch(0.58 0.14 60 / 0.12)",
  red: "oklch(0.55 0.18 25)",
  redWash: "oklch(0.55 0.18 25 / 0.10)",

  boardBg: "#e8ebe6",
  boardGrid: "#c4c8c0",
  boardGridStrong: "#9ea29a",
  marker: "#c85448",
  markerRing: "#7a2a22",
  markerSelectionGlow: "rgba(31, 122, 104, 0.18)",
  markerSelectionRing: "#0f7c68",

  stageGradient: "radial-gradient(ellipse at center, #eeefec 0%, #d9dcd6 100%)",
  overlayBg: "rgba(255, 255, 255, 0.92)",
  panelBg: "rgba(255, 255, 255, 0.96)",

  fontUi: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

  r1: 3,
  r2: 5,
  r3: 8,

  shadow1: "0 1px 0 rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.06)",
  shadow2: "0 10px 30px rgba(0, 0, 0, 0.12)"
};

function tokenKeyToCssName(key: string): string {
  return "--fc-" + key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

export const cssCustomPropertyNames: Readonly<Record<keyof DesignTokens, string>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(darkTokens) as Array<keyof DesignTokens>).map((key) => [
        key,
        tokenKeyToCssName(key)
      ])
    ) as Record<keyof DesignTokens, string>
  );

export function getTokens(theme: Theme): DesignTokens {
  return theme === "dark" ? darkTokens : lightTokens;
}

export function applyTokensToRoot(theme: Theme): DesignTokens {
  const tokens = getTokens(theme);
  const root = document.documentElement;
  const { style } = root;
  for (const key of Object.keys(tokens) as Array<keyof DesignTokens>) {
    const value = tokens[key];
    const serialized = typeof value === "number" ? `${value}px` : value;
    style.setProperty(cssCustomPropertyNames[key], serialized);
  }
  root.dataset.theme = theme;
  style.colorScheme = theme;
  return tokens;
}
