// Decorative futsal court behind the sign-in pages: drawn in SVG (no image file, works offline).
// Proportions follow a 40 × 20 m futsal court at 10 units per metre: 3 m goals, D-shaped
// penalty areas (6 m quarter circles joined by a line), penalty marks at 6 m and 10 m,
// 3 m centre circle. Landscape on wide screens, turned upright on phones.

function Court() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {/* Mown-grass stripes */}
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={i * 40}
          y="0"
          width="40"
          height="200"
          fill="currentColor"
          stroke="none"
          opacity={i % 2 ? 0.035 : 0}
        />
      ))}
      <rect x="0" y="0" width="400" height="200" rx="2" />
      <line x1="200" y1="0" x2="200" y2="200" />
      <circle cx="200" cy="100" r="30" />
      <circle cx="200" cy="100" r="2" fill="currentColor" />
      {/* Penalty areas */}
      <path d="M0 25 A60 60 0 0 1 60 85 L60 115 A60 60 0 0 1 0 175" />
      <path d="M400 25 A60 60 0 0 0 340 85 L340 115 A60 60 0 0 0 400 175" />
      {/* Penalty marks (6 m) and second penalty marks (10 m) */}
      <circle cx="60" cy="100" r="1.8" fill="currentColor" />
      <circle cx="340" cy="100" r="1.8" fill="currentColor" />
      <circle cx="100" cy="100" r="1.8" fill="currentColor" />
      <circle cx="300" cy="100" r="1.8" fill="currentColor" />
      {/* Goals */}
      <rect x="-10" y="85" width="10" height="30" />
      <rect x="400" y="85" width="10" height="30" />
      {/* Corner arcs */}
      <path d="M0 6 A6 6 0 0 0 6 0 M394 0 A6 6 0 0 0 400 6 M400 194 A6 6 0 0 0 394 200 M6 200 A6 6 0 0 0 0 194" />
    </g>
  )
}

export default function CourtBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-700" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(96,165,250,0.35),transparent_60%)]" />
      {/* Landscape court */}
      <svg
        className="absolute inset-0 hidden h-full w-full text-white/25 landscape:block"
        viewBox="-30 -20 460 240"
        preserveAspectRatio="xMidYMid slice"
      >
        <Court />
      </svg>
      {/* Upright court for phones */}
      <svg
        className="absolute inset-0 h-full w-full text-white/25 landscape:hidden"
        viewBox="-20 -30 240 460"
        preserveAspectRatio="xMidYMid slice"
      >
        <g transform="translate(200 0) rotate(90)">
          <Court />
        </g>
      </svg>
      {/* Soft vignette keeps the edges calm */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(2,6,23,0.55)_100%)]" />
    </div>
  )
}
