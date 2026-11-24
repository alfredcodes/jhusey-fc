// Photo behind the sign-in pages, lightly dimmed so the card stays readable.
// Photo: Izuddin Helmi Adnan on Unsplash (Unsplash License: free for commercial use, credit
// appreciated). https://unsplash.com/photos/K5ChxJaheKI — a floodlit training pitch, seen from above.
// Two crops: upright for phones, turned sideways for wide screens. Both are in the PWA precache.

export default function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <picture>
        <source media="(orientation: landscape)" srcSet="/login-bg-landscape.webp" />
        <img
          src="/login-bg-portrait.webp"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover brightness-125 saturate-110"
        />
      </picture>
      {/* Light dim: the pitch stays bright, the edges soften so the card stands out */}
      <div className="absolute inset-0 bg-gray-950/15" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(3,7,18,0.35)_100%)]" />
    </div>
  )
}

export function PhotoCredit() {
  return (
    <p className="absolute right-3 bottom-2 text-[10px] text-white/45">
      Photo: Izuddin Helmi Adnan / Unsplash
    </p>
  )
}
