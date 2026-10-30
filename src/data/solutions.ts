import type { Circuit } from '../circuit/types';
import { createPreset } from './presets';

function withWire(
  circuit: Circuit,
  points: Array<[number, number]>,
  id = 'solution-wire'
): Circuit {
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

/**
 * Solved target circuits used by teacher mode and the printable worksheet.
 * These are presentation data only; the solver always runs on the student circuit.
 */
export function solutionCircuit(missionId: string): Circuit | null {
  switch (missionId) {
    case 'one-bulb':
      return closeSwitches(
        withWire(createPreset('one-bulb-gap'), [
          [15, 10],
          [19, 10]
        ])
      );
    case 'series-parallel':
      return closeSwitches(
        withWire(createPreset('parallel-gap'), [
          [21, 10],
          [24, 10]
        ])
      );
    case 'current-not-used':
      return closeSwitches(createPreset('current-not-used'));
    case 'meter-placement': {
      const base = closeSwitches(createPreset('meter-placement'));
      return {
        ...base,
        components: [
          ...base.components,
          { id: 'a1', kind: 'ammeter', x: 21, y: 10, rotation: 0 },
          { id: 'v1', kind: 'voltmeter', x: 28, y: 14, rotation: 0 }
        ]
      };
    }
    case 'short-circuit': {
      const base = createPreset('short-circuit');
      return { ...base, wires: base.wires.filter((wire) => wire.id !== 'w4') };
    }
    case 'divider': {
      const base = closeSwitches(
        withWire(createPreset('divider'), [
          [31, 10],
          [31, 16]
        ])
      );
      return {
        ...base,
        components: base.components.map((component) =>
          component.id === 'r2' ? { ...component, value: 220 } : component
        )
      };
    }
    default:
      return null;
  }
}
