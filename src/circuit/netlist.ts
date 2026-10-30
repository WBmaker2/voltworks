import { BULB_RATING, CLOSED_SWITCH_RESISTANCE, VOLTMETER_RESISTANCE } from './constants';
import { getAllTerminals, getTerminal, pointKey, pointsEqual, wireContainsPoint } from './geometry';
import type { Circuit, CircuitComponent, Netlist, Point, Terminal } from './types';

class UnionFind {
  private parent: number[] = [];
  private rank: number[] = [];

  add(): number {
    const id = this.parent.length;
    this.parent.push(id);
    this.rank.push(0);
    return id;
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
    if (rootA === rootB) return;
    if (this.rank[rootA] < this.rank[rootB]) {
      this.parent[rootA] = rootB;
    } else if (this.rank[rootA] > this.rank[rootB]) {
      this.parent[rootB] = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA] += 1;
    }
  }
}

function bulbResistance(component: CircuitComponent): number {
  const rating = component.rating ?? BULB_RATING;
  if (rating.power <= 0 || rating.voltage <= 0) return BULB_RATING.voltage ** 2 / BULB_RATING.power;
  return rating.voltage ** 2 / rating.power;
}

export function buildNetlist(circuit: Circuit): Netlist {
  const terminals = getAllTerminals(circuit.components);
  const pointIds = new Map<string, number>();
  const unionFind = new UnionFind();

  const pointId = (point: Point): number => {
    const key = pointKey(point);
    const existing = pointIds.get(key);
    if (existing !== undefined) return existing;
    const id = unionFind.add();
    pointIds.set(key, id);
    return id;
  };

  for (const terminal of terminals) pointId(terminal);

  for (const wire of circuit.wires) {
    if (wire.points.length === 0) continue;
    const first = pointId(wire.points[0]);
    for (const point of wire.points) unionFind.union(first, pointId(point));
  }

  const unionPointWithWire = (point: Point, wireFirst: Point): void => {
    unionFind.union(pointId(point), pointId(wireFirst));
  };

  for (const wire of circuit.wires) {
    if (wire.points.length === 0) continue;
    const firstPoint = wire.points[0];
    const firstId = pointId(firstPoint);

    for (const terminal of terminals) {
      if (wireContainsPoint(wire, terminal)) {
        unionFind.union(firstId, pointId(terminal));
      }
    }

    for (const other of circuit.wires) {
      if (other.id === wire.id || other.points.length === 0) continue;
      for (const endpoint of [wire.points[0], wire.points[wire.points.length - 1]]) {
        if (!endpoint) continue;
        if (wireContainsPoint(other, endpoint)) {
          unionPointWithWire(endpoint, other.points[0]);
        }
      }
    }
  }

  const nodeIndexByRoot = new Map<number, number>();
  const terminalNodes: Record<string, number> = {};
  const nodeForTerminal = (terminal: Terminal): number => {
    const root = unionFind.find(pointId(terminal));
    const existing = nodeIndexByRoot.get(root);
    if (existing !== undefined) return existing;
    const index = nodeIndexByRoot.size;
    nodeIndexByRoot.set(root, index);
    return index;
  };

  for (const terminal of terminals) {
    terminalNodes[terminal.id] = nodeForTerminal(terminal);
  }

  const componentNodes: Record<string, { a: number; b: number }> = {};
  for (const component of circuit.components) {
    if (component.kind === 'battery') {
      componentNodes[component.id] = {
        a: terminalNodes[`${component.id}:positive`],
        b: terminalNodes[`${component.id}:negative`]
      };
    } else {
      componentNodes[component.id] = {
        a: terminalNodes[`${component.id}:a`],
        b: terminalNodes[`${component.id}:b`]
      };
    }
  }

  const netlist: Netlist = {
    nodes: nodeIndexByRoot.size,
    ground: 0,
    groundComponentId: null,
    resistors: [],
    voltageSources: [],
    switches: [],
    ammeters: [],
    voltmeters: [],
    terminalNodes,
    componentNodes
  };

  for (const component of circuit.components) {
    const nodes = componentNodes[component.id];
    if (component.kind === 'battery') {
      netlist.voltageSources.push({
        id: component.id,
        a: nodes.a,
        b: nodes.b,
        voltage: component.value ?? 3
      });
    } else if (component.kind === 'bulb') {
      netlist.resistors.push({
        id: component.id,
        a: nodes.a,
        b: nodes.b,
        resistance: bulbResistance(component)
      });
    } else if (component.kind === 'resistor') {
      netlist.resistors.push({
        id: component.id,
        a: nodes.a,
        b: nodes.b,
        resistance: component.value ?? 100
      });
    } else if (component.kind === 'switch') {
      netlist.switches.push({
        id: component.id,
        a: nodes.a,
        b: nodes.b,
        closed: component.closed ?? false,
        resistance: CLOSED_SWITCH_RESISTANCE
      });
    } else if (component.kind === 'ammeter') {
      if (nodes.a !== nodes.b) {
        netlist.ammeters.push({ id: component.id, a: nodes.a, b: nodes.b });
      }
    } else if (component.kind === 'voltmeter') {
      netlist.voltmeters.push({
        id: component.id,
        a: nodes.a,
        b: nodes.b,
        resistance: VOLTMETER_RESISTANCE
      });
    }
  }

  const battery = circuit.components.find((component) => component.kind === 'battery');
  if (battery) {
    const negative = getTerminal(battery, 'negative');
    netlist.ground = terminalNodes[negative.id];
    netlist.groundComponentId = battery.id;
  } else if (netlist.nodes > 0) {
    netlist.ground = 0;
  }

  return netlist;
}

export function netlistNodeForPoint(netlist: Netlist, terminalId: string): number {
  const node = netlist.terminalNodes[terminalId];
  if (node === undefined) throw new Error(`Unknown terminal ${terminalId}`);
  return node;
}

export function terminalsAtGridPoint(circuit: Circuit, point: Point): Terminal[] {
  return getAllTerminals(circuit.components).filter((terminal) => pointsEqual(terminal, point));
}
