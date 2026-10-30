import { solveCircuit } from '../circuit/solve';
import type { Circuit, CircuitWarning, ComponentKind, SolveResult } from '../circuit/types';
import { formatCurrent, formatPower, formatVoltage } from '../circuit/units';
import { createPreset, PRESET_META, type PresetKey } from '../data/presets';
import { MISSIONS, missionById } from '../data/missions';
import { CircuitEditor } from '../editor/CircuitEditor';
import { evaluateTarget } from '../features/missions/checks';
import { renderMissionList, renderMissionStrip } from '../features/missions/MissionPanel';
import { renderInspector } from '../features/inspector/InspectorView';
import { describeCircuitShort } from '../features/inspector/summary';
import { renderTeacher } from '../features/teacher/TeacherView';
import { renderCircuitPreview } from '../render/preview';
import { Scene3D } from '../render/Scene3D';
import { SchematicCanvas } from '../render/SchematicCanvas';
import {
  clearProgress,
  loadCircuitSnapshot,
  loadProgress,
  saveCircuitSnapshot,
  saveProgress
} from '../storage/progress';
import { renderTray } from '../ui/TrayView';
import { esc } from '../ui/escape';
import { icon } from '../ui/icons';
import type { AppActions, AppContext } from './context';
import {
  createInitialState,
  emptyMissionProgress,
  missionProgress,
  progressData,
  Store,
  type AppState,
  type EditorTool,
  type Route
} from './state';

const SHELL = `
  <div class="app-frame" id="app-frame" data-route="workbench" data-theme="light">
    <header class="topbar">
      <button class="brand" type="button" data-action="go-workbench" aria-label="VoltWorks 작업대">
        <span class="brand-mark">V</span>
        <span class="brand-text"><strong>VoltWorks</strong><small>전기 회로 작업대</small></span>
      </button>
      <nav class="main-nav" aria-label="주요 화면">
        <button type="button" data-route="workbench" data-nav="workbench">작업대</button>
        <button type="button" data-route="missions" data-nav="missions">미션 <span class="nav-count" id="mission-count">0/6</span></button>
        <button type="button" data-route="teacher" data-nav="teacher">교사용</button>
      </nav>
      <div class="topbar-actions" id="topbar-actions"></div>
    </header>

    <main class="workbench-view" id="workbench-view">
      <aside class="panel tray-panel" id="tray-panel" aria-label="부품함">
        <header class="panel-head">
          <div><div class="section-kicker">Parts</div><h2>부품함</h2></div>
          <button class="icon-btn drawer-close" type="button" data-action="close-drawer" aria-label="부품함 닫기">${icon('close', 16)}</button>
        </header>
        <div id="tray" class="panel-scroll"></div>
      </aside>

      <section class="stage" aria-label="회로 작업대">
        <div class="stage-toolbar">
          <div class="tool-group" role="toolbar" aria-label="편집 도구" id="tool-group">
            <button class="tool-btn" type="button" data-action="set-tool" data-tool="select" aria-pressed="true" title="선택">${icon('cursor', 16)}<span>선택</span></button>
            <button class="tool-btn" type="button" data-action="set-tool" data-tool="wire" aria-pressed="false" title="전선">${icon('wire', 16)}<span>전선</span></button>
            <button class="tool-btn" type="button" data-action="set-tool" data-tool="delete" aria-pressed="false" title="삭제">${icon('trash', 16)}<span>삭제</span></button>
            <button class="tool-btn" type="button" data-action="set-tool" data-tool="pan" aria-pressed="false" title="이동">${icon('hand', 16)}<span>이동</span></button>
          </div>
          <div class="stage-toolbar-spacer"></div>
          <details class="toolbar-menu" id="overlay-menu">
            <summary class="tool-btn" aria-label="표시 설정" title="표시 설정">${icon('grid', 16)}<span>표시</span></summary>
            <div class="toolbar-pop" role="group" aria-label="표시 설정">
              <label><input type="checkbox" data-overlay="current" /> 전류 입자</label>
              <label><input type="checkbox" data-overlay="voltages" /> 전압 배지</label>
              <label><input type="checkbox" data-overlay="labels" /> 부품 라벨</label>
              <label><input type="checkbox" data-overlay="grid" /> 격자</label>
            </div>
          </details>
          <div class="zoom-group" role="group" aria-label="확대와 이동">
            <button class="icon-btn" type="button" data-action="zoom-out" aria-label="축소">${icon('minus', 15)}</button>
            <button class="icon-btn" type="button" data-action="fit-canvas" aria-label="화면 맞춤">${icon('fit', 15)}</button>
            <button class="icon-btn" type="button" data-action="zoom-in" aria-label="확대">${icon('plus', 15)}</button>
          </div>
          <button class="btn btn--small drawer-open" type="button" data-action="open-drawer" data-drawer="left">부품</button>
          <button class="btn btn--small drawer-open" type="button" data-action="open-drawer" data-drawer="right">측정</button>
        </div>

        <div class="canvas-wrap" id="canvas-wrap">
          <canvas id="schematic" tabindex="0" aria-label="회로 작업대" aria-describedby="circuit-description"></canvas>
          <div class="tabletop-host" id="tabletop-host" aria-label="3D 회로 보기"></div>
          <div class="tabletop-hint" role="note">드래그 회전 · 휠 확대 · 편집은 2D 보기</div>
          <div class="canvas-notice" role="note">
            <span class="notice-dot" aria-hidden="true"></span>
            <span>이상적 부품 모델 · 교육용 저전압</span>
            <button class="link-btn" type="button" data-action="open-help">모델 안내</button>
          </div>
          <div class="canvas-hint" id="canvas-hint"></div>
          <div class="toast" id="toast" role="status" aria-live="polite"></div>
          <div class="drawer-backdrop" data-action="close-drawer"></div>
        </div>

        <section class="mission-strip" id="mission-strip" aria-label="미션"></section>
      </section>

      <aside class="panel inspector-panel" id="inspector-panel" aria-label="측정 패널">
        <header class="panel-head">
          <div><div class="section-kicker">Measure</div><h2>측정 패널</h2></div>
          <button class="icon-btn drawer-close" type="button" data-action="close-drawer" aria-label="측정 패널 닫기">${icon('close', 16)}</button>
        </header>
        <div id="inspector" class="panel-scroll"></div>
      </aside>
    </main>

    <section class="route-view" id="route-view" aria-live="polite"></section>

    <nav class="mobile-tabs" aria-label="모바일 패널">
      <button type="button" data-action="mobile-panel" data-panel="parts">${icon('battery', 18)}<span>부품</span></button>
      <button type="button" data-action="mobile-panel" data-panel="inspect">${icon('ammeter', 18)}<span>측정</span></button>
      <button type="button" data-action="mobile-panel" data-panel="mission">${icon('list', 18)}<span>미션</span></button>
    </nav>

    <dialog id="help-dialog" class="dialog" aria-labelledby="help-title">
      <div class="dialog-head">
        <div><div class="section-kicker">안내</div><h2 id="help-title">VoltWorks 사용법</h2></div>
        <button class="icon-btn" type="button" data-action="close-help" aria-label="도움말 닫기">${icon('close', 16)}</button>
      </div>
      <div class="dialog-body">
        <section>
          <h3>회로 만들기</h3>
          <ol>
            <li>왼쪽 부품함에서 부품을 고른 뒤 작업대를 클릭하세요. Tab과 Enter로도 놓을 수 있습니다.</li>
            <li>부품의 단자를 클릭하고, 빈 격자를 거쳐 다른 단자를 클릭하면 전선이 이어집니다.</li>
            <li>스위치를 클릭하면 열고 닫을 수 있습니다. 선택한 부품은 R로 회전하고 Delete로 지웁니다.</li>
          </ol>
        </section>
        <section>
          <h3>계측기</h3>
          <p>전류계는 회로와 직렬로, 전압계는 측정할 부품과 나란히 연결합니다. 연결이 잘못되면 경고 카드가 나타납니다.</p>
        </section>
        <section>
          <h3>키보드</h3>
          <p><kbd>Tab</kbd> 부품함과 작업대 이동 · <kbd>Enter</kbd> 놓기/연결 · <kbd>←↑↓→</kbd> 이동 · <kbd>N</kbd> 다음 부품 (<kbd>Shift</kbd>+<kbd>N</kbd> 이전) · <kbd>W</kbd> 전선 시작 (<kbd>Shift</kbd>+<kbd>W</kbd> 반대 단자) · <kbd>R</kbd> 회전 · <kbd>Delete</kbd> 삭제 · <kbd>Esc</kbd> 취소</p>
        </section>
        <section>
          <h3>이상적 부품 모델</h3>
          <p>전선 0Ω, 전류계 0Ω, 전압계 1GΩ, 전구는 일정 저항 15Ω으로 계산합니다. 교육용 저전압 회로만 다루며 실제 배선의 안전을 보증하지 않습니다.</p>
        </section>
        <section class="dialog-preferences">
          <h3>접근성</h3>
          <label class="check-row">
            <input type="checkbox" data-action="toggle-reduced-motion" id="reduced-motion-toggle" />
            <span>애니메이션 줄이기 (전류 입자 대신 정지 화살표)</span>
          </label>
          <p class="mini-note">운영체제의 “동작 줄이기” 설정도 자동으로 반영됩니다.</p>
        </section>
      </div>
    </dialog>

    <div id="sr-status" class="sr-only" aria-live="polite"></div>
    <p id="circuit-description" class="sr-only"></p>
  </div>
`;

