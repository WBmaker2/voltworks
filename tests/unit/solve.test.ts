import { describe, expect, it } from 'vitest';
import { BULB_RATING } from '../../src/circuit/constants';
import { buildNetlist } from '../../src/circuit/netlist';
import { solveCircuit } from '../../src/circuit/solve';
import type { Circuit, CircuitComponent, Netlist, Wire } from '../../src/circuit/types';

function component(
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
    ...(kind === 'battery' ? { value: 9 } : {}),
    ...(kind === 'resistor' ? { value: 100 } : {}),
    ...(kind === 'bulb' ? { rating: { ...BULB_RATING } } : {}),
    ...(kind === 'switch' ? { closed: false } : {}),
    ...extra
  };
}

function wire(id: string, points: Array<[number, number]>): Wire {
  return { id, points: points.map(([x, y]) => ({ x, y })) };
}

function circuit(components: CircuitComponent[], wires: Wire[]): Circuit {
  return { components, wires };
}

function near(actual: number, expected: number, tolerance = 1e-6): void {
  expect(Math.abs(actual - expected)).toBeLessThan(tolerance);
}

function netlistResult(netlist: Netlist) {
  return solveCircuitFromNetlist(netlist);
}

// Imported lazily to keep the public circuit API honest: tests may use the
// low-level solver directly, but the app always goes through solveCircuit.
import { solveMna } from '../../src/circuit/mna';

function solveCircuitFromNetlist(netlist: Netlist) {
  const solution = solveMna(netlist);
  const result = {
    nodeVoltages: solution.nodeVoltages,
    ground: netlist.ground,
    sourceCurrents: solution.sourceCurrents,
    componentStates: new Map(),
    warnings: [],
    solved: true
  };
  return { result, solution };
}

describe('MNA solver', () => {
  it('solves a single battery and resistor with the documented sign convention', () => {
    const netlist: Netlist = {
      nodes: 2,
      ground: 0,
      groundComponentId: 'battery',
      resistors: [{ id: 'r1', a: 1, b: 0, resistance: 100 }],
      voltageSources: [{ id: 'battery', a: 1, b: 0, voltage: 10 }],
      switches: [],
      ammeters: [],
      voltmeters: [],
      terminalNodes: {},
      componentNodes: {}
    };
    const { result, solution } = netlistResult(netlist);
    near(result.nodeVoltages[1], 10);
    near(solution.sourceCurrents.get('battery') ?? 0, -0.1);
  });

  it('solves two resistors in series with voltage division', () => {
    const netlist: Netlist = {
      nodes: 3,
      ground: 0,
      groundComponentId: 'battery',
      resistors: [
        { id: 'r1', a: 1, b: 2, resistance: 100 },
        { id: 'r2', a: 2, b: 0, resistance: 200 }
      ],
      voltageSources: [{ id: 'battery', a: 1, b: 0, voltage: 10 }],
      switches: [],
      ammeters: [],
      voltmeters: [],
      terminalNodes: {},
      componentNodes: {}
    };
    const { result, solution } = netlistResult(netlist);
    near(result.nodeVoltages[1], 10);
    near(result.nodeVoltages[2], 10 * (200 / 300));
    near(Math.abs(solution.sourceCurrents.get('battery') ?? 0), 1 / 30);
  });

  it('solves two resistors in parallel with a current split', () => {
    const netlist: Netlist = {
      nodes: 2,
      ground: 0,
      groundComponentId: 'battery',
      resistors: [
        { id: 'r1', a: 1, b: 0, resistance: 100 },
        { id: 'r2', a: 1, b: 0, resistance: 200 }
      ],
      voltageSources: [{ id: 'battery', a: 1, b: 0, voltage: 10 }],
      switches: [],
      ammeters: [],
      voltmeters: [],
      terminalNodes: {},
      componentNodes: {}
    };
    const { result, solution } = netlistResult(netlist);
    near(result.nodeVoltages[1], 10);
    near(Math.abs(solution.sourceCurrents.get('battery') ?? 0), 0.15);
    near(10 / 100 + 10 / 200, 0.15);
  });

  it('throws a named error for a singular matrix', () => {
    const netlist: Netlist = {
      nodes: 2,
      ground: 0,
      groundComponentId: 'battery',
      resistors: [],
      voltageSources: [{ id: 'battery', a: 1, b: 1, voltage: 10 }],
      switches: [],
      ammeters: [],
      voltmeters: [],
      terminalNodes: {},
      componentNodes: {}
    };
    expect(() => solveMna(netlist)).toThrowError(/singular/i);
  });
});

