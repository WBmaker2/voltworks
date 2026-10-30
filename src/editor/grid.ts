import type { Point } from '../circuit/types';

export const WORLD_BOUNDS = {
  minX: 2,
  maxX: 78,
  minY: 2,
  maxY: 44
};

export function snapPoint(point: Point): Point {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y)
  };
}

export function clampPoint(point: Point): Point {
  return {
    x: Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, point.x)),
    y: Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, point.y))
  };
}

export function snapAndClamp(point: Point): Point {
  return clampPoint(snapPoint(point));
}
