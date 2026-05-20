export type LoadState = 'idle' | 'loading' | 'error';

export type ThemeChoice = 'system' | 'light' | 'dark';

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
};
