import type {
  CircuitComponent,
  ComponentKind,
  Point,
  Rotation,
  Terminal,
  TerminalRole,
  Wire
} from './types';

export interface ComponentSpec {
  labelKo: string;
  category: 'source' | 'load' | 'control' | 'meter';
  bodyWidth: number;
  bodyHeight: number;
  terminals: Array<{ role: TerminalRole; dx: number; dy: number }>;
}

const HORIZONTAL_TERMINALS: Array<{ role: TerminalRole; dx: number; dy: number }> = [
  { role: 'a', dx: -1, dy: 0 },
  { role: 'b', dx: 1, dy: 0 }
];

const BATTERY_TERMINALS: Array<{ role: TerminalRole; dx: number; dy: number }> = [
  { role: 'negative', dx: -1, dy: 0 },
  { role: 'positive', dx: 1, dy: 0 }
];

export const COMPONENT_SPECS: Record<ComponentKind, ComponentSpec> = {
  battery: {
    labelKo: '전지',
    category: 'source',
    bodyWidth: 1.4,
    bodyHeight: 0.9,
    terminals: BATTERY_TERMINALS
  },
  bulb: {
    labelKo: '전구',
    category: 'load',
    bodyWidth: 1,
    bodyHeight: 1,
    terminals: HORIZONTAL_TERMINALS
  },
  resistor: {
    labelKo: '저항',
    category: 'load',
    bodyWidth: 1.4,
    bodyHeight: 0.55,
    terminals: HORIZONTAL_TERMINALS
  },
  switch: {
    labelKo: '스위치',
    category: 'control',
    bodyWidth: 1.6,
    bodyHeight: 0.6,
    terminals: HORIZONTAL_TERMINALS
  },
  ammeter: {
    labelKo: '전류계',
    category: 'meter',
    bodyWidth: 1,
    bodyHeight: 1,
    terminals: HORIZONTAL_TERMINALS
  },
  voltmeter: {
    labelKo: '전압계',
    category: 'meter',
    bodyWidth: 1,
    bodyHeight: 1,
    terminals: HORIZONTAL_TERMINALS
  }
};

export function rotateOffset(dx: number, dy: number, rotation: Rotation): Point {
  switch (rotation) {
    case 90:
      return { x: -dy, y: dx };
    case 180:
      return { x: -dx, y: -dy };
    case 270:
      return { x: dy, y: -dx };
    default:
      return { x: dx, y: dy };
  }
}

export function getTerminals(component: CircuitComponent): Terminal[] {
  const spec = COMPONENT_SPECS[component.kind];
  return spec.terminals.map((terminal) => {
    const offset = rotateOffset(terminal.dx, terminal.dy, component.rotation);
    return {
      id: `${component.id}:${terminal.role}`,
      componentId: component.id,
      role: terminal.role,
      x: component.x + offset.x,
      y: component.y + offset.y
    };
  });
}

export function getAllTerminals(components: CircuitComponent[]): Terminal[] {
  return components.flatMap(getTerminals);
}

export function getTerminal(component: CircuitComponent, role: TerminalRole): Terminal {
  const terminal = getTerminals(component).find((item) => item.role === role);
  if (!terminal) throw new Error(`No terminal ${role} on ${component.kind}`);
  return terminal;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function componentBounds(component: CircuitComponent): Bounds {
  const spec = COMPONENT_SPECS[component.kind];
  const vertical = component.rotation === 90 || component.rotation === 270;
  const halfW = (vertical ? spec.bodyHeight : spec.bodyWidth) / 2;
  const halfH = (vertical ? spec.bodyWidth : spec.bodyHeight) / 2;
  return {
    minX: component.x - halfW,
    minY: component.y - halfH,
    maxX: component.x + halfW,
    maxY: component.y + halfH
  };
}

export function componentFootprint(component: CircuitComponent): Bounds {
  const vertical = component.rotation === 90 || component.rotation === 270;
  const halfW = vertical ? 0.5 : 1;
  const halfH = vertical ? 1 : 0.5;
  return {
    minX: component.x - halfW,
    minY: component.y - halfH,
    maxX: component.x + halfW,
    maxY: component.y + halfH
  };
}

export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function pointOnSegment(point: Point, a: Point, b: Point): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > 1e-9) return false;
  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < 0) return false;
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return dot <= lengthSq;
}

