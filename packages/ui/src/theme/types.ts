/** Semantic color tokens applied to `--ds-*` CSS variables. */
export type SemanticColorTokens = {
  canvas: string;
  canvasAmbient: string;
  surface1: string;
  surface2: string;
  surface3: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryHover: string;
  primaryFg: string;
  primaryMuted: string;
  secondary: string;
  secondaryHover: string;
  secondaryFg: string;
  secondaryMuted: string;
  focus: string;
  danger: string;
  dangerMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  overlay: string;
  shadowXs: string;
  shadowSm: string;
  shadowMd: string;
};

export type AccentTokens = Pick<
  SemanticColorTokens,
  "primary" | "primaryHover" | "primaryFg" | "primaryMuted" | "focus"
>;

export type ResolvedTheme = "light" | "dark";
