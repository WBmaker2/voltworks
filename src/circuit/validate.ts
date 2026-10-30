import {
  BULB_RATING,
  MAX_COMPONENTS,
  MAX_NODES,
  OPEN_CIRCUIT_CURRENT,
  SHORT_CURRENT,
  SHORT_RESISTANCE
} from './constants';
import { getAllTerminals, wireContainsPoint } from './geometry';
import type { Circuit, CircuitWarning, Netlist, SolveResult, Terminal } from './types';

class NodeSet {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(value: number): number {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    let current = value;
    while (this.parent[current] !== current) {
      const next = this.parent[current];
      this.parent[current] = root;
      current = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootB] = rootA;
  }
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function terminalsOnWire(
  circuit: Circuit,
  wire: Circuit['wires'][number]
): Array<{ terminal: Terminal; componentId: string }> {
  return getAllTerminals(circuit.components)
    .filter((terminal) => wireContainsPoint(wire, terminal))
    .map((terminal) => ({ terminal, componentId: terminal.componentId }));
}

export function findShortingWireIds(circuit: Circuit): string[] {
  const ids: string[] = [];
  for (const wire of circuit.wires) {
    const terminals = terminalsOnWire(circuit, wire);
    const byComponent = new Map<string, Terminal[]>();
    for (const entry of terminals) {
      const list = byComponent.get(entry.componentId) ?? [];
      list.push(entry.terminal);
      byComponent.set(entry.componentId, list);
    }
    for (const list of byComponent.values()) {
      if (list.length >= 2) {
        ids.push(wire.id);
        break;
      }
    }
  }
  return ids;
}

function buildNodeSet(
  netlist: Netlist,
  options: { excludeVoltmeters?: boolean; passiveOnly?: boolean } = {}
): NodeSet {
  const set = new NodeSet(netlist.nodes);
  const add = (a: number, b: number): void => {
    if (a >= 0 && b >= 0 && a !== b) set.union(a, b);
  };
  for (const element of netlist.resistors) add(element.a, element.b);
  if (!options.passiveOnly) {
    for (const element of netlist.voltageSources) add(element.a, element.b);
  }
  for (const element of netlist.ammeters) add(element.a, element.b);
  for (const element of netlist.switches) {
    if (element.closed) add(element.a, element.b);
  }
  if (!options.excludeVoltmeters) {
    for (const element of netlist.voltmeters) add(element.a, element.b);
  }
  return set;
}

function sameNodePair(a: { a: number; b: number }, b: { a: number; b: number }): boolean {
  return (a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a);
}

export function groundedNodes(netlist: Netlist): boolean[] {
  if (netlist.nodes === 0) return [];
  const set = buildNodeSet(netlist);
  const groundRoot = set.find(netlist.ground);
  return Array.from({ length: netlist.nodes }, (_, node) => set.find(node) === groundRoot);
}

export function floatingComponentIds(
  circuit: Circuit,
  netlist: Netlist,
  grounded: boolean[]
): string[] {
  const ids: string[] = [];
  for (const component of circuit.components) {
    const nodes = netlist.componentNodes[component.id];
    if (!nodes) continue;
    if (!grounded[nodes.a] || !grounded[nodes.b]) ids.push(component.id);
  }
  return ids;
}

export function hasDeadShort(netlist: Netlist): { short: boolean; ids: string[] } {
  const ids = new Set<string>();
  const sourcePairs = new Map<string, string>();

  for (const source of netlist.voltageSources) {
    if (source.a === source.b) {
      ids.add(source.id);
      continue;
    }
    const key = pairKey(source.a, source.b);
    const other = sourcePairs.get(key);
    if (other) {
      ids.add(other);
      ids.add(source.id);
    } else {
      sourcePairs.set(key, source.id);
    }
  }
  for (const meter of netlist.ammeters) {
    if (meter.a === meter.b) continue;
    const key = pairKey(meter.a, meter.b);
    const other = sourcePairs.get(key);
    if (other) {
      ids.add(other);
      ids.add(meter.id);
    } else {
      sourcePairs.set(key, meter.id);
    }
  }

  return { short: ids.size > 0, ids: [...ids] };
}

export function preValidate(circuit: Circuit, netlist: Netlist): CircuitWarning[] {
  const warnings: CircuitWarning[] = [];
  const battery = circuit.components.find((component) => component.kind === 'battery');

  if (!battery) {
    warnings.push({
      code: 'no-battery',
      messageKo: '전원을 먼저 연결하세요. 전지가 없으면 회로를 풀 수 없습니다.',
      componentIds: []
    });
    return warnings;
  }

  if (circuit.components.length > MAX_COMPONENTS) {
    warnings.push({
      code: 'solver',
      messageKo: `부품은 최대 ${MAX_COMPONENTS}개까지 놓을 수 있습니다.`,
      componentIds: []
    });
  }
  if (netlist.nodes > MAX_NODES) {
    warnings.push({
      code: 'solver',
      messageKo: `전기 접점은 최대 ${MAX_NODES}개까지 지원합니다. 전선을 줄여 보세요.`,
      componentIds: []
    });
  }

  const deadShort = hasDeadShort(netlist);
  if (deadShort.short) {
    warnings.push({
      code: 'short',
      messageKo: '단락 회로입니다. 전지의 +극과 −극이 전선으로 바로 이어져 있습니다.',
      componentIds: deadShort.ids,
      wireIds: findShortingWireIds(circuit)
    });
  }

  const sourcePairs = new Map<string, string[]>();
  for (const component of circuit.components) {
    if (
      component.kind === 'battery' ||
      component.kind === 'bulb' ||
      component.kind === 'resistor'
    ) {
      const nodes = netlist.componentNodes[component.id];
      if (!nodes) continue;
      const key = pairKey(nodes.a, nodes.b);
      const list = sourcePairs.get(key) ?? [];
      list.push(component.id);
      sourcePairs.set(key, list);
    } else if (component.kind === 'switch' && component.closed) {
      const nodes = netlist.componentNodes[component.id];
      if (!nodes) continue;
      const key = pairKey(nodes.a, nodes.b);
      const list = sourcePairs.get(key) ?? [];
      list.push(component.id);
      sourcePairs.set(key, list);
    } else if (component.kind === 'voltmeter') {
      const nodes = netlist.componentNodes[component.id];
      if (!nodes) continue;
      const key = pairKey(nodes.a, nodes.b);
      const list = sourcePairs.get(key) ?? [];
      list.push(component.id);
      sourcePairs.set(key, list);
    }
  }

  for (const meter of circuit.components) {
    if (meter.kind !== 'ammeter') continue;
    const nodes = netlist.componentNodes[meter.id];
    if (!nodes) continue;
    const key = pairKey(nodes.a, nodes.b);
    const parallel = (sourcePairs.get(key) ?? []).filter((id) => id !== meter.id);
    if (parallel.length > 0) {
      warnings.push({
        code: 'meter-parallel',
        messageKo:
          '전류계는 회로와 직렬로 연결해야 합니다. 지금은 부품과 나란히 연결되어 있습니다.',
        componentIds: [meter.id, ...parallel]
      });
    }
  }

  const withoutVoltmeters = buildNodeSet(netlist, { excludeVoltmeters: true, passiveOnly: true });
  for (const component of circuit.components) {
    if (component.kind !== 'voltmeter') continue;
    const nodes = netlist.componentNodes[component.id];
    if (!nodes || nodes.a === nodes.b) continue;
    const acrossSource = netlist.voltageSources.some((source) => sameNodePair(nodes, source));
    if (!acrossSource && withoutVoltmeters.find(nodes.a) !== withoutVoltmeters.find(nodes.b)) {
      warnings.push({
        code: 'meter-series',
        messageKo: '전압계는 측정할 부품과 나란히 연결해야 합니다. 지금은 회로가 끊어져 있습니다.',
        componentIds: [component.id]
      });
    }
  }

  const grounded = groundedNodes(netlist);
  const floating = floatingComponentIds(circuit, netlist, grounded);
  if (floating.length > 0) {
    warnings.push({
      code: 'floating',
      messageKo: '연결되지 않은 부품이 있습니다. 전선으로 회로를 닫아 보세요.',
      componentIds: floating
    });
  }

  return warnings;
}

export function postValidate(
  circuit: Circuit,
  _netlist: Netlist,
  result: SolveResult
): CircuitWarning[] {
  const warnings: CircuitWarning[] = [];
  const batteries = circuit.components.filter((component) => component.kind === 'battery');
  if (batteries.length === 0) return warnings;

  const activeVoltmeter = circuit.components.some((component) => {
    if (component.kind !== 'voltmeter') return false;
    const state = result.componentStates.get(component.id);
    return state ? Math.abs(state.current) > 1e-12 || Math.abs(state.voltage) > 0.01 : false;
  });

  let anyCurrent = false;
  for (const battery of batteries) {
    const state = result.componentStates.get(battery.id);
    const externalCurrent = Math.abs(state?.current ?? 0);
    if (externalCurrent > OPEN_CIRCUIT_CURRENT) anyCurrent = true;

    if (externalCurrent > SHORT_CURRENT) {
      warnings.push({
        code: 'short',
        messageKo: '단락 회로입니다. 전류가 너무 많이 흐릅니다. 전선을 확인하세요.',
        componentIds: [battery.id],
        wireIds: findShortingWireIds(circuit)
      });
      continue;
    }

    if (externalCurrent > 1e-9) {
      const voltage = Math.abs(battery.value ?? 3);
      const equivalent = voltage / externalCurrent;
      if (equivalent < SHORT_RESISTANCE) {
        const lowResistance = circuit.components
          .filter((component) => {
            if (component.kind === 'switch') return component.closed ?? false;
            if (component.kind === 'ammeter') return true;
            if (component.kind === 'resistor') return (component.value ?? 100) < SHORT_RESISTANCE;
            return false;
          })
          .map((component) => component.id);
        warnings.push({
          code: 'short',
          messageKo: '단락 회로입니다. 전지 양극 사이의 저항이 거의 0입니다.',
          componentIds: [battery.id, ...lowResistance],
          wireIds: findShortingWireIds(circuit)
        });
      }
    }
  }

  if (!anyCurrent && !activeVoltmeter) {
    const openSwitches = circuit.components
      .filter((component) => component.kind === 'switch' && !(component.closed ?? false))
      .map((component) => component.id);
    warnings.push({
      code: 'open',
      messageKo: '회로가 열려 있습니다. 스위치와 전선을 확인하세요.',
      componentIds: openSwitches.length > 0 ? openSwitches : batteries.map((battery) => battery.id)
    });
  }

  for (const component of circuit.components) {
    if (component.kind !== 'bulb') continue;
    const state = result.componentStates.get(component.id);
    if (!state) continue;
    const rating = component.rating ?? BULB_RATING;
    if (state.power > rating.power * 1.05) {
      warnings.push({
        code: 'overload',
        messageKo: '전구가 정격 전력을 넘었습니다. 더 낮은 전압을 사용해 보세요.',
        componentIds: [component.id]
      });
    }
  }

  return warnings;
}
