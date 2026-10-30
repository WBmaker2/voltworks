import { GRID_CELL_PX } from '../circuit/constants';
import { componentBounds, findJunctions, getTerminals } from '../circuit/geometry';
import type { Circuit } from '../circuit/types';
import { drawComponent } from './drawComponents';
import { paletteFor } from './theme';

export function renderCircuitPreview(
  circuit: Circuit,
  width = 720,
  height = 420,
  theme: 'light' | 'dark' = 'light'
): string {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const palette = paletteFor(theme);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const component of circuit.components) {
    const bounds = componentBounds(component);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.maxX);
    maxY = Math.max(maxY, bounds.maxY);
  }
  for (const wire of circuit.wires) {
    for (const point of wire.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 20;
    maxY = 12;
  }
  const padding = 2.2;
  const spanX = Math.max(8, maxX - minX + padding * 2);
  const spanY = Math.max(5, maxY - minY + padding * 2);
  const scale = Math.min((width * dpr) / spanX, (height * dpr) / spanY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2 - centerX * scale, canvas.height / 2 - centerY * scale);
  ctx.scale(scale, scale);

  const left = centerX - canvas.width / (2 * scale) - 1;
  const right = centerX + canvas.width / (2 * scale) + 1;
  const top = centerY - canvas.height / (2 * scale) - 1;
  const bottom = centerY + canvas.height / (2 * scale) + 1;
  ctx.beginPath();
  for (let x = Math.floor(left); x <= right; x += 1) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
  }
  for (let y = Math.floor(top); y <= bottom; y += 1) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
  }
  ctx.strokeStyle = palette.gridLine;
  ctx.lineWidth = 1 / scale;
  ctx.stroke();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const wire of circuit.wires) {
    if (wire.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(wire.points[0].x, wire.points[0].y);
    for (let index = 1; index < wire.points.length; index += 1) {
      ctx.lineTo(wire.points[index].x, wire.points[index].y);
    }
    ctx.strokeStyle = palette.paper;
    ctx.lineWidth = 7 / scale;
    ctx.stroke();
    ctx.strokeStyle = palette.wire;
    ctx.lineWidth = 3.4 / scale;
    ctx.stroke();
  }

  for (const junction of findJunctions(circuit.wires)) {
    ctx.beginPath();
    ctx.arc(junction.x, junction.y, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = palette.paper;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(junction.x, junction.y, 0.085, 0, Math.PI * 2);
    ctx.fillStyle = palette.wire;
    ctx.fill();
  }

  for (const component of circuit.components) {
    drawComponent(ctx, component, {
      palette,
      scale,
      labels: true,
      voltages: false,
      selected: false
    });
    for (const terminal of getTerminals(component)) {
      ctx.beginPath();
      ctx.arc(terminal.x, terminal.y, 0.06, 0, Math.PI * 2);
      ctx.fillStyle = palette.paper;
      ctx.fill();
      ctx.strokeStyle = palette.inkSoft;
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/png');
}

export function previewScaleHint(): string {
  return `1칸 = ${GRID_CELL_PX}px`;
}
