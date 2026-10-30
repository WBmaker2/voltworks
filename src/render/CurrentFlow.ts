import type { Point, Wire, WireFlow } from '../circuit/types';
import type { Palette } from './theme';

export interface WireGeometry {
  points: Point[];
  cumulative: number[];
  total: number;
}

export interface FlowPoint {
  x: number;
  y: number;
  angle: number;
}

export function buildWireGeometry(wire: Wire): WireGeometry {
  const points = wire.points;
  const cumulative = new Array<number>(points.length).fill(0);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    total += Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    cumulative[index] = total;
  }
  return { points, cumulative, total };
}

export function pointAtDistance(geometry: WireGeometry, distance: number): FlowPoint {
  const { points, cumulative, total } = geometry;
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };
  const clamped = Math.max(0, Math.min(total, distance));
  let index = 0;
  while (index < cumulative.length - 2 && cumulative[index + 1] < clamped) index += 1;
  const start = points[index];
  const end = points[index + 1] ?? start;
  const segmentStart = cumulative[index] ?? 0;
  const length = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
  const t = length > 0 ? (clamped - segmentStart) / length : 0;
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    angle: Math.atan2(end.y - start.y, end.x - start.x)
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function drawCurrentFlow(
  ctx: CanvasRenderingContext2D,
  flows: WireFlow[],
  geometries: Map<string, WireGeometry>,
  timeSeconds: number,
  palette: Palette,
  scale: number,
  reducedMotion: boolean
): void {
  if (reducedMotion) {
    drawStaticArrows(ctx, flows, geometries, palette, scale);
    return;
  }

  const radius = 0.075;
  let active = 0;
  ctx.beginPath();
  for (const flow of flows) {
    const geometry = geometries.get(flow.wireId);
    if (!geometry || geometry.total <= 0 || Math.abs(flow.current) < 1e-9) continue;
    const spacing = 1.05;
    const count = Math.min(36, Math.max(1, Math.floor(geometry.total / spacing)));
    const phase = hashString(flow.wireId) * geometry.total;
    const speed = 1.1 + Math.min(9, flow.speed * 3.2);
    for (let index = 0; index < count; index += 1) {
      if (active >= 1200) break;
      const raw = timeSeconds * speed * flow.direction + phase + index * spacing;
      const distance = ((raw % geometry.total) + geometry.total) % geometry.total;
      const point = pointAtDistance(geometry, distance);
      ctx.moveTo(point.x + radius, point.y);
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      active += 1;
    }
    if (active >= 1200) break;
  }
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawStaticArrows(
  ctx: CanvasRenderingContext2D,
  flows: WireFlow[],
  geometries: Map<string, WireGeometry>,
  palette: Palette,
  scale: number
): void {
  ctx.save();
  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = palette.accent;
  ctx.lineWidth = 1.6 / scale;
  for (const flow of flows) {
    const geometry = geometries.get(flow.wireId);
    if (!geometry || geometry.total < 0.4 || Math.abs(flow.current) < 1e-9) continue;
    const fractions = geometry.total > 5 ? [0.28, 0.72] : [0.5];
    for (const fraction of fractions) {
      const point = pointAtDistance(geometry, geometry.total * fraction);
      const angle = point.angle + (flow.direction === 1 ? 0 : Math.PI);
      const size = 0.16;
      ctx.beginPath();
      ctx.moveTo(point.x + Math.cos(angle) * size, point.y + Math.sin(angle) * size);
      ctx.lineTo(point.x + Math.cos(angle + 2.55) * size, point.y + Math.sin(angle + 2.55) * size);
      ctx.lineTo(point.x + Math.cos(angle - 2.55) * size, point.y + Math.sin(angle - 2.55) * size);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}
