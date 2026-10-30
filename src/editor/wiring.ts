import { manhattanPath, pointsEqual } from '../circuit/geometry';
import type { Point, Wire } from '../circuit/types';

export function dedupePoints(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || !pointsEqual(previous, point)) result.push(point);
  }
  return result;
}

export function appendOrthogonalPath(points: Point[], next: Point): Point[] {
  const last = points[points.length - 1];
  if (!last || pointsEqual(last, next)) return points;
  const path = manhattanPath(last, next);
  return dedupePoints([...points, ...path]);
}

export function buildWirePath(start: Point, end: Point, waypoints: Point[] = []): Point[] {
  let points: Point[] = [start];
  for (const waypoint of waypoints) {
    points = appendOrthogonalPath(points, waypoint);
  }
  points = appendOrthogonalPath(points, end);
  return dedupePoints(points);
}

export function trimEndpointAt(wire: Wire, point: Point): Wire | null {
  const points = wire.points.slice();
  if (points[0] && pointsEqual(points[0], point)) {
    points.shift();
  } else if (points[points.length - 1] && pointsEqual(points[points.length - 1], point)) {
    points.pop();
  } else {
    return wire;
  }
  const deduped = dedupePoints(points);
  if (deduped.length < 2) return null;
  return { ...wire, points: deduped };
}

export function rerouteEndpoint(wire: Wire, oldPoint: Point, newPoint: Point): Wire {
  if (pointsEqual(oldPoint, newPoint)) return wire;
  const points = wire.points.slice();
  if (points[0] && pointsEqual(points[0], oldPoint)) {
    if (points.length === 1) return { ...wire, points: [newPoint] };
    const rest = points.slice(1);
    const path = manhattanPath(newPoint, rest[0]);
    return {
      ...wire,
      points: dedupePoints([newPoint, ...path, ...rest.slice(1)])
    };
  }
  if (points[points.length - 1] && pointsEqual(points[points.length - 1], oldPoint)) {
    const previous = points[points.length - 2];
    if (!previous) return { ...wire, points: [newPoint] };
    return {
      ...wire,
      points: dedupePoints([...points.slice(0, -1), ...manhattanPath(previous, newPoint)])
    };
  }
  return wire;
}

export function wireHasEndpoint(wire: Wire, point: Point): boolean {
  return Boolean(
    (wire.points[0] && pointsEqual(wire.points[0], point)) ||
    (wire.points[wire.points.length - 1] && pointsEqual(wire.points[wire.points.length - 1], point))
  );
}
