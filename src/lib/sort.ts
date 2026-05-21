export function compareServiceNumbers(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function compareBusStopCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}
