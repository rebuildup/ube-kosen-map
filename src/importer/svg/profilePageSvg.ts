import type { SvgProfile } from './types'

export const profilePageSvg = async (raw: string): Promise<SvgProfile> => ({
    pathCount: (raw.match(/<path(\s|>)/g) ?? []).length,
    useCount: (raw.match(/<use(\s|>)/g) ?? []).length,
    textCount: (raw.match(/<text(\s|>)/g) ?? []).length,
  })
