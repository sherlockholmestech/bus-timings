export type LoadState = 'idle' | 'loading' | 'error';
export type DrawerSnap = 'peek' | 'half' | 'full';

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
};
