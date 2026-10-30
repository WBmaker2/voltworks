import { BULB_RATING } from './constants';
import { distanceAlongWire, getAllTerminals, wireContainsPoint, wireLength } from './geometry';
import type {
  Circuit,
  CircuitSummary,
  ComponentState,
  Netlist,
  SolveResult,
  Terminal,
  Wire,
  WireFlow
} from './types';

export function bulbBrightness(power: number, ratedPower: number): number {
  if (!Number.isFinite(power) || ratedPower <= 0) return 0;
  return Math.max(0, Math.min(1.5, power / ratedPower));
}

export function computeComponentStates(
  circuit: Circuit,
  netlist: Netlist,
  result: Pick<SolveResult, 'nodeVoltages' | 'sourceCurrents'>
): Map<string, ComponentState> {
  const states = new Map<string, ComponentState>();
  const voltageAt = (node: number): number => result.nodeVoltages[node] ?? 0;

  for (const component of circuit.components) {
    const nodes = netlist.componentNodes[component.id];
    if (!nodes) continue;
    const va = voltageAt(nodes.a);
    const vb = voltageAt(nodes.b);
    const voltage = va - vb;

    if (component.kind === 'battery') {
      const sourceCurrent = result.sourceCurrents.get(component.id) ?? 0;
      const externalCurrent = -sourceCurrent;
      const value = component.value ?? 3;
      states.set(component.id, {
        voltage: value,
        current: externalCurrent,
        power: value * externalCurrent
      });
    } else if (component.kind === 'bulb') {
      const rating = component.rating ?? BULB_RATING;
      const resistance = rating.voltage ** 2 / rating.power;
      const current = resistance > 0 ? voltage / resistance : 0;
      const power = current * current * resistance;
      states.set(component.id, {
        voltage,
        current,
        power,
        resistance,
        brightness: bulbBrightness(power, rating.power)
      });
    } else if (component.kind === 'resistor') {
      const resistance = component.value ?? 100;
      const current = resistance > 0 ? voltage / resistance : 0;
      states.set(component.id, {
        voltage,
        current,
        power: current * current * resistance,
        resistance
      });
    } else if (component.kind === 'switch') {
      const closed = component.closed ?? false;
      const resistance = closed ? 1e-3 : 0;
      const current = closed ? voltage / resistance : 0;
      states.set(component.id, {
        voltage,
        current,
        power: closed ? current * current * resistance : 0,
        resistance
      });
    } else if (component.kind === 'ammeter') {
      const current = result.sourceCurrents.get(component.id) ?? 0;
      states.set(component.id, {
        voltage,
        current,
        power: 0
      });
    } else if (component.kind === 'voltmeter') {
      const resistance =
        netlist.voltmeters.find((meter) => meter.id === component.id)?.resistance ?? 1e9;
      const current = resistance > 0 ? voltage / resistance : 0;
      states.set(component.id, {
        voltage,
        current,
        power: voltage * current,
        resistance
      });
    }
  }

  return states;
}

export function summarizeCircuit(
  circuit: Circuit,
  _netlist: Netlist,
  result: SolveResult
): CircuitSummary {
  const battery = circuit.components.find((component) => component.kind === 'battery');
  if (!battery) {
    return {
      batteryId: null,
      sourceVoltage: 0,
      sourceCurrent: 0,
      totalPower: 0,
      equivalentResistance: null
    };
  }
  const state = result.componentStates.get(battery.id);
  const sourceVoltage = battery.value ?? 3;
  const sourceCurrent = state?.current ?? 0;
  let totalPower = 0;
  for (const [id, componentState] of result.componentStates) {
    const component = circuit.components.find((item) => item.id === id);
    if (!component || component.kind === 'battery') continue;
    if (componentState.power > 0) totalPower += componentState.power;
  }
  const equivalentResistance =
    sourceCurrent > 1e-9 ? Math.abs(sourceVoltage / sourceCurrent) : null;
  return {
    batteryId: battery.id,
    sourceVoltage,
    sourceCurrent,
    totalPower,
    equivalentResistance
  };
}

function terminalInjection(
  terminal: Terminal,
  circuit: Circuit,
  states: Map<string, ComponentState>
): number {
  const component = circuit.components.find((item) => item.id === terminal.componentId);
  const state = states.get(terminal.componentId);
  if (!component || !state) return 0;

  if (component.kind === 'battery') {
    return terminal.role === 'positive' ? state.current : -state.current;
  }
  if (component.kind === 'ammeter') {
    return terminal.role === 'a' ? -state.current : state.current;
  }
  return terminal.role === 'a' ? -state.current : state.current;
}

export function computeWireFlows(circuit: Circuit, result: SolveResult): WireFlow[] {
  const terminals = getAllTerminals(circuit.components);
  const flows: WireFlow[] = [];

  for (const wire of circuit.wires) {
    if (wire.points.length < 2) continue;
    const attached: Array<{ terminal: Terminal; injection: number }> = [];
    for (const terminal of terminals) {
      if (!wireContainsPoint(wire, terminal)) continue;
      const injection = terminalInjection(terminal, circuit, result.componentStates);
      if (Number.isFinite(injection) && Math.abs(injection) > 1e-9) {
        attached.push({ terminal, injection });
      }
    }
    if (attached.length === 0) continue;
    attached.sort((a, b) => Math.abs(b.injection) - Math.abs(a.injection));
    const chosen = attached[0];
    const length = wireLength(wire);
    if (length === 0) continue;
    const distance = distanceAlongWire(wire, chosen.terminal);
    const nearStart = distance <= length / 2;
    const awayFromTerminal = chosen.injection > 0;
    const direction: 1 | -1 = nearStart === awayFromTerminal ? 1 : -1;
    flows.push({
      wireId: wire.id,
      current: chosen.injection,
      direction,
      speed: Math.log1p(Math.abs(chosen.injection))
    });
  }

  return flows;
}

export function totalDissipatedPower(result: SolveResult): number {
  let total = 0;
  for (const state of result.componentStates.values()) {
    if (state.power > 0) total += state.power;
  }
  return total;
}

export function wireFlowFor(flows: WireFlow[], wire: Wire): WireFlow | null {
  return flows.find((flow) => flow.wireId === wire.id) ?? null;
}
