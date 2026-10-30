import {
  componentFootprint,
  distanceToWire,
  getAllTerminals,
  pointsEqual
} from '../circuit/geometry';
import type { CircuitComponent, Point, Terminal, Wire } from '../circuit/types';

export type Hit =
  | { kind: 'terminal'; terminal: Terminal }
  | { kind: 'component'; component: CircuitComponent }
  | { kind: 'wire'; wire: Wire; point: Point }
  | { kind: 'empty'; point: Point };

function pointInBounds(
  point: Point,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

export interface HitOptions {
  terminalRadius?: number;
  wireRadius?: number;
}

export function hitTest(
  components: CircuitComponent[],
  wires: Wire[],
  point: Point,
  options: HitOptions = {}
): Hit {
  const terminalRadius = options.terminalRadius ?? 0.4;
  const wireRadius = options.wireRadius ?? 0.24;

  let closestTerminal: Terminal | null = null;
  let closestDistance = terminalRadius;
  for (const terminal of getAllTerminals(components)) {
    const distance = Math.hypot(terminal.x - point.x, terminal.y - point.y);
    if (distance <= closestDistance) {
      closestDistance = distance;
      closestTerminal = terminal;
    }
  }
  if (closestTerminal) return { kind: 'terminal', terminal: closestTerminal };

  for (let index = components.length - 1; index >= 0; index -= 1) {
    const component = components[index];
    if (pointInBounds(point, componentFootprint(component))) {
      return { kind: 'component', component };
    }
  }

  let closestWire: Wire | null = null;
  let closestWireDistance = wireRadius;
  for (const wire of wires) {
    const distance = distanceToWire(point, wire);
    if (distance <= closestWireDistance) {
      closestWireDistance = distance;
      closestWire = wire;
    }
  }
  if (closestWire) {
    const wirePoint = closestWire.points.reduce<Point>((best, candidate) => {
      const bestDistance = Math.hypot(best.x - point.x, best.y - point.y);
      const candidateDistance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      return candidateDistance < bestDistance ? candidate : best;
    }, closestWire.points[0] ?? point);
    const snapped =
      Math.abs(wirePoint.x - point.x) <= 0.5 && Math.abs(wirePoint.y - point.y) <= 0.5
        ? wirePoint
        : { x: Math.round(point.x), y: Math.round(point.y) };
    return { kind: 'wire', wire: closestWire, point: snapped };
  }

  return { kind: 'empty', point: { x: Math.round(point.x), y: Math.round(point.y) } };
}

export function isEndpointAt(wire: Wire, point: Point): boolean {
  return (
    Boolean(wire.points[0] && pointsEqual(wire.points[0], point)) ||
    Boolean(
      wire.points[wire.points.length - 1] && pointsEqual(wire.points[wire.points.length - 1], point)
    )
  );
}
