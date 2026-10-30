import { getAllTerminals, getTerminals, pointsEqual } from '../circuit/geometry';
import type {
  Circuit,
  CircuitComponent,
  ComponentKind,
  Point,
  Rotation,
  Wire
} from '../circuit/types';
import { catalogItem } from '../data/components';
import { missionById } from '../data/missions';
import type { AppState, Store } from '../app/state';
import { History } from './commands';
import { snapAndClamp } from './grid';
import { hitTest, type Hit } from './hitTest';
import { canPlaceComponent, createComponent, nextComponentId } from './placement';
import { appendOrthogonalPath, dedupePoints, rerouteEndpoint, trimEndpointAt } from './wiring';

export interface CircuitSnapshot {
  components: CircuitComponent[];
  wires: Wire[];
}

export interface CircuitEditorOptions {
  onCircuitChange: (reason: 'edit' | 'load' | 'undo' | 'redo' | 'keyboard') => void;
}

function cloneSnapshot(snapshot: CircuitSnapshot): CircuitSnapshot {
  return structuredClone(snapshot);
}

export class CircuitEditor {
  private store: Store;
  private options: CircuitEditorOptions;
  private history = new History<CircuitSnapshot>();
  private moveStart: CircuitSnapshot | null = null;
  private moveId: string | null = null;
  private moveStartPoint: Point | null = null;
  private pendingToggleId: string | null = null;

  constructor(store: Store, options: CircuitEditorOptions) {
    this.store = store;
    this.options = options;
  }

  snapshot(): CircuitSnapshot {
    const state = this.store.get();
    return cloneSnapshot({
      components: state.editor.components,
      wires: state.editor.wires
    });
  }

  circuit(): Circuit {
    return this.snapshot();
  }

  load(circuit: Circuit): void {
    this.history.clear();
    this.moveStart = null;
    this.moveId = null;
    this.pendingToggleId = null;
    this.store.update((state) => {
      state.editor.components = structuredClone(circuit.components);
      state.editor.wires = structuredClone(circuit.wires);
      state.editor.selection = { kind: null, id: null };
      state.editor.wireDraft = null;
      state.editor.keyboardWire = false;
      state.editor.armedKind = null;
      state.editor.placementCursor = null;
      state.editor.tool = 'select';
    });
    this.options.onCircuitChange('load');
  }