describe('circuit solving', () => {
  it('solves a battery and resistor wired into a loop', () => {
    const loop = circuit(
      [component('b1', 'battery', 4, 4, { value: 9 }), component('r1', 'resistor', 8, 4)],
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
        ])
      ]
    );
    const result = solveCircuit(loop);
    expect(result.solved).toBe(true);
    near(result.componentStates.get('r1')?.current ?? 0, 0.09);
    near(result.componentStates.get('r1')?.power ?? 0, 0.81);
    near(result.componentStates.get('b1')?.current ?? 0, 0.09);
    expect(result.warnings.some((warning) => warning.code === 'open')).toBe(false);
  });

  it('solves a series circuit with hand-calculated values', () => {
    const series = circuit(
      [
        component('b1', 'battery', 4, 4, { value: 10 }),
        component('r1', 'resistor', 8, 4, { value: 100 }),
        component('r2', 'resistor', 12, 4, { value: 200 })
      ],
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
    const result = solveCircuit(series);
    near(result.componentStates.get('r1')?.voltage ?? 0, 10 / 3);
    near(result.componentStates.get('r2')?.voltage ?? 0, 20 / 3);
    near(result.componentStates.get('r1')?.current ?? 0, 1 / 30);
    near(result.componentStates.get('r2')?.current ?? 0, 1 / 30);
  });

  it('solves a parallel circuit and keeps the same voltage across both branches', () => {
    const parallel = circuit(
      [
        component('b1', 'battery', 4, 4, { value: 10 }),
        component('r1', 'resistor', 8, 4, { value: 100 }),
        component('r2', 'resistor', 8, 8, { value: 200 })
      ],
      [
        wire('w1', [
          [5, 4],
          [5, 8],
          [7, 8],
          [7, 4]
        ]),
        wire('w2', [
          [9, 4],
          [9, 8]
        ]),
        wire('w3', [
          [9, 8],
          [9, 10],
          [3, 10],
          [3, 4]
        ])
      ]
    );
    const result = solveCircuit(parallel);
    near(result.componentStates.get('r1')?.voltage ?? 0, 10);
    near(result.componentStates.get('r2')?.voltage ?? 0, 10);
    near(result.componentStates.get('r1')?.current ?? 0, 0.1);
    near(result.componentStates.get('r2')?.current ?? 0, 0.05);
  });

  it('computes bulb power and brightness at the rated voltage', () => {
    const bulbCircuit = circuit(
      [component('b1', 'battery', 4, 4, { value: 3 }), component('l1', 'bulb', 8, 4)],
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
        ])
      ]
    );
    const result = solveCircuit(bulbCircuit);
    near(result.componentStates.get('l1')?.power ?? 0, 0.6);
    near(result.componentStates.get('l1')?.brightness ?? 0, 1);
  });

  it('reads current through an ammeter in a series loop', () => {
    const meterCircuit = circuit(
      [
        component('b1', 'battery', 4, 4, { value: 3 }),
        component('a1', 'ammeter', 8, 4),
        component('l1', 'bulb', 12, 4)
      ],
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
    const result = solveCircuit(meterCircuit);
    near(result.componentStates.get('a1')?.current ?? 0, 0.2);
    expect(result.warnings.some((warning) => warning.code === 'meter-parallel')).toBe(false);
  });

  it('reads voltage across a bulb with a voltmeter in parallel', () => {
    const meterCircuit = circuit(
      [
        component('b1', 'battery', 4, 4, { value: 3 }),
        component('l1', 'bulb', 8, 4),
        component('v1', 'voltmeter', 8, 10)
      ],
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
    const result = solveCircuit(meterCircuit);
    near(result.componentStates.get('v1')?.voltage ?? 0, 3, 1e-5);
    expect(result.warnings.some((warning) => warning.code === 'meter-series')).toBe(false);
  });

  it('detects an open switch without a false short warning', () => {
    const openCircuit = circuit(
      [
        component('b1', 'battery', 4, 4, { value: 3 }),
        component('s1', 'switch', 8, 4, { closed: false }),
        component('l1', 'bulb', 12, 4)
      ],
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
    const result = solveCircuit(openCircuit);
    expect(result.warnings.some((warning) => warning.code === 'open')).toBe(true);
    expect(result.warnings.some((warning) => warning.code === 'short')).toBe(false);
  });

  it('detects a direct wire short without producing NaN values', () => {
    const shortCircuit = circuit(
      [component('b1', 'battery', 4, 4, { value: 9 })],
      [
        wire('w1', [
          [5, 4],
          [5, 6],
          [3, 6],
          [3, 4]
        ])
      ]
    );
    const result = solveCircuit(shortCircuit);
    expect(result.warnings.some((warning) => warning.code === 'short')).toBe(true);
    for (const state of result.componentStates.values()) {
      expect(Number.isFinite(state.voltage)).toBe(true);
      expect(Number.isFinite(state.current)).toBe(true);
      expect(Number.isFinite(state.power)).toBe(true);
    }
  });

  it('warns instead of crashing for a floating component', () => {
    const floating = circuit(
      [component('b1', 'battery', 4, 4, { value: 3 }), component('l1', 'bulb', 10, 10)],
      []
    );
    const result = solveCircuit(floating);
    expect(result.warnings.some((warning) => warning.code === 'floating')).toBe(true);
    expect(result.solved).toBe(true);
  });

  it('returns deterministic results for the same circuit', () => {
    const series = circuit(
      [
        component('b1', 'battery', 4, 4, { value: 10 }),
        component('r1', 'resistor', 8, 4, { value: 100 }),
        component('r2', 'resistor', 12, 4, { value: 200 })
      ],
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
    const first = solveCircuit(series);
    const second = solveCircuit(series);
    first.nodeVoltages.forEach((voltage, index) => {
      near(voltage, second.nodeVoltages[index], 1e-9);
    });
  });
});

describe('netlist extraction', () => {
  it('does not connect crossing wires without a junction', () => {
    const crossing = circuit(
      [
        component('b1', 'battery', 0, 0, { value: 3 }),
        component('l1', 'bulb', 4, 0),
        component('b2', 'battery', 2, -4, { value: 3, rotation: 90 }),
        component('l2', 'bulb', 2, 4, { rotation: 90 })
      ],
      [
        wire('w1', [
          [1, 0],
          [3, 0]
        ]),
        wire('w2', [
          [2, -3],
          [2, 3]
        ])
      ]
    );
    const netlist = buildNetlist(crossing);
    expect(netlist.terminalNodes['b1:positive']).toBe(netlist.terminalNodes['l1:a']);
    expect(netlist.terminalNodes['b2:positive']).toBe(netlist.terminalNodes['l2:a']);
    expect(netlist.terminalNodes['b1:positive']).not.toBe(netlist.terminalNodes['b2:positive']);
  });

  it('connects a wire endpoint that lands on another wire (T junction)', () => {
    const tJunction = circuit(
      [
        component('b1', 'battery', 0, 0, { value: 3 }),
        component('l1', 'bulb', 4, 0),
        component('r1', 'resistor', 2, 5, { value: 100, rotation: 90 })
      ],
      [
        wire('w1', [
          [1, 0],
          [3, 0]
        ]),
        wire('w2', [
          [2, 0],
          [2, 4]
        ])
      ]
    );
    const netlist = buildNetlist(tJunction);
    expect(netlist.terminalNodes['r1:a']).toBe(netlist.terminalNodes['b1:positive']);
    expect(netlist.terminalNodes['r1:b']).not.toBe(netlist.terminalNodes['b1:positive']);
  });
});
