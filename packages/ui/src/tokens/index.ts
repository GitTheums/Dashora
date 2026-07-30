/**
 * Design tokens for Dashora UI.
 * CSS custom properties in styles.css are the runtime source of truth;
 * these values mirror them for typed composition and documentation.
 */

export const colors = {
  light: {
    canvas: "#eef1f4",
    canvasAmbient: "#d9e0e6",
    surface1: "#fbfcfd",
    surface2: "#eef2f5",
    surface3: "#e3e8ed",
    fg: "#12171c",
    fgMuted: "#55606c",
    fgSubtle: "#74808c",
    border: "rgba(18, 23, 28, 0.1)",
    borderStrong: "rgba(18, 23, 28, 0.18)",
    primary: "#0f5c4c",
    primaryHover: "#0c4a3d",
    primaryFg: "#ffffff",
    primaryMuted: "rgba(15, 92, 76, 0.12)",
    secondary: "#2c5878",
    secondaryHover: "#234864",
    secondaryFg: "#ffffff",
    secondaryMuted: "rgba(44, 88, 120, 0.12)",
    focus: "#0f5c4c",
    danger: "#c43c3c",
    dangerMuted: "rgba(196, 60, 60, 0.1)",
    success: "#1a7a55",
    successMuted: "rgba(26, 122, 85, 0.1)",
    warning: "#b86a14",
    warningMuted: "rgba(184, 106, 20, 0.1)",
    overlay: "rgba(12, 16, 20, 0.48)",
  },
  dark: {
    canvas: "#0b0d10",
    canvasAmbient: "#141a1c",
    surface1: "#12161a",
    surface2: "#181d22",
    surface3: "#1f262c",
    fg: "#e8eef2",
    fgMuted: "#96a1ab",
    fgSubtle: "#6d7884",
    border: "rgba(232, 238, 242, 0.09)",
    borderStrong: "rgba(232, 238, 242, 0.16)",
    primary: "#4ec9a8",
    primaryHover: "#66d4b6",
    primaryFg: "#042018",
    primaryMuted: "rgba(78, 201, 168, 0.14)",
    secondary: "#8bb4d0",
    secondaryHover: "#a3c5db",
    secondaryFg: "#0a1520",
    secondaryMuted: "rgba(139, 180, 208, 0.14)",
    focus: "#4ec9a8",
    danger: "#f08787",
    dangerMuted: "rgba(240, 135, 135, 0.14)",
    success: "#4ec9a8",
    successMuted: "rgba(78, 201, 168, 0.14)",
    warning: "#e0b15a",
    warningMuted: "rgba(224, 177, 90, 0.14)",
    overlay: "rgba(4, 6, 8, 0.64)",
  },
} as const;

export const typography = {
  fontSans: '"Geist Sans", "Segoe UI", "Helvetica Neue", sans-serif',
  fontMono: '"Geist Mono", ui-monospace, "Cascadia Code", monospace',
  size: {
    xs: "0.75rem",
    sm: "0.8125rem",
    md: "0.875rem",
    lg: "1rem",
    xl: "1.125rem",
    "2xl": "1.375rem",
    "3xl": "1.75rem",
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
  },
  tracking: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.04em",
  },
} as const;

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
} as const;

export const radii = {
  none: "0",
  sm: "0.375rem",
  md: "0.625rem",
  lg: "1rem",
  xl: "1.25rem",
  full: "9999px",
} as const;

export const shadows = {
  light: {
    xs: "0 1px 2px rgba(12, 16, 20, 0.04)",
    sm: "0 1px 3px rgba(12, 16, 20, 0.05), 0 4px 12px rgba(12, 16, 20, 0.04)",
    md: "0 8px 24px rgba(12, 16, 20, 0.08)",
    focus: "0 0 0 3px var(--ds-primary-muted)",
  },
  dark: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.28)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.32), 0 4px 14px rgba(0, 0, 0, 0.28)",
    md: "0 12px 32px rgba(0, 0, 0, 0.45)",
    focus: "0 0 0 3px var(--ds-primary-muted)",
  },
} as const;

export const motion = {
  durationFast: "150ms",
  durationNormal: "180ms",
  durationSlow: "220ms",
  easingDefault: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  easingEmphasized: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  stickyHeader: 100,
  stickyNavigation: 100,
  dropdown: 200,
  overlay: 300,
  modal: 400,
  toast: 500,
  tooltip: 600,
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1200,
  "2xl": 1440,
} as const;

export type ThemeMode = "light" | "dark" | "system";
