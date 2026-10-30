import type { Circuit, CircuitWarning, Mission, SolveResult } from '../../circuit/types';
import { formatCurrent, formatPower, formatVoltage, formatVoltageMilli } from '../../circuit/units';

export interface MissionCheck {
  ok: boolean;
  evidenceKo: string;
  hintKo: string;
}

function statesOfKind(circuit: Circuit, result: SolveResult, kind: string) {
  return circuit.components
    .filter((component) => component.kind === kind)
    .map((component) => ({
      component,
      state: result.componentStates.get(component.id)
    }))
    .filter((entry) => entry.state !== undefined);
}

function hasWarning(warnings: CircuitWarning[], ...codes: CircuitWarning['code'][]): boolean {
  return warnings.some((warning) => codes.includes(warning.code));
}

function switchesClosed(circuit: Circuit): boolean {
  const switches = circuit.components.filter((component) => component.kind === 'switch');
  return switches.length > 0 && switches.every((component) => component.closed ?? false);
}

function near(a: number, b: number, tolerance = 1e-6): boolean {
  return Math.abs(a - b) <= tolerance;
}

function bulbEvidence(
  bulbs: Array<{
    component: Circuit['components'][number];
    state?: { power: number; current: number; voltage: number };
  }>
): string {
  return bulbs
    .map((entry, index) => {
      const state = entry.state;
      if (!state) return `전구 ${index + 1}: 계산 전`;
      return `전구 ${index + 1}: ${formatPower(state.power)} · ${formatCurrent(state.current)}`;
    })
    .join(' / ');
}

