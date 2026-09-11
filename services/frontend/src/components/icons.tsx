/** Hand-drawn, dependency-free icons -- this frontend has no icon library
 * installed, and adding one just for a couple of glyphs isn't worth a new
 * dependency. Always paired with visible text, so decorative + aria-hidden. */

export function DelegateIcon({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="3.2" cy="8" r="1.8" stroke={color} strokeWidth="1.3" />
      <circle cx="12.8" cy="3.2" r="1.8" stroke={color} strokeWidth="1.3" />
      <circle cx="12.8" cy="12.8" r="1.8" stroke={color} strokeWidth="1.3" />
      <path d="M4.8 7.1L11.2 4.1M4.8 8.9L11.2 11.9" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
