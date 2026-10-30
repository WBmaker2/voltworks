import type {
  CircuitComponent,
  ComponentKind,
  MissionProgress,
  Point,
  ProgressData,
  Rotation,
  SolveResult,
  Wire
} from '../circuit/types';

export type Route = 'workbench' | 'missions' | 'teacher';
export type EditorTool = 'select' | 'wire' | 'delete' | 'pan';

export interface Selection {
  kind: 'component' | 'wire' | null;
  id: string | null;
}

export interface Toast {
  id: number;
  messageKo: string;
  tone: 'info' | 'warn' | 'success';
}

export interface AppState {
  route: Route;
  editor: {
    components: CircuitComponent[];
    wires: Wire[];
    selection: Selection;
    tool: EditorTool;
    gridSnap: boolean;
    armedKind: ComponentKind | null;
    placementCursor: Point | null;
    wireDraft: Point[] | null;
    keyboardWire: boolean;
    placementValues: {
      battery: number;
      resistor: number;
    };
  };
  simulation: {
    running: boolean;
    result: SolveResult | null;
    lastSolveMs: number;
  };
  mission: {
    currentId: string | null;
    stage: number;
    completed: string[];
    progress: Record<string, MissionProgress>;
    explanationOpen: boolean;
  };
  preferences: {
    theme: 'light' | 'dark';
    reducedMotion: boolean;
    view: 'schematic' | 'tabletop';
    overlays: {
      current: boolean;
      voltages: boolean;
      labels: boolean;
      grid: boolean;
    };
  };
  ui: {
    helpOpen: boolean;
    toast: Toast | null;
    mobilePanel: 'none' | 'parts' | 'inspect' | 'mission';
    drawer: 'left' | 'right' | null;
    teacherReveal: boolean;
  };
}

export type Listener = (state: AppState) => void;

export function emptyMissionProgress(): MissionProgress {
  return {
    prediction: null,
    explanation: null,
    stage: 0,
    measured: false,
    targetPassed: false
  };
}

export function createInitialState(progress: ProgressData): AppState {
  return {
    route: 'workbench',
    editor: {
      components: [],
      wires: [],
      selection: { kind: null, id: null },
      tool: 'select',
      gridSnap: true,
      armedKind: null,
      placementCursor: null,
      wireDraft: null,
      keyboardWire: false,
      placementValues: {
        battery: 3,
        resistor: 100
      }
    },
    simulation: {
      running: true,
      result: null,
      lastSolveMs: 0
    },
    mission: {
      currentId: null,
      stage: 0,
      completed: [...progress.completed],
      progress: { ...progress.answers },
      explanationOpen: false
    },
    preferences: {
      theme: progress.preferences.theme,
      reducedMotion: progress.preferences.reducedMotion,
      view: progress.preferences.view,
      overlays: { ...progress.preferences.overlays }
    },
    ui: {
      helpOpen: false,
      toast: null,
      mobilePanel: 'none',
      drawer: null,
      teacherReveal: false
    }
  };
}

export function missionProgress(
  state: AppState,
  missionId = state.mission.currentId
): MissionProgress {
  if (!missionId) return emptyMissionProgress();
  return state.mission.progress[missionId] ?? emptyMissionProgress();
}

export function progressData(state: AppState, lastMissionId: string | null): ProgressData {
  return {
    completed: [...state.mission.completed],
    lastMissionId,
    answers: state.mission.progress,
    preferences: {
      reducedMotion: state.preferences.reducedMotion,
      theme: state.preferences.theme,
      view: state.preferences.view,
      overlays: { ...state.preferences.overlays }
    }
  };
}

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();
  private toastCounter = 0;

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update(mutator: (state: AppState) => void): void {
    mutator(this.state);
    for (const listener of this.listeners) listener(this.state);
  }

  updateSilent(mutator: (state: AppState) => void): void {
    mutator(this.state);
  }

  toast(messageKo: string, tone: Toast['tone'] = 'info'): void {
    this.toastCounter += 1;
    const toast: Toast = { id: this.toastCounter, messageKo, tone };
    this.update((state) => {
      state.ui.toast = toast;
    });
    const id = toast.id;
    window.setTimeout(() => {
      if (this.state.ui.toast?.id === id) {
        this.update((state) => {
          state.ui.toast = null;
        });
      }
    }, 3400);
  }

  setComponents(components: CircuitComponent[], wires: Wire[]): void {
    this.update((state) => {
      state.editor.components = components;
      state.editor.wires = wires;
    });
  }

  setSelection(kind: Selection['kind'], id: string | null): void {
    this.update((state) => {
      state.editor.selection = { kind, id };
    });
  }

  rotateSelected(): Rotation {
    const selected = this.state.editor.selection;
    if (selected.kind !== 'component' || !selected.id) return 0;
    const component = this.state.editor.components.find((item) => item.id === selected.id);
    return component ? (((component.rotation + 90) % 360) as Rotation) : 0;
  }
}
