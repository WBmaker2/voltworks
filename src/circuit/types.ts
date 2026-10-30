export type ComponentKind = 'battery' | 'bulb' | 'resistor' | 'switch' | 'ammeter' | 'voltmeter';

export type Rotation = 0 | 90 | 180 | 270;
export type TerminalRole = 'positive' | 'negative' | 'a' | 'b';

export interface Point {
  x: number;
  y: number;
}

export interface Terminal {
  id: string;
  componentId: string;
  role: TerminalRole;
  x: number;
  y: number;
}

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rotation: Rotation;
  /** Volts for a battery, ohms for a resistor. */
  value?: number;
  /** Bulb rating. Resistance is derived from rated voltage and power. */
  rating?: { voltage: number; power: number };
  /** Switch state. */
  closed?: boolean;
}

export interface Wire {
  id: string;
  points: Point[];
}

export interface Circuit {
  components: CircuitComponent[];
  wires: Wire[];
}

export interface ResistorElement {
  id: string;
  a: number;
  b: number;
  resistance: number;
}

export interface VoltageSourceElement {
  id: string;
  a: number;
  b: number;
  voltage: number;
}

export interface SwitchElement {
  id: string;
  a: number;
  b: number;
  closed: boolean;
  resistance: number;
}

export interface AmmeterElement {
  id: string;
  a: number;
  b: number;
}

export interface VoltmeterElement {
  id: string;
  a: number;
  b: number;
  resistance: number;
}

export interface Netlist {
  nodes: number;
  ground: number;
  groundComponentId: string | null;
  resistors: ResistorElement[];
  voltageSources: VoltageSourceElement[];
  switches: SwitchElement[];
  ammeters: AmmeterElement[];
  voltmeters: VoltmeterElement[];
  terminalNodes: Record<string, number>;
  componentNodes: Record<string, { a: number; b: number }>;
}

export interface CircuitWarning {
  code:
    | 'floating'
    | 'open'
    | 'short'
    | 'meter-series'
    | 'meter-parallel'
    | 'no-ground'
    | 'no-battery'
    | 'overload'
    | 'solver';
  messageKo: string;
  componentIds: string[];
  wireIds?: string[];
}

export interface ComponentState {
  voltage: number;
  current: number;
  power: number;
  brightness?: number;
  resistance?: number;
}

export interface SolveResult {
  nodeVoltages: number[];
  ground: number;
  sourceCurrents: Map<string, number>;
  componentStates: Map<string, ComponentState>;
  warnings: CircuitWarning[];
  /** True when a numerical solution exists (false for a detected dead short or a singular system). */
  solved: boolean;
}

export interface WireFlow {
  wireId: string;
  current: number;
  direction: 1 | -1;
  speed: number;
}

export interface CircuitSummary {
  batteryId: string | null;
  sourceVoltage: number;
  sourceCurrent: number;
  totalPower: number;
  equivalentResistance: number | null;
}

export type MissionConcept = 'series' | 'parallel' | 'measurement' | 'short' | 'power' | 'divider';

export interface MissionOption {
  id: string;
  labelKo: string;
}

export interface MissionStage {
  titleKo: string;
  promptKo: string;
  hintKo: string;
  target: string;
  /** Optional preset key loaded when the stage begins. */
  preset?: string;
}

export interface Mission {
  id: string;
  titleKo: string;
  concept: MissionConcept;
  promptKo: string;
  setup: {
    presetCircuit?: string;
    allowedComponents: ComponentKind[];
    target?: string;
  };
  prediction: {
    questionKo: string;
    options: MissionOption[];
    answer: string;
  };
  explanation: {
    questionKo: string;
    options: MissionOption[];
    answer: string;
    bodyKo: string;
  };
  takeawayKo: string;
  hintKo: string;
  difficulty: 1 | 2 | 3;
  stages?: MissionStage[];
  teacher?: {
    expectedKo: string;
    solutionKo: string;
  };
}

export interface MissionProgress {
  prediction: string | null;
  explanation: string | null;
  stage: number;
  measured: boolean;
  targetPassed: boolean;
}

export interface ProgressData {
  completed: string[];
  lastMissionId: string | null;
  answers: Record<string, MissionProgress>;
  preferences: {
    reducedMotion: boolean;
    theme: 'light' | 'dark';
    view: 'schematic' | 'tabletop';
    overlays: {
      current: boolean;
      voltages: boolean;
      labels: boolean;
      grid: boolean;
    };
  };
}