  private pushHistory(): void {
    this.history.push(this.snapshot());
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  undo(): void {
    const current = this.snapshot();
    const previous = this.history.undo(current);
    if (!previous) return;
    this.restore(previous);
    this.options.onCircuitChange('undo');
  }

  redo(): void {
    const current = this.snapshot();
    const next = this.history.redo(current);
    if (!next) return;
    this.restore(next);
    this.options.onCircuitChange('redo');
  }

  private restore(snapshot: CircuitSnapshot): void {
    this.store.update((state) => {
      state.editor.components = structuredClone(snapshot.components);
      state.editor.wires = structuredClone(snapshot.wires);
      state.editor.selection = { kind: null, id: null };
      state.editor.wireDraft = null;
      state.editor.keyboardWire = false;
      state.editor.armedKind = null;
      state.editor.placementCursor = null;
    });
  }

  private isKindAllowed(kind: ComponentKind): boolean {
    const mission = missionById(this.store.get().mission.currentId);
    if (!mission) return true;
    return mission.setup.allowedComponents.includes(kind);
  }

  private defaultPlacementCursor(state: AppState): Point {
    const components = state.editor.components;
    if (components.length === 0) return { x: 24, y: 16 };
    const rightmost = components.reduce(
      (best, component) => (component.x > best.x ? component : best),
      components[0]
    );
    return snapAndClamp({ x: rightmost.x + 3, y: rightmost.y });
  }

  arm(kind: ComponentKind, cursor?: Point): void {
    if (!this.isKindAllowed(kind)) {
      this.store.toast('이 미션에서는 사용할 수 없는 부품입니다.', 'warn');
      return;
    }
    this.store.update((state) => {
      state.editor.armedKind = kind;
      state.editor.placementCursor = cursor
        ? snapAndClamp(cursor)
        : this.defaultPlacementCursor(state);
      state.editor.wireDraft = null;
      state.editor.keyboardWire = false;
      state.editor.tool = 'select';
    });
  }

  disarm(): void {
    this.store.update((state) => {
      state.editor.armedKind = null;
      state.editor.placementCursor = null;
    });
  }

  updatePlacementCursor(point: Point): void {
    const state = this.store.get();
    if (!state.editor.armedKind) return;
    this.store.updateSilent((draft) => {
      draft.editor.placementCursor = snapAndClamp(point);
    });
  }

  placeArmedAt(point?: Point): void {
    const state = this.store.get();
    const kind = state.editor.armedKind;
    if (!kind) return;
    const target = snapAndClamp(point ?? state.editor.placementCursor ?? { x: 20, y: 12 });
    const placement = canPlaceComponent(state.editor.components, kind, target, 0);
    if (!placement.ok) {
      this.store.toast(placement.reasonKo ?? '이곳에는 놓을 수 없습니다.', 'warn');
      return;
    }
    const id = nextComponentId(state.editor.components, kind);
    const component = createComponent(id, kind, target);
    if (kind === 'battery') component.value = state.editor.placementValues.battery;
    if (kind === 'resistor') component.value = state.editor.placementValues.resistor;
    this.pushHistory();
    this.store.update((draft) => {
      draft.editor.components = [...draft.editor.components, component];
      draft.editor.selection = { kind: 'component', id };
      draft.editor.armedKind = null;
      draft.editor.placementCursor = null;
    });
    this.store.toast(`${catalogItem(kind).labelKo}을(를) 놓았습니다.`);
    this.options.onCircuitChange('edit');
  }

  select(kind: 'component' | 'wire' | null, id: string | null): void {
    this.store.update((state) => {
      state.editor.selection = { kind, id };
      state.editor.armedKind = null;
      state.editor.placementCursor = null;
    });
  }

  clearSelection(): void {
    if (this.store.get().editor.selection.kind === null) return;
    this.store.update((state) => {
      state.editor.selection = { kind: null, id: null };
    });
  }

  setTool(tool: AppState['editor']['tool']): void {
    this.store.update((state) => {
      state.editor.tool = tool;
      state.editor.armedKind = null;
      state.editor.placementCursor = null;
      if (state.editor.tool !== 'wire') {
        state.editor.wireDraft = null;
        state.editor.keyboardWire = false;
      }
    });
  }

  beginWire(start: Point, keyboard = false): void {
    this.store.update((state) => {
      state.editor.wireDraft = [{ x: start.x, y: start.y }];
      state.editor.keyboardWire = keyboard;
      state.editor.placementCursor = keyboard ? { x: start.x, y: start.y } : null;
    });
  }

  addWaypoint(point: Point): void {
    const state = this.store.get();
    const draft = state.editor.wireDraft;
    if (!draft || draft.length === 0) return;
    const snapped = snapAndClamp(point);
    const last = draft[draft.length - 1];
    if (last && pointsEqual(last, snapped)) return;
    const points = appendOrthogonalPath(draft, snapped);
    this.store.updateSilent((draftState) => {
      draftState.editor.wireDraft = points;
    });
  }

  cancelWire(): void {
    if (!this.store.get().editor.wireDraft) return;
    this.store.update((state) => {
      state.editor.wireDraft = null;
      state.editor.keyboardWire = false;
      state.editor.placementCursor = null;
    });
  }

  finishWire(end: Point): void {
    const state = this.store.get();
    const draft = state.editor.wireDraft;
    if (!draft || draft.length === 0) return;
    const snapped = snapAndClamp(end);
    const start = draft[0];
    if (pointsEqual(start, snapped)) {
      this.cancelWire();
      return;
    }
    const points = dedupePoints(appendOrthogonalPath(draft, snapped));
    if (points.length < 2) {
      this.cancelWire();
      return;
    }
    let maximum = 0;
    for (const wire of state.editor.wires) {
      if (!wire.id.startsWith('w')) continue;
      const suffix = Number(wire.id.slice(1));
      if (Number.isFinite(suffix)) maximum = Math.max(maximum, suffix);
    }
    const wire: Wire = { id: `w${maximum + 1}`, points };
    this.pushHistory();
    this.store.update((draftState) => {
      draftState.editor.wires = [...draftState.editor.wires, wire];
      draftState.editor.wireDraft = null;
      draftState.editor.keyboardWire = false;
      draftState.editor.placementCursor = null;
      draftState.editor.selection = { kind: 'wire', id: wire.id };
    });
    this.options.onCircuitChange('edit');
  }

  private rerouteWiresForTerminalMove(
    snapshot: CircuitSnapshot,
    oldComponent: CircuitComponent,
    newComponent: CircuitComponent
  ): CircuitSnapshot {
    const oldTerminals = getTerminals(oldComponent);
    const newTerminals = getTerminals(newComponent);
    let wires = snapshot.wires.map((wire) => ({
      ...wire,
      points: wire.points.map((point) => ({ ...point }))
    }));
    for (const oldTerminal of oldTerminals) {
      const newTerminal = newTerminals.find((terminal) => terminal.role === oldTerminal.role);
      if (!newTerminal) continue;
      wires = wires.map((wire) =>
        rerouteEndpoint(
          wire,
          { x: oldTerminal.x, y: oldTerminal.y },
          { x: newTerminal.x, y: newTerminal.y }
        )
      );
    }
    return { components: snapshot.components, wires };
  }

  beginMove(id: string): void {
    const state = this.store.get();
    const component = state.editor.components.find((item) => item.id === id);
    if (!component) return;
    this.pushHistory();
    this.moveStart = this.snapshot();
    this.moveId = id;
    this.moveStartPoint = { x: component.x, y: component.y };
    this.pendingToggleId = component.kind === 'switch' ? id : null;
  }

  moveTo(point: Point): boolean {
    if (!this.moveStart || !this.moveId || !this.moveStartPoint) return false;
    const target = snapAndClamp(point);
    const original = this.moveStart.components.find((component) => component.id === this.moveId);
    if (!original) return false;
    if (original.x === target.x && original.y === target.y) return false;
    const placement = canPlaceComponent(
      this.moveStart.components,
      original.kind,
      target,
      original.rotation,
      this.moveId
    );
    if (!placement.ok) return false;

    const moved: CircuitComponent = { ...original, x: target.x, y: target.y };
    const components = this.moveStart.components.map((component) =>
      component.id === this.moveId ? moved : component
    );
    const base: CircuitSnapshot = {
      components,
      wires: this.moveStart.wires
    };
    const rerouted = this.rerouteWiresForTerminalMove(base, original, moved);
    this.store.updateSilent((state) => {
      state.editor.components = structuredClone(rerouted.components);
      state.editor.wires = structuredClone(rerouted.wires);
    });
    this.pendingToggleId = null;
    return true;
  }

  endMove(clicked: boolean): void {
    const state = this.store.get();
    const id = this.moveId;
    const start = this.moveStart;
    if (!id || !start) {
      this.pendingToggleId = null;
      return;
    }
    const component = state.editor.components.find((item) => item.id === id);
    const original = start.components.find((item) => item.id === id);
    const moved = Boolean(
      component && original && (component.x !== original.x || component.y !== original.y)
    );
    let changed = false;

    if (!moved) {
      if (clicked && this.pendingToggleId && component?.kind === 'switch') {
        this.store.update((draft) => {
          draft.editor.components = draft.editor.components.map((item) =>
            item.id === id ? { ...item, closed: !(item.closed ?? false) } : item
          );
        });
        changed = true;
      } else {
        this.history.dropLast();
      }
    } else {
      changed = true;
    }

    this.moveStart = null;
    this.moveId = null;
    this.moveStartPoint = null;
    this.pendingToggleId = null;
    if (changed) this.options.onCircuitChange('edit');
  }

  moveSelectedBy(dx: number, dy: number): void {
    const state = this.store.get();
    if (state.editor.selection.kind !== 'component' || !state.editor.selection.id) return;
    const component = state.editor.components.find((item) => item.id === state.editor.selection.id);
    if (!component) return;
    this.beginMove(component.id);
    const moved = this.moveTo({ x: component.x + dx, y: component.y + dy });
    this.endMove(false);
    if (!moved) {
      this.store.toast('그 방향으로는 움직일 수 없습니다.', 'warn');
    }
  }

  rotateSelected(): void {
    const state = this.store.get();
    if (state.editor.selection.kind !== 'component' || !state.editor.selection.id) return;
    const component = state.editor.components.find((item) => item.id === state.editor.selection.id);
    if (!component) return;
    const rotation = ((component.rotation + 90) % 360) as Rotation;
    const placement = canPlaceComponent(
      state.editor.components,
      component.kind,
      { x: component.x, y: component.y },
      rotation,
      component.id
    );
    if (!placement.ok) {
      this.store.toast(placement.reasonKo ?? '회전할 공간이 없습니다.', 'warn');
      return;
    }
    const rotated: CircuitComponent = { ...component, rotation };
    const base: CircuitSnapshot = {
      components: state.editor.components.map((item) =>
        item.id === component.id ? rotated : item
      ),
      wires: state.editor.wires
    };
    const rerouted = this.rerouteWiresForTerminalMove(base, component, rotated);
    this.pushHistory();
    this.store.update((draft) => {
      draft.editor.components = structuredClone(rerouted.components);
      draft.editor.wires = structuredClone(rerouted.wires);
    });
    this.options.onCircuitChange('edit');
  }

  toggleSwitch(id: string, withHistory = true): void {
    const component = this.store.get().editor.components.find((item) => item.id === id);
    if (!component || component.kind !== 'switch') return;
    if (withHistory) this.pushHistory();
    this.store.update((state) => {
      state.editor.components = state.editor.components.map((item) =>
        item.id === id ? { ...item, closed: !(item.closed ?? false) } : item
      );
    });
    this.options.onCircuitChange('edit');
  }

  setValue(id: string, value: number): void {
    const component = this.store.get().editor.components.find((item) => item.id === id);
    if (!component) return;
    if (component.value === value) return;
    this.pushHistory();
    this.store.update((state) => {
      state.editor.components = state.editor.components.map((item) =>
        item.id === id ? { ...item, value } : item
      );
    });
    this.options.onCircuitChange('edit');
  }

  setClosed(id: string, closed: boolean): void {
    const component = this.store.get().editor.components.find((item) => item.id === id);
    if (!component || component.kind !== 'switch' || (component.closed ?? false) === closed) return;
    this.pushHistory();
    this.store.update((state) => {
      state.editor.components = state.editor.components.map((item) =>
        item.id === id ? { ...item, closed } : item
      );
    });
    this.options.onCircuitChange('edit');
  }

  deleteSelected(): void {
    const selection = this.store.get().editor.selection;
    if (selection.kind === 'component' && selection.id) this.deleteComponent(selection.id);
    else if (selection.kind === 'wire' && selection.id) this.deleteWire(selection.id);
  }

  deleteHit(hit: Hit): void {
    if (hit.kind === 'component') this.deleteComponent(hit.component.id);
    else if (hit.kind === 'terminal') this.deleteComponent(hit.terminal.componentId);
    else if (hit.kind === 'wire') this.deleteWire(hit.wire.id);
    else this.store.toast('삭제할 부품이나 전선을 클릭하세요.');
  }

  private deleteComponent(id: string): void {
    const state = this.store.get();
    const component = state.editor.components.find((item) => item.id === id);
    if (!component) return;
    this.pushHistory();
    const terminalPoints = getAllTerminals([component]).map((terminal) => ({
      x: terminal.x,
      y: terminal.y
    }));
    const wires: Wire[] = [];
    for (const wire of state.editor.wires) {
      let candidate: Wire | null = wire;
      for (const point of terminalPoints) {
        if (!candidate) break;
        candidate = trimEndpointAt(candidate, point);
      }
      if (candidate) wires.push(candidate);
    }
    this.store.update((draft) => {
      draft.editor.components = draft.editor.components.filter((item) => item.id !== id);
      draft.editor.wires = wires;
      draft.editor.selection = { kind: null, id: null };
      if (draft.editor.wireDraft) {
        const [start] = draft.editor.wireDraft;
        if (start && terminalPoints.some((point) => pointsEqual(point, start))) {
          draft.editor.wireDraft = null;
          draft.editor.keyboardWire = false;
        }
      }
    });
    this.options.onCircuitChange('edit');
  }

  private deleteWire(id: string): void {
    const state = this.store.get();
    if (!state.editor.wires.some((wire) => wire.id === id)) return;
    this.pushHistory();
    this.store.update((draft) => {
      draft.editor.wires = draft.editor.wires.filter((wire) => wire.id !== id);
      if (draft.editor.selection.kind === 'wire' && draft.editor.selection.id === id) {
        draft.editor.selection = { kind: null, id: null };
      }
    });
    this.options.onCircuitChange('edit');
  }

  handlePointerDown(hit: Hit, world: Point): void {
    const state = this.store.get();
    if (state.editor.armedKind) {
      this.placeArmedAt(state.editor.placementCursor ?? world);
      return;
    }
    if (state.editor.tool === 'delete') {
      this.deleteHit(hit);
      return;
    }
    if (state.editor.tool === 'pan') return;

    const draft = state.editor.wireDraft;
    if (draft) {
      if (hit.kind === 'terminal') {
        const point = { x: hit.terminal.x, y: hit.terminal.y };
        const last = draft[draft.length - 1];
        if (last && pointsEqual(last, point)) {
          this.cancelWire();
        } else {
          this.finishWire(point);
        }
        return;
      }
      if (hit.kind === 'wire') {
        this.finishWire(hit.point);
        return;
      }
      if (hit.kind === 'empty') {
        this.addWaypoint(hit.point);
        return;
      }
      this.store.toast('전선은 단자나 빈 격자 위를 지나야 합니다.');
      return;
    }

    if (state.editor.tool === 'wire') {
      if (hit.kind === 'terminal') {
        this.beginWire({ x: hit.terminal.x, y: hit.terminal.y });
      } else if (hit.kind === 'wire') {
        this.beginWire(hit.point);
      } else {
        this.store.toast('전선은 단자나 전선 위에서 시작하세요.');
      }
      return;
    }

    if (hit.kind === 'terminal') {
      this.beginWire({ x: hit.terminal.x, y: hit.terminal.y });
      this.select('component', hit.terminal.componentId);
      return;
    }
    if (hit.kind === 'component') {
      this.select('component', hit.component.id);
      this.beginMove(hit.component.id);
      return;
    }
    if (hit.kind === 'wire') {
      this.select('wire', hit.wire.id);
      return;
    }
    this.clearSelection();
  }

  startKeyboardWire(reverse = false): void {
    const state = this.store.get();
    if (state.editor.selection.kind !== 'component' || !state.editor.selection.id) {
      this.store.toast('먼저 전선을 시작할 부품을 선택하세요.', 'warn');
      return;
    }
    const component = state.editor.components.find((item) => item.id === state.editor.selection.id);
    if (!component) return;
    const terminals = getTerminals(component);
    const terminal = reverse ? terminals[terminals.length - 1] : terminals[0];
    if (!terminal) return;
    this.beginWire({ x: terminal.x, y: terminal.y }, true);
    const label =
      terminal.role === 'positive'
        ? '+극'
        : terminal.role === 'negative'
          ? '−극'
          : `${terminal.role.toUpperCase()} 단자`;
    this.store.toast(
      `${label}에서 전선을 시작합니다. 화살표로 이동하고 Enter로 경로를 추가하세요. 다른 단자에서 Enter를 누르면 연결됩니다.`
    );
  }

  private cycleSelection(reverse = false): void {
    const state = this.store.get();
    const components = state.editor.components;
    if (components.length === 0) {
      this.store.toast('선택할 부품이 없습니다.', 'warn');
      return;
    }
    const currentIndex =
      state.editor.selection.kind === 'component'
        ? components.findIndex((component) => component.id === state.editor.selection.id)
        : -1;
    const nextIndex =
      currentIndex < 0
        ? reverse
          ? components.length - 1
          : 0
        : (currentIndex + (reverse ? -1 : 1) + components.length) % components.length;
    this.select('component', components[nextIndex].id);
    this.store.toast(
      `${catalogItem(components[nextIndex].kind).labelKo} ${components[nextIndex].id} 선택`
    );
  }

  private finishKeyboardWire(): void {
    const state = this.store.get();
    if (!state.editor.wireDraft) return;
    const cursor =
      state.editor.placementCursor ?? state.editor.wireDraft[state.editor.wireDraft.length - 1];
    const hit = hitTest(state.editor.components, state.editor.wires, cursor, {
      terminalRadius: 0.35,
      wireRadius: 0.3
    });
    if (hit.kind === 'terminal') {
      this.finishWire({ x: hit.terminal.x, y: hit.terminal.y });
    } else if (hit.kind === 'wire') {
      this.finishWire(hit.point);
    } else {
      this.addWaypoint(cursor);
    }
  }

  handleKey(key: string, shift = false): boolean {
    const state = this.store.get();
    if (key === 'Escape') {
      if (state.editor.armedKind) {
        this.disarm();
        return true;
      }
      if (state.editor.wireDraft) {
        this.cancelWire();
        return true;
      }
      if (state.editor.selection.kind) {
        this.clearSelection();
        return true;
      }
      return false;
    }

    if (state.editor.armedKind) {
      const cursor = state.editor.placementCursor ?? { x: 20, y: 12 };
      if (key === 'ArrowLeft') {
        this.updatePlacementCursor({ x: cursor.x - 1, y: cursor.y });
        return true;
      }
      if (key === 'ArrowRight') {
        this.updatePlacementCursor({ x: cursor.x + 1, y: cursor.y });
        return true;
      }
      if (key === 'ArrowUp') {
        this.updatePlacementCursor({ x: cursor.x, y: cursor.y - 1 });
        return true;
      }
      if (key === 'ArrowDown') {
        this.updatePlacementCursor({ x: cursor.x, y: cursor.y + 1 });
        return true;
      }
      if (key === 'Enter') {
        this.placeArmedAt(cursor);
        return true;
      }
      return false;
    }

    if (state.editor.wireDraft && state.editor.keyboardWire) {
      const cursor = state.editor.placementCursor ??
        state.editor.wireDraft[state.editor.wireDraft.length - 1] ?? { x: 20, y: 12 };
      if (key === 'ArrowLeft') {
        this.store.update((draft) => {
          draft.editor.placementCursor = snapAndClamp({ x: cursor.x - 1, y: cursor.y });
        });
        return true;
      }
      if (key === 'ArrowRight') {
        this.store.update((draft) => {
          draft.editor.placementCursor = snapAndClamp({ x: cursor.x + 1, y: cursor.y });
        });
        return true;
      }
      if (key === 'ArrowUp') {
        this.store.update((draft) => {
          draft.editor.placementCursor = snapAndClamp({ x: cursor.x, y: cursor.y - 1 });
        });
        return true;
      }
      if (key === 'ArrowDown') {
        this.store.update((draft) => {
          draft.editor.placementCursor = snapAndClamp({ x: cursor.x, y: cursor.y + 1 });
        });
        return true;
      }
      if (key === 'Enter') {
        this.finishKeyboardWire();
        return true;
      }
      return false;
    }

    if (key === 'Delete' || key === 'Backspace') {
      if (state.editor.selection.kind) {
        this.deleteSelected();
        return true;
      }
      return false;
    }
    if (key === 'r' || key === 'R') {
      this.rotateSelected();
      return true;
    }
    if (key === 'w' || key === 'W') {
      this.startKeyboardWire(shift);
      return true;
    }
    if (key === 'n' || key === 'N') {
      this.cycleSelection(shift);
      return true;
    }
    if (
      key === 'Enter' &&
      state.editor.selection.kind === 'component' &&
      state.editor.selection.id
    ) {
      const component = state.editor.components.find(
        (item) => item.id === state.editor.selection.id
      );
      if (component?.kind === 'switch') {
        this.toggleSwitch(component.id);
        return true;
      }
    }
    if (state.editor.selection.kind === 'component' && state.editor.selection.id) {
      if (key === 'ArrowLeft') {
        this.moveSelectedBy(-1, 0);
        return true;
      }
      if (key === 'ArrowRight') {
        this.moveSelectedBy(1, 0);
        return true;
      }
      if (key === 'ArrowUp') {
        this.moveSelectedBy(0, -1);
        return true;
      }
      if (key === 'ArrowDown') {
        this.moveSelectedBy(0, 1);
        return true;
      }
    }
    return false;
  }
}
