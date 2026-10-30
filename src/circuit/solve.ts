import { MAX_COMPONENTS, MAX_NODES } from './constants';
import { SingularMatrixError, solveMna } from './mna';
import { buildNetlist } from './netlist';
import { computeComponentStates } from './power';
import type { Circuit, CircuitWarning, Netlist, SolveResult } from './types';
import { groundedNodes, hasDeadShort, postValidate, preValidate } from './validate';

function remap(value: number, map: number[]): number {
  return map[value] ?? -1;
}

function buildActiveNetlist(
  netlist: Netlist,
  grounded: boolean[]
): {
  active: Netlist;
  nodeMap: number[];
  groundedCount: number;
} {
  const nodeMap = new Array<number>(netlist.nodes).fill(-1);
  let next = 0;
  if (netlist.nodes > 0 && grounded[netlist.ground]) {
    nodeMap[netlist.ground] = next;
    next += 1;
  }
  for (let node = 0; node < netlist.nodes; node += 1) {
    if (node === netlist.ground) continue;
    if (grounded[node]) {
      nodeMap[node] = next;
      next += 1;
    }
  }

  const terminalNodes: Record<string, number> = {};
  for (const [id, node] of Object.entries(netlist.terminalNodes)) {
    terminalNodes[id] = remap(node, nodeMap);
  }
  const componentNodes: Record<string, { a: number; b: number }> = {};
  for (const [id, nodes] of Object.entries(netlist.componentNodes)) {
    componentNodes[id] = { a: remap(nodes.a, nodeMap), b: remap(nodes.b, nodeMap) };
  }

  const active: Netlist = {
    nodes: next,
    ground: netlist.ground >= 0 ? nodeMap[netlist.ground] : 0,
    groundComponentId: netlist.groundComponentId,
    resistors: netlist.resistors
      .filter((element) => nodeMap[element.a] >= 0 && nodeMap[element.b] >= 0)
      .map((element) => ({ ...element, a: nodeMap[element.a], b: nodeMap[element.b] })),
    voltageSources: netlist.voltageSources
      .filter((element) => nodeMap[element.a] >= 0 && nodeMap[element.b] >= 0)
      .map((element) => ({ ...element, a: nodeMap[element.a], b: nodeMap[element.b] })),
    switches: netlist.switches
      .filter((element) => nodeMap[element.a] >= 0 && nodeMap[element.b] >= 0)
      .map((element) => ({ ...element, a: nodeMap[element.a], b: nodeMap[element.b] })),
    ammeters: netlist.ammeters
      .filter((element) => nodeMap[element.a] >= 0 && nodeMap[element.b] >= 0)
      .map((element) => ({ ...element, a: nodeMap[element.a], b: nodeMap[element.b] })),
    voltmeters: netlist.voltmeters
      .filter((element) => nodeMap[element.a] >= 0 && nodeMap[element.b] >= 0)
      .map((element) => ({ ...element, a: nodeMap[element.a], b: nodeMap[element.b] })),
    terminalNodes,
    componentNodes
  };

  return { active, nodeMap, groundedCount: next };
}

function zeroResult(circuit: Circuit, netlist: Netlist, warnings: CircuitWarning[]): SolveResult {
  const nodeVoltages = new Array<number>(netlist.nodes).fill(0);
  const sourceCurrents = new Map<string, number>();
  const result: SolveResult = {
    nodeVoltages,
    ground: netlist.ground,
    sourceCurrents,
    componentStates: new Map(),
    warnings,
    solved: false
  };
  result.componentStates = computeComponentStates(circuit, netlist, result);
  return result;
}

function dedupeWarnings(warnings: CircuitWarning[]): CircuitWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.messageKo}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function solveCircuit(circuit: Circuit): SolveResult {
  const netlist = buildNetlist(circuit);
  const warnings = preValidate(circuit, netlist);
  const noBattery = warnings.some((warning) => warning.code === 'no-battery');
  const deadShort = hasDeadShort(netlist);
  const tooLarge = circuit.components.length > MAX_COMPONENTS || netlist.nodes > MAX_NODES;

  if (noBattery || deadShort.short || tooLarge) {
    return zeroResult(circuit, netlist, dedupeWarnings(warnings));
  }

  const grounded = groundedNodes(netlist);
  const { active, nodeMap } = buildActiveNetlist(netlist, grounded);

  try {
    const solution = solveMna(active);
    const nodeVoltages = new Array<number>(netlist.nodes).fill(0);
    for (let node = 0; node < netlist.nodes; node += 1) {
      const mapped = nodeMap[node];
      if (mapped >= 0) nodeVoltages[node] = solution.nodeVoltages[mapped] ?? 0;
    }

    const result: SolveResult = {
      nodeVoltages,
      ground: netlist.ground,
      sourceCurrents: solution.sourceCurrents,
      componentStates: new Map(),
      warnings: [],
      solved: true
    };
    result.componentStates = computeComponentStates(circuit, netlist, result);
    result.warnings = dedupeWarnings([...warnings, ...postValidate(circuit, netlist, result)]);
    return result;
  } catch (error) {
    const message =
      error instanceof SingularMatrixError
        ? '회로를 계산할 수 없습니다. 전원이나 전선 연결을 다시 확인하세요.'
        : '회로를 계산하는 중 문제가 생겼습니다. 부품 연결을 확인하세요.';
    return zeroResult(
      circuit,
      netlist,
      dedupeWarnings([
        ...warnings,
        {
          code: 'solver',
          messageKo: message,
          componentIds: []
        }
      ])
    );
  }
}
