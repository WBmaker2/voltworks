import { GMIN } from './constants';
import type { Netlist } from './types';

/**
 * Modified nodal analysis.
 *
 * Unknowns are
 *   x = [v_1 ... v_(n-1), i_1 ... i_m]^T
 * where v are non-ground node voltages and i are voltage-source branch currents.
 *
 * Sign convention: a voltage source is declared with `a` as the positive
 * terminal and `b` as the negative terminal. Its unknown current `j` flows
 * from a to b *inside* the source. The current delivered to the external
 * circuit at the positive terminal is therefore `-j`.
 *
 * Resistor stamp (g = 1/R):
 *   G[a][a] += g, G[b][b] += g, G[a][b] -= g, G[b][a] -= g
 *
 * Voltage-source stamp:
 *   B[a][k] += 1, B[b][k] -= 1, e[k] = V
 *
 * A tiny shunt conductance (GMIN) to ground keeps a matrix that slipped past
 * floating-node filtering numerically well behaved. It is far below any
 * classroom measurement precision.
 */

export class SingularMatrixError extends Error {
  constructor(message = 'The circuit matrix is singular.') {
    super(message);
    this.name = 'SingularMatrixError';
  }
}

export interface MnaSolution {
  nodeVoltages: number[];
  sourceCurrents: Map<string, number>;
}

function solveLinearSystem(matrix: number[][], rhs: number[]): number[] {
  const size = matrix.length;
  if (size === 0) return [];
  const a = matrix.map((row) => row.slice());
  const b = rhs.slice();

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    let pivotValue = Math.abs(a[column][column]);
    for (let row = column + 1; row < size; row += 1) {
      const candidate = Math.abs(a[row][column]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }
    if (pivotValue < 1e-12) throw new SingularMatrixError();

    if (pivotRow !== column) {
      const row = a[column];
      a[column] = a[pivotRow];
      a[pivotRow] = row;
      const value = b[column];
      b[column] = b[pivotRow];
      b[pivotRow] = value;
    }

    const pivot = a[column][column];
    for (let row = column + 1; row < size; row += 1) {
      const factor = a[row][column] / pivot;
      if (factor === 0) continue;
      for (let col = column; col < size; col += 1) {
        a[row][col] -= factor * a[column][col];
      }
      b[row] -= factor * b[column];
    }
  }

  const solution = new Array<number>(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let col = row + 1; col < size; col += 1) {
      sum -= a[row][col] * solution[col];
    }
    const pivot = a[row][row];
    if (Math.abs(pivot) < 1e-12) throw new SingularMatrixError();
    solution[row] = sum / pivot;
  }

  return solution;
}

export function solveMna(netlist: Netlist): MnaSolution {
  const sourceElements = [
    ...netlist.voltageSources.map((source) => ({
      id: source.id,
      a: source.a,
      b: source.b,
      voltage: source.voltage
    })),
    ...netlist.ammeters.map((meter) => ({
      id: meter.id,
      a: meter.a,
      b: meter.b,
      voltage: 0
    }))
  ];

  const unknownIndex = new Array<number>(netlist.nodes).fill(-1);
  let nextUnknown = 0;
  for (let node = 0; node < netlist.nodes; node += 1) {
    if (node !== netlist.ground) {
      unknownIndex[node] = nextUnknown;
      nextUnknown += 1;
    }
  }

  const voltageUnknownStart = nextUnknown;
  const total = nextUnknown + sourceElements.length;
  const matrix: number[][] = Array.from({ length: total }, () => new Array<number>(total).fill(0));
  const rhs: number[] = new Array<number>(total).fill(0);

  const addConductance = (a: number, b: number, conductance: number): void => {
    if (a === b || conductance === 0) return;
    const ia = unknownIndex[a];
    const ib = unknownIndex[b];
    if (ia >= 0) matrix[ia][ia] += conductance;
    if (ib >= 0) matrix[ib][ib] += conductance;
    if (ia >= 0 && ib >= 0) {
      matrix[ia][ib] -= conductance;
      matrix[ib][ia] -= conductance;
    }
  };

  const resistorLike = [
    ...netlist.resistors.map((element) => ({
      a: element.a,
      b: element.b,
      resistance: element.resistance
    })),
    ...netlist.switches
      .filter((element) => element.closed)
      .map((element) => ({ a: element.a, b: element.b, resistance: element.resistance })),
    ...netlist.voltmeters.map((element) => ({
      a: element.a,
      b: element.b,
      resistance: element.resistance
    }))
  ];

  for (const element of resistorLike) {
    const resistance = Math.max(element.resistance, 1e-12);
    addConductance(element.a, element.b, 1 / resistance);
  }

  for (let node = 0; node < netlist.nodes; node += 1) {
    if (node !== netlist.ground) matrix[unknownIndex[node]][unknownIndex[node]] += GMIN;
  }

  sourceElements.forEach((source, index) => {
    const column = voltageUnknownStart + index;
    const ia = unknownIndex[source.a];
    const ib = unknownIndex[source.b];
    if (ia >= 0) {
      matrix[ia][column] += 1;
      matrix[column][ia] += 1;
    }
    if (ib >= 0) {
      matrix[ib][column] -= 1;
      matrix[column][ib] -= 1;
    }
    rhs[column] = source.voltage;
  });

  const solution = solveLinearSystem(matrix, rhs);
  const nodeVoltages = new Array<number>(netlist.nodes).fill(0);
  for (let node = 0; node < netlist.nodes; node += 1) {
    const index = unknownIndex[node];
    if (index >= 0) nodeVoltages[node] = solution[index];
  }

  const sourceCurrents = new Map<string, number>();
  sourceElements.forEach((source, index) => {
    sourceCurrents.set(source.id, solution[voltageUnknownStart + index] ?? 0);
  });

  return { nodeVoltages, sourceCurrents };
}
