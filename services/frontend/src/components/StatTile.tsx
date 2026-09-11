import type { CSSProperties, ReactNode } from "react";
import { colors, font, shadow, srOnly } from "../theme";

export type StatTone = "success" | "warning" | "danger" | "neutral";

const TONE_COLOR: Record<StatTone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  neutral: colors.textMuted,
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  tone?: StatTone;
  /** 0-1 fill ratio rendered as a bar under the value. Omit to hide the bar. */
  ratio?: number;
  /** Shows a pulsing dot next to the label -- reserve for values that actually
   * refresh on their own (a polling view), not anything static. */
  live?: boolean;
  /** Plain-language sentence a screen reader announces when this changes --
   * the visible value/bar is color- and shape-coded, which doesn't reach a
   * screen reader on its own. */
  announce?: string;
}

function tileStyle(accent: string): CSSProperties {
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: 12,
    padding: "16px 20px",
    minWidth: 180,
    flex: "1 1 180px",
    boxShadow: shadow.sm,
    fontFamily: font,
  };
}

export default function StatTile({ label, value, sublabel, tone = "neutral", ratio, live, announce }: StatTileProps) {
  const accent = TONE_COLOR[tone];
  return (
    <div style={tileStyle(accent)}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {live && (
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: accent,
              animation: "pulse-dot 2s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: colors.text, lineHeight: 1.15, letterSpacing: -0.3 }}>
        {value}
      </div>
      {sublabel && <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 3 }}>{sublabel}</div>}
      {ratio !== undefined && (
        <div
          style={{
            marginTop: 10,
            height: 6,
            borderRadius: 999,
            background: colors.border,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`,
              height: "100%",
              background: accent,
              borderRadius: 999,
              transition: "width 300ms ease",
            }}
          />
        </div>
      )}
      {announce && (
        <span role="status" aria-atomic="true" style={srOnly}>
          {announce}
        </span>
      )}
    </div>
  );
}
