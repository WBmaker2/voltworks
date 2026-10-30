import { BATTERY_VOLTAGES, BULB_RATING } from '../circuit/constants';
import type { ComponentKind } from '../circuit/types';
import { formatVoltsShort } from '../circuit/units';

export interface CatalogItem {
  kind: ComponentKind;
  labelKo: string;
  hintKo: string;
  category: 'source' | 'load' | 'control' | 'meter';
  specKo: string;
}

export const CATALOG: CatalogItem[] = [
  {
    kind: 'battery',
    labelKo: '전지',
    hintKo: '전압을 골라 회로에 전원을 공급합니다.',
    category: 'source',
    specKo: `${BATTERY_VOLTAGES.map((voltage) => formatVoltsShort(voltage)).join(' · ')}`
  },
  {
    kind: 'bulb',
    labelKo: '전구',
    hintKo: '전력을 빛으로 바꾸는 부하입니다.',
    category: 'load',
    specKo: `${BULB_RATING.voltage}V · ${BULB_RATING.power}W`
  },
  {
    kind: 'resistor',
    labelKo: '저항',
    hintKo: '전류를 제한합니다. 값을 바꿔 실험하세요.',
    category: 'load',
    specKo: '10Ω – 1kΩ'
  },
  {
    kind: 'switch',
    labelKo: '스위치',
    hintKo: '회로를 열거나 닫습니다.',
    category: 'control',
    specKo: '열림 · 닫힘'
  },
  {
    kind: 'ammeter',
    labelKo: '전류계',
    hintKo: '회로와 직렬로 연결해 전류를 잽니다.',
    category: 'meter',
    specKo: '이상적 전류계 · 0Ω'
  },
  {
    kind: 'voltmeter',
    labelKo: '전압계',
    hintKo: '측정할 부품과 나란히 연결해 전압을 잽니다.',
    category: 'meter',
    specKo: '이상적 전압계 · 1GΩ'
  }
];

export const CATEGORY_LABELS: Record<CatalogItem['category'], string> = {
  source: '전원',
  load: '부하',
  control: '제어',
  meter: '계측'
};

export function catalogItem(kind: ComponentKind): CatalogItem {
  const item = CATALOG.find((entry) => entry.kind === kind);
  if (!item) throw new Error(`Unknown component kind: ${kind}`);
  return item;
}
