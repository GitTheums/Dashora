import type { ThemeAccentId } from "@dashora/shared";
import type { AccentTokens, ResolvedTheme } from "./types.js";

const ACCENTS: Record<Exclude<ThemeAccentId, "custom">, Record<ResolvedTheme, AccentTokens>> = {
  teal: {
    light: {
      primary: "#0f5c4c",
      primaryHover: "#0c4a3d",
      primaryFg: "#ffffff",
      primaryMuted: "rgba(15, 92, 76, 0.12)",
      focus: "#0f5c4c",
    },
    dark: {
      primary: "#4ec9a8",
      primaryHover: "#66d4b6",
      primaryFg: "#042018",
      primaryMuted: "rgba(78, 201, 168, 0.14)",
      focus: "#4ec9a8",
    },
  },
  sky: {
    light: {
      primary: "#0369a1",
      primaryHover: "#075985",
      primaryFg: "#ffffff",
      primaryMuted: "rgba(3, 105, 161, 0.12)",
      focus: "#0369a1",
    },
    dark: {
      primary: "#38bdf8",
      primaryHover: "#7dd3fc",
      primaryFg: "#082f49",
      primaryMuted: "rgba(56, 189, 248, 0.16)",
      focus: "#38bdf8",
    },
  },
  emerald: {
    light: {
      primary: "#047857",
      primaryHover: "#065f46",
      primaryFg: "#ffffff",
      primaryMuted: "rgba(4, 120, 87, 0.12)",
      focus: "#047857",
    },
    dark: {
      primary: "#34d399",
      primaryHover: "#6ee7b7",
      primaryFg: "#022c22",
      primaryMuted: "rgba(52, 211, 153, 0.16)",
      focus: "#34d399",
    },
  },
  amber: {
    light: {
      primary: "#b45309",
      primaryHover: "#92400e",
      primaryFg: "#ffffff",
      primaryMuted: "rgba(180, 83, 9, 0.12)",
      focus: "#b45309",
    },
    dark: {
      primary: "#fbbf24",
      primaryHover: "#fcd34d",
      primaryFg: "#422006",
      primaryMuted: "rgba(251, 191, 36, 0.16)",
      focus: "#fbbf24",
    },
  },
  rose: {
    light: {
      primary: "#be123c",
      primaryHover: "#9f1239",
      primaryFg: "#ffffff",
      primaryMuted: "rgba(190, 18, 60, 0.12)",
      focus: "#be123c",
    },
    dark: {
      primary: "#fb7185",
      primaryHover: "#fda4af",
      primaryFg: "#4c0519",
      primaryMuted: "rgba(251, 113, 133, 0.16)",
      focus: "#fb7185",
    },
  },
  violet: {
    light: {
      primary: "#6d28d9",
      primaryHover: "#5b21b6",
      primaryFg: "#ffffff",
      primaryMuted: "rgba(109, 40, 217, 0.12)",
      focus: "#6d28d9",
    },
    dark: {
      primary: "#a78bfa",
      primaryHover: "#c4b5fd",
      primaryFg: "#2e1065",
      primaryMuted: "rgba(167, 139, 250, 0.16)",
      focus: "#a78bfa",
    },
  },
  slate: {
    light: {
      primary: "#334155",
      primaryHover: "#1e293b",
      primaryFg: "#ffffff",
      primaryMuted: "rgba(51, 65, 85, 0.12)",
      focus: "#334155",
    },
    dark: {
      primary: "#94a3b8",
      primaryHover: "#cbd5e1",
      primaryFg: "#0f172a",
      primaryMuted: "rgba(148, 163, 184, 0.16)",
      focus: "#94a3b8",
    },
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function customAccent(hex: string, resolved: ResolvedTheme): AccentTokens {
  const rgb = hexToRgb(hex) ?? { r: 15, g: 92, b: 76 };
  const mutedAlpha = resolved === "dark" ? 0.16 : 0.12;
  const luminance = relativeLuminance(hex);
  const primaryFg = luminance > 0.45 ? "#12171c" : "#ffffff";
  return {
    primary: hex,
    primaryHover: hex,
    primaryFg,
    primaryMuted: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${mutedAlpha})`,
    focus: hex,
  };
}

export function resolveAccentTokens(
  accent: ThemeAccentId,
  resolved: ResolvedTheme,
  accentCustom?: string | null,
): AccentTokens {
  if (accent === "custom" && accentCustom) {
    return customAccent(accentCustom, resolved);
  }
  if (accent === "custom") {
    return ACCENTS.teal[resolved];
  }
  return ACCENTS[accent][resolved];
}

export function getAccentSwatch(
  accent: Exclude<ThemeAccentId, "custom">,
  resolved: ResolvedTheme,
): string {
  return ACCENTS[accent][resolved].primary;
}
