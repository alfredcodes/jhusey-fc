// Photo behind the sign-in pages, with a dark overlay so the card stays readable.
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
          className="h-full w-full object-cover"
        />
      </picture>
      {/* Dark overlay, a little stronger at the edges */}
      <div className="absolute inset-0 bg-gray-950/55" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(3,7,18,0.6)_100%)]" />
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