export function wireSegments(wire: Wire): Array<{ a: Point; b: Point }> {
  const segments: Array<{ a: Point; b: Point }> = [];
  for (let i = 0; i < wire.points.length - 1; i += 1) {
    segments.push({ a: wire.points[i], b: wire.points[i + 1] });
  }
  return segments;
}

export function wireContainsPoint(wire: Wire, point: Point): boolean {
  if (wire.points.some((vertex) => pointsEqual(vertex, point))) return true;
  return wireSegments(wire).some((segment) => pointOnSegment(point, segment.a, segment.b));
}

export function wireLength(wire: Wire): number {
  let length = 0;
  for (const segment of wireSegments(wire)) {
    length += Math.abs(segment.b.x - segment.a.x) + Math.abs(segment.b.y - segment.a.y);
  }
  return length;
}

export function distanceAlongWire(wire: Wire, point: Point): number {
  let traveled = 0;
  for (const segment of wireSegments(wire)) {
    if (pointOnSegment(point, segment.a, segment.b)) {
      return traveled + Math.abs(point.x - segment.a.x) + Math.abs(point.y - segment.a.y);
    }
    traveled += Math.abs(segment.b.x - segment.a.x) + Math.abs(segment.b.y - segment.a.y);
  }
  return traveled;
}

export function manhattanPath(from: Point, to: Point): Point[] {
  if (from.x === to.x || from.y === to.y) return [{ x: to.x, y: to.y }];
  return [
    { x: to.x, y: from.y },
    { x: to.x, y: to.y }
  ];
}

export function terminalAtPoint(components: CircuitComponent[], point: Point): Terminal | null {
  return getAllTerminals(components).find((terminal) => pointsEqual(terminal, point)) ?? null;
}

export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function distanceToWire(point: Point, wire: Wire): number {
  return Math.min(
    ...wireSegments(wire).map((segment) => distanceToSegment(point, segment.a, segment.b))
  );
}

export interface JunctionPoint extends Point {
  degree: number;
}

export function findJunctions(wires: Wire[]): JunctionPoint[] {
  const counts = new Map<string, { point: Point; count: number }>();
  for (const wire of wires) {
    for (const segment of wireSegments(wire)) {
      for (const point of [segment.a, segment.b]) {
        const key = pointKey(point);
        const current = counts.get(key) ?? { point, count: 0 };
        current.count += 1;
        counts.set(key, current);
      }
    }
  }

  const junctions: JunctionPoint[] = [];
  for (const { point, count } of counts.values()) {
    if (count >= 3) junctions.push({ ...point, degree: count });
  }

  for (const wire of wires) {
    for (const endpoint of [wire.points[0], wire.points[wire.points.length - 1]]) {
      if (!endpoint) continue;
      const touchesOther = wires.some(
        (other) =>
          other.id !== wire.id &&
          (wireContainsPoint(other, endpoint) ||
            pointsEqual(other.points[0], endpoint) ||
            pointsEqual(other.points[other.points.length - 1], endpoint))
      );
      if (touchesOther && !junctions.some((entry) => pointsEqual(entry, endpoint))) {
        junctions.push({ ...endpoint, degree: 2 });
      }
    }
  }

  return junctions;
}

export function rotateTerminalPoint(
  component: CircuitComponent,
  previousRotation: Rotation,
  point: Point
): Point | null {
  for (const terminal of COMPONENT_SPECS[component.kind].terminals) {
    const oldOffset = rotateOffset(terminal.dx, terminal.dy, previousRotation);
    if (component.x + oldOffset.x === point.x && component.y + oldOffset.y === point.y) {
      const newOffset = rotateOffset(terminal.dx, terminal.dy, component.rotation);
      return { x: component.x + newOffset.x, y: component.y + newOffset.y };
    }
  }
  return null;
}
