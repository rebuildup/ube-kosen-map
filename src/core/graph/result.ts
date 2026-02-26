/**
 * @module graph/result
 * Result type for error handling without exceptions.
 */

export type Result<T, E extends Error = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E extends Error>(error: E): Result<never, E> => ({ ok: false, error })
