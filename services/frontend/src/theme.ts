/**
 * Small shared style constants -- the frontend had zero design system
 * before this (every view hand-rolled its own inline hex colors/spacing).
 * Not a component library, just enough shared vocabulary that new views
 * (and views touched going forward) look like the same product. Existing
 * views (CaptureView, PhotosView, CustomersView, AnalyticsView, QueryView,
 * MeshDemoView) haven't been migrated to this yet -- that's follow-up
 * scope, not done in this pass.
 */
import type { CSSProperties } from "react";

export const colors = {
  primary: "#0B4F6C",
  primaryLight: "#E8F1F5",
  accent: "#00A9A5",
  bg: "#fafafa",
  card: "#ffffff",
  border: "#e2e2e2",
  text: "#1a1a1a",
  textMuted: "#666666",
  success: "#1a7f37",
  successBg: "#e6f4ea",
  warning: "#9a6700",
  warningBg: "#fff8e6",
  danger: "#c62828",
  dangerBg: "#fdecea",
};

export const card: CSSProperties = {
  background: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: 20,
};

export const button: CSSProperties = {
  background: colors.primary,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
};

export const buttonSecondary: CSSProperties = {
  background: "transparent",
  color: colors.primary,
  border: `1px solid ${colors.primary}`,
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
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
