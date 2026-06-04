export function formatClockTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * A timestamp captured at the moment a refresh completed
 * successfully.
 *
 * - `at` is the raw `Date.now()` value (epoch milliseconds) and is
 *   used to compare two timestamps so the drawer header can show
 *   the *newest* successful refresh across modes.
 * - `display` is the human-readable clock time used by the drawer
 *   header.
 *
 * The two fields are captured together so a future refactor cannot
 * accidentally advance one without the other.
 */
export type Timestamp = {
  at: number;
  display: string;
};

/**
 * Capture a comparable timestamp and a user-readable display string
 * for the same instant. The runner writes both fields atomically so
 * the drawer header can compare timestamps across modes and pick the
 * newest one (see `pickNewestTimestamp`).
 */
export function formatTimestamp(date = new Date()): Timestamp {
  return {
    at: date.getTime(),
    display: formatClockTime(date),
  };
}

/**
 * Return whichever timestamp was captured most recently. When both
 * timestamps are present, the larger `at` value wins. When only one
 * is present, it is returned. When neither is present, `null` is
 * returned. `null` is treated as the oldest possible instant so
 * `pickNewestTimestamp` never picks a missing timestamp over a
 * present one.
 *
 * This helper is used by the route-mode drawer header to show the
 * newest successful refresh across the selected-stop and favourites
 * refresh modes.
 */
export function pickNewestTimestamp(
  a: Timestamp | null,
  b: Timestamp | null
): Timestamp | null {
  if (a === null && b === null) {
    return null;
  }
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  return a.at >= b.at ? a : b;
}
