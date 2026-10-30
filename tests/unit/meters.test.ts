import { describe, expect, it } from 'vitest';
import { BULB_RATING } from '../../src/circuit/constants';
import { solveCircuit } from '../../src/circuit/solve';
import type { Circuit, CircuitComponent, Wire } from '../../src/circuit/types';

function part(
  id: string,
  kind: CircuitComponent['kind'],
  x: number,
  y: number,
  extra: Partial<CircuitComponent> = {}
): CircuitComponent {
  return {
    id,
    kind,
    x,
    y,
    rotation: 0,
    ...(kind === 'battery' ? { value: 3 } : {}),
    ...(kind === 'bulb' ? { rating: { ...BULB_RATING } } : {}),
    ...extra
  };
}

function wire(id: string, points: Array<[number, number]>): Wire {
  return { id, points: points.map(([x, y]) => ({ x, y })) };
}

function circuit(components: CircuitComponent[], wires: Wire[]): Circuit {
  return { components, wires };
}

describe('meter validation', () => {
  it('warns when an ammeter is connected in parallel with a bulb', () => {
    const ammeterParallel = circuit(
      [part('b1', 'battery', 4, 4), part('l1', 'bulb', 8, 4), part('a1', 'ammeter', 8, 10)],
      [
        wire('w1', [
          [5, 4],
          [7, 4]
        ]),
        wire('w2', [
          [9, 4],
          [9, 8],
          [3, 8],
          [3, 4]
        ]),
        wire('w3', [
          [7, 10],
          [7, 4]
        ]),
        wire('w4', [
          [9, 10],
          [9, 4]
        ])
      ]
    );
    const result = solveCircuit(ammeterParallel);
    const warning = result.warnings.find((item) => item.code === 'meter-parallel');
    expect(warning).toBeDefined();
    expect(warning?.componentIds).toContain('a1');
    expect(warning?.componentIds).toContain('l1');
  });

  it('warns when a voltmeter is the only path in a branch', () => {
    const voltmeterSeries = circuit(
      [part('b1', 'battery', 4, 4), part('v1', 'voltmeter', 8, 4), part('l1', 'bulb', 12, 4)],
      [
        wire('w1', [
          [5, 4],
          [7, 4]
        ]),
        wire('w2', [
          [9, 4],
          [11, 4]
        ]),
        wire('w3', [
          [13, 4],
          [13, 8],
          [3, 8],
          [3, 4]
        ])
      ]
    );
    const result = solveCircuit(voltmeterSeries);
    expect(result.warnings.some((item) => item.code === 'meter-series')).toBe(true);
  });
});