export function evaluateTarget(
  target: string,
  circuit: Circuit,
  result: SolveResult,
  mission: Mission
): MissionCheck {
  const warnings = result.warnings;
  const short = hasWarning(warnings, 'short');
  const open = hasWarning(warnings, 'open');
  const noBattery = hasWarning(warnings, 'no-battery');
  const closed = switchesClosed(circuit);
  const bulbs = statesOfKind(circuit, result, 'bulb');
  const ammeters = statesOfKind(circuit, result, 'ammeter');
  const voltmeters = statesOfKind(circuit, result, 'voltmeter');

  if (noBattery) {
    return {
      ok: false,
      evidenceKo: '전원이 없습니다.',
      hintKo: '전지를 먼저 놓고 회로를 연결하세요.'
    };
  }

  switch (target) {
    case 'one-bulb': {
      const lit = bulbs.some((entry) => (entry.state?.power ?? 0) > 0.3);
      const ok = lit && closed && !short && !open;
      return {
        ok,
        evidenceKo: bulbs.length > 0 ? bulbEvidence(bulbs) : '전구가 없습니다.',
        hintKo: ok ? '' : '전지 +극과 스위치 왼쪽 끝을 전선으로 잇고, 스위치를 닫았는지 확인하세요.'
      };
    }
    case 'series-equal': {
      if (bulbs.length < 2) {
        return {
          ok: false,
          evidenceKo: '전구가 두 개 필요합니다.',
          hintKo: '전구 두 개가 직렬로 연결되어 있는지 확인하세요.'
        };
      }
      const powers = bulbs.map((entry) => entry.state?.power ?? 0);
      const currents = bulbs.map((entry) => entry.state?.current ?? 0);
      const lit = powers.every((power) => power > 0.05);
      const equalPower = near(powers[0], powers[1], 1e-6);
      const equalCurrent = near(currents[0], currents[1], 1e-6);
      const ok = lit && equalPower && equalCurrent && closed && !short && !open;
      return {
        ok,
        evidenceKo: bulbEvidence(bulbs),
        hintKo: ok ? '' : '스위치를 닫고, 두 전구에 같은 전류가 흐르는지 확인하세요.'
      };
    }
    case 'parallel-brighter': {
      if (bulbs.length < 2) {
        return {
          ok: false,
          evidenceKo: '전구가 두 개 필요합니다.',
          hintKo: '두 전구가 모두 회로에 연결되어 있는지 확인하세요.'
        };
      }
      const powers = bulbs.map((entry) => entry.state?.power ?? 0);
      const voltages = bulbs.map((entry) => Math.abs(entry.state?.voltage ?? 0));
      const bright = powers.every((power) => power > 0.4);
      const fullVoltage = voltages.every((voltage) => voltage > 2.5);
      const ok = bright && fullVoltage && closed && !short && !open;
      return {
        ok,
        evidenceKo: bulbEvidence(bulbs),
        hintKo: ok
          ? ''
          : '전구 두 개가 전지 양극 사이에 나란히 연결되도록 전선을 이어 보세요. 스위치도 닫아야 합니다.'
      };
    }
    case 'current-equal': {
      if (ammeters.length < 2) {
        return {
          ok: false,
          evidenceKo: '전류계가 두 개 필요합니다.',
          hintKo: '전구 앞과 뒤의 전류계를 모두 회로에 연결하세요.'
        };
      }
      const currents = ammeters.map((entry) => entry.state?.current ?? 0);
      const flowing = currents.every((current) => Math.abs(current) > 0.05);
      const equal = near(Math.abs(currents[0]), Math.abs(currents[1]), 1e-6);
      const ok = flowing && equal && closed && !short && !open;
      return {
        ok,
        evidenceKo: ammeters
          .map((entry, index) => `전류계 ${index + 1}: ${formatCurrent(entry.state?.current ?? 0)}`)
          .join(' / '),
        hintKo: ok ? '' : '스위치를 닫고 두 전류계의 값이 같은지 확인하세요.'
      };
    }
    case 'meters-correct': {
      if (ammeters.length < 1 || voltmeters.length < 1) {
        return {
          ok: false,
          evidenceKo: '계측기가 부족합니다.',
          hintKo: '빈자리에 전류계와 전압계를 하나씩 놓으세요.'
        };
      }
      const current = Math.abs(ammeters[0].state?.current ?? 0);
      const voltage = Math.abs(voltmeters[0].state?.voltage ?? 0);
      const meterProblem = hasWarning(warnings, 'meter-series', 'meter-parallel');
      const ok = current > 0.1 && voltage > 2.5 && closed && !short && !open && !meterProblem;
      return {
        ok,
        evidenceKo: `전류 ${formatCurrent(current)} · 전압 ${formatVoltage(voltage)}`,
        hintKo: ok ? '' : '전류계는 스위치와 전구 사이에 직렬로, 전압계는 전구와 나란히 놓으세요.'
      };
    }
    case 'short-fixed': {
      const lit = bulbs.some((entry) => (entry.state?.power ?? 0) > 0.3);
      const ok = lit && closed && !short && !open;
      return {
        ok,
        evidenceKo: bulbs.length > 0 ? bulbEvidence(bulbs) : '전구가 없습니다.',
        hintKo: ok ? '' : '전구의 양쪽 끝을 직접 잇는 우회 전선을 삭제하세요. 스위치는 닫아 두세요.'
      };
    }
    case 'divider-3v': {
      if (voltmeters.length === 0) {
        return {
          ok: false,
          evidenceKo: '전압계가 없습니다.',
          hintKo: '전압계가 저항과 나란히 연결되어 있는지 확인하세요.'
        };
      }
      const reading = Math.abs(voltmeters[0].state?.voltage ?? 0);
      const ok = reading >= 2.4 && reading <= 3.2 && closed && !short && !open;
      return {
        ok,
        evidenceKo: `전압계 ${formatVoltageMilli(reading)} · ${bulbEvidence(bulbs)}`,
        hintKo: ok
          ? ''
          : 'R1:R2를 1:2로 맞추세요. 아래 저항을 220Ω으로 바꾸고 회로를 완전히 닫으세요.'
      };
    }
    default:
      return {
        ok: false,
        evidenceKo: `알 수 없는 목표: ${target}`,
        hintKo: mission.hintKo
      };
  }
}
