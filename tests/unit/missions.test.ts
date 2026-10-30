import { describe, expect, it } from 'vitest';
import { solveCircuit } from '../../src/circuit/solve';
import type { Circuit } from '../../src/circuit/types';
import { createPreset } from '../../src/data/presets';
import { missionById } from '../../src/data/missions';
import { evaluateTarget } from '../../src/features/missions/checks';

function withWire(circuit: Circuit, points: Array<[number, number]>, id = 'test-wire'): Circuit {
  return {
    ...circuit,
    wires: [...circuit.wires, { id, points: points.map(([x, y]) => ({ x, y })) }]
  };
}

function closeSwitches(circuit: Circuit): Circuit {
  return {
    ...circuit,
    components: circuit.components.map((component) =>
      component.kind === 'switch' ? { ...component, closed: true } : component
    )
  };
}

function evaluate(missionId: string, circuit: Circuit) {
  const mission = missionById(missionId);
  if (!mission) throw new Error(`Missing mission ${missionId}`);
  const result = solveCircuit(circuit);
  const target = mission.stages?.[0]?.target ?? mission.setup.target ?? '';
  return {
    result,
    check: evaluateTarget(target, circuit, result, mission)
  };
}

describe('mission presets and targets', () => {
  it('completes the one-bulb mission after connecting the missing wire', () => {
    const circuit = closeSwitches(
      withWire(createPreset('one-bulb-gap'), [
        [15, 10],
        [19, 10]
      ])
    );
    const { result, check } = evaluate('one-bulb', circuit);
    expect(result.warnings.some((warning) => warning.code === 'short')).toBe(false);
    expect(check.ok).toBe(true);
  });

  it('completes stage 1 of the series/parallel mission with equal bulb power', () => {
    const { result, check } = evaluate('series-parallel', closeSwitches(createPreset('series')));
    expect(result.componentStates.get('l1')?.power).toBeCloseTo(0.15, 3);
    expect(result.componentStates.get('l2')?.power).toBeCloseTo(0.15, 3);
    expect(check.ok).toBe(true);
  });

  it('completes stage 2 of the series/parallel mission with brighter parallel bulbs', () => {
    const circuit = closeSwitches(
      withWire(createPreset('parallel-gap'), [
        [21, 10],
        [24, 10]
      ])
    );
    const result = solveCircuit(circuit);
    const mission = missionById('series-parallel');
    if (!mission) throw new Error('Missing mission');
    const belowTarget = evaluateTarget(mission.stages?.[1]?.target ?? '', circuit, result, mission);
    expect(result.componentStates.get('l1')?.power).toBeCloseTo(0.6, 3);
    expect(result.componentStates.get('l2')?.power).toBeCloseTo(0.6, 3);
    expect(belowTarget.ok).toBe(true);
  });

  it('passes the current-not-used mission with equal ammeter readings', () => {
    const { result, check } = evaluate(
      'current-not-used',
      closeSwitches(createPreset('current-not-used'))
    );
    expect(result.componentStates.get('a1')?.current).toBeCloseTo(0.1, 3);
    expect(result.componentStates.get('a2')?.current).toBeCloseTo(0.1, 3);
    expect(check.ok).toBe(true);
  });

  it('passes the meter-placement mission when both meters are in the right place', () => {
    const base = closeSwitches(createPreset('meter-placement'));
    const withMeters: Circuit = {
      ...base,
      components: [
        ...base.components,
        { id: 'a1', kind: 'ammeter', x: 21, y: 10, rotation: 0 },
        { id: 'v1', kind: 'voltmeter', x: 28, y: 14, rotation: 0 }
      ]
    };
    const { result, check } = evaluate('meter-placement', withMeters);
    expect(Math.abs(result.componentStates.get('a1')?.current ?? 0)).toBeCloseTo(0.2, 3);
    expect(Math.abs(result.componentStates.get('v1')?.voltage ?? 0)).toBeCloseTo(3, 3);
    expect(check.ok).toBe(true);
  });

  it('fails the short-circuit mission before the bypass wire is removed', () => {
    const { result, check } = evaluate('short-circuit', createPreset('short-circuit'));
    expect(result.warnings.some((warning) => warning.code === 'short')).toBe(true);
    expect(check.ok).toBe(false);
  });

  it('passes the short-circuit mission after the bypass wire is removed', () => {
    const preset = createPreset('short-circuit');
    const fixed: Circuit = {
      ...preset,
      wires: preset.wires.filter((wire) => wire.id !== 'w4')
    };
    const { result, check } = evaluate('short-circuit', fixed);
    expect(result.warnings.some((warning) => warning.code === 'short')).toBe(false);
    expect(result.componentStates.get('l1')?.power).toBeCloseTo(0.6, 3);
    expect(check.ok).toBe(true);
  });

  it('passes the divider mission with a 100Ω / 220Ω divider', () => {
    const preset = createPreset('divider');
    const circuit: Circuit = closeSwitches({
      ...withWire(preset, [
        [31, 10],
        [31, 16]
      ]),
      components: preset.components.map((component) =>
        component.id === 'r2' ? { ...component, value: 220 } : component
      )
    });
    const { result, check } = evaluate('divider', circuit);
    expect(Math.abs(result.componentStates.get('v1')?.voltage ?? 0)).toBeCloseTo(2.8125, 4);
    expect(check.ok).toBe(true);
  });
});
