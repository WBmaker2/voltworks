import { BULB_RATING } from '../circuit/constants';
import { COMPONENT_SPECS, componentBounds } from '../circuit/geometry';
import type { CircuitComponent, ComponentState } from '../circuit/types';
import { formatCurrent, formatOhmsShort, formatVoltage, formatVoltsShort } from '../circuit/units';
import { CANVAS_FONT, CANVAS_MONO, type Palette, withAlpha } from './theme';

export interface ComponentDrawOptions {
  palette: Palette;
  scale: number;
  labels: boolean;
  voltages: boolean;
  selected: boolean;
  state?: ComponentState;
}

function strokeWidth(scale: number, screenPixels = 1.8): number {
  return screenPixels / scale;
}

function labelText(component: CircuitComponent, state: ComponentState | undefined): string {
  switch (component.kind) {
    case 'battery':
      return formatVoltsShort(component.value ?? 3);
    case 'bulb':
      return `${BULB_RATING.voltage}V ${BULB_RATING.power}W`;
    case 'resistor':
      return formatOhmsShort(component.value ?? 100);
    case 'switch':
      return `스위치 ${component.closed ? '닫힘' : '열림'}`;
    case 'ammeter':
      return formatCurrent(state?.current ?? 0);
    case 'voltmeter':
      return formatVoltage(state?.voltage ?? 0);
    default:
      return '';
  }
}

function drawLabelChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  palette: Palette,
  scale: number,
  options: { meter?: boolean; warning?: boolean; accent?: boolean } = {}
): void {
  if (!text) return;
  const fontSize = 10.5 / scale;
  ctx.save();
  ctx.font = `${options.meter ? 600 : 500} ${fontSize}px ${options.meter ? CANVAS_MONO : CANVAS_FONT}`;
  const metrics = ctx.measureText(text);
  const paddingX = 4 / scale;
  const height = 14 / scale;
  const width = metrics.width + paddingX * 2;
  const left = x - width / 2;
  const top = y - height / 2;
  const radius = 3 / scale;

  ctx.beginPath();
  ctx.roundRect(left, top, width, height, radius);
  ctx.fillStyle = options.warning ? palette.warning : options.meter ? palette.ink : palette.paper;
  ctx.globalAlpha = options.meter || options.warning ? 1 : 0.94;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (options.accent) {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = strokeWidth(scale, 1);
    ctx.stroke();
  }

  ctx.fillStyle = options.meter || options.warning ? palette.paper : palette.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.3 / scale);
  ctx.restore();
}

