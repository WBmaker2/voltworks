import { BULB_RATING } from '../circuit/constants';
import type { Circuit, CircuitComponent, Rotation, Wire } from '../circuit/types';

export type PresetKey =
  | 'starter'
  | 'one-bulb-gap'
  | 'series'
  | 'parallel-gap'
  | 'current-not-used'
  | 'meter-placement'
  | 'short-circuit'
  | 'divider';

export interface PresetDefinition {
  key: PresetKey;
  nameKo: string;
  descriptionKo: string;
  circuit: Circuit;
}

function part(
  id: string,
  kind: CircuitComponent['kind'],
  x: number,
  y: number,
  options: {
    rotation?: Rotation;
    value?: number;
    closed?: boolean;
    rating?: { voltage: number; power: number };
  } = {}
): CircuitComponent {
  return {
    id,
    kind,
    x,
    y,
    rotation: options.rotation ?? 0,
    ...(options.value !== undefined ? { value: options.value } : {}),
    ...(options.closed !== undefined ? { closed: options.closed } : {}),
    ...(options.rating ? { rating: options.rating } : {})
  };
}

function path(id: string, points: Array<[number, number]>): Wire {
  return { id, points: points.map(([x, y]) => ({ x, y })) };
}

function starter(): Circuit {
  return {
    components: [
      part('b1', 'battery', 14, 10, { value: 3 }),
      part('s1', 'switch', 20, 10, { closed: false }),
      part('l1', 'bulb', 26, 10, { rating: { ...BULB_RATING } })
    ],
    wires: [
      path('w1', [
        [15, 10],
        [19, 10]
      ]),
      path('w2', [
        [21, 10],
        [25, 10]
      ]),
      path('w3', [
        [27, 10],
        [27, 15],
        [13, 15],
        [13, 10]
      ])
    ]
  };
}

function oneBulbGap(): Circuit {
  const circuit = starter();
  circuit.wires = circuit.wires.filter((wire) => wire.id !== 'w1');
  return circuit;
}

function series(): Circuit {
  return {
    components: [
      part('b1', 'battery', 14, 10, { value: 3 }),
      part('s1', 'switch', 20, 10, { closed: false }),
      part('l1', 'bulb', 26, 10, { rating: { ...BULB_RATING } }),
      part('l2', 'bulb', 32, 10, { rating: { ...BULB_RATING } })
    ],
    wires: [
      path('w1', [
        [15, 10],
        [19, 10]
      ]),
      path('w2', [
        [21, 10],
        [25, 10]
      ]),
      path('w3', [
        [27, 10],
        [31, 10]
      ]),
      path('w4', [
        [33, 10],
        [33, 15],
        [13, 15],
        [13, 10]
      ])
    ]
  };
}

function parallelGap(): Circuit {
  return {
    components: [
      part('b1', 'battery', 14, 10, { value: 3 }),
      part('s1', 'switch', 20, 10, { closed: false }),
      part('l1', 'bulb', 28, 8, { rating: { ...BULB_RATING } }),
      part('l2', 'bulb', 28, 13, { rating: { ...BULB_RATING } })
    ],
    wires: [
      path('w1', [
        [15, 10],
        [19, 10]
      ]),
      path('w3', [
        [24, 10],
        [24, 8],
        [27, 8]
      ]),
      path('w4', [
        [24, 10],
        [24, 13],
        [27, 13]
      ]),
      path('w5', [
        [29, 8],
        [31, 8],
        [31, 13],
        [29, 13]
      ]),
      path('w6', [
        [31, 13],
        [31, 17],
        [13, 17],
        [13, 10]
      ])
    ]
  };
}

function currentNotUsed(): Circuit {
  return {
    components: [
      part('b1', 'battery', 10, 10, { value: 3 }),
      part('s1', 'switch', 15, 10, { closed: false }),
      part('a1', 'ammeter', 20, 10),
      part('l1', 'bulb', 25, 10, { rating: { ...BULB_RATING } }),
      part('a2', 'ammeter', 31, 10),
      part('l2', 'bulb', 37, 10, { rating: { ...BULB_RATING } })
    ],
    wires: [
      path('w1', [
        [11, 10],
        [14, 10]
      ]),
      path('w2', [
        [16, 10],
        [19, 10]
      ]),
      path('w3', [
        [21, 10],
        [24, 10]
      ]),
      path('w4', [
        [26, 10],
        [30, 10]
      ]),
      path('w5', [
        [32, 10],
        [36, 10]
      ]),
      path('w6', [
        [38, 10],
        [38, 15],
        [9, 15],
        [9, 10]
      ])
    ]
  };
}

