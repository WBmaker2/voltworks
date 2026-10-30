import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE_UNITS_PER_CELL } from '../circuit/constants';
import { findJunctions } from '../circuit/geometry';
import { computeWireFlows } from '../circuit/power';
import { formatOhmsShort, formatVoltsShort } from '../circuit/units';
import type { Circuit, SolveResult, Wire } from '../circuit/types';
import type { Store } from '../app/state';
import { buildWireGeometry, pointAtDistance, type WireGeometry } from './CurrentFlow';
import { paletteFor } from './theme';

interface ComponentVisual {
  group: THREE.Group;
  kind: Circuit['components'][number]['kind'];
  bulbMaterial?: THREE.MeshStandardMaterial;
  bulbLight?: THREE.PointLight;
  lever?: THREE.Mesh;
  needle?: THREE.Mesh;
}

interface WireVisual {
  wire: Wire;
  geometry: WireGeometry;
}

export class Scene3D {
  private host: HTMLElement;
  private store: Store;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  private controls: OrbitControls | null = null;
  private root = new THREE.Group();
  private componentGroup = new THREE.Group();
  private wireGroup = new THREE.Group();
  private tableGroup = new THREE.Group();
  private particleMesh: THREE.InstancedMesh | null = null;
  private visuals = new Map<string, ComponentVisual>();
  private wireVisuals: WireVisual[] = [];
  private flows = computeWireFlows({ components: [], wires: [] }, emptyResult());
  private center = { x: 20, y: 12 };
  private active = false;
  private running = false;
  private frame = 0;
  private lastTime = 0;
  private lastComponents: unknown = null;
  private lastWires: unknown = null;
  private lastResult: SolveResult | null = null;
  private lastTheme: 'light' | 'dark' | null = null;
  private needsFit = true;
  private hemisphereLight: THREE.HemisphereLight | null = null;
  private rimLight: THREE.DirectionalLight | null = null;
  private resizeObserver: ResizeObserver;
  private boundVisibility = (): void => {
    if (document.hidden) this.stop();
    else if (this.active) this.start();
  };
  private reducedMotion = false;
  private failed = false;
  private dummy = new THREE.Object3D();
  private maxParticles = 700;

  constructor(host: HTMLElement, store: Store) {
    this.host = host;
    this.store = store;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    document.addEventListener('visibilitychange', this.boundVisibility);
    this.initRenderer();
  }