function drawBulbGlow(ctx: CanvasRenderingContext2D, brightness: number, palette: Palette): void {
  if (brightness <= 0.01) return;
  const radius = 0.8 + Math.min(1, brightness) * 0.75;
  const gradient = ctx.createRadialGradient(0, 0, 0.12, 0, 0, radius);
  gradient.addColorStop(0, withAlpha(palette.accent, 0.32 + Math.min(0.3, brightness * 0.2)));
  gradient.addColorStop(0.45, withAlpha(palette.accent, 0.13 + Math.min(0.12, brightness * 0.08)));
  gradient.addColorStop(1, withAlpha(palette.accent, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawComponent(
  ctx: CanvasRenderingContext2D,
  component: CircuitComponent,
  options: ComponentDrawOptions
): void {
  const { palette, scale, state } = options;
  const spec = COMPONENT_SPECS[component.kind];
  const vertical = component.rotation === 90 || component.rotation === 270;
  const bodyHalfWidth = spec.bodyWidth / 2;
  const bodyHalfHeight = spec.bodyHeight / 2;
  const line = strokeWidth(scale, 1.9);
  const heavy = strokeWidth(scale, 3.1);

  ctx.save();
  ctx.translate(component.x, component.y);
  ctx.rotate((component.rotation * Math.PI) / 180);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = palette.ink;
  ctx.fillStyle = palette.paper;
  ctx.lineWidth = line;

  if (component.kind === 'battery') {
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-0.24, 0);
    ctx.moveTo(0.24, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();

    ctx.lineWidth = heavy;
    ctx.beginPath();
    ctx.moveTo(-0.18, -0.25);
    ctx.lineTo(-0.18, 0.25);
    ctx.stroke();

    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.moveTo(0.18, -0.45);
    ctx.lineTo(0.18, 0.45);
    ctx.stroke();

    ctx.font = `600 ${12 / scale}px ${CANVAS_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.ink;
    ctx.fillText('+', 0.55, -0.44);
    ctx.fillText('−', -0.55, -0.44);
  } else if (component.kind === 'bulb') {
    const brightness = state?.brightness ?? 0;
    drawBulbGlow(ctx, brightness, palette);
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-bodyHalfWidth, 0);
    ctx.moveTo(bodyHalfWidth, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, bodyHalfWidth, 0, Math.PI * 2);
    ctx.fillStyle =
      brightness > 0.05
        ? withAlpha(palette.accent, 0.12 + Math.min(0.25, brightness * 0.2))
        : palette.paper;
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = brightness > 0.05 ? palette.accent : palette.ink;
    ctx.lineWidth = strokeWidth(scale, 1.6);
    ctx.beginPath();
    ctx.moveTo(-0.25, -0.25);
    ctx.lineTo(0.25, 0.25);
    ctx.moveTo(0.25, -0.25);
    ctx.lineTo(-0.25, 0.25);
    ctx.stroke();
    ctx.restore();
  } else if (component.kind === 'resistor') {
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-bodyHalfWidth, 0);
    ctx.moveTo(bodyHalfWidth, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-bodyHalfWidth, -bodyHalfHeight, spec.bodyWidth, spec.bodyHeight, 0.08);
    ctx.fillStyle = palette.paper;
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.stroke();
  } else if (component.kind === 'switch') {
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-0.62, 0);
    ctx.moveTo(0.62, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();

    ctx.fillStyle = palette.ink;
    for (const x of [-0.55, 0.55]) {
      ctx.beginPath();
      ctx.arc(x, 0, 0.075, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    if (component.closed) {
      ctx.moveTo(-0.55, 0);
      ctx.lineTo(0.55, 0);
    } else {
      ctx.moveTo(-0.55, 0);
      ctx.lineTo(0.42, -0.48);
    }
    ctx.lineWidth = strokeWidth(scale, 2.4);
    ctx.strokeStyle = component.closed ? palette.accent : palette.ink;
    ctx.stroke();
  } else if (component.kind === 'ammeter' || component.kind === 'voltmeter') {
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-bodyHalfWidth, 0);
    ctx.moveTo(bodyHalfWidth, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, bodyHalfWidth, 0, Math.PI * 2);
    ctx.fillStyle = palette.paper;
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.stroke();

    ctx.fillStyle = palette.ink;
    ctx.font = `700 ${13 / scale}px ${CANVAS_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(component.kind === 'ammeter' ? 'A' : 'V', 0, 0.02);

    const reading =
      component.kind === 'ammeter'
        ? Math.min(1, Math.abs(state?.current ?? 0) / 0.5)
        : Math.min(1, Math.abs(state?.voltage ?? 0) / 10);
    if (reading > 0) {
      const angle = -Math.PI * 0.75 + reading * Math.PI * 0.5;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = strokeWidth(scale, 1.6);
      ctx.beginPath();
      ctx.moveTo(0, 0.18);
      ctx.lineTo(Math.cos(angle) * 0.28, 0.18 + Math.sin(angle) * 0.28);
      ctx.stroke();
    }
  }

  ctx.restore();

  if (options.labels || component.kind === 'ammeter' || component.kind === 'voltmeter') {
    const text = labelText(component, state);
    const labelY = component.y + (vertical ? 1.28 : component.kind === 'bulb' ? 0.92 : 0.78);
    drawLabelChip(ctx, component.x, labelY, text, palette, scale, {
      meter: component.kind === 'ammeter' || component.kind === 'voltmeter',
      accent: options.selected
    });
  }

  if (options.voltages && state && component.kind !== 'ammeter' && component.kind !== 'voltmeter') {
    const badgeY = component.y - (vertical ? 1.25 : component.kind === 'bulb' ? 0.92 : 0.72);
    drawLabelChip(ctx, component.x, badgeY, formatVoltage(state.voltage), palette, scale, {
      meter: true
    });
  }

  if (options.selected) {
    const bounds = componentBounds(component);
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = strokeWidth(scale, 1.4);
    ctx.setLineDash([6 / scale, 4 / scale]);
    ctx.strokeRect(
      bounds.minX - 0.18,
      bounds.minY - 0.18,
      bounds.maxX - bounds.minX + 0.36,
      bounds.maxY - bounds.minY + 0.36
    );
    ctx.restore();
  }
}
