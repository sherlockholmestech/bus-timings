import type { BusStop } from './lta';

export function searchBusStops(busStops: BusStop[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return busStops
    .map((stop) => {
      const searchable = `${stop.BusStopCode} ${stop.Description} ${stop.RoadName}`.toLowerCase();
      return {
        score: scoreSearchResult(normalizedQuery, searchable, stop.BusStopCode.toLowerCase()),
        stop,
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.stop.Description.localeCompare(b.stop.Description))
    .map((result) => result.stop)
    .slice(0, 50);
}

function scoreSearchResult(query: string, searchable: string, stopCode: string) {
  if (stopCode === query) {
    return 1000;
  }
  if (stopCode.startsWith(query)) {
    return 900 - stopCode.length;
  }
  if (searchable.includes(query)) {
    return 700 - searchable.indexOf(query);
  }

  let score = 0;
  let searchIndex = 0;
  let streak = 0;

  for (const char of query) {
    const nextIndex = searchable.indexOf(char, searchIndex);
    if (nextIndex === -1) {
      return 0;
    }

    const gap = nextIndex - searchIndex;
    streak = gap === 0 ? streak + 1 : 0;
    score += 12 + streak * 6 - Math.min(gap, 12);
    searchIndex = nextIndex + 1;
  }

  return score - searchable.length * 0.05;
}
