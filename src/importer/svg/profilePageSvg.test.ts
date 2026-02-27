import { describe, expect, it } from 'vitest'
import { profilePageSvg } from './profilePageSvg'
import pageSvgRaw from '../../../docs/reference/page_1.svg?raw'

describe('profilePageSvg', () => {
  it('counts major SVG element types for page_1.svg', async () => {
    const profile = await profilePageSvg(pageSvgRaw)
    expect(profile.pathCount).toBeGreaterThan(8000)
    expect(profile.useCount).toBeGreaterThan(200)
    expect(profile.textCount).toBe(0)
  })
})