function focusKeyOf(element: Element | null): string | null {
  if (!element || !(element instanceof HTMLElement)) return null;
  return element.dataset.focusKey ?? null;
}

export class App {
  private root: HTMLElement;
  private store: Store;
  private editor: CircuitEditor;
  private renderer: SchematicCanvas;
  private scene3d: Scene3D | null = null;
  private actions: AppActions;
  private context: AppContext;
  private lastMissionId: string | null = null;
  private lastAnnouncedResult: SolveResult | null = null;
  private saveTimer: number | null = null;
  private renderScheduled = false;

  private frame: HTMLElement;
  private topbarActions: HTMLElement;
  private tray: HTMLElement;
  private inspector: HTMLElement;
  private missionStrip: HTMLElement;
  private routeView: HTMLElement;
  private toast: HTMLElement;
  private canvasHint: HTMLElement;
  private canvas: HTMLCanvasElement;
  private tabletopHost: HTMLElement;
  private helpDialog: HTMLDialogElement;
  private circuitDescription: HTMLElement;
  private srStatus: HTMLElement;

  private boundClick = (event: MouseEvent): void => this.onClick(event);
  private boundChange = (event: Event): void => this.onChange(event);
  private boundKeyDown = (event: KeyboardEvent): void => this.onKeyDown(event);
  private boundCanvasPointer = (): void => {
    const open = this.root.querySelector<HTMLDetailsElement>('details[open]');
    if (open) open.open = false;
  };

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = SHELL;

    const progress = loadProgress();
    this.lastMissionId = progress.lastMissionId;
    this.store = new Store(createInitialState(progress));
    this.editor = new CircuitEditor(this.store, {
      onCircuitChange: (reason) => this.onCircuitChange(reason)
    });

    this.canvas = this.must<HTMLCanvasElement>('#schematic');
    this.tabletopHost = this.must('#tabletop-host');
    this.frame = this.must('#app-frame');
    this.topbarActions = this.must('#topbar-actions');
    this.tray = this.must('#tray');
    this.inspector = this.must('#inspector');
    this.missionStrip = this.must('#mission-strip');
    this.routeView = this.must('#route-view');
    this.toast = this.must('#toast');
    this.canvasHint = this.must('#canvas-hint');
    this.helpDialog = this.must<HTMLDialogElement>('#help-dialog');
    this.circuitDescription = this.must('#circuit-description');
    this.srStatus = this.must('#sr-status');

    this.renderer = new SchematicCanvas(this.canvas, this.store, this.editor);
    this.actions = this.createActions();
    this.context = {
      store: this.store,
      editor: this.editor,
      renderer: this.renderer,
      scene3d: null,
      actions: this.actions
    };

    this.bindEvents();
    this.store.subscribe(() => this.scheduleRender());

