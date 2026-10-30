import { computeWireFlows } from '../circuit/power';
import {
  componentBounds,
  componentFootprint,
  findJunctions,
  getAllTerminals,
  getTerminals,
  pointsEqual,
  wireLength
} from '../circuit/geometry';
import { GRID_CELL_PX } from '../circuit/constants';
import type { Point, SolveResult, Wire, WireFlow } from '../circuit/types';
import type { Store } from '../app/state';
import type { CircuitEditor } from '../editor/CircuitEditor';
import { WORLD_BOUNDS, snapAndClamp } from '../editor/grid';
import { hitTest, type Hit } from '../editor/hitTest';
import { canPlaceComponent, createComponent } from '../editor/placement';
import { appendOrthogonalPath } from '../editor/wiring';
import { buildWireGeometry, drawCurrentFlow, type WireGeometry } from './CurrentFlow';
import { drawComponent } from './drawComponents';
import { CANVAS_FONT, CANVAS_MONO, paletteFor, withAlpha, type Palette } from './theme';

type PointerMode = 'idle' | 'pan' | 'move' | 'wire';

interface PinchState {
  distance: number;
  worldMid: Point;
  zoom: number;
}

const MIN_ZOOM = 0.42;
const MAX_ZOOM = 2.8;

export class SchematicCanvas {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private store: Store;
  private editor: CircuitEditor;
  private camera = { x: 4, y: 2, zoom: 1 };
  private width = 0;
  private height = 0;
  private dpr = 1;
  private running = false;
  private active = true;
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private fitRequested = true;
  private hasUserView = false;
  private lastWidth = 0;
  private lastHeight = 0;
  private pointers = new Map<number, Point>();
  private primaryPointer: number | null = null;
  private mode: PointerMode = 'idle';
  private downScreen: Point = { x: 0, y: 0 };
  private panStartCamera = { x: 0, y: 0 };
  private moved = false;
  private pinch: PinchState | null = null;
  private hoverHit: Hit | null = null;
  private hoverWorld: Point | null = null;
  private spaceHeld = false;

  private lastResult: SolveResult | null = null;
  private lastComponents: unknown = null;
  private lastWires: unknown = null;
  private flows: WireFlow[] = [];
  private geometries = new Map<string, WireGeometry>();
  private junctions = findJunctions([]);
  private warningComponents = new Set<string>();
  private warningWires = new Set<string>();

  private boundPointerDown = (event: PointerEvent): void => this.onPointerDown(event);
  private boundPointerMove = (event: PointerEvent): void => this.onPointerMove(event);
  private boundPointerUp = (event: PointerEvent): void => this.onPointerUp(event);
  private boundWheel = (event: WheelEvent): void => this.onWheel(event);
  private boundKeyDown = (event: KeyboardEvent): void => this.onKeyDown(event);
  private boundKeyUp = (event: KeyboardEvent): void => this.onKeyUp(event);
  private boundVisibility = (): void => this.onVisibilityChange();

