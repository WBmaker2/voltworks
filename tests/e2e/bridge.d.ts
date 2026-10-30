import type { AppActions } from '../../src/app/context';
import type { AppState, Route } from '../../src/app/state';
import type { Circuit, ComponentState, Point, SolveResult } from '../../src/circuit/types';
import type { PresetKey } from '../../src/data/presets';

export interface TestSolveResult extends Omit<SolveResult, 'sourceCurrents' | 'componentStates'> {
  sourceCurrents: Record<string, number>;
  componentStates: Record<string, ComponentState>;
}

export interface TestSnapshot extends Omit<AppState, 'simulation'> {
  simulation: {
    running: boolean;
    result: TestSolveResult | null;
    lastSolveMs: number;
  };
}

export interface VoltWorksBridge {
  getState(): AppState;
  getSnapshot(): TestSnapshot;
  getCircuit(): Circuit;
  solve(): SolveResult;
  loadCircuit(circuit: Circuit): void;
  loadPreset(key: PresetKey): void;
  startMission(id: string): void;
  measure(): void;
  setPrediction(id: string): void;
  answerExplanation(id: string): void;
  nextStage(): void;
  worldToScreen(point: Point): Point;
  getCamera(): { x: number; y: number; zoom: number };
  setRoute(route: Route): void;
  actions: AppActions;
}

declare global {
  interface Window {
    __voltworks: VoltWorksBridge;
  }
}

export {};
