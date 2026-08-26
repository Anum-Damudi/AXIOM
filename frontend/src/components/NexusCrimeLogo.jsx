export default function NexusCrimeLogo({ size = 40, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 140"
      width={size}
      height={size * 1.167}
      fill="none"
      className={className}
      role="img"
      aria-label="NEXUS-CRIME logo"
    >
      <defs>
        <linearGradient id="ncg-grad" x1="60" y1="0" x2="60" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0e2a4a" />
          <stop offset="100%" stopColor="#081c33" />
        </linearGradient>
        <linearGradient id="ncg-accent" x1="60" y1="20" x2="60" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <filter id="ncg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ncg-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield body */}
      <path
        d="M60 6 C75 6, 108 10, 112 14 C116 18, 117 28, 115 44
           C112 68, 92 96, 60 132 C28 96, 8 68, 5 44
           C3 28, 4 18, 8 14 C12 10, 45 6, 60 6Z"
        fill="url(#ncg-grad)"
        stroke="#164e63"
        strokeWidth="1.2"
      />

      {/* Inner frame — subtle accent outline */}
      <path
        d="M60 16 C72 16, 100 19, 103 22 C106 25, 107 33, 105 46
           C102 66, 86 88, 60 120 C34 88, 18 66, 15 46
           C13 33, 14 25, 17 22 C20 19, 48 16, 60 16Z"
        fill="none"
        stroke="url(#ncg-accent)"
        strokeWidth="0.6"
        opacity="0.4"
      />

      {/* Network connections — outer ring */}
      {[
        [60, 32, 88, 52],
        [88, 52, 80, 88],
        [80, 88, 60, 100],
        [60, 100, 40, 88],
        [40, 88, 32, 52],
        [32, 52, 60, 32],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={`outer-${i}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#0891b2"
          strokeWidth="0.7"
          opacity="0.5"
        />
      ))}

      {/* Network connections — spokes to center */}
      {[[60, 32], [88, 52], [80, 88], [60, 100], [40, 88], [32, 52]].map(([x, y], i) => (
        <line
          key={`spoke-${i}`}
          x1={60} y1={68} x2={x} y2={y}
          stroke="#22d3ee"
          strokeWidth="0.5"
          opacity="0.35"
        />
      ))}

      {/* Secondary inner connections */}
      {[
        [60, 32, 80, 88],
        [88, 52, 60, 100],
        [80, 88, 40, 88],
        [60, 100, 32, 52],
        [40, 88, 60, 32],
        [32, 52, 88, 52],
      ].map(([x1, y1, x2, y2], i) => (
        <line
          key={`cross-${i}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#0891b2"
          strokeWidth="0.35"
          opacity="0.2"
        />
      ))}

      {/* Outer nodes */}
      {[
        [60, 32, 3.2],
        [88, 52, 2.6],
        [80, 88, 2.8],
        [60, 100, 2.4],
        [40, 88, 2.8],
        [32, 52, 2.6],
      ].map(([cx, cy, r], i) => (
        <circle
          key={`node-${i}`}
          cx={cx} cy={cy} r={r}
          fill="#0e7490"
          stroke="#22d3ee"
          strokeWidth="0.8"
          filter="url(#ncg-glow)"
        />
      ))}

      {/* Center node — the "nexus" */}
      <circle
        cx="60" cy="68" r="5"
        fill="#164e63"
        stroke="#22d3ee"
        strokeWidth="1.2"
        filter="url(#ncg-glow-strong)"
      />
      <circle cx="60" cy="68" r="2.2" fill="#22d3ee" opacity="0.9" />
      <circle cx="60" cy="68" r="0.9" fill="#ecfeff" opacity="0.7" />
    </svg>
  )
}