  constructor(canvas: HTMLCanvasElement, store: Store, editor: CircuitEditor) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    this.canvas = canvas;
    this.context = context;
    this.store = store;
    this.editor = editor;

    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('pointermove', this.boundPointerMove);
    canvas.addEventListener('pointerup', this.boundPointerUp);
    canvas.addEventListener('pointercancel', this.boundPointerUp);
    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    canvas.addEventListener('keydown', this.boundKeyDown);
    canvas.addEventListener('keyup', this.boundKeyUp);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('visibilitychange', this.boundVisibility);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.frame = requestAnimationFrame((time) => this.loop(time));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      this.resize();
      this.start();
    } else {
      this.stop();
    }
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    this.canvas.removeEventListener('pointermove', this.boundPointerMove);
    this.canvas.removeEventListener('pointerup', this.boundPointerUp);
    this.canvas.removeEventListener('pointercancel', this.boundPointerUp);
    this.canvas.removeEventListener('wheel', this.boundWheel);
    this.canvas.removeEventListener('keydown', this.boundKeyDown);
    this.canvas.removeEventListener('keyup', this.boundKeyUp);
    document.removeEventListener('visibilitychange', this.boundVisibility);
  }

  fitToCircuit(): void {
    const state = this.store.get();
    if (!this.width || !this.height) return;
    this.hasUserView = false;
    if (state.editor.components.length === 0) {
      this.camera = { x: 8, y: 3, zoom: 1.15 };
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const component of state.editor.components) {
      const bounds = componentBounds(component);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }
    for (const wire of state.editor.wires) {
      for (const point of wire.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
    const padding = 3.2;
    const spanX = Math.max(12, maxX - minX + padding * 2);
    const spanY = Math.max(8, maxY - minY + padding * 2);
    const scale = Math.min(this.width / spanX, this.height / spanY);
    const zoom = Math.max(MIN_ZOOM, Math.min(2.1, scale / GRID_CELL_PX));
    const effectiveScale = GRID_CELL_PX * zoom;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.camera = {
      x: centerX - this.width / (2 * effectiveScale),
      y: centerY - this.height / (2 * effectiveScale),
      zoom
    };
  }

  requestFit(): void {
    this.fitRequested = true;
    this.fitToCircuit();
    this.fitRequested = false;
  }

  zoomBy(factor: number): void {
    const center = { x: this.width / 2, y: this.height / 2 };
    this.zoomAt(center, factor);
  }

  resetView(): void {
    this.fitToCircuit();
  }

  private zoomAt(screen: Point, factor: number): void {
    this.hasUserView = true;
    const before = this.screenToWorld(screen);
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.zoom * factor));
    const scale = GRID_CELL_PX * zoom;
    this.camera.zoom = zoom;
    this.camera.x = before.x - screen.x / scale;
    this.camera.y = before.y - screen.y / scale;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.width = width;
    this.height = height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * this.dpr);
    const pixelHeight = Math.round(height * this.dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    const sizeChanged = width !== this.lastWidth || height !== this.lastHeight;
    this.lastWidth = width;
    this.lastHeight = height;
    if (this.fitRequested || (sizeChanged && !this.hasUserView && width > 1 && height > 1)) {
      this.fitToCircuit();
      this.fitRequested = false;
    }
    if (!this.running) this.draw(performance.now());
  }

  private loop(time: number): void {
    if (!this.running) return;
    if (document.hidden) {
      this.running = false;
      return;
    }
    this.draw(time);
    this.frame = requestAnimationFrame((next) => this.loop(next));
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.stop();
    } else if (this.active) {
      this.start();
    }
  }

  private screenToWorld(screen: Point): Point {
    const scale = GRID_CELL_PX * this.camera.zoom;
    return {
      x: this.camera.x + screen.x / scale,
      y: this.camera.y + screen.y / scale
    };
  }

  private eventScreen(event: PointerEvent | WheelEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private hitAt(world: Point): Hit {
    const state = this.store.get();
    const scale = GRID_CELL_PX * this.camera.zoom;
    const terminalRadius = Math.max(0.24, Math.min(0.62, 11 / scale));
    const wireRadius = Math.max(0.16, Math.min(0.42, 8 / scale));
    return hitTest(state.editor.components, state.editor.wires, world, {
      terminalRadius,
      wireRadius
    });
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
    const screen = this.eventScreen(event);
    this.pointers.set(event.pointerId, screen);
    this.canvas.setPointerCapture(event.pointerId);

    if (this.pointers.size === 2) {
      const points = [...this.pointers.values()];
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      this.pinch = {
        distance: Math.max(1, distance),
        worldMid: this.screenToWorld(midpoint),
        zoom: this.camera.zoom
      };
      this.hasUserView = true;
      this.mode = 'idle';
      event.preventDefault();
      return;
    }
    if (this.pointers.size > 2) return;

    this.primaryPointer = event.pointerId;
    this.downScreen = screen;
    const world = this.screenToWorld(screen);
    this.moved = false;
    this.hoverWorld = world;
    this.hoverHit = this.hitAt(world);

    const state = this.store.get();
    const middleButton = event.pointerType === 'mouse' && event.button === 1;
    if (middleButton || this.spaceHeld || state.editor.tool === 'pan') {
      this.mode = 'pan';
      this.hasUserView = true;
      this.panStartCamera = { x: this.camera.x, y: this.camera.y };
      event.preventDefault();
      return;
    }

    if (state.editor.armedKind) {
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = 'idle';
      event.preventDefault();
      return;
    }

    if (state.editor.tool === 'delete') {
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = 'idle';
      event.preventDefault();
      return;
    }

    if (state.editor.tool === 'wire') {
      const hadDraft = Boolean(state.editor.wireDraft);
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = !hadDraft && this.store.get().editor.wireDraft ? 'wire' : 'idle';
      event.preventDefault();
      return;
    }

    if (this.hoverHit.kind === 'component') {
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = 'move';
    } else if (this.hoverHit.kind === 'terminal') {
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = 'wire';
    } else if (this.hoverHit.kind === 'wire') {
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = 'idle';
    } else if (state.editor.wireDraft) {
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = 'idle';
    } else {
      this.editor.handlePointerDown(this.hoverHit, world);
      this.mode = 'pan';
      this.hasUserView = true;
      this.panStartCamera = { x: this.camera.x, y: this.camera.y };
    }
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent): void {
    const screen = this.eventScreen(event);
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, screen);

    if (this.pinch && this.pointers.size >= 2) {
      const points = [...this.pointers.values()];
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const factor = distance / this.pinch.distance;
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinch.zoom * factor));
      const scale = GRID_CELL_PX * zoom;
      this.camera.zoom = zoom;
      this.camera.x = this.pinch.worldMid.x - midpoint.x / scale;
      this.camera.y = this.pinch.worldMid.y - midpoint.y / scale;
      event.preventDefault();
      return;
    }

    const world = this.screenToWorld(screen);
    this.hoverWorld = world;
    this.hoverHit = this.hitAt(world);
    const state = this.store.get();

    if (state.editor.armedKind) {
      this.editor.updatePlacementCursor(world);
    }

    const distance = Math.hypot(screen.x - this.downScreen.x, screen.y - this.downScreen.y);
    if (distance > 3) this.moved = true;

    if (this.mode === 'pan') {
      const scale = GRID_CELL_PX * this.camera.zoom;
      this.camera.x = this.panStartCamera.x - (screen.x - this.downScreen.x) / scale;
      this.camera.y = this.panStartCamera.y - (screen.y - this.downScreen.y) / scale;
      event.preventDefault();
      return;
    }

    if (this.mode === 'move' && this.moved) {
      this.editor.moveTo(world);
      event.preventDefault();
      return;
    }

    if (this.mode === 'wire' && this.moved) {
      event.preventDefault();
    }
  }

  private onPointerUp(event: PointerEvent): void {
    const screen = this.eventScreen(event);
    this.pointers.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }

    if (this.pinch) {
      if (this.pointers.size < 2) {
        this.pinch = null;
        this.mode = 'idle';
        this.moved = false;
      }
      return;
    }

    if (this.primaryPointer !== event.pointerId) return;
    const state = this.store.get();
    const world = this.screenToWorld(screen);
    const hit = this.hitAt(world);

    if (this.mode === 'move') {
      this.editor.endMove(!this.moved);
    } else if (this.mode === 'wire' && this.moved) {
      const draft = state.editor.wireDraft;
      const start = draft?.[0];
      if (hit.kind === 'terminal') {
        const point = { x: hit.terminal.x, y: hit.terminal.y };
        if (start && pointsEqual(start, point)) this.editor.cancelWire();
        else this.editor.finishWire(point);
      } else if (hit.kind === 'wire') {
        this.editor.finishWire(hit.point);
      } else {
        this.editor.cancelWire();
      }
    }

    this.mode = 'idle';
    this.primaryPointer = null;
    this.moved = false;
    this.hoverWorld = world;
    this.hoverHit = hit;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const screen = this.eventScreen(event);
    const factor = Math.exp(-event.deltaY * 0.0012);
    this.zoomAt(screen, factor);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spaceHeld = true;
      this.canvas.classList.add('is-panning');
      event.preventDefault();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spaceHeld = false;
      this.canvas.classList.remove('is-panning');
    }
  }

  private ensureCache(): void {
    const state = this.store.get();
    const result = state.simulation.result;
    if (
      result === this.lastResult &&
      state.editor.components === this.lastComponents &&
      state.editor.wires === this.lastWires
    ) {
      return;
    }
    this.lastResult = result;
    this.lastComponents = state.editor.components;
    this.lastWires = state.editor.wires;
    this.geometries = new Map(state.editor.wires.map((wire) => [wire.id, buildWireGeometry(wire)]));
    this.junctions = findJunctions(state.editor.wires);
    this.warningComponents = new Set();
    this.warningWires = new Set();
    if (result) {
      for (const warning of result.warnings) {
        for (const id of warning.componentIds) this.warningComponents.add(id);
        for (const id of warning.wireIds ?? []) this.warningWires.add(id);
      }
      this.flows = computeWireFlows(
        { components: state.editor.components, wires: state.editor.wires },
        result
      );
    } else {
      this.flows = [];
    }
  }

  private draw(timeMs: number): void {
    const state = this.store.get();
    const palette = paletteFor(state.preferences.theme);
    const ctx = this.context;
    const scale = GRID_CELL_PX * this.camera.zoom;
    this.ensureCache();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.translate(-this.camera.x * scale, -this.camera.y * scale);
    ctx.scale(scale, scale);

    if (state.preferences.overlays.grid) this.drawGrid(ctx, palette, scale);
    const invalid = this.hasInvalidCircuit(state.simulation.result);
    this.drawWires(ctx, state, palette, scale, invalid);
    this.drawJunctions(ctx, palette, state);
    if (
      !invalid &&
      state.simulation.running &&
      state.preferences.overlays.current &&
      this.mode !== 'move'
    ) {
      drawCurrentFlow(
        ctx,
        this.flows,
        this.geometries,
        timeMs / 1000,
        palette,
        scale,
        state.preferences.reducedMotion
      );
    }
    this.drawComponents(ctx, state, palette, scale);
    this.drawDraft(ctx, state, palette, scale);
    this.drawGhost(ctx, state, palette, scale);
    this.drawEmptyState(ctx, state, palette, scale);
    if (!state.simulation.running) this.drawPausedBadge(ctx, palette, scale);
  }

  private hasInvalidCircuit(result: SolveResult | null): boolean {
    if (!result || !result.solved) return true;
    return result.warnings.some((warning) =>
      ['short', 'solver', 'no-battery', 'open'].includes(warning.code)
    );
  }

  private drawGrid(ctx: CanvasRenderingContext2D, palette: Palette, scale: number): void {
    const left = this.camera.x;
    const top = this.camera.y;
    const right = left + this.width / scale;
    const bottom = top + this.height / scale;
    const startX = Math.floor(left);
    const endX = Math.ceil(right);
    const startY = Math.floor(top);
    const endY = Math.ceil(bottom);

    if (scale >= 9) {
      ctx.beginPath();
      for (let x = startX; x <= endX; x += 1) {
        if (x % 5 === 0) continue;
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
      }
      for (let y = startY; y <= endY; y += 1) {
        if (y % 5 === 0) continue;
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.strokeStyle = palette.gridLine;
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    }

    ctx.beginPath();
    for (let x = Math.ceil(startX / 5) * 5; x <= endX; x += 5) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.ceil(startY / 5) * 5; y <= endY; y += 5) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.strokeStyle = palette.gridMajor;
    ctx.lineWidth = 1.2 / scale;
    ctx.stroke();
  }

  private drawWires(
    ctx: CanvasRenderingContext2D,
    state: ReturnType<Store['get']>,
    palette: Palette,
    scale: number,
    invalid: boolean
  ): void {
    const selectedId = state.editor.selection.kind === 'wire' ? state.editor.selection.id : null;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const wire of state.editor.wires) {
      if (wire.points.length < 2) continue;
      const warning = this.warningWires.has(wire.id);
      const selected = wire.id === selectedId;
      const color = warning
        ? palette.warning
        : selected
          ? palette.accent
          : invalid
            ? palette.wireMuted
            : palette.wire;

      ctx.beginPath();
      ctx.moveTo(wire.points[0].x, wire.points[0].y);
      for (let index = 1; index < wire.points.length; index += 1) {
        const point = wire.points[index];
        ctx.lineTo(point.x, point.y);
      }

      ctx.strokeStyle = palette.paper;
      ctx.lineWidth = 7 / scale;
      ctx.stroke();

      if (selected) {
        ctx.strokeStyle = withAlpha(palette.accent, 0.18);
        ctx.lineWidth = 10 / scale;
        ctx.stroke();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = (warning ? 4.2 : 3.5) / scale;
      ctx.setLineDash(warning ? [7 / scale, 5 / scale] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawJunctions(
    ctx: CanvasRenderingContext2D,
    palette: Palette,
    state: ReturnType<Store['get']>
  ): void {
    for (const junction of this.junctions) {
      ctx.beginPath();
      ctx.arc(junction.x, junction.y, 0.16, 0, Math.PI * 2);
      ctx.fillStyle = palette.paper;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(junction.x, junction.y, 0.095, 0, Math.PI * 2);
      ctx.fillStyle = state.preferences.theme === 'dark' ? palette.ink : palette.wire;
      ctx.fill();
    }
  }

  private drawComponents(
    ctx: CanvasRenderingContext2D,
    state: ReturnType<Store['get']>,
    palette: Palette,
    scale: number
  ): void {
    const result = state.simulation.result;
    const selectedId =
      state.editor.selection.kind === 'component' ? state.editor.selection.id : null;
    for (const component of state.editor.components) {
      const componentState = result?.componentStates.get(component.id);
      drawComponent(ctx, component, {
        palette,
        scale,
        labels: state.preferences.overlays.labels,
        voltages: state.preferences.overlays.voltages,
        selected: component.id === selectedId,
        state: componentState
      });
      if (this.warningComponents.has(component.id)) {
        this.drawWarningBadge(ctx, component, palette, scale);
      }
    }

    const hoveredTerminal = this.hoverHit?.kind === 'terminal' ? this.hoverHit.terminal.id : null;
    for (const component of state.editor.components) {
      const selected = component.id === selectedId;
      for (const terminal of getTerminals(component)) {
        const hovered = terminal.id === hoveredTerminal;
        ctx.beginPath();
        ctx.arc(terminal.x, terminal.y, hovered ? 0.15 : selected ? 0.09 : 0.065, 0, Math.PI * 2);
        ctx.fillStyle = hovered ? palette.accent : palette.paper;
        ctx.fill();
        ctx.strokeStyle = hovered || selected ? palette.accent : palette.inkSoft;
        ctx.lineWidth = (hovered ? 2 : 1) / scale;
        ctx.stroke();
      }
    }

    if (this.hoverHit?.kind === 'component' && this.mode === 'idle') {
      const bounds = componentBounds(this.hoverHit.component);
      ctx.strokeStyle = withAlpha(palette.accent, 0.5);
      ctx.lineWidth = 1.2 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.strokeRect(
        bounds.minX - 0.16,
        bounds.minY - 0.16,
        bounds.maxX - bounds.minX + 0.32,
        bounds.maxY - bounds.minY + 0.32
      );
      ctx.setLineDash([]);
    }
  }

  private drawWarningBadge(
    ctx: CanvasRenderingContext2D,
    component: ReturnType<Store['get']>['editor']['components'][number],
    palette: Palette,
    scale: number
  ): void {
    const bounds = componentBounds(component);
    ctx.save();
    ctx.strokeStyle = palette.warning;
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([6 / scale, 4 / scale]);
    ctx.strokeRect(
      bounds.minX - 0.2,
      bounds.minY - 0.2,
      bounds.maxX - bounds.minX + 0.4,
      bounds.maxY - bounds.minY + 0.4
    );
    ctx.setLineDash([]);
    const badgeX = bounds.maxX + 0.28;
    const badgeY = bounds.minY - 0.24;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 0.18, 0, Math.PI * 2);
    ctx.fillStyle = palette.warning;
    ctx.fill();
    ctx.fillStyle = palette.paper;
    ctx.font = `700 ${12 / scale}px ${CANVAS_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', badgeX, badgeY + 0.5 / scale);
    ctx.restore();
  }

  private drawDraft(
    ctx: CanvasRenderingContext2D,
    state: ReturnType<Store['get']>,
    palette: Palette,
    scale: number
  ): void {
    const draft = state.editor.wireDraft;
    if (!draft || draft.length === 0) return;
    const cursor =
      state.editor.keyboardWire && state.editor.placementCursor
        ? state.editor.placementCursor
        : this.hoverWorld;
    let preview = draft;
    if (cursor) {
      const last = draft[draft.length - 1];
      if (!last || !pointsEqual(last, cursor)) {
        preview = appendOrthogonalPath(draft, snapAndClamp(cursor));
      }
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(preview[0].x, preview[0].y);
    for (let index = 1; index < preview.length; index += 1) {
      ctx.lineTo(preview[index].x, preview[index].y);
    }
    ctx.strokeStyle = withAlpha(palette.accent, 0.18);
    ctx.lineWidth = 8 / scale;
    ctx.stroke();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([6 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const point of draft) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 0.1, 0, Math.PI * 2);
      ctx.fillStyle = palette.accent;
      ctx.fill();
    }
    const end = preview[preview.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, 0.14, 0, Math.PI * 2);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    if (state.editor.keyboardWire && state.editor.placementCursor) {
      const cursorPoint = state.editor.placementCursor;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.6 / scale;
      ctx.strokeRect(cursorPoint.x - 0.2, cursorPoint.y - 0.2, 0.4, 0.4);
      ctx.beginPath();
      ctx.moveTo(cursorPoint.x - 0.32, cursorPoint.y);
      ctx.lineTo(cursorPoint.x + 0.32, cursorPoint.y);
      ctx.moveTo(cursorPoint.x, cursorPoint.y - 0.32);
      ctx.lineTo(cursorPoint.x, cursorPoint.y + 0.32);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGhost(
    ctx: CanvasRenderingContext2D,
    state: ReturnType<Store['get']>,
    palette: Palette,
    scale: number
  ): void {
    const kind = state.editor.armedKind;
    const cursor = state.editor.placementCursor;
    if (!kind || !cursor) return;
    const ghost = createComponent('__ghost__', kind, cursor);
    const placement = canPlaceComponent(state.editor.components, kind, cursor, 0);
    const footprint = componentFootprint(ghost);
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawComponent(ctx, ghost, {
      palette,
      scale,
      labels: true,
      voltages: false,
      selected: false
    });
    ctx.globalAlpha = 1;
    ctx.setLineDash([5 / scale, 4 / scale]);
    ctx.strokeStyle = placement.ok ? palette.accent : palette.warning;
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeRect(
      footprint.minX,
      footprint.minY,
      footprint.maxX - footprint.minX,
      footprint.maxY - footprint.minY
    );
    ctx.setLineDash([]);
    if (!placement.ok) {
      ctx.strokeStyle = palette.warning;
      ctx.beginPath();
      ctx.moveTo(cursor.x - 0.35, cursor.y - 0.35);
      ctx.lineTo(cursor.x + 0.35, cursor.y + 0.35);
      ctx.moveTo(cursor.x + 0.35, cursor.y - 0.35);
      ctx.lineTo(cursor.x - 0.35, cursor.y + 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEmptyState(
    ctx: CanvasRenderingContext2D,
    state: ReturnType<Store['get']>,
    palette: Palette,
    scale: number
  ): void {
    if (state.editor.components.length > 0) return;
    const centerX = this.camera.x + this.width / (2 * scale);
    const centerY = this.camera.y + this.height / (2 * scale);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.muted;
    ctx.font = `600 ${16 / scale}px ${CANVAS_FONT}`;
    ctx.fillText('부품을 골라 작업대를 클릭하세요', centerX, centerY - 0.4);
    ctx.font = `400 ${11 / scale}px ${CANVAS_FONT}`;
    ctx.fillText('왼쪽 부품함 · Tab으로 이동 · Enter로 배치', centerX, centerY + 0.6);
    ctx.restore();
  }

  private drawPausedBadge(ctx: CanvasRenderingContext2D, palette: Palette, scale: number): void {
    const x = this.camera.x + 0.9;
    const y = this.camera.y + 0.9;
    ctx.save();
    ctx.font = `600 ${10 / scale}px ${CANVAS_MONO}`;
    const width = ctx.measureText('일시정지').width + 12 / scale;
    ctx.beginPath();
    ctx.roundRect(x, y, width, 18 / scale, 3 / scale);
    ctx.fillStyle = palette.ink;
    ctx.fill();
    ctx.fillStyle = palette.paper;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('일시정지', x + 6 / scale, y + 9.5 / scale);
    ctx.restore();
  }

  // Kept for tests and screenshot tooling.
  getCamera(): { x: number; y: number; zoom: number } {
    return { ...this.camera };
  }

  worldToScreen(point: Point): Point {
    const scale = GRID_CELL_PX * this.camera.zoom;
    return {
      x: (point.x - this.camera.x) * scale,
      y: (point.y - this.camera.y) * scale
    };
  }

  wireScreenLength(wire: Wire): number {
    return wireLength(wire) * GRID_CELL_PX * this.camera.zoom;
  }

  getWorldBounds(): typeof WORLD_BOUNDS {
    return WORLD_BOUNDS;
  }

  getHoverTerminalIds(): string[] {
    return getAllTerminals(this.store.get().editor.components).map((terminal) => terminal.id);
  }

  sampleFlowPoint(wireId: string, fraction: number): Point | null {
    const geometry = this.geometries.get(wireId);
    if (!geometry) return null;
    const total = geometry.total;
    const fromStart = Math.max(0, Math.min(1, fraction)) * total;
    let distance = 0;
    for (let index = 0; index < geometry.points.length - 1; index += 1) {
      const a = geometry.points[index];
      const b = geometry.points[index + 1];
      const segment = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      if (distance + segment >= fromStart) {
        const t = segment > 0 ? (fromStart - distance) / segment : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      distance += segment;
    }
    const last = geometry.points[geometry.points.length - 1];
    return last ? { ...last } : null;
  }
}
