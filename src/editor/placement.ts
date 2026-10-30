import { BULB_RATING, MAX_COMPONENTS } from '../circuit/constants';
import { boundsOverlap, componentFootprint } from '../circuit/geometry';
import type { CircuitComponent, ComponentKind, Point } from '../circuit/types';
import { WORLD_BOUNDS } from './grid';

const PREFIXES: Record<ComponentKind, string> = {
  battery: 'b',
  bulb: 'l',
  resistor: 'r',
  switch: 's',
  ammeter: 'a',
  voltmeter: 'v'
};

export function nextComponentId(components: CircuitComponent[], kind: ComponentKind): string {
  const prefix = PREFIXES[kind];
  let maximum = 0;
  for (const component of components) {
    if (!component.id.startsWith(prefix)) continue;
    const suffix = Number(component.id.slice(prefix.length));
    if (Number.isFinite(suffix)) maximum = Math.max(maximum, suffix);
  }
  return `${prefix}${maximum + 1}`;
}

export function createComponent(id: string, kind: ComponentKind, point: Point): CircuitComponent {
  const base: CircuitComponent = {
    id,
    kind,
    x: point.x,
    y: point.y,
    rotation: 0
  };
  if (kind === 'battery') base.value = 3;
  if (kind === 'resistor') base.value = 100;
  if (kind === 'bulb') base.rating = { ...BULB_RATING };
  if (kind === 'switch') base.closed = false;
  return base;
}

export interface PlacementResult {
  ok: boolean;
  reasonKo?: string;
}

export function canPlaceComponent(
  components: CircuitComponent[],
  kind: ComponentKind,
  point: Point,
  rotation: CircuitComponent['rotation'],
  ignoreId?: string
): PlacementResult {
  if (components.length >= MAX_COMPONENTS) {
    return { ok: false, reasonKo: `부품은 최대 ${MAX_COMPONENTS}개까지 놓을 수 있습니다.` };
  }
  const candidate: CircuitComponent = {
    id: '__candidate__',
    kind,
    x: point.x,
    y: point.y,
    rotation
  };
  const footprint = componentFootprint(candidate);
  if (
    footprint.minX < WORLD_BOUNDS.minX ||
    footprint.maxX > WORLD_BOUNDS.maxX ||
    footprint.minY < WORLD_BOUNDS.minY ||
    footprint.maxY > WORLD_BOUNDS.maxY
  ) {
    return { ok: false, reasonKo: '작업대 가장자리에는 부품을 놓을 수 없습니다.' };
  }
  for (const component of components) {
    if (component.id === ignoreId) continue;
    if (boundsOverlap(footprint, componentFootprint(component))) {
      return { ok: false, reasonKo: '다른 부품과 겹칩니다. 빈자리를 골라 주세요.' };
    }
  }
  return { ok: true };
}
