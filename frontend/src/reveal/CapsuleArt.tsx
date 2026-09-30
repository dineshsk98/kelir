/** The capsule: two halves held by a ribbon band. Original art; colors come from the theme.
 *  The halves are separate groups so the burst can pull them apart. */
export function CapsuleArt() {
  return (
    <svg className="capsule-art" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="capsule-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--capsule-c)" />
          <stop offset="0.45" stopColor="var(--capsule-a)" />
          <stop offset="1" stopColor="var(--capsule-b)" />
        </linearGradient>
        <linearGradient id="capsule-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--capsule-a)" />
          <stop offset="1" stopColor="var(--capsule-b)" />
        </linearGradient>
      </defs>
      <g className="capsule-left">
        <path d="M120 20 H75 a55 55 0 0 0 0 110 H120 Z" fill="url(#capsule-left)" />
        <path d="M78 34 a40 40 0 0 0 -34 26" stroke="#fff" strokeOpacity="0.55" strokeWidth="7"
              strokeLinecap="round" fill="none" />
      </g>
      <g className="capsule-right">
        <path d="M120 20 H165 a55 55 0 0 1 0 110 H120 Z" fill="url(#capsule-right)" />
        <circle cx="180" cy="52" r="5" fill="#fff" fillOpacity="0.5" />
      </g>
      <g className="capsule-band">
        <rect x="111" y="16" width="18" height="118" rx="5" fill="var(--capsule-band)" />
        <path d="M120 16 c-14 -14 -34 -8 -26 6 c4 7 16 6 26 -6 c10 12 22 13 26 6 c8 -14 -12 -20 -26 -6 z"
              fill="var(--capsule-band)" />
      </g>
    </svg>
  )
}
