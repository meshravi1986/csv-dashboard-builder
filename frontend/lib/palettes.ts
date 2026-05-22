export interface Palette {
  name: string;
  label: string;
  colors: string[];
  fill: (opacity?: number) => string;
  fillStops?: { offset: number; color: string }[];
}

export const palettes: Record<string, Palette> = {
  slate: {
    name: "slate",
    label: "Slate",
    colors: ["#0f172a", "#334155", "#475569", "#64748b"],
    fill: (o = 0.1) => `rgba(15,23,42,${o})`,
  },
  ocean: {
    name: "ocean",
    label: "Ocean",
    colors: ["#0ea5e9", "#0284c7", "#0369a1", "#38bdf8"],
    fill: (o = 0.1) => `rgba(14,165,233,${o})`,
  },
  forest: {
    name: "forest",
    label: "Forest",
    colors: ["#10b981", "#059669", "#047857", "#34d399"],
    fill: (o = 0.1) => `rgba(16,185,129,${o})`,
  },
  sunset: {
    name: "sunset",
    label: "Sunset",
    colors: ["#f59e0b", "#d97706", "#b45309", "#fbbf24"],
    fill: (o = 0.1) => `rgba(245,158,11,${o})`,
  },
  violet: {
    name: "violet",
    label: "Violet",
    colors: ["#8b5cf6", "#7c3aed", "#6d28d9", "#a78bfa"],
    fill: (o = 0.1) => `rgba(139,92,246,${o})`,
  },
  rainbow: {
    name: "rainbow",
    label: "Rainbow",
    colors: ["#0f172a", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"],
    fill: (o = 0.1) => `rgba(15,23,42,${o})`,
  },
};

export function getPalette(name?: string): Palette {
  return palettes[name || "slate"] || palettes.slate;
}

export const paletteOptions = Object.values(palettes).map((p) => ({
  value: p.name,
  label: p.label,
  colors: p.colors,
}));
