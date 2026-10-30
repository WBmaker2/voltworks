import type { Mission } from '../circuit/types';

export const MISSIONS: Mission[] = [
  {
    id: 'one-bulb',
    titleKo: '전구를 켜라',
    concept: 'series',
    difficulty: 1,
    promptKo: '전지, 스위치, 전구가 한 줄로 이어진 회로를 완성하고 전구를 켜 보세요.',
    setup: {
      presetCircuit: 'one-bulb-gap',
      allowedComponents: ['battery', 'bulb', 'switch'],
      target: 'one-bulb'
    },
    prediction: {
      questionKo: '전선 하나가 빠져 있습니다. 전선을 연결하고 스위치를 닫으면 전구가 켜질까요?',
      options: [
        { id: 'yes', labelKo: '켜진다' },
        { id: 'no', labelKo: '켜지지 않는다' }
      ],
      answer: 'yes'
    },
    explanation: {
      questionKo: '전구가 켜진 까닭으로 가장 알맞은 것은?',
      options: [
        { id: 'closed-loop', labelKo: '전지에서 나온 전류가 닫힌 길을 따라 흐르기 때문이다.' },
        { id: 'bulb-makes-current', labelKo: '전구가 스스로 전류를 만들어 내기 때문이다.' },
        { id: 'switch-voltage', labelKo: '스위치가 전지의 전압을 높여 주기 때문이다.' }
      ],
      answer: 'closed-loop',
      bodyKo:
        '전지는 +극과 −극 사이에 전압을 만듭니다. 도선으로 두 극을 이어 닫힌 회로를 만들면 전류가 흐르고, 전구는 전기 에너지를 빛과 열로 바꿉니다.'
    },
    takeawayKo: '닫힌 회로가 있어야 전류가 흐르고 전구가 빛납니다.',
    hintKo: '전지의 +극과 스위치 왼쪽 끝을 전선으로 이어 보세요. 그다음 스위치를 클릭해 닫으세요.',
    teacher: {
      expectedKo: '전구 0.60W · 전지 전류 200mA',
      solutionKo: '전지 3V, 전구 15Ω. 닫힌 직렬 회로에서 I = 3V / 15Ω = 200mA, P = 0.60W.'
    }
  },
  {
    id: 'series-parallel',
    titleKo: '직렬과 병렬',
    concept: 'parallel',
    difficulty: 2,
    promptKo: '같은 두 전구를 직렬과 병렬로 각각 연결하고, 전력이 어떻게 달라지는지 비교하세요.',
    setup: {
      presetCircuit: 'series',
      allowedComponents: ['battery', 'bulb', 'switch'],
      target: 'series-equal'
    },
    prediction: {
      questionKo: '같은 전지에 전구 두 개를 연결합니다. 더 밝게 빛나는 연결은 어느 쪽일까요?',
      options: [
        { id: 'parallel', labelKo: '병렬 연결' },
        { id: 'series', labelKo: '직렬 연결' },
        { id: 'same', labelKo: '두 연결이 같다' }
      ],
      answer: 'parallel'
    },
    explanation: {
      questionKo: '병렬 연결에서 두 전구가 더 밝은 까닭은?',
      options: [
        { id: 'full-voltage', labelKo: '각 전구가 전지 전압을 거의 그대로 받기 때문이다.' },
        { id: 'less-current', labelKo: '각 전구에 더 적은 전류가 흐르기 때문이다.' },
        { id: 'parallel-resistance', labelKo: '전체 저항이 커져서 전류가 작아지기 때문이다.' }
      ],
      answer: 'full-voltage',
      bodyKo:
        '직렬에서는 전지 전압을 두 전구가 나누어 가지므로 각 전구의 전압과 전력이 작아집니다. 병렬에서는 각 전구가 전지 전압을 거의 그대로 받아 P = V²/R 만큼의 전력을 씁니다.'
    },
    takeawayKo: '병렬 연결은 각 전구에 전지 전압을 그대로 줍니다. 그래서 직렬보다 밝습니다.',
    hintKo:
      '직렬에서는 두 전구가 전압을 나눠 가지고, 병렬에서는 각 전구가 전지 전압을 거의 그대로 받습니다.',
    teacher: {
      expectedKo: '직렬: 전구마다 0.15W · 병렬: 전구마다 0.60W',
      solutionKo:
        '직렬은 3V를 두 15Ω 전구가 나눠 가져 각 1.5V, P=0.15W. 병렬은 각 전구에 3V가 걸려 P=0.60W.'
    },
    stages: [
      {
        titleKo: '1단계 · 직렬 회로',
        promptKo: '스위치를 닫고 직렬로 연결된 두 전구의 전력을 측정하세요.',
        hintKo: '스위치를 클릭해 닫은 뒤 측정 버튼을 누르세요.',
        target: 'series-equal',
        preset: 'series'
      },
      {
        titleKo: '2단계 · 병렬 회로',
        promptKo: '두 전구가 나란히 연결되도록 빠진 전선을 이어 보세요. 스위치도 닫아야 합니다.',
        hintKo: '스위치 오른쪽 끝과 두 전구가 만나는 점을 전선으로 연결하고 스위치를 닫으세요.',
        target: 'parallel-brighter',
        preset: 'parallel-gap'
      }
    ]
  },
  {
    id: 'current-not-used',
    titleKo: '전류는 어디서 사라질까?',
    concept: 'series',
    difficulty: 2,
    promptKo: '전구 앞과 뒤에 전류계를 두었습니다. 스위치를 닫고 두 전류계의 값을 비교하세요.',
    setup: {
      presetCircuit: 'current-not-used',
      allowedComponents: ['battery', 'bulb', 'switch', 'ammeter'],
      target: 'current-equal'
    },
    prediction: {
      questionKo: '스위치를 닫으면 두 전류계의 값은 어떻게 될까요?',
      options: [
        { id: 'same', labelKo: '두 값이 같다' },
        { id: 'front', labelKo: '전구 앞이 더 크다' },
        { id: 'back', labelKo: '전구 뒤가 더 크다' }
      ],
      answer: 'same'
    },
    explanation: {
      questionKo: '직렬 회로에서 전류가 줄어들지 않는 까닭은?',
      options: [
        {
          id: 'one-path',
          labelKo: '전류가 흐를 수 있는 길이 하나뿐이라 전하가 사라지지 않기 때문이다.'
        },
        { id: 'bulb-stores', labelKo: '전구가 전류를 저장했다가 뒤로 보내기 때문이다.' },
        { id: 'battery-pushes', labelKo: '전지가 뒤쪽에서 더 세게 밀어 주기 때문이다.' }
      ],
      answer: 'one-path',
      bodyKo:
        '직렬 회로에서는 같은 전하가 한 길을 따라 계속 흐릅니다. 전구는 전류를 소비하는 것이 아니라 전기 에너지를 빛과 열로 바꿉니다. 그래서 전구 앞과 뒤의 전류는 같습니다.'
    },
    takeawayKo: '직렬 회로의 전류는 어느 지점에서나 같습니다. 전구는 전류를 먹지 않습니다.',
    hintKo: '두 전류계가 같은 전류를 읽는지 확인하세요. 전구는 전류를 소비하지 않습니다.',
    teacher: {
      expectedKo: '두 전류계 모두 100mA',
      solutionKo: '직렬 회로의 전류는 모든 지점에서 같습니다. 두 15Ω 전구와 3V 전지에서 I=100mA.'
    }
  },
  {
    id: 'meter-placement',
    titleKo: '계측기 연결',
    concept: 'measurement',
    difficulty: 3,
    promptKo: '전류계는 직렬, 전압계는 나란히. 빈자리에 계측기를 넣고 전구의 전류와 전압을 재세요.',
    setup: {
      presetCircuit: 'meter-placement',
      allowedComponents: ['battery', 'bulb', 'switch', 'ammeter', 'voltmeter'],
      target: 'meters-correct'
    },
    prediction: {
      questionKo: '전류계와 전압계를 바르게 연결한 것은?',
      options: [
        {
          id: 'a-series-v-parallel',
          labelKo: '전류계는 회로와 직렬, 전압계는 전구와 나란히'
        },
        { id: 'both-series', labelKo: '둘 다 회로와 직렬' },
        { id: 'both-parallel', labelKo: '둘 다 전구와 나란히' },
        { id: 'a-parallel-v-series', labelKo: '전류계는 나란히, 전압계는 직렬' }
      ],
      answer: 'a-series-v-parallel'
    },
    explanation: {
      questionKo: '전압계를 전구와 나란히 연결하는 까닭은?',
      options: [
        { id: 'same-voltage', labelKo: '전구 양 끝의 전압 차이를 그대로 재기 위해서다.' },
        { id: 'limit-current', labelKo: '전구에 흐르는 전류를 줄이기 위해서다.' },
        { id: 'break-circuit', labelKo: '회로를 끊어 전류를 멈추게 하기 위해서다.' }
      ],
      answer: 'same-voltage',
      bodyKo:
        '전압계는 전류를 거의 흘리지 않으므로 측정할 부품과 나란히 연결합니다. 전류계는 전류가 전부 통과하도록 회로와 직렬로 넣습니다.'
    },
    takeawayKo: '전류계는 직렬, 전압계는 병렬. 연결 위치가 측정값을 바꿉니다.',
    hintKo: '전류계는 스위치와 전구 사이의 빈자리에, 전압계는 전구 아래 빈자리에 놓으세요.',
    teacher: {
      expectedKo: '전류계 200mA · 전압계 3.0V',
      solutionKo: '전류계는 직렬로 넣어 200mA를 읽고, 전압계는 전구와 병렬로 넣어 3.0V를 읽습니다.'
    }
  },
  {
    id: 'short-circuit',
    titleKo: '단락을 찾아라',
    concept: 'short',
    difficulty: 2,
    promptKo:
      '전구를 우회하는 전선 때문에 단락이 생겼습니다. 전류가 어디로 흐르는지 확인하고 고치세요.',
    setup: {
      presetCircuit: 'short-circuit',
      allowedComponents: ['battery', 'bulb', 'switch'],
      target: 'short-fixed'
    },
    prediction: {
      questionKo: '전구를 지나는 길과 저항이 거의 없는 전선 길이 있습니다. 전류는 어디로 흐를까요?',
      options: [
        { id: 'wire', labelKo: '저항이 거의 없는 전선 쪽으로 거의 모두 흐른다' },
        { id: 'bulb', labelKo: '전구 쪽으로 거의 모두 흐른다' },
        { id: 'both', labelKo: '두 길에 똑같이 나뉘어 흐른다' }
      ],
      answer: 'wire'
    },
    explanation: {
      questionKo: '단락이 위험한 까닭은?',
      options: [
        { id: 'huge-current', labelKo: '저항이 거의 0이어서 전류가 매우 크게 흐르기 때문이다.' },
        { id: 'no-voltage', labelKo: '전지의 전압이 0이 되기 때문이다.' },
        { id: 'bulb-bright', labelKo: '전구가 정격보다 어두워지기 때문이다.' }
      ],
      answer: 'huge-current',
      bodyKo:
        '전류는 저항이 작은 길을 선호합니다. 전구를 우회하는 전선이 있으면 전류가 그쪽으로 몰려 매우 커지고, 전구에는 거의 흐르지 않습니다. 이것이 단락입니다.'
    },
    takeawayKo: '저항이 거의 없는 우회로가 있으면 단락입니다. 우회 전선을 없애야 합니다.',
    hintKo: '전구의 양쪽 끝을 직접 잇는 전선을 찾아 삭제하세요.',
    teacher: {
      expectedKo: '단락 상태 약 3,000A · 고친 뒤 전구 0.60W',
      solutionKo:
        '닫힌 스위치 저항 1mΩ과 이상적 전선 때문에 3V/1mΩ ≈ 3,000A가 흐릅니다. 우회 전선을 지우면 200mA, 0.60W로 돌아옵니다.'
    }
  },
  {
    id: 'divider',
    titleKo: '9V에서 3V 만들기',
    concept: 'divider',
    difficulty: 3,
    promptKo: '9V 전지와 두 저항으로 전구에 3V를 공급하는 전압 분배 회로를 완성하세요.',
    setup: {
      presetCircuit: 'divider',
      allowedComponents: ['battery', 'resistor', 'switch', 'voltmeter'],
      target: 'divider-3v'
    },
    prediction: {
      questionKo: '9V에서 3V를 얻으려면 두 저항의 비 R1:R2는 얼마여야 할까요?',
      options: [
        { id: 'one-one', labelKo: '1 : 1' },
        { id: 'one-two', labelKo: '1 : 2' },
        { id: 'two-one', labelKo: '2 : 1' }
      ],
      answer: 'one-two'
    },
    explanation: {
      questionKo: '전압 분배에서 R1 양단의 전압이 3V가 되는 까닭은?',
      options: [
        { id: 'ratio', labelKo: '직렬 회로에서 전압은 저항의 크기에 비례해 나뉘기 때문이다.' },
        { id: 'current-split', labelKo: '전류가 두 저항에 똑같이 나뉘기 때문이다.' },
        { id: 'battery-half', labelKo: '전지는 항상 전압을 절반으로 나누기 때문이다.' }
      ],
      answer: 'ratio',
      bodyKo:
        '직렬 회로에는 같은 전류가 흐르므로 V = IR에 따라 전압은 저항에 비례합니다. R1:R2 = 1:2이면 전체 9V 중 R1에 3V, R2에 6V가 걸립니다.'
    },
    takeawayKo: '직렬 회로의 전압은 저항의 비율대로 나뉩니다.',
    hintKo:
      'R2를 220Ω으로 바꾸고, R2 오른쪽 끝과 전지 −극으로 이어지는 전선을 연결하세요. 스위치도 닫아야 합니다.',
    teacher: {
      expectedKo: 'R1=100Ω, R2=220Ω일 때 전압계 약 2.8V',
      solutionKo: 'V_R1 = 9V × 100Ω/(100Ω+220Ω) ≈ 2.81V. 1:2 비율이면 3V에 가장 가깝습니다.'
    }
  }
];

export function missionById(id: string | null): Mission | null {
  if (!id) return null;
  return MISSIONS.find((mission) => mission.id === id) ?? null;
}
