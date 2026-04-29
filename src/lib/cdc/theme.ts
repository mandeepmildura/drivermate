// Per-route branding so the driver can tell C012 from C011 at a glance.
// Tailwind class names are kept as full literal strings so they survive purge.
import type { RouteCode } from './types';

export type RouteTheme = {
  // Soft pill: faint background + colored text (route badge)
  badge: string;
  // Solid call-to-action: filled accent + dark text (selected toggle)
  solid: string;
  // CSS color for inline styles (left-edge accent on V/Line panel strip)
  edgeColor: string;
};

export const ROUTE_THEMES: Record<RouteCode, RouteTheme> = {
  C012: {
    badge: 'bg-emerald-500/20 text-emerald-300',
    solid: 'bg-emerald-500 text-slate-900',
    edgeColor: 'rgb(16 185 129)',
  },
  C011: {
    badge: 'bg-sky-500/20 text-sky-300',
    solid: 'bg-sky-500 text-slate-900',
    edgeColor: 'rgb(14 165 233)',
  },
};
