# Geolocation and Punch-in Evidence

## Capture policy
- Request browser geolocation only after the member explicitly taps Punch In.
- No background, passive or continuous location tracking.
- Store the location submitted for that punch-in as a historical event.
- Show members their own timestamp, venue, coordinates, reported accuracy, distance and map.
- Admin can inspect all punch-in evidence.
- Do not expose another member's precise coordinates in team attendance views.

## Verification
- GPS is the only additional punch-in verification. No Session PIN, QR code or manual code.
- The server loads the venue's configured coordinates and radius.
- The server validates latitude/longitude ranges and accuracy.
- The server calculates distance (e.g. Haversine) from the venue coordinates; do not trust a client-computed distance.
- Reject a punch-in outside the configured radius.
- Accuracy threshold must be agreed and tested at the real venue. A 100m geofence radius is provisional, not a proven correct value.
- If permission is denied or location cannot be obtained, explain why punch-in cannot be verified and let the member retry.

## Limitations and privacy
GPS can be inaccurate indoors and can be spoofed on some devices. This is not foolproof anti-cheating. Record accuracy and distance so the admin can interpret the evidence. Do not promise that GPS proves the member was physically playing.
