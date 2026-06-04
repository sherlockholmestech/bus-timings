// Tiny helper for in-flight request tokens.
//
// A "request token" is a monotonically increasing counter that callers
// capture at the start of an async request and re-check after the
// await. If the captured token no longer matches the live token, a newer
// request has superseded the in-flight one and the response must be
// ignored.
//
// This pattern is used by the shell to prevent stale AccountKey
// requests from overwriting live state when the user changes the key
// mid-flight, and to keep `lastUpdated` / `arrivalState` bound to the
// active key/stop/mode rather than the response of a previous request.

export type RequestTokenStore = {
  /**
   * The current live token. Reads are intentionally a getter so that
   * callers always observe the latest value, not a snapshot from
   * closure creation time.
   */
  readonly current: number;
  /**
   * Advance the live token by one and return the new value. The
   * returned value is the token the caller should capture for the
   * current request.
   */
  capture(): number;
  /**
   * Advance the live token without returning a new value. Use this
   * when invalidating every in-flight request without starting a new
   * one (for example, when the user closes the relevant view).
   */
  invalidate(): void;
  /**
   * Returns `true` when the captured token still matches the live
   * token. A `false` result means a newer request has been captured
   * since and the caller should drop the in-flight response.
   */
  isCurrent(token: number): boolean;
};

export function createRequestToken(): RequestTokenStore {
  let value = 0;
  return {
    get current() {
      return value;
    },
    capture() {
      value += 1;
      return value;
    },
    invalidate() {
      value += 1;
    },
    isCurrent(token) {
      return value === token;
    }
  };
}
