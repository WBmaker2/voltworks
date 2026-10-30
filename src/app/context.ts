import type { CircuitWarning, ComponentKind } from '../circuit/types';
import type { PresetKey } from '../data/presets';
import type { CircuitEditor } from '../editor/CircuitEditor';
import type { SchematicCanvas } from '../render/SchematicCanvas';
import type { Scene3D } from '../render/Scene3D';
import type { AppState, EditorTool, Route, Store } from './state';

export interface AppContext {
  store: Store;
  editor: CircuitEditor;
  renderer: SchematicCanvas;
  scene3d: Scene3D | null;
  actions: AppActions;
}

export interface AppActions {
  setRoute(route: Route): void;
  startMission(id: string): void;
  exitMission(): void;
  measure(): void;
  setPrediction(id: string): void;
  answerExplanation(id: string): void;
  nextStage(): void;
  restartMission(): void;
  nextMission(): void;
  newCircuit(): void;
  loadPreset(key: PresetKey): void;
  setTool(tool: EditorTool): void;
  arm(kind: ComponentKind): void;
  setPlacementValue(kind: 'battery' | 'resistor', value: number): void;
  undo(): void;
  redo(): void;
  toggleRun(): void;
  setView(view: AppState['preferences']['view']): void;
  toggleOverlay(key: keyof AppState['preferences']['overlays']): void;
  setTheme(theme: AppState['preferences']['theme']): void;
  rotateSelected(): void;
  deleteSelected(): void;
  setValue(id: string, value: number): void;
  setClosed(id: string, closed: boolean): void;
  openHelp(): void;
  closeHelp(): void;
  openDrawer(drawer: AppState['ui']['drawer']): void;
  setMobilePanel(panel: AppState['ui']['mobilePanel']): void;
  resetProgress(): void;
  printWorksheet(): void;
  toggleTeacherReveal(): void;
  selectWarning(warning: CircuitWarning): void;
  focusCanvas(): void;
  fitCanvas(): void;
  zoomBy(factor: number): void;
}
