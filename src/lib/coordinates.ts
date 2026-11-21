export type LatLng = { latitude: number; longitude: number }

/**
 * Reads "latitude, longitude" from what an admin pastes: the numbers Google Maps
 * copies on right-click ("27.717245, 85.323960") or a Maps link containing
 * "@27.71,85.32" or "q=27.71,85.32". Returns null if no valid pair is found.
 */
export function parseLatLng(input: string): LatLng | null {
  const text = input.trim()
  const fromLink = text.match(/[@=](-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/)
  const plain = text.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  const match = fromLink ?? plain
  if (!match) return null

  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

/** A plain OpenStreetMap link for checking a point. No map library is needed. */
export function osmLink({ latitude, longitude }: LatLng, zoom = 18): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`
}