  private initRenderer(): void {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.98;
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      this.host.appendChild(this.renderer.domElement);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enablePan = true;
      this.controls.minDistance = 6;
      this.controls.maxDistance = 90;
      this.controls.maxPolarAngle = Math.PI * 0.46;
      this.controls.target.set(0, 0, 0);
      this.scene.add(this.root);
      this.root.add(this.tableGroup, this.wireGroup, this.componentGroup);
      this.setupLights();
      this.resize();
      this.rebuild();
    } catch {
      this.failed = true;
      this.host.innerHTML =
        '<div class="scene3d-fallback"><strong>3D 보기를 시작할 수 없습니다.</strong><p>이 브라우저에서 WebGL을 사용할 수 없습니다. 2D 회로는 그대로 사용할 수 있습니다.</p></div>';
    }
  }

  private setupLights(): void {
    const palette = paletteFor(this.store.get().preferences.theme);
    const hemisphere = new THREE.HemisphereLight(
      new THREE.Color(palette.paper),
      new THREE.Color(palette.ink),
      1.05
    );
    this.hemisphereLight = hemisphere;
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(new THREE.Color('#ffffff'), 1.75);
    key.position.set(12, 24, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 24;
    key.shadow.camera.bottom = -24;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(palette.accent), 0.38);
    rim.position.set(-16, 10, -14);
    this.rimLight = rim;
    this.scene.add(rim);
    this.scene.background = new THREE.Color(palette.paper);
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

  start(): void {
    if (this.failed || this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frame = requestAnimationFrame((time) => this.loop(time));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  requestFit(): void {
    this.needsFit = true;
    this.fitCamera();
    this.needsFit = false;
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.controls?.dispose();
    this.disposeGroup(this.scene);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  private resize(): void {
    if (!this.renderer || this.failed) return;
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private loop(time: number): void {
    if (!this.running) return;
    if (document.hidden) {
      this.running = false;
      return;
    }
    const delta = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.updateScene(delta);
    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
    this.frame = requestAnimationFrame((next) => this.loop(next));
  }

  private updateScene(delta: number): void {
    const state = this.store.get();
    this.reducedMotion = state.preferences.reducedMotion;
    if (state.preferences.theme !== this.lastTheme) {
      this.lastTheme = state.preferences.theme;
      this.applyTheme();
      this.rebuild();
    }
    if (state.editor.components !== this.lastComponents || state.editor.wires !== this.lastWires) {
      this.rebuild();
    }
    if (state.simulation.result !== this.lastResult) {
      this.lastResult = state.simulation.result;
      this.updateElectrics(state.simulation.result);
    }
    if (this.reducedMotion) {
      if (this.particleMesh) this.particleMesh.count = 0;
    } else {
      this.animateTime = (this.animateTime + delta) % 1000;
      this.updateParticles(this.animateTime);
    }
  }

  private animateTime = 0;

  private rebuild(): void {
    if (this.failed) return;
    const state = this.store.get();
    this.lastComponents = state.editor.components;
    this.lastWires = state.editor.wires;
    this.clearGroup(this.componentGroup);
    this.clearGroup(this.wireGroup);
    this.clearGroup(this.tableGroup);
    this.particleMesh = null;
    this.visuals.clear();
    this.wireVisuals = [];

    const components = state.editor.components;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const component of components) {
      minX = Math.min(minX, component.x);
      minY = Math.min(minY, component.y);
      maxX = Math.max(maxX, component.x);
      maxY = Math.max(maxY, component.y);
    }
    for (const wire of state.editor.wires) {
      for (const point of wire.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
    if (!Number.isFinite(minX)) {
      minX = 12;
      minY = 6;
      maxX = 30;
      maxY = 20;
    }
    this.center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const sceneWidth = Math.max(12, (maxX - minX) * SCENE_UNITS_PER_CELL + 7);
    const sceneDepth = Math.max(9, (maxY - minY) * SCENE_UNITS_PER_CELL + 7);
    this.buildTable(sceneWidth, sceneDepth);
    this.buildComponents(state.editor.components);
    this.buildWires(state.editor.wires);
    this.buildParticles();
    this.updateElectrics(state.simulation.result);
    if (this.needsFit) {
      this.needsFit = false;
      this.fitCamera();
    }
  }

  private applyTheme(): void {
    const palette = paletteFor(this.store.get().preferences.theme);
    this.scene.background = new THREE.Color(palette.paper);
    if (this.hemisphereLight) {
      this.hemisphereLight.color = new THREE.Color(palette.paper);
      this.hemisphereLight.groundColor = new THREE.Color(palette.ink);
    }
    if (this.rimLight) this.rimLight.color = new THREE.Color(palette.accent);
  }

  private buildTable(width: number, depth: number): void {
    const palette = paletteFor(this.store.get().preferences.theme);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.4, depth),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.table),
        roughness: 0.9,
        metalness: 0.02
      })
    );
    table.position.y = -0.25;
    table.receiveShadow = true;
    this.tableGroup.add(table);

    const texture = this.buildTableTexture(palette);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(width / 2, depth / 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.94,
        metalness: 0.01
      })
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -0.045;
    grid.receiveShadow = true;
    this.tableGroup.add(grid);
  }

  private buildTableTexture(palette: ReturnType<typeof paletteFor>): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = palette.table;
    ctx.fillRect(0, 0, 256, 256);
    const minor = palette.gridLine;
    const major = palette.gridMajor;
    ctx.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const position = index * 64;
      ctx.strokeStyle = index % 2 === 0 ? major : minor;
      ctx.beginPath();
      ctx.moveTo(position + 0.5, 0);
      ctx.lineTo(position + 0.5, 256);
      ctx.moveTo(0, position + 0.5);
      ctx.lineTo(256, position + 0.5);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }

  private toScene(x: number, z: number, height: number): THREE.Vector3 {
    return new THREE.Vector3(
      (x - this.center.x) * SCENE_UNITS_PER_CELL,
      height,
      (z - this.center.y) * SCENE_UNITS_PER_CELL
    );
  }

  private buildComponents(components: Circuit['components']): void {
    const palette = paletteFor(this.store.get().preferences.theme);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.ink),
      roughness: 0.55,
      metalness: 0.15
    });
    const paperMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.paper),
      roughness: 0.75,
      metalness: 0.02
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.accent),
      roughness: 0.45,
      metalness: 0.15,
      emissive: new THREE.Color(palette.accent),
      emissiveIntensity: 0.08
    });

    for (const component of components) {
      const group = new THREE.Group();
      const position = this.toScene(component.x, component.y, 0.28);
      group.position.copy(position);
      group.rotation.y = (-component.rotation * Math.PI) / 180;
      const visual: ComponentVisual = { group, kind: component.kind };

      if (component.kind === 'battery') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.62, 0.7), bodyMaterial);
        body.position.y = 0.22;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 0.72), accentMaterial);
        stripe.position.set(0.48, 0.22, 0);
        group.add(stripe);
        for (const side of [-1, 1]) {
          const terminal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12),
            accentMaterial
          );
          terminal.position.set(side * 0.62, 0.42, 0);
          group.add(terminal);
        }
      } else if (component.kind === 'bulb') {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.35, 16), bodyMaterial);
        base.position.y = 0.12;
        base.castShadow = true;
        group.add(base);
        const glassMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#fff4df'),
          emissive: new THREE.Color(palette.accent),
          emissiveIntensity: 0,
          roughness: 0.25,
          metalness: 0,
          transparent: true,
          opacity: 0.92
        });
        const glass = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 18), glassMaterial);
        glass.position.y = 0.62;
        glass.castShadow = true;
        group.add(glass);
        const filament = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 16), accentMaterial);
        filament.position.y = 0.62;
        filament.rotation.x = Math.PI / 2;
        group.add(filament);
        const light = new THREE.PointLight(new THREE.Color(palette.accent), 0, 6, 2);
        light.position.y = 0.7;
        group.add(light);
        visual.bulbMaterial = glassMaterial;
        visual.bulbLight = light;
      } else if (component.kind === 'resistor') {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.19, 1.05, 18),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color('#d9c9a3'),
            roughness: 0.7,
            metalness: 0.05
          })
        );
        body.rotation.z = Math.PI / 2;
        body.position.y = 0.28;
        body.castShadow = true;
        group.add(body);
        for (const offset of [-0.22, 0.02, 0.25]) {
          const band = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16),
            offset === 0.02 ? accentMaterial : bodyMaterial
          );
          band.rotation.z = Math.PI / 2;
          band.position.set(offset, 0.28, 0);
          group.add(band);
        }
      } else if (component.kind === 'switch') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.5), bodyMaterial);
        base.position.y = 0.14;
        base.castShadow = true;
        group.add(base);
        for (const side of [-1, 1]) {
          const contact = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12),
            accentMaterial
          );
          contact.position.set(side * 0.5, 0.3, 0);
          group.add(contact);
        }
        const lever = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.09, 0.13), accentMaterial);
        lever.position.set(0.05, 0.38, 0);
        lever.castShadow = true;
        group.add(lever);
        visual.lever = lever;
      } else {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.78), bodyMaterial);
        base.position.y = 0.15;
        base.castShadow = true;
        group.add(base);
        const dial = new THREE.Mesh(
          new THREE.CylinderGeometry(0.33, 0.33, 0.08, 24),
          paperMaterial
        );
        dial.position.y = 0.3;
        group.add(dial);
        const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.26), accentMaterial);
        needle.position.set(0, 0.35, 0);
        group.add(needle);
        visual.needle = needle;
      }

      const labelText =
        component.kind === 'battery'
          ? formatVoltsShort(component.value ?? 3)
          : component.kind === 'resistor'
            ? formatOhmsShort(component.value ?? 100)
            : component.kind === 'bulb'
              ? '전구'
              : component.kind === 'switch'
                ? `스위치 ${component.closed ? '닫힘' : '열림'}`
                : component.kind === 'ammeter'
                  ? '전류계'
                  : '전압계';
      const label = this.makeLabelSprite(labelText, palette);
      label.position.set(0, 1.22, 0);
      group.add(label);

      this.componentGroup.add(group);
      this.visuals.set(component.id, visual);
    }
  }

  private makeLabelSprite(text: string, palette: ReturnType<typeof paletteFor>): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = palette.panel;
      ctx.globalAlpha = 0.94;
      ctx.beginPath();
      ctx.roundRect(8, 10, 240, 44, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette.gridMajor;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = palette.ink;
      ctx.font = '600 24px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 33);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.55, 0.39, 1);
    sprite.renderOrder = 5;
    return sprite;
  }

  private buildWires(wires: Circuit['wires']): void {
    const palette = paletteFor(this.store.get().preferences.theme);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.wire),
      roughness: 0.55,
      metalness: 0.25
    });
    for (const wire of wires) {
      if (wire.points.length < 2) continue;
      const geometry = buildWireGeometry(wire);
      this.wireVisuals.push({ wire, geometry });
      const points = wire.points.map((point) => this.toScene(point.x, point.y, 0.1));
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.12);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(8, wire.points.length * 8), 0.045, 6, false),
        material
      );
      tube.castShadow = true;
      this.wireGroup.add(tube);
    }

    const junctionMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.accent),
      roughness: 0.4,
      metalness: 0.2
    });
    for (const junction of findJunctions(wires)) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), junctionMaterial);
      sphere.position.copy(this.toScene(junction.x, junction.y, 0.1));
      this.wireGroup.add(sphere);
    }
  }

  private buildParticles(): void {
    if (this.particleMesh) {
      this.componentGroup.remove(this.particleMesh);
      this.particleMesh.geometry.dispose();
      (this.particleMesh.material as THREE.Material).dispose();
      this.particleMesh = null;
    }
    const palette = paletteFor(this.store.get().preferences.theme);
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.accent) }),
      this.maxParticles
    );
    this.particleMesh.count = 0;
    this.particleMesh.frustumCulled = false;
    this.componentGroup.add(this.particleMesh);
  }

  private updateElectrics(result: SolveResult | null): void {
    const state = this.store.get();
    this.flows = result
      ? computeWireFlows({ components: state.editor.components, wires: state.editor.wires }, result)
      : [];
    for (const component of state.editor.components) {
      const visual = this.visuals.get(component.id);
      if (!visual) continue;
      const componentState = result?.componentStates.get(component.id);
      if (visual.bulbMaterial) {
        const brightness = Math.max(0, Math.min(1.5, componentState?.brightness ?? 0));
        visual.bulbMaterial.emissiveIntensity = brightness * 1.8;
        if (visual.bulbLight) visual.bulbLight.intensity = brightness * 2.2;
      }
      if (visual.lever) {
        visual.lever.rotation.z = component.closed ? 0 : -0.55;
      }
      if (visual.needle) {
        const reading =
          component.kind === 'ammeter'
            ? Math.min(1, Math.abs(componentState?.current ?? 0) / 0.5)
            : Math.min(1, Math.abs(componentState?.voltage ?? 0) / 10);
        visual.needle.rotation.y = -0.9 + reading * 1.8;
      }
    }
  }

  private updateParticles(time: number): void {
    if (!this.particleMesh) return;
    const palette = paletteFor(this.store.get().preferences.theme);
    const material = this.particleMesh.material as THREE.MeshBasicMaterial;
    material.color = new THREE.Color(palette.accent);
    let instance = 0;
    for (const flow of this.flows) {
      const visual = this.wireVisuals.find((entry) => entry.wire.id === flow.wireId);
      if (!visual || visual.geometry.total <= 0) continue;
      const spacing = 1.2;
      const count = Math.min(22, Math.max(1, Math.floor(visual.geometry.total / spacing)));
      const speed = 1.1 + Math.min(9, flow.speed * 3.2);
      for (let index = 0; index < count; index += 1) {
        if (instance >= this.maxParticles) break;
        const raw = time * speed * flow.direction + index * spacing + visual.wire.id.length * 0.37;
        const distance =
          ((raw % visual.geometry.total) + visual.geometry.total) % visual.geometry.total;
        const point = pointAtDistance(visual.geometry, distance);
        const position = this.toScene(point.x, point.y, 0.16);
        this.dummy.position.copy(position);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.particleMesh.setMatrixAt(instance, this.dummy.matrix);
        instance += 1;
      }
    }
    this.particleMesh.count = instance;
    this.particleMesh.instanceMatrix.needsUpdate = true;
  }

  private fitCamera(): void {
    if (!this.renderer) return;
    const state = this.store.get();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const component of state.editor.components) {
      minX = Math.min(minX, component.x);
      minY = Math.min(minY, component.y);
      maxX = Math.max(maxX, component.x);
      maxY = Math.max(maxY, component.y);
    }
    if (!Number.isFinite(minX)) {
      minX = 10;
      minY = 6;
      maxX = 30;
      maxY = 20;
    }
    const cx = ((minX + maxX) / 2 - this.center.x) * SCENE_UNITS_PER_CELL;
    const cz = ((minY + maxY) / 2 - this.center.y) * SCENE_UNITS_PER_CELL;
    const spanX = Math.max(7, (maxX - minX) * SCENE_UNITS_PER_CELL);
    const spanZ = Math.max(5, (maxY - minY) * SCENE_UNITS_PER_CELL);
    const distance = Math.max(9.5, Math.min(40, Math.max(spanX, spanZ) * 0.9 + 6.5));
    this.camera.position.set(cx + distance * 0.28, distance * 0.55, cz + distance * 0.82);
    this.camera.lookAt(cx, 0, cz);
    if (this.controls) {
      this.controls.target.set(cx, 0, cz);
      this.controls.update();
    }
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children.pop() as THREE.Object3D;
      this.disposeObject(child);
    }
  }

  private disposeGroup(group: THREE.Object3D): void {
    for (const child of [...group.children]) {
      group.remove(child);
      this.disposeObject(child);
    }
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const entry of material) entry.dispose();
      } else if (material) {
        const mapped = material as THREE.MeshStandardMaterial;
        if (mapped.map) mapped.map.dispose();
        material.dispose();
      }
    });
  }
}

function emptyResult(): SolveResult {
  return {
    nodeVoltages: [],
    ground: 0,
    sourceCurrents: new Map(),
    componentStates: new Map(),
    warnings: [],
    solved: false
  };
}
