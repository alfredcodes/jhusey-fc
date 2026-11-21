import { describe, expect, it } from 'vitest'
import { osmLink, parseLatLng } from './coordinates.ts'

describe('parseLatLng', () => {
  it.each([
    ['27.717245, 85.323960', 27.717245, 85.32396],
    ['27.717245,85.323960', 27.717245, 85.32396],
    ['  27.7 85.3  ', 27.7, 85.3],
    ['https://www.google.com/maps/@27.7172453,85.3239605,17z', 27.7172453, 85.3239605],
    ['https://maps.google.com/?q=27.7172,85.324', 27.7172, 85.324],
    ['-33.8688, 151.2093', -33.8688, 151.2093],
  ])('reads %s', (input, latitude, longitude) => {
    expect(parseLatLng(input)).toEqual({ latitude, longitude })
  })

  it.each(['', 'Kathmandu', '95, 85', '27, 190', 'https://maps.app.goo.gl/abc123'])(
    'rejects %s',
    (input) => {
      expect(parseLatLng(input)).toBeNull()
    },
  )
})

describe('osmLink', () => {
  it('points OpenStreetMap at the coordinates', () => {
    expect(osmLink({ latitude: 27.7, longitude: 85.3 })).toBe(
      'https://www.openstreetmap.org/?mlat=27.7&mlon=85.3#map=18/27.7/85.3',
    )
  })
})
