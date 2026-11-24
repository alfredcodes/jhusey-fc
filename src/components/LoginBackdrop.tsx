// Photo behind the sign-in pages: a football on a grass pitch, in daylight.
// Photo: Peter Glaser on Unsplash (Unsplash License: free for commercial use, credit appreciated).
// https://unsplash.com/photos/qWs_Wa1JrKM
// Two crops: upright (centred on the ball) for phones, the full photo for wide screens, where
// the card sits on the right so the ball stays visible. Both are in the PWA precache.

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
      {/* Only a faint edge vignette: the page stays light */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(15,23,42,0.18)_100%)]" />
    </div>
  )
}

export function PhotoCredit() {
  return (
    <p className="absolute right-3 bottom-2 text-[10px] text-white/80 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
      Photo: Peter Glaser / Unsplash
    </p>
  )
}