function meterPlacement(): Circuit {
  return {
    components: [
      part('b1', 'battery', 10, 10, { value: 3 }),
      part('s1', 'switch', 15, 10, { closed: false }),
      part('l1', 'bulb', 28, 10, { rating: { ...BULB_RATING } })
    ],
    wires: [
      path('w1', [
        [11, 10],
        [14, 10]
      ]),
      path('w2', [
        [16, 10],
        [20, 10]
      ]),
      path('w3', [
        [22, 10],
        [27, 10]
      ]),
      path('w4', [
        [29, 10],
        [29, 16],
        [9, 16],
        [9, 10]
      ]),
      path('w5', [
        [27, 10],
        [27, 14]
      ])
    ]
  };
}

function shortCircuit(): Circuit {
  return {
    components: [
      part('b1', 'battery', 10, 10, { value: 3 }),
      part('s1', 'switch', 15, 10, { closed: true }),
      part('l1', 'bulb', 22, 10, { rating: { ...BULB_RATING } })
    ],
    wires: [
      path('w1', [
        [11, 10],
        [14, 10]
      ]),
      path('w2', [
        [16, 10],
        [21, 10]
      ]),
      path('w3', [
        [23, 10],
        [23, 17],
        [9, 17],
        [9, 10]
      ]),
      path('w4', [
        [21, 10],
        [21, 14],
        [23, 14],
        [23, 10]
      ])
    ]
  };
}

function divider(): Circuit {
  return {
    components: [
      part('b1', 'battery', 10, 10, { value: 9 }),
      part('s1', 'switch', 15, 10, { closed: false }),
      part('r1', 'resistor', 22, 10, { value: 100 }),
      part('r2', 'resistor', 30, 10, { value: 100 }),
      part('v1', 'voltmeter', 22, 16)
    ],
    wires: [
      path('w1', [
        [11, 10],
        [14, 10]
      ]),
      path('w2', [
        [16, 10],
        [21, 10]
      ]),
      path('w3', [
        [23, 10],
        [29, 10]
      ]),
      path('w4', [
        [31, 16],
        [31, 19],
        [9, 19],
        [9, 10]
      ]),
      path('w5', [
        [21, 16],
        [21, 10]
      ]),
      path('w6', [
        [23, 16],
        [23, 10]
      ])
    ]
  };
}

const BUILDERS: Record<PresetKey, () => Circuit> = {
  starter,
  'one-bulb-gap': oneBulbGap,
  series,
  'parallel-gap': parallelGap,
  'current-not-used': currentNotUsed,
  'meter-placement': meterPlacement,
  'short-circuit': shortCircuit,
  divider
};

export const PRESET_META: Record<PresetKey, { nameKo: string; descriptionKo: string }> = {
  starter: {
    nameKo: '기본 회로',
    descriptionKo: '전지, 스위치, 전구가 연결된 기본 회로'
  },
  'one-bulb-gap': {
    nameKo: '전구를 켜라',
    descriptionKo: '전선 하나가 빠진 회로'
  },
  series: {
    nameKo: '직렬 회로',
    descriptionKo: '전구 두 개가 한 줄로 연결된 회로'
  },
  'parallel-gap': {
    nameKo: '병렬 회로',
    descriptionKo: '전구 두 개를 나란히 연결하는 회로'
  },
  'current-not-used': {
    nameKo: '전류 측정',
    descriptionKo: '전구 앞뒤에 전류계를 둔 회로'
  },
  'meter-placement': {
    nameKo: '계측기 연결',
    descriptionKo: '전류계와 전압계를 넣는 회로'
  },
  'short-circuit': {
    nameKo: '단락 회로',
    descriptionKo: '전구를 우회하는 전선이 있는 회로'
  },
  divider: {
    nameKo: '전압 분배',
    descriptionKo: '9V에서 3V를 만드는 회로'
  }
};

export function createPreset(key: PresetKey): Circuit {
  const circuit = BUILDERS[key]();
  return structuredClone(circuit);
}

export function presetKeys(): PresetKey[] {
  return Object.keys(BUILDERS) as PresetKey[];
}
