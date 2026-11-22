/** A location problem, with a message written for the member. */
export class LocationError extends Error {}

export type Position = { latitude: number; longitude: number; accuracy: number }

/**
 * Reads the device location ONCE, only when called (after the member taps Punch In).
 * No watchPosition, no background tracking, no cached position.
 * Rejects with a LocationError whose message is written for the member.
 */
export function getCurrentPosition(timeoutMs = 15_000): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(
        new LocationError(
          'This browser cannot share its location. Try Chrome or Safari on your phone.',
        ),
      )
      return
    }
    if (!window.isSecureContext) {
      reject(new LocationError('Location only works on a secure (https://) page.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      (error) => reject(new LocationError(locationErrorMessage(error.code))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    )
  })
}

function locationErrorMessage(code: number): string {
  switch (code) {
    case 1: // PERMISSION_DENIED
      return 'Location permission is blocked. Allow location for this site in your browser settings, then try again.'
    case 3: // TIMEOUT
      return 'Finding your location took too long. Go outside or near a window and try again.'
    default: // POSITION_UNAVAILABLE
      return 'Your phone could not find its location. Turn on Location (GPS) and try again.'
  }
}