    const saved = loadCircuitSnapshot('workbench');
    this.editor.load(saved ?? createPreset('starter'));
    this.renderer.requestFit();
    this.syncActiveViews();
    this.render();
    this.saveProgressNow();
    this.exposeTestBridge();
  }

  destroy(): void {
    this.renderer.destroy();
    this.scene3d?.destroy();
    this.root.removeEventListener('click', this.boundClick);
    this.root.removeEventListener('change', this.boundChange);
    window.removeEventListener('keydown', this.boundKeyDown);
    this.canvas.removeEventListener('pointerdown', this.boundCanvasPointer);
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveWorkbenchSnapshotNow();
    this.saveProgressNow();
  }

  private must<T extends Element = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }

  private createActions(): AppActions {
    return {
      setRoute: (route) => this.setRoute(route),
      startMission: (id) => this.startMission(id),
      exitMission: () => this.exitMission(),
      measure: () => this.measure(),
      setPrediction: (id) => this.setPrediction(id),
      answerExplanation: (id) => this.answerExplanation(id),
      nextStage: () => this.nextStage(),
      restartMission: () => this.restartMission(),
      nextMission: () => this.nextMission(),
      newCircuit: () => this.newCircuit(),
      loadPreset: (key) => this.loadPreset(key),
      setTool: (tool) => this.editor.setTool(tool),
      arm: (kind) => this.arm(kind),
      setPlacementValue: (kind, value) => this.setPlacementValue(kind, value),
      undo: () => this.editor.undo(),
      redo: () => this.editor.redo(),
      toggleRun: () => this.toggleRun(),
      setView: (view) => this.setView(view),
      toggleOverlay: (key) => this.toggleOverlay(key),
      setTheme: (theme) => this.setTheme(theme),
      rotateSelected: () => this.editor.rotateSelected(),
      deleteSelected: () => this.editor.deleteSelected(),
      setValue: (id, value) => this.editor.setValue(id, value),
      setClosed: (id, closed) => this.editor.setClosed(id, closed),
      openHelp: () => this.openHelp(),
      closeHelp: () => this.closeHelp(),
      openDrawer: (drawer) =>
        this.store.update((state) => {
          state.ui.drawer = drawer;
        }),
      setMobilePanel: (panel) =>
        this.store.update((state) => {
          state.ui.mobilePanel = panel;
        }),
      resetProgress: () => this.resetProgress(),
      printWorksheet: () => this.printWorksheet(),
      toggleTeacherReveal: () =>
        this.store.update((state) => {
          state.ui.teacherReveal = !state.ui.teacherReveal;
        }),
      selectWarning: (warning) => this.selectWarning(warning),
      focusCanvas: () => this.canvas.focus({ preventScroll: true }),
      fitCanvas: () => this.fitCanvas(),
      zoomBy: (factor) => this.renderer.zoomBy(factor)
    };
  }

  private bindEvents(): void {
    this.root.addEventListener('click', this.boundClick);
    this.root.addEventListener('change', this.boundChange);
    window.addEventListener('keydown', this.boundKeyDown);
    this.canvas.addEventListener('pointerdown', this.boundCanvasPointer);
    this.helpDialog.addEventListener('close', () => {
      if (this.store.get().ui.helpOpen) {
        this.store.update((state) => {
          state.ui.helpOpen = false;
        });
      }
    });
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '[data-action], [data-kind], [data-route]'
    );
    if (!target) return;

    if (target.dataset.route) {
      this.setRoute(target.dataset.route as Route);
      return;
    }
    if (target.dataset.kind) {
      this.arm(target.dataset.kind as ComponentKind);
      return;
    }

    const action = target.dataset.action;
    if (!action) return;
    if (action === 'prediction' || action === 'explanation') return;

    switch (action) {
      case 'go-workbench':
        this.setRoute('workbench');
        break;
      case 'go-missions':
        this.setRoute('missions');
        break;
      case 'go-teacher':
        this.setRoute('teacher');
        break;
      case 'start-mission':
        if (target.dataset.id) this.startMission(target.dataset.id);
        break;
      case 'next-stage':
        this.nextStage();
        break;
      case 'next-mission':
        this.nextMission();
        break;
      case 'restart-mission':
        this.restartMission();
        break;
      case 'exit-mission':
        this.exitMission();
        break;
      case 'measure':
        this.measure();
        break;
      case 'new-circuit':
        this.newCircuit();
        break;
      case 'undo':
        this.editor.undo();
        break;
      case 'redo':
        this.editor.redo();
        break;
      case 'toggle-run':
        this.toggleRun();
        break;
      case 'toggle-view':
        this.setView(this.store.get().preferences.view === 'schematic' ? 'tabletop' : 'schematic');
        break;
      case 'toggle-theme':
        this.setTheme(this.store.get().preferences.theme === 'light' ? 'dark' : 'light');
        break;
      case 'open-help':
        this.openHelp();
        break;
      case 'close-help':
        this.closeHelp();
        break;
      case 'rotate':
        this.editor.rotateSelected();
        break;
      case 'delete':
        this.editor.deleteSelected();
        break;
      case 'toggle-switch':
        if (target.dataset.id) this.editor.toggleSwitch(target.dataset.id);
        break;
      case 'set-voltage':
        if (target.dataset.id && target.dataset.value) {
          this.editor.setValue(target.dataset.id, Number(target.dataset.value));
        }
        break;
      case 'set-tool':
        if (target.dataset.tool) this.editor.setTool(target.dataset.tool as EditorTool);
        break;
      case 'open-drawer':
        this.store.update((state) => {
          state.ui.drawer = (target.dataset.drawer as 'left' | 'right') ?? null;
        });
        break;
      case 'close-drawer':
        this.store.update((state) => {
          state.ui.drawer = null;
        });
        break;
      case 'mobile-panel': {
        const panel = (target.dataset.panel as AppState['ui']['mobilePanel']) ?? 'none';
        this.store.update((state) => {
          state.ui.mobilePanel = state.ui.mobilePanel === panel ? 'none' : panel;
        });
        break;
      }
      case 'toggle-reveal':
        this.store.update((state) => {
          state.ui.teacherReveal = !state.ui.teacherReveal;
        });
        break;
      case 'print-worksheet':
        this.printWorksheet();
        break;
      case 'reset-progress':
        this.resetProgress();
        break;
      case 'select-warning': {
        const index = Number(target.dataset.index);
        const warning = this.store.get().simulation.result?.warnings[index];
        if (warning) this.selectWarning(warning);
        break;
      }
      case 'zoom-in':
        this.renderer.zoomBy(1.18);
        break;
      case 'zoom-out':
        this.renderer.zoomBy(1 / 1.18);
        break;
      case 'fit-canvas':
        this.fitCanvas();
        break;
      default:
        break;
    }
  }

  private onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    if (target instanceof HTMLInputElement && target.dataset.action === 'prediction') {
      this.setPrediction(target.value);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.action === 'explanation') {
      this.answerExplanation(target.value);
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.action === 'toggle-reduced-motion') {
      this.store.update((state) => {
        state.preferences.reducedMotion = target.checked;
      });
      this.saveProgressNow();
      return;
    }
    if (target instanceof HTMLInputElement && target.dataset.overlay) {
      this.toggleOverlay(target.dataset.overlay as keyof AppState['preferences']['overlays']);
      return;
    }
    if (target.dataset.action === 'placement-battery') {
      this.setPlacementValue('battery', Number(target.value));
      return;
    }
    if (target.dataset.action === 'placement-resistor') {
      this.setPlacementValue('resistor', Number(target.value));
      return;
    }
    if (target.dataset.action === 'load-preset') {
      this.loadPreset(target.value as PresetKey);
      return;
    }
    if (target.dataset.action === 'set-resistor' && target.dataset.id) {
      this.editor.setValue(target.dataset.id, Number(target.value));
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.store.get().ui.helpOpen && event.key === 'Escape') {
      this.closeHelp();
      event.preventDefault();
      return;
    }
    if (this.store.get().route !== 'workbench') {
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        this.openHelp();
        event.preventDefault();
      }
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('input, select, textarea, [contenteditable="true"]') ||
      (target?.closest('button, summary, a') && (event.key === 'Enter' || event.key === ' '))
    ) {
      return;
    }

    const meta = event.metaKey || event.ctrlKey;
    if (meta && (event.key === 'z' || event.key === 'Z')) {
      if (event.shiftKey) this.editor.redo();
      else this.editor.undo();
      event.preventDefault();
      return;
    }
    if (meta && (event.key === 'y' || event.key === 'Y')) {
      this.editor.redo();
      event.preventDefault();
      return;
    }
    if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
      this.openHelp();
      event.preventDefault();
      return;
    }

    if (this.editor.handleKey(event.key, event.shiftKey)) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      this.store.update((state) => {
        state.ui.drawer = null;
        state.ui.mobilePanel = 'none';
      });
    }
    if (event.key === 'g' || event.key === 'G') {
      this.toggleOverlay('grid');
      event.preventDefault();
    }
    if (event.key === 'v' || event.key === 'V') {
      this.setView(this.store.get().preferences.view === 'schematic' ? 'tabletop' : 'schematic');
      event.preventDefault();
    }
  }

  private focusSoon(selector: string): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = this.root.querySelector<HTMLElement>(selector);
        element?.focus({ preventScroll: true });
      });
    });
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderScheduled = false;
      this.render();
    });
  }

  private render(): void {
    const state = this.store.get();
    const active = document.activeElement as HTMLElement | null;
    const key = focusKeyOf(active);
    const selectionStart =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        ? active.selectionStart
        : null;

    this.frame.dataset.theme = state.preferences.theme;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content = state.preferences.theme === 'dark' ? '#0c1015' : '#f7f7f5';
    }
    this.frame.dataset.reducedMotion = String(state.preferences.reducedMotion);
    this.frame.dataset.route = state.route;
    this.frame.dataset.drawer = state.ui.drawer ?? '';
    this.frame.dataset.mobilePanel = state.ui.mobilePanel;
    this.frame.classList.toggle('is-tabletop', state.preferences.view === 'tabletop');

    const completedCount = state.mission.completed.length;
    const missionCount = this.must('#mission-count');
    missionCount.textContent = `${completedCount}/6`;

    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-nav]')) {
      const route = button.dataset.nav;
      button.classList.toggle('is-active', route === state.route);
      button.setAttribute('aria-current', route === state.route ? 'page' : 'false');
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
      const activeTool = button.dataset.tool === state.editor.tool;
      button.classList.toggle('is-active', activeTool);
      button.setAttribute('aria-pressed', String(activeTool));
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      '[data-action="mobile-panel"]'
    )) {
      const panel = button.dataset.panel;
      const isActive = panel === state.ui.mobilePanel;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }

    this.topbarActions.innerHTML = this.renderTopbarActions(state);
    this.tray.innerHTML = renderTray(this.context);
    this.inspector.innerHTML = renderInspector(this.context);
    this.missionStrip.innerHTML = renderMissionStrip(this.context);
    this.routeView.innerHTML =
      state.route === 'missions'
        ? renderMissionList(this.context)
        : state.route === 'teacher'
          ? renderTeacher(this.context)
          : '';

    this.renderer.setActive(state.route === 'workbench' && state.preferences.view === 'schematic');
    if (state.preferences.view === 'tabletop') {
      this.ensureScene3d();
      this.scene3d?.setActive(state.route === 'workbench');
    } else {
      this.scene3d?.setActive(false);
    }

    this.renderOverlayChecks(state);
    this.renderToast(state);
    this.renderCanvasHint(state);
    this.renderHelp(state);

    const description = describeCircuitShort(
      { components: state.editor.components, wires: state.editor.wires },
      state.simulation.result
    );
    this.circuitDescription.textContent = description;

    const result = state.simulation.result;
    if (result && result !== this.lastAnnouncedResult) {
      this.lastAnnouncedResult = result;
      const warning = result.warnings[0];
      this.srStatus.textContent = warning
        ? `회로 갱신. ${warning.messageKo}`
        : `회로 갱신. ${this.shortStatus(result)}`;
    }

    if (key && !state.ui.helpOpen) {
      const restored = this.root.querySelector<HTMLElement>(
        `[data-focus-key="${window.CSS.escape(key)}"]`
      );
      if (restored) {
        restored.focus({ preventScroll: true });
        if (
          selectionStart !== null &&
          (restored instanceof HTMLInputElement || restored instanceof HTMLTextAreaElement)
        ) {
          try {
            restored.setSelectionRange(selectionStart, selectionStart);
          } catch {
            // Some input types do not support selection ranges.
          }
        }
      }
    }
  }

  private renderTopbarActions(state: AppState): string {
    const running = state.simulation.running;
    const solveMs =
      state.simulation.result === null ? '—' : `${state.simulation.lastSolveMs.toFixed(1)}ms`;
    return `
      <div class="sim-chip ${running ? 'is-running' : ''}" title="마지막 계산 시간">
        <span class="sim-dot" aria-hidden="true"></span>
        <span>${running ? '실행 중' : '일시정지'}</span>
        <span class="sim-time">${solveMs}</span>
      </div>
      <button class="btn btn--small" type="button" data-action="toggle-run" data-focus-key="toggle-run" aria-label="${running ? '일시정지' : '실행'}">
        ${icon(running ? 'pause' : 'play', 14)} <span>${running ? '일시정지' : '실행'}</span>
      </button>
      <span class="topbar-sep" aria-hidden="true"></span>
      <button class="icon-btn" type="button" data-action="undo" data-focus-key="undo" aria-label="실행 취소" title="실행 취소 (Ctrl+Z)" ${this.editor.canUndo() ? '' : 'disabled'}>
        ${icon('undo', 17)}
      </button>
      <button class="icon-btn" type="button" data-action="redo" data-focus-key="redo" aria-label="다시 실행" title="다시 실행 (Ctrl+Shift+Z)" ${this.editor.canRedo() ? '' : 'disabled'}>
        ${icon('redo', 17)}
      </button>
      <button class="btn btn--small" type="button" data-action="toggle-view" data-focus-key="toggle-view" aria-label="보기 전환">
        ${icon('cube', 15)} <span>${state.preferences.view === 'schematic' ? '3D 보기' : '2D 보기'}</span>
      </button>
      <button class="icon-btn" type="button" data-action="toggle-theme" data-focus-key="toggle-theme" aria-label="테마 바꾸기" title="테마 바꾸기">
        ${icon(state.preferences.theme === 'light' ? 'moon' : 'sun', 17)}
      </button>
      <button class="icon-btn" type="button" data-action="open-help" data-focus-key="open-help" aria-label="도움말" title="도움말 (?)">
        ${icon('help', 17)}
      </button>
      <button class="btn btn--small" type="button" data-action="new-circuit" data-focus-key="new-circuit">새 회로</button>
    `;
  }

  private renderOverlayChecks(state: AppState): void {
    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[data-overlay]')) {
      const key = input.dataset.overlay as keyof AppState['preferences']['overlays'];
      input.checked = state.preferences.overlays[key];
    }
    const reduced = this.must<HTMLInputElement>('#reduced-motion-toggle');
    reduced.checked = state.preferences.reducedMotion;
  }

  private renderToast(state: AppState): void {
    if (!state.ui.toast) {
      this.toast.textContent = '';
      this.toast.className = 'toast';
      return;
    }
    this.toast.textContent = state.ui.toast.messageKo;
    this.toast.className = `toast is-visible tone-${state.ui.toast.tone}`;
  }

  private renderCanvasHint(state: AppState): void {
    if (state.preferences.view === 'tabletop') {
      this.canvasHint.textContent = '';
      return;
    }
    let hint = '부품을 끌어 옮기고, 단자를 클릭해 전선을 연결하세요.';
    if (state.editor.armedKind) {
      hint = '작업대를 클릭해 부품을 놓으세요. 화살표와 Enter로도 놓을 수 있습니다. Esc 취소.';
    } else if (state.editor.wireDraft) {
      hint = '다음 단자를 클릭해 연결하세요. 빈 격자를 클릭하면 경유점이 생깁니다. Esc 취소.';
    } else if (state.editor.tool === 'wire') {
      hint = '단자나 전선 위를 클릭해 전선을 시작하세요.';
    } else if (state.editor.tool === 'delete') {
      hint = '삭제할 부품이나 전선을 클릭하세요.';
    } else if (state.editor.tool === 'pan') {
      hint = '드래그해 작업대를 이동하세요. 휠로 확대·축소합니다.';
    } else if (state.editor.selection.kind === 'component') {
      hint = 'R 회전 · Delete 삭제 · 화살표 이동 · W 전선 시작 (Shift+W 반대 단자) · N 다음 부품';
    }
    this.canvasHint.textContent = hint;
  }

  private renderHelp(state: AppState): void {
    if (state.ui.helpOpen && !this.helpDialog.open) {
      this.helpDialog.showModal();
    } else if (!state.ui.helpOpen && this.helpDialog.open) {
      this.helpDialog.close();
    }
  }

  private shortStatus(result: SolveResult): string {
    const component = this.store.get().editor.components.find((item) => item.kind === 'battery');
    const battery = component ? result.componentStates.get(component.id) : undefined;
    const current = battery ? formatCurrent(battery.current) : null;
    const power = battery ? formatPower(battery.power) : null;
    if (!current) return '회로를 계산했습니다.';
    return `전지 ${formatVoltage(battery?.voltage ?? 0)}, 전류 ${current}, 전력 ${power}.`;
  }

  private onCircuitChange(reason: 'edit' | 'load' | 'undo' | 'redo' | 'keyboard'): void {
    const state = this.store.get();
    if (reason === 'load' || state.simulation.running) {
      this.solveNow();
    }
    if (!state.mission.currentId) this.scheduleWorkbenchSnapshot();
    this.scheduleRender();
  }

  private solveNow(): SolveResult {
    const started = performance.now();
    const result = solveCircuit(this.editor.circuit());
    const elapsed = performance.now() - started;
    this.store.update((state) => {
      state.simulation.result = result;
      state.simulation.lastSolveMs = elapsed;
    });
    return result;
  }

  private scheduleWorkbenchSnapshot(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      if (!this.store.get().mission.currentId) {
        saveCircuitSnapshot('workbench', this.editor.circuit());
      }
    }, 420);
  }

  private saveWorkbenchSnapshotNow(): void {
    if (this.store.get().mission.currentId) return;
    saveCircuitSnapshot('workbench', this.editor.circuit());
  }

  private saveProgressNow(): void {
    saveProgress(progressData(this.store.get(), this.lastMissionId));
  }

  private setRoute(route: Route): void {
    const state = this.store.get();
    if (state.route === route) {
      this.store.update((draft) => {
        draft.ui.drawer = null;
        draft.ui.mobilePanel = 'none';
      });
      return;
    }
    if (state.route === 'workbench' && !state.mission.currentId) this.saveWorkbenchSnapshotNow();
    if (route === 'workbench' && !state.mission.currentId) {
      const saved = loadCircuitSnapshot('workbench');
      if (saved) {
        this.editor.load(saved);
        requestAnimationFrame(() => this.fitActiveView());
      }
    }
    this.store.update((draft) => {
      draft.route = route;
      draft.ui.drawer = null;
      draft.ui.mobilePanel = 'none';
    });
    this.syncActiveViews();
    this.scheduleRender();
  }

  private syncActiveViews(): void {
    const state = this.store.get();
    const workbench = state.route === 'workbench';
    if (!workbench) {
      this.renderer.setActive(false);
      this.scene3d?.setActive(false);
      return;
    }
    if (state.preferences.view === 'tabletop') {
      this.ensureScene3d();
      this.renderer.setActive(false);
      this.scene3d?.setActive(true);
    } else {
      this.scene3d?.setActive(false);
      this.renderer.setActive(true);
    }
  }

  private ensureScene3d(): Scene3D {
    if (!this.scene3d) {
      this.scene3d = new Scene3D(this.tabletopHost, this.store);
      this.context.scene3d = this.scene3d;
      this.scene3d.setActive(this.store.get().route === 'workbench');
      this.scene3d.requestFit();
    }
    return this.scene3d;
  }

  private arm(kind: ComponentKind): void {
    if (this.store.get().preferences.view === 'tabletop') this.setView('schematic');
    this.editor.arm(kind);
    if (this.store.get().ui.mobilePanel !== 'none') {
      this.store.update((state) => {
        state.ui.mobilePanel = 'none';
      });
    }
    this.canvas.focus({ preventScroll: true });
  }

  private setPlacementValue(kind: 'battery' | 'resistor', value: number): void {
    this.store.update((state) => {
      state.editor.placementValues[kind] = value;
    });
  }

  private setView(view: AppState['preferences']['view']): void {
    this.store.update((state) => {
      state.preferences.view = view;
    });
    this.frame.classList.toggle('is-tabletop', view === 'tabletop');
    if (view === 'tabletop') {
      const scene = this.ensureScene3d();
      scene.setActive(this.store.get().route === 'workbench');
      scene.requestFit();
    } else {
      this.renderer.setActive(this.store.get().route === 'workbench');
      this.renderer.requestFit();
    }
    this.syncActiveViews();
    this.saveProgressNow();
  }

  private fitActiveView(): void {
    const state = this.store.get();
    if (state.preferences.view === 'tabletop') {
      this.ensureScene3d().requestFit();
    } else {
      this.renderer.requestFit();
    }
  }

  private toggleOverlay(key: keyof AppState['preferences']['overlays']): void {
    this.store.update((state) => {
      state.preferences.overlays[key] = !state.preferences.overlays[key];
    });
    this.saveProgressNow();
  }

  private setTheme(theme: AppState['preferences']['theme']): void {
    this.store.update((state) => {
      state.preferences.theme = theme;
    });
    this.saveProgressNow();
  }

  private toggleRun(): void {
    const running = !this.store.get().simulation.running;
    this.store.update((state) => {
      state.simulation.running = running;
    });
    if (running) {
      this.solveNow();
      this.store.toast('회로 계산을 다시 시작합니다.');
    } else {
      this.store.toast('계산을 일시정지했습니다.', 'warn');
    }
  }

  private openHelp(): void {
    this.store.update((state) => {
      state.ui.helpOpen = true;
    });
  }

  private closeHelp(): void {
    this.store.update((state) => {
      state.ui.helpOpen = false;
    });
  }

  private startMission(id: string): void {
    const mission = missionById(id);
    if (!mission) return;
    const state = this.store.get();
    const existing = state.mission.progress[id] ?? emptyMissionProgress();
    const maxStage = mission.stages ? mission.stages.length - 1 : 0;
    const stage = Math.max(0, Math.min(maxStage, existing.stage));
    const stageDef = mission.stages?.[stage] ?? null;
    const presetKey = (stageDef?.preset ?? mission.setup.presetCircuit ?? 'starter') as PresetKey;
    const circuit: Circuit = createPreset(presetKey);
    const progress = existing.explanation
      ? { ...existing, stage }
      : { ...existing, stage, measured: false, targetPassed: false };
    this.lastMissionId = id;
    this.store.update((draft) => {
      draft.route = 'workbench';
      draft.mission.currentId = id;
      draft.mission.stage = stage;
      draft.mission.explanationOpen = false;
      draft.mission.progress[id] = progress;
      draft.ui.drawer = null;
      draft.ui.mobilePanel = 'none';
    });
    this.editor.load(circuit);
    this.render();
    this.syncActiveViews();
    requestAnimationFrame(() => this.fitActiveView());
    this.saveProgressNow();
    this.store.toast(`${mission.titleKo} 미션을 시작합니다.`);
    this.focusSoon('input[data-action="prediction"]');
  }

  private exitMission(): void {
    const state = this.store.get();
    const id = state.mission.currentId;
    if (id) this.lastMissionId = id;
    this.store.update((draft) => {
      draft.route = 'missions';
      draft.mission.currentId = null;
      draft.mission.stage = 0;
      draft.mission.explanationOpen = false;
      draft.ui.drawer = null;
      draft.ui.mobilePanel = 'none';
    });
    this.syncActiveViews();
    this.saveProgressNow();
    if (id) this.focusSoon(`[data-action="start-mission"][data-id="${id}"]`);
  }

  private measure(): void {
    const state = this.store.get();
    const mission = missionById(state.mission.currentId);
    const result = this.solveNow();
    if (!mission) {
      this.store.toast('회로를 다시 계산했습니다.');
      return;
    }
    const progress = missionProgress(this.store.get(), mission.id);
    const stage = mission.stages?.[progress.stage] ?? null;
    const target = stage?.target ?? mission.setup.target ?? '';
    const check = evaluateTarget(
      target,
      { components: this.store.get().editor.components, wires: this.store.get().editor.wires },
      result,
      mission
    );
    const id = mission.id;
    const next = { ...progress, measured: true, targetPassed: check.ok };
    this.store.update((draft) => {
      draft.mission.progress[id] = next;
      draft.mission.explanationOpen =
        check.ok && !(mission.stages && progress.stage < mission.stages.length - 1);
    });
    this.saveProgressNow();
    if (check.ok) {
      const hasNext = Boolean(mission.stages && progress.stage < mission.stages.length - 1);
      this.store.toast(
        hasNext
          ? '단계 목표를 달성했습니다. 다음 단계로 가세요.'
          : '측정 성공! 이제 설명을 골라 보세요.',
        'success'
      );
      this.focusSoon(hasNext ? '[data-action="next-stage"]' : 'input[data-action="explanation"]');
    } else {
      this.store.toast(
        this.store.get().simulation.result?.warnings[0]?.messageKo ??
          '아직 목표에 도달하지 않았습니다. 측정값을 확인하세요.',
        'warn'
      );
      this.focusSoon('[data-action="measure"]');
    }
  }

  private setPrediction(optionId: string): void {
    const state = this.store.get();
    const id = state.mission.currentId;
    if (!id) return;
    const progress = { ...missionProgress(state, id), prediction: optionId };
    this.store.update((draft) => {
      draft.mission.progress[id] = progress;
    });
    this.saveProgressNow();
    this.store.toast('예측을 저장했습니다. 이제 회로를 만들고 측정하세요.');
    this.focusSoon('#schematic');
  }

  private answerExplanation(optionId: string): void {
    const state = this.store.get();
    const mission = missionById(state.mission.currentId);
    const id = state.mission.currentId;
    if (!mission || !id) return;
    if (optionId !== mission.explanation.answer) {
      this.store.toast('다시 생각해 보세요. 측정값을 근거로 판단하세요.', 'warn');
      return;
    }
    const progress = { ...missionProgress(state, id), explanation: optionId };
    const completed = state.mission.completed.includes(id)
      ? state.mission.completed
      : [...state.mission.completed, id];
    this.store.update((draft) => {
      draft.mission.progress[id] = progress;
      draft.mission.completed = completed;
    });
    this.saveProgressNow();
    this.store.toast('미션을 완료했습니다!', 'success');
    const next = MISSIONS[MISSIONS.findIndex((item) => item.id === id) + 1];
    this.focusSoon(next ? '[data-action="next-mission"]' : '[data-action="go-missions"]');
  }

  private nextStage(): void {
    const state = this.store.get();
    const mission = missionById(state.mission.currentId);
    const id = state.mission.currentId;
    if (!mission || !id || !mission.stages) return;
    const progress = missionProgress(state, id);
    if (progress.stage >= mission.stages.length - 1) return;
    const stage = progress.stage + 1;
    const stageDef = mission.stages[stage];
    const next = {
      ...progress,
      stage,
      measured: false,
      targetPassed: false
    };
    this.store.update((draft) => {
      draft.mission.progress[id] = next;
      draft.mission.stage = stage;
      draft.mission.explanationOpen = false;
    });
    this.editor.load(
      createPreset((stageDef.preset ?? mission.setup.presetCircuit ?? 'starter') as PresetKey)
    );
    this.render();
    requestAnimationFrame(() => this.fitActiveView());
    this.saveProgressNow();
    this.store.toast(`${stageDef.titleKo}를 시작합니다.`);
    this.focusSoon('#schematic');
  }

  private restartMission(): void {
    const state = this.store.get();
    const mission = missionById(state.mission.currentId);
    const id = state.mission.currentId;
    if (!mission || !id) return;
    const progress = emptyMissionProgress();
    const stageDef = mission.stages?.[0] ?? null;
    const presetKey = (stageDef?.preset ?? mission.setup.presetCircuit ?? 'starter') as PresetKey;
    this.store.update((draft) => {
      draft.mission.progress[id] = progress;
      draft.mission.stage = 0;
      draft.mission.completed = draft.mission.completed.filter((item) => item !== id);
      draft.mission.explanationOpen = false;
    });
    this.editor.load(createPreset(presetKey));
    this.render();
    requestAnimationFrame(() => this.fitActiveView());
    this.saveProgressNow();
    this.store.toast('미션을 처음부터 다시 시작합니다.');
    this.focusSoon('input[data-action="prediction"]');
  }

  private nextMission(): void {
    const current = this.store.get().mission.currentId;
    if (!current) {
      this.setRoute('missions');
      return;
    }
    const index = MISSIONS.findIndex((mission) => mission.id === current);
    const next = MISSIONS[index + 1];
    if (next) this.startMission(next.id);
    else this.exitMission();
  }

  private newCircuit(): void {
    this.store.update((draft) => {
      draft.route = 'workbench';
      draft.mission.currentId = null;
      draft.mission.stage = 0;
      draft.mission.explanationOpen = false;
      draft.ui.drawer = null;
      draft.ui.mobilePanel = 'none';
    });
    this.editor.load({ components: [], wires: [] });
    this.render();
    requestAnimationFrame(() => this.fitActiveView());
    saveCircuitSnapshot('workbench', { components: [], wires: [] });
    this.store.toast('새 회로를 시작합니다.');
    this.focusSoon('#schematic');
  }

  private loadPreset(key: PresetKey): void {
    if (!PRESET_META[key]) return;
    this.store.update((draft) => {
      draft.route = 'workbench';
      draft.mission.currentId = null;
      draft.mission.stage = 0;
      draft.mission.explanationOpen = false;
      draft.ui.drawer = null;
      draft.ui.mobilePanel = 'none';
    });
    this.editor.load(createPreset(key));
    this.render();
    requestAnimationFrame(() => this.fitActiveView());
    this.store.toast(`${PRESET_META[key].nameKo} 예제를 불러왔습니다.`);
    this.focusSoon('#schematic');
  }

  private selectWarning(warning: CircuitWarning): void {
    if (warning.componentIds.length > 0) {
      this.editor.select('component', warning.componentIds[0]);
    } else if (warning.wireIds && warning.wireIds.length > 0) {
      this.editor.select('wire', warning.wireIds[0]);
    }
    this.canvas.focus({ preventScroll: true });
  }

  private fitCanvas(): void {
    this.renderer.requestFit();
    this.scene3d?.requestFit();
  }

  private resetProgress(): void {
    const confirmed = window.confirm(
      '이 브라우저에 저장된 VoltWorks 미션 진행과 회로를 모두 지울까요? 이 작업은 되돌릴 수 없습니다.'
    );
    if (!confirmed) return;
    clearProgress();
    this.lastMissionId = null;
    this.store.update((draft) => {
      draft.route = 'missions';
      draft.mission.currentId = null;
      draft.mission.stage = 0;
      draft.mission.completed = [];
      draft.mission.progress = {};
      draft.mission.explanationOpen = false;
      draft.ui.drawer = null;
      draft.ui.mobilePanel = 'none';
    });
    this.editor.load(createPreset('starter'));
    this.saveProgressNow();
    saveCircuitSnapshot('workbench', createPreset('starter'));
    this.syncActiveViews();
    this.store.toast('진행 상황을 초기화했습니다.');
    this.focusSoon('[data-action="start-mission"]');
  }

  private printWorksheet(): void {
    const previews = MISSIONS.map((mission) => {
      const keys: PresetKey[] = mission.stages
        ? mission.stages.map(
            (stage) => (stage.preset ?? mission.setup.presetCircuit ?? 'starter') as PresetKey
          )
        : [(mission.setup.presetCircuit ?? 'starter') as PresetKey];
      return {
        mission,
        images: keys.map((key) => renderCircuitPreview(createPreset(key), 640, 330, 'light'))
      };
    });

    const win = window.open('', '_blank', 'width=920,height=1200');
    if (!win) {
      this.store.toast('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도하세요.', 'warn');
      return;
    }
    const styles = `
      <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 36px 44px; font-family: "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; color: #111; background: #fff; line-height: 1.5; }
        h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.03em; }
        h2 { font-size: 17px; margin: 0 0 8px; }
        h3 { font-size: 13px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em; }
        .sub { color: #666; margin: 0 0 24px; font-size: 13px; }
        .mission { break-inside: avoid; page-break-inside: avoid; border-top: 2px solid #111; padding: 18px 0 22px; }
        .meta { display: flex; gap: 12px; align-items: baseline; font-size: 12px; color: #666; margin-bottom: 6px; }
        .image { width: 100%; border: 1px solid #ddd; margin: 10px 0; display: block; }
        .prompt { font-size: 14px; margin: 6px 0 14px; }
        .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .box { border: 1px solid #bbb; padding: 10px 12px; }
        .options { margin: 6px 0 0; padding: 0; list-style: none; font-size: 13px; }
        .options li { margin: 4px 0; }
        .square { display: inline-block; width: 10px; height: 10px; border: 1px solid #111; margin-right: 6px; vertical-align: -1px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th, td { border: 1px solid #999; padding: 7px 8px; text-align: left; }
        th { background: #f2f2f0; font-weight: 600; }
        .lines { margin-top: 8px; font-size: 13px; }
        .line { border-bottom: 1px solid #999; height: 24px; }
        .footer { margin-top: 20px; font-size: 11px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
        @media print { body { padding: 12mm 14mm; } .mission { page-break-after: always; } .mission:last-child { page-break-after: auto; } }
      </style>
    `;
    const missionHtml = previews
      .map(
        ({ mission, images }, index) => `
        <section class="mission">
          <div class="meta"><span>M${String(index + 1).padStart(2, '0')}</span><span>${esc(mission.titleKo)}</span><span>난이도 ${mission.difficulty}/3</span></div>
          <h2>${esc(mission.titleKo)}</h2>
          <p class="prompt">${esc(mission.promptKo)}</p>
          ${images.map((image, imageIndex) => `<img class="image" src="${image}" alt="${esc(mission.titleKo)} 회로 도해 ${imageIndex + 1}" />`).join('')}
          <div class="columns">
            <div class="box">
              <h3>예측</h3>
              <p>${esc(mission.prediction.questionKo)}</p>
              <ul class="options">
                ${mission.prediction.options.map((option) => `<li><span class="square"></span>${esc(option.labelKo)}</li>`).join('')}
              </ul>
            </div>
            <div class="box">
              <h3>측정 기록</h3>
              <table>
                <thead><tr><th>지점</th><th>전압</th><th>전류</th><th>전력</th></tr></thead>
                <tbody>
                  ${Array.from({ length: 4 }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>').join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="lines">
            <h3>설명</h3>
            <p>${esc(mission.explanation.questionKo)}</p>
            <div class="line"></div>
            <div class="line"></div>
          </div>
        </section>
      `
      )
      .join('');

    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" /><title>VoltWorks 학습지</title>${styles}</head><body>
      <h1>VoltWorks 전기 회로 학습지</h1>
      <p class="sub">이름: ______________________ &nbsp;&nbsp; 학년/반: ______________ &nbsp;&nbsp; 날짜: ______________</p>
      ${missionHtml}
      <p class="footer">VoltWorks는 이상적 부품 모델을 사용하는 교육용 저전압 시뮬레이터입니다. 실제 배선의 안전을 보증하지 않습니다.</p>
    </body></html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 350);
  }

  private exposeTestBridge(): void {
    const bridge = {
      getState: () => this.store.get(),
      getSnapshot: () => {
        const state = this.store.get();
        const result = state.simulation.result;
        return {
          ...state,
          simulation: {
            ...state.simulation,
            result: result
              ? {
                  ...result,
                  sourceCurrents: Object.fromEntries(result.sourceCurrents),
                  componentStates: Object.fromEntries(result.componentStates)
                }
              : null
          }
        };
      },
      getCircuit: () => this.editor.circuit(),
      solve: () => solveCircuit(this.editor.circuit()),
      loadCircuit: (circuit: Circuit) => {
        this.store.update((draft) => {
          draft.route = 'workbench';
          draft.mission.currentId = null;
          draft.mission.stage = 0;
        });
        this.editor.load(circuit);
        this.render();
        requestAnimationFrame(() => this.fitActiveView());
      },
      loadPreset: (key: PresetKey) => this.loadPreset(key),
      startMission: (id: string) => this.startMission(id),
      measure: () => this.measure(),
      setPrediction: (id: string) => this.setPrediction(id),
      answerExplanation: (id: string) => this.answerExplanation(id),
      nextStage: () => this.nextStage(),
      worldToScreen: (point: { x: number; y: number }) => this.renderer.worldToScreen(point),
      getCamera: () => this.renderer.getCamera(),
      setRoute: (route: Route) => this.setRoute(route),
      actions: this.actions
    };
    (window as unknown as { __voltworks: typeof bridge }).__voltworks = bridge;
  }
}
