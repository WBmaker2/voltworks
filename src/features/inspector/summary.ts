import { getAllTerminals, wireContainsPoint } from '../../circuit/geometry';
import { catalogItem } from '../../data/components';
import type {
  Circuit,
  CircuitComponent,
  Mission,
  MissionConcept,
  MissionProgress,
  SolveResult
} from '../../circuit/types';
import { formatCurrent, formatPower, formatResistance, formatVoltage } from '../../circuit/units';

export function componentLabel(component: CircuitComponent): string {
  return `${catalogItem(component.kind).labelKo} ${component.id}`;
}

export const CONCEPT_LABEL: Record<MissionConcept, string> = {
  series: '직렬 회로',
  parallel: '병렬 회로',
  measurement: '계측',
  short: '단락',
  power: '전력',
  divider: '전압 분배'
};

export function missionScore(mission: Mission, progress: MissionProgress | undefined): number {
  if (!progress?.explanation) return 0;
  let score = 30;
  if (progress.prediction === mission.prediction.answer) score += 40;
  if (progress.targetPassed) score += 30;
  return score;
}

export function describeCircuit(circuit: Circuit, result: SolveResult | null): string[] {
  const lines: string[] = [];
  const counts = new Map<string, number>();
  for (const component of circuit.components) {
    counts.set(component.kind, (counts.get(component.kind) ?? 0) + 1);
  }
  const countText = [...counts.entries()]
    .map(([kind, count]) => `${catalogItem(kind as CircuitComponent['kind']).labelKo} ${count}개`)
    .join(', ');
  lines.push(
    circuit.components.length > 0
      ? `부품: ${countText}. 전선 ${circuit.wires.length}개.`
      : '아직 부품이 없습니다.'
  );

  const terminalName = (role: string): string =>
    role === 'positive' ? '+극' : role === 'negative' ? '−극' : `${role} 단자`;
  const terminals = getAllTerminals(circuit.components);
  for (const wire of circuit.wires) {
    const attached = terminals
      .filter((terminal) => wireContainsPoint(wire, terminal))
      .map((terminal) => {
        const component = circuit.components.find((item) => item.id === terminal.componentId);
        const label = component ? catalogItem(component.kind).labelKo : '부품';
        return `${label} ${terminal.componentId} ${terminalName(terminal.role)}`;
      });
    if (attached.length > 0) {
      lines.push(`전선 ${wire.id}: ${attached.join(' · ')}.`);
    }
  }

  if (result) {
    for (const component of circuit.components) {
      const state = result.componentStates.get(component.id);
      if (!state) continue;
      const reading = [
        `전압 ${formatVoltage(state.voltage)}`,
        `전류 ${formatCurrent(state.current)}`,
        `전력 ${formatPower(state.power)}`
      ];
      if (component.kind === 'resistor' || component.kind === 'bulb') {
        reading.push(`저항 ${formatResistance(state.resistance ?? 0)}`);
      }
      lines.push(`${componentLabel(component)}: ${reading.join(', ')}.`);
    }
    if (result.warnings.length === 0) {
      lines.push('경고 없음. 회로가 정상적으로 계산되었습니다.');
    } else {
      lines.push(...result.warnings.map((warning) => warning.messageKo));
    }
  } else {
    lines.push('회로를 계산하려면 전지와 닫힌 전선 길이가 필요합니다.');
  }
  return lines;
}

export function describeCircuitShort(circuit: Circuit, result: SolveResult | null): string {
  return describeCircuit(circuit, result).join(' ');
}

export function readingForMeter(component: CircuitComponent, result: SolveResult | null): string {
  const state = result?.componentStates.get(component.id);
  if (!state) return '—';
  return component.kind === 'ammeter' ? formatCurrent(state.current) : formatVoltage(state.voltage);
}

export function meterFraction(component: CircuitComponent, result: SolveResult | null): number {
  const state = result?.componentStates.get(component.id);
  if (!state) return 0;
  if (component.kind === 'ammeter') return Math.max(0, Math.min(1, Math.abs(state.current) / 0.5));
  return Math.max(0, Math.min(1, Math.abs(state.voltage) / 10));
}
