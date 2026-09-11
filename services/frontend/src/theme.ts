/**
 * Small shared style constants -- the frontend had zero design system
 * before this (every view hand-rolled its own inline hex colors/spacing).
 * Not a component library, just enough shared vocabulary that new views
 * (and views touched going forward) look like the same product. Existing
 * views (CaptureView, PhotosView, CustomersView, AnalyticsView, QueryView)
 * haven't been migrated to this yet -- that's follow-up scope, not done in
 * this pass.
 *
 * Palette: professional navy/blue, enterprise B2B register -- matches the
 * "trust & authority" brief for a field-service intelligence product, not a
 * consumer app. Plus Jakarta Sans (loaded in index.html) with a system-font
 * fallback so nothing breaks if the Google Fonts request fails.
 */
import type { CSSProperties } from "react";

export const colors = {
  primary: "#0F172A",
  primaryLight: "#E8ECF1",
  accent: "#0369A1",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#020617",
  textMuted: "#475569",
  success: "#15803D",
  successBg: "#DCFCE7",
  warning: "#B45309",
  warningBg: "#FEF3C7",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
};

export const font = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

export const shadow = {
  sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
  md: "0 4px 12px rgba(15, 23, 42, 0.08)",
};

export const card: CSSProperties = {
  background: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  padding: 20,
  boxShadow: shadow.sm,
};

export const button: CSSProperties = {
  background: colors.primary,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
  fontFamily: font,
  cursor: "pointer",
};

export const buttonSecondary: CSSProperties = {
  background: "transparent",
  color: colors.primary,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
  fontFamily: font,
  cursor: "pointer",
};

export const input: CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
};

export function badge(bg: string, fg: string): CSSProperties {
  return {
    display: "inline-block",
    background: bg,
    color: fg,
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 12,
    fontWeight: 600,
  };
}

// Visually hidden but still reachable by screen readers -- for a live
// status announcement whose visible form (a color-coded stat tile) already
// conveys the same info sighted users need, but a screen reader user needs
// a plain-language sentence instead of "4/5" plus a progress bar's color.
export const srOnly: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
