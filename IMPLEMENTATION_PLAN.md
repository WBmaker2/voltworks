# VoltWorks — Implementation Plan

**Project name:** VoltWorks
**Folder:** `/Volumes/ External Drive 256G/Dev2/opencode/voltworks`
**Type:** Static educational SPA/PWA
**Runtime AI:** None. No LLM/API calls after build. All circuit solving runs in the browser.
**Target learners:** Grades 6–11 (Korean 초6~고2)
**Subject:** Physics — electric circuits, Ohm's law, series and parallel, measurement
**MVP duration:** 3–4 weeks

---

## 0. One-page summary

VoltWorks is a circuit workbench built around a single question: **why does the same battery make one bulb bright and another dim?**

Students place a battery, bulbs, resistors, switches, wires, and meters on a grid. The app solves the circuit with modified nodal analysis (MNA), animates the current, and reports voltage, current, resistance, and power for every component. Mission cards ask students to predict brightness or meter readings before they connect anything, then explain the result with evidence.

The app is **not** an AI tutor. Every number comes from a deterministic linear solve. There are no generated explanations, no network calls, and no hidden model. The 3D view is a presentation layer for the same solved circuit; it never invents its own physics.

**Why this is a strong build**

- A real numerical method with exact expected answers: MNA, equivalent resistance, voltage division, and Kirchhoff's laws are all testable.
- Immediate visual feedback: current particles, bulb brightness, meter needles, and a short-circuit warning.
- Clear misconceptions to target: "current is used up by the first bulb", "the battery always gives the same current", "a voltmeter goes in series", "parallel is always brighter".
- The hard part is graph construction and validation, not rendering. That makes it a good fit for a coding model that can write pure solvers and unit tests.

**MVP shape**

- Components: battery (1.5 V, 3 V, 9 V), bulb, fixed resistor, switch, wire, ammeter, voltmeter.
- DC only; ideal wires and meters; constant-resistance bulbs.
- Series and parallel circuits with up to 30 components.
- Six missions, local progress, teacher mode, PWA.
- 2D schematic is the primary view; a 3D tabletop view is a visual layer.

---

## 1. Product definition

### 1.1 Learning problem

Students often memorize `V = IR` but cannot apply it to a circuit with more than one component. They think current is "used up" as it passes through a bulb, that a battery always pushes the same current, or that a voltmeter is connected in series like an ammeter. Static textbook diagrams do not let them move a meter, break a wire, or see the current change.

### 1.2 Learning goals

By the end of the core missions, a student should be able to:

- Build a closed series and parallel circuit and explain the difference.
- Apply Ohm's law to a component and to the whole circuit.
- Explain why current is the same at every point in a series loop.
- Explain why parallel branches share the battery voltage and split the current.
- Place an ammeter in series and a voltmeter in parallel.
- Predict bulb brightness from power, not from position in the loop.
- Find and fix an open circuit and a short circuit.
- Use measured values to justify a conclusion.

### 1.3 Core learning loop

1. **Predict** — the mission asks for brightness, current, or voltage before the circuit is complete.
2. **Build** — the student places components and wires on the grid.
3. **Measure** — the solver updates the meters and the current animation.
4. **Explain** — the student answers a short question using the measured evidence.
5. **Connect** — a one-sentence takeaway links the circuit to a real device.

### 1.4 Success criteria

- A student can build a series circuit and a parallel circuit from a blank canvas.
- A student can explain why the current is the same before and after a bulb in series.
- A student can place an ammeter and a voltmeter correctly without help.
- A student can predict which bulb is brighter in a given circuit and justify it with power.
- A student can identify and repair a short circuit.
- A teacher can reset progress, reveal answers, and print a worksheet without code changes.

---

## 2. Scope

### MVP (must ship)

- Battery with selectable voltage: 1.5 V, 3 V, 9 V.
- Bulb with a rated voltage and rated power; constant resistance in the MVP.
- Fixed resistors: 10 Ω, 47 Ω, 100 Ω, 220 Ω, 470 Ω, 1 kΩ.
- Switch (open/closed).
- Ideal wire with orthogonal routing.
- Ideal ammeter (0 V source) and ideal voltmeter (1 GΩ).
- Grid-based schematic editor with drag, rotate, and delete.
- MNA solver with ground selection and floating-node detection.
- Short-circuit, open-circuit, and meter-misconnection warnings.
- Current animation with direction and speed proportional to current.
- Bulb brightness from power.
- Component inspector with voltage, current, resistance, and power.
- 2D schematic view and a simple 3D tabletop view.
- Six missions with prediction gates and explanations.
- Local progress, teacher reset, printable worksheet.
- Responsive layout, keyboard alternative, reduced motion.
- PWA install and offline cache.

### Later (do not build in the first pass)

- Capacitors, inductors, and AC sources.
- Potentiometers and variable resistors.
- Non-ohmic bulb model with temperature-dependent resistance.
- Fuses and circuit breakers with reset.
- Breadboard view and physical board layout.
- Mesh-current and superposition tutorials.
- Classroom accounts or teacher dashboards.

### Out of scope

- Mains voltage, household wiring, or any real-world safety claim.
- PCB design, electromagnetic simulation, or SPICE-level device models.
- Any server, database, login, or analytics.
- Any runtime AI or generated explanations.
- Claims that the simulator can certify a real circuit as safe.

---

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite + TypeScript | Static output, fast iteration |
| 3D | Three.js | 3D tabletop view and current particles |
| 2D UI | Canvas 2D + DOM overlay | Precise schematic editing and hit testing |
| Circuit math | Pure TypeScript modules | Deterministic and unit-testable without a DOM |
| Math tests | Vitest | MNA, equivalent resistance, and validation tests |
| Browser tests | Playwright | Wiring, meters, missions, accessibility |
| PWA | `vite-plugin-pwa` | Offline classroom use |
| Hosting | GitHub Pages / Cloudflare Pages | No server |

**Constraints**

- Node.js 20+.
- No backend, no API keys, no runtime network calls.
- No external textures or model files. Use procedural materials and system fonts.
- Target 60 fps on a mid-range laptop and ≥ 30 fps on a school tablet.
- Initial gzip bundle under 800 KB.
- The solver must produce identical results for the same netlist and component values.

---

## 4. Architecture

### 4.1 Module map

```text
src/
  main.ts
  app/
    App.ts
    state.ts
    routes.ts
  circuit/
    types.ts             components, terminals, netlist
    geometry.ts          terminal positions and wire paths
    netlist.ts           wire/union-find node extraction
    mna.ts               matrix assembly and linear solve
    solve.ts             public solve API and result types
    validate.ts          floating nodes, shorts, meter checks
    power.ts             bulb brightness and component power
    units.ts             volts, amps, ohms, watts formatting
  editor/
    grid.ts
    placement.ts
    wiring.ts
    hitTest.ts
    commands.ts          undo/redo
  render/
    SchematicCanvas.ts
    WireRenderer.ts
    CurrentFlow.ts
    Scene3D.ts
    CameraRig.ts
  features/
    inspector/
    missions/
    teacher/
  data/
    missions.json
    components.json
  ui/
    components/
    styles/
  storage/
    progress.ts
  tests/
    unit/
    e2e/
```

### 4.2 Coordinate frames and units

- The schematic uses a logical grid: 1 cell = 20 px at base scale, with 10 px sub-grid snapping.
- Electrical units are SI: volts, amps, ohms, watts.
- The 3D view uses scene units where 1 grid cell = 0.5 units; convert only at the render boundary.
- Never mix pixel coordinates into the circuit math.

### 4.3 State

```ts
interface AppState {
  route: 'workbench' | 'missions' | 'teacher';
  editor: {
    components: CircuitComponent[];
    wires: Wire[];
    selection: { kind: 'component' | 'wire' | null; id: string | null };
    tool: 'select' | 'wire' | 'delete' | 'pan';
    gridSnap: boolean;
  };
  simulation: {
    running: boolean;
    result: SolveResult | null;
    error: CircuitError | null;
  };
  view: 'schematic' | 'tabletop';
  overlays: {
    current: boolean;
    voltages: boolean;
    labels: boolean;
    grid: boolean;
  };
  mission: {
    currentId: string | null;
    prediction: string | null;
    completed: string[];
  };
  preferences: {
    reducedMotion: boolean;
    theme: 'light' | 'dark';
  };
}
```

### 4.4 Persistence

- `localStorage` key: `voltworks.progress.v1`.
- Store completed missions, last mission id, answers, and view preferences.
- Optionally store the last circuit as a JSON snapshot, keyed by mission id.
- Teacher reset clears progress after confirmation.
- No personal data.

---

## 5. Data model

### 5.1 Components and terminals

```ts
type ComponentKind =
  | 'battery'
  | 'bulb'
  | 'resistor'
  | 'switch'
  | 'wire'
  | 'ammeter'
  | 'voltmeter';

interface Terminal {
  id: string;       // e.g. "battery-1:positive"
  componentId: string;
  role: 'positive' | 'negative' | 'a' | 'b' | 'common';
  x: number;        // logical grid position
  y: number;
}

interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  value?: number;   // volts or ohms
  rating?: { voltage: number; power: number }; // bulb
  closed?: boolean; // switch
}

interface Wire {
  id: string;
  points: { x: number; y: number }[];
}
```

### 5.2 Netlist

```ts
interface Netlist {
  nodes: number;                  // electrical nodes, including ground
  ground: number;
  resistors: ResistorElement[];
  voltageSources: VoltageSourceElement[];
  switches: SwitchElement[];
  ammeters: AmmeterElement[];
  voltmeters: VoltmeterElement[];
}

interface ResistorElement {
  id: string;
  a: number;      // node index
  b: number;
  resistance: number;
}

interface VoltageSourceElement {
  id: string;
  a: number;      // positive node
  b: number;      // negative node
  voltage: number;
}
```

### 5.3 Solve result

```ts
interface SolveResult {
  nodeVoltages: number[];              // volts, ground = 0
  sourceCurrents: Map<string, number>; // amps, positive from + to - inside source
  componentStates: Map<string, {
    voltage: number;
    current: number;
    power: number;
    brightness?: number;               // 0..1.5 for bulbs
  }>;
  warnings: CircuitWarning[];
}

interface CircuitWarning {
  code: 'floating' | 'open' | 'short' | 'meter-series' | 'meter-parallel' | 'no-ground';
  messageKo: string;
  componentIds: string[];
}
```

### 5.4 Mission

```ts
interface Mission {
  id: string;
  titleKo: string;
  concept: 'series' | 'parallel' | 'measurement' | 'short' | 'power' | 'divider';
  promptKo: string;
  setup: {
    presetCircuit?: string;
    allowedComponents: ComponentKind[];
    target?: string; // mission-specific check id
  };
  options: string[];
  answer: string;
  explanationKo: string;
  takeawayKo: string;
  difficulty: 1 | 2 | 3;
}
```

### 5.5 Constants

```ts
const GROUND_TOLERANCE = 1e-9;
const SHORT_RESISTANCE = 0.05;      // ohms between battery terminals
const SHORT_CURRENT = 10;           // amps
const AMMETER_VOLTAGE = 0;          // ammeter is a 0 V source
const VOLTMETER_RESISTANCE = 1e9;   // ohms
const CLOSED_SWITCH_RESISTANCE = 1e-3;
const MAX_COMPONENTS = 30;
const MAX_NODES = 40;
```

Keep these in one file with comments. Do not scatter magic numbers.

---

### 5.6 Mission content

The six missions are stored in `missions.json`. Each has a prediction gate before the student edits the circuit and an explanation gate after the solved values match.

1. `one-bulb` — **전구를 켜라**: battery, switch, and bulb. Predict whether the bulb lights before closing the switch; explain the closed loop.
2. `series-parallel` — **직렬과 병렬**: build both circuits. Predict which bulb is brighter; explain using voltage, current, and power.
3. `current-not-used` — **전류는 어디서 사라질까?**: measure the current before and after a bulb in series. Predict whether it changes; explain current conservation.
4. `meter-placement` — **계측기 연결**: place an ammeter in series and a voltmeter in parallel. Predict the readings; explain why the connections differ.
5. `short-circuit` — **단락을 찾아라**: a preset circuit contains a short. Predict which path the current takes; fix it and explain the warning.
6. `divider` — **9V에서 3V 만들기**: design a two-resistor divider. Predict the resistor ratio; measure the output and explain the result.

---

## 6. Core algorithms

### 6.1 From drawing to netlist

1. Create a terminal for every component pin.
2. Merge terminals connected by wires and closed switches with union-find.
3. Merge terminals that touch at the same grid point.
4. Assign electrical node indices; the battery negative terminal is the default ground.
5. Build resistor and voltage-source elements:
   - Bulb and resistor → resistor.
   - Battery → voltage source.
   - Closed switch → small resistor (1e-3 Ω).
   - Open switch → omitted.
   - Ammeter → 0 V voltage source.
   - Voltmeter → 1 GΩ resistor.
6. Reject circuits with more than 40 nodes or 30 components in the MVP.

**Important:** Wires are ideal and merge nodes. A wire crossing another wire without a junction dot must not connect. The editor must make this visible.

### 6.2 Modified nodal analysis

Unknowns:

```text
x = [v_1 ... v_{n-1}, i_1 ... i_m]ᵀ
```

where `v` are node voltages except ground and `i` are currents through voltage sources.

Matrix form:

```text
[ G  B ] [ v ]   [ i ]
[ Bᵀ 0 ] [ j ] = [ e ]
```

Stamps:

- Resistor between nodes `a` and `b` with conductance `g = 1/R`:

```text
G[a][a] += g
G[b][b] += g
G[a][b] -= g
G[b][a] -= g
```

- Voltage source between positive node `a` and negative node `b` with value `V`:

```text
B[a][k] += 1
B[b][k] -= 1
e[k] = V
```

Solve with Gaussian elimination with partial pivoting. Matrices are small, so a dense solver is enough.

**Sign convention:** `j[k]` is the current flowing from the positive terminal to the negative terminal *inside* the source. The current delivered to the external circuit is `-j[k]`. Tests must pin this convention with a simple battery-and-resistor circuit.

### 6.3 Component currents and voltages

- Resistor: `I = (V_a - V_b) / R`, positive from `a` to `b`.
- Battery: external current = `-j[k]`.
- Bulb: same as resistor; `P = I²R`; brightness = `clamp(P / ratedPower, 0, 1.5)`.
- Ammeter: current = `j[k]` for its 0 V source, with the sign convention above.
- Voltmeter: `V = V_a - V_b`; current is negligible but still computed.
- Power: `P = V × I`; for a resistor, `P = I²R`.

### 6.4 Validation

Run validation before and after the solve:

- **No ground:** no battery negative terminal or explicit ground → error.
- **Floating node:** a node with no path to ground → warning; show the node in the schematic.
- **Open circuit:** battery current below 1 µA and no voltmeter path → "회로가 열려 있습니다."
- **Short circuit:** equivalent resistance between battery terminals < 0.05 Ω or battery current > 10 A → "단락 회로입니다. 전선을 확인하세요."
- **Ammeter in parallel:** ammeter directly across a battery or a component with a parallel path → warning.
- **Voltmeter in series:** voltmeter is the only path in a branch → warning.
- **No battery:** "전원을 먼저 연결하세요."

Validation messages must point to the specific component ids so the editor can highlight them.

### 6.5 Wire routing and hit testing

- Wires are orthogonal polylines snapped to the grid.
- A wire is created by dragging from one terminal to another; intermediate points can be added.
- Junction dots appear when three or more wire segments meet.
- A crossing without a junction dot is not a connection.
- Hit testing priority: terminals > components > wires > empty grid.
- Deleting a component also deletes its attached wire endpoints; the user sees a preview.

### 6.6 Current animation

- Each wire segment carries the net branch current, derived from the solved component currents at its endpoints.
- Particle speed is proportional to `log1p(|I|)` so small and large currents are both visible.
- Particle direction follows the sign of the current.
- Particle count scales with segment length, capped at 2000 active particles.
- When the circuit is invalid or open, particles stop and the wire turns muted.
- Use a fixed timestep for animation; pause when the tab is hidden.

### 6.7 3D tabletop view

- Extrude the schematic onto a table: components become simple meshes, wires become tubes.
- Current particles follow the same 2D paths at a fixed height.
- Bulb brightness drives an emissive material and a soft point light.
- The 3D camera is orbit-only; no first-person navigation.
- The 3D view is optional and never changes the solved values.

### 6.8 Units and formatting

- Volt: `V`, amp: `A`, ohm: `Ω`, watt: `W`.
- Show 2 significant digits for small values and 3 for values ≥ 10.
- Use `mA`, `kΩ`, and `mW` when the value is far from 1.
- Never show `NaN` or `Infinity`; map solver failures to a user-facing warning.

### 6.9 Determinism

- No random values in the solver.
- Component ids are stable strings, not array indices.
- The same netlist and values must produce the same result across runs and platforms within 1e-9.
- Tests compare against hand-calculated values, not snapshots of floating-point noise.

---

## 7. Screens and UX

### 7.1 Workbench

- **Left:** component tray grouped by source, load, control, and meter.
- **Center:** schematic canvas with grid, zoom, pan, and wire tool.
- **Right:** inspector for the selected component and a live meter panel.
- **Top:** run/pause, reset, undo/redo, view toggle, help.
- **Bottom:** mission strip with the current prompt, prediction, and check button.

### 7.2 Inspector and meters

- Selected component: name, value, voltage, current, power, and brightness.
- Circuit summary: total current, total power, equivalent resistance seen by the battery.
- Meters show a digital readout and a small analog gauge.
- Warning cards are clickable and highlight the offending component.

### 7.3 Mission screen

- Prediction card with a question and 3–4 options.
- The preset circuit is loaded but the key component may be missing.
- The student builds or edits the circuit, then presses "측정".
- The app checks the solved values with tolerances, not exact pixels.
- On success: explanation, takeaway, and a "next mission" button.
- On failure: a hint that points to the evidence, not the answer.

### 7.4 Teacher mode

- Mission list with concepts, answers, and explanations.
- Show the target circuit and expected meter readings.
- Reset progress.
- Print a worksheet with circuit diagrams and blank measurement tables.
- Toggle answer visibility for classroom projection.

### 7.5 Responsive layout

**Desktop (≥ 1024 px)**

- Three columns: tray, canvas, inspector.

**Tablet (768–1023 px)**

- Canvas with collapsible left and right drawers.

**Phone (< 768 px)**

- Canvas at the top; bottom sheet tabs: Parts | Inspect | Mission.
- Large touch targets and a simplified wire tool.
- Pinch to zoom; two-finger pan.

### 7.6 Accessibility

- Keyboard path: `Tab` through the tray, `Enter` to place, arrow keys to move, `W` to start a wire, `Enter` to connect, `Delete` to remove.
- Every circuit state has a text summary: component list, connections, solved values, warnings.
- Screen reader announces meter changes and warnings.
- Respect `prefers-reduced-motion`: no current particles when reduced motion is on; use static arrows instead.
- Do not encode voltage or current by color alone; show numbers and labels.
- Provide a "read the circuit" panel that describes the netlist in words.
- Ensure warnings are announced with `aria-live="polite"`.

---

## 8. Implementation milestones

### M0 — Setup (0.5 day)

- Scaffold Vite + TypeScript + Three.js.
- Add Vitest, Playwright, ESLint, Prettier, PWA plugin.
- Create the module map and a blank canvas.
- **Verify:** dev server, build, and tests run.

### M1 — Circuit core (3–4 days)

- Implement component types, netlist extraction, MNA assembly, and the linear solver.
- Write unit tests for a single resistor, series, parallel, and a voltage divider.
- Implement validation for ground, floating nodes, and shorts.
- **Verify:** all solver tests pass without a DOM.

### M2 — Schematic editor (3–4 days)

- Implement the grid, placement, rotation, wiring, junction dots, and hit testing.
- Add undo/redo and delete.
- Build the inspector and meter panel.
- **Verify:** a student can build a battery–switch–bulb circuit from scratch.

### M3 — Solving and feedback (2–3 days)

- Connect the editor to the solver on every valid edit.
- Add bulb brightness, current animation, and warning highlights.
- Add the run/pause and reset controls.
- **Verify:** series and parallel brightness match hand calculations.

### M4 — Meters and missions (2–3 days)

- Implement ammeter and voltmeter behavior and misconnection warnings.
- Author six missions with prediction and explanation gates.
- Add progress persistence and teacher reset.
- **Verify:** each mission can be completed from a fresh state.

### M5 — 3D tabletop view (2 days)

- Extrude components and wires into a simple 3D table.
- Add current particles, bulb glow, and orbit controls.
- **Verify:** the 3D view matches the 2D solved values.

### M6 — Responsive, accessibility, PWA (2 days)

- Implement the three layouts.
- Add keyboard controls, text summaries, reduced motion.
- Configure offline caching.
- **Verify:** keyboard-only completion; offline reload.

### M7 — QA and pilot (2 days)

- Run all tests and screenshot checks.
- Test on a low-end tablet.
- Ask 3–5 students to try the series, parallel, and meter missions.
- Fix the top usability issues.
- Deploy.
- **Verify:** acceptance criteria below are met.

---

## 9. Testing and verification

### Unit tests (Vitest)

- Single battery and resistor: `I = V/R`, node voltages correct.
- Two resistors in series: equivalent resistance and voltage division.
- Two resistors in parallel: equivalent resistance and current split.
- Bulb power and brightness at rated voltage.
- Ammeter current sign and magnitude in a series loop.
- Voltmeter reading across a resistor.
- Open switch: no current; no false short warning.
- Short circuit: warning and current clamp.
- Floating node: warning, not a crash.
- Singular matrix: mapped to a user-facing error.
- Determinism: repeated solves return identical values within 1e-9.

### Interaction tests (Playwright)

- Place a battery, switch, and bulb; wire them; close the switch; confirm brightness.
- Add a second bulb in series and in parallel; confirm the readings change.
- Rotate and delete a component.
- Create a crossing wire without a junction; confirm it does not connect.
- Place an ammeter in series and read the current.
- Place a voltmeter in parallel and read the voltage.
- Trigger and fix a short circuit.
- Complete a mission correctly and incorrectly.
- Reset progress in teacher mode.
- Keyboard-only path through the one-bulb mission.

### Visual tests

- Screenshot a series circuit, a parallel circuit, and a short circuit.
- Screenshot the inspector and meter panel.
- Run at 1440×900, 1024×768, and 390×844.
- Check that warning highlights are visible without color alone.

### Accessibility checks

- `axe-core` scan with no critical issues.
- Keyboard reaches every control.
- Reduced motion stops current particles and uses static arrows.
- Text summary matches the current circuit.
- Warnings are announced by screen readers.

### Performance budget

- 60 fps on a mid-range laptop; ≥ 30 fps on a school tablet.
- Solve time < 5 ms for 40 nodes on a mid-range laptop.
- No per-frame object creation.
- Pause rendering when the tab is hidden.
- DPR clamp to 2.
- Initial load < 2.5 s on simulated 4G.

---

## 10. Acceptance criteria / Go-No-Go

- [ ] A student can build a battery–switch–bulb circuit from a blank canvas.
- [ ] Series and parallel circuits produce correct currents and voltages.
- [ ] Bulb brightness follows `P = I²R` and the rated power.
- [ ] An ammeter in series reads the correct current.
- [ ] A voltmeter in parallel reads the correct voltage.
- [ ] A short circuit is detected and explained.
- [ ] An open circuit is detected and explained.
- [ ] A wire crossing without a junction does not connect.
- [ ] Six missions are playable, scored, and saved locally.
- [ ] Teacher reset works.
- [ ] Keyboard-only mission completion works.
- [ ] Reduced motion is respected.
- [ ] The app works offline after the first load.
- [ ] No runtime network calls to an AI service or backend.
- [ ] The "ideal component model" notice is visible in the workbench.

If the series, parallel, or meter tests fail, stop and fix the solver before adding missions.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| MNA sign or ground errors teach wrong physics | Core learning fails | Hand-calculated golden tests; explicit sign convention; teacher review |
| Wire crossings accidentally connect | Wrong circuit | Junction-dot rule; interaction test for crossings |
| A short circuit produces huge numbers or NaNs | Unusable UI | Current clamp, short detection, user-facing warning |
| Ideal meters behave unlike real meters | Misconception | Label "ideal meter" and explain the assumption in the inspector |
| Bulb brightness is confused with current | Misconception | Show power and brightness separately; mission on power |
| 3D view diverges from the 2D solution | Confusing feedback | 3D reads only the solved result; no separate physics |
| Dense solver becomes slow with large circuits | Performance | MVP caps at 40 nodes; dense solve is fine |
| Drag-and-drop wiring is inaccessible | Some students cannot build | Full keyboard path and click-to-connect alternative |
| Students think the simulator certifies real wiring | Safety misconception | Persistent "low-voltage educational model" notice; no mains content |

---

## 12. AI build guide

Use the AI coding agent for scaffolding, the MNA solver, the editor, tests, and screenshot-driven fixes. Circuit sign conventions are easy to get subtly wrong, so tests and teacher review are mandatory.

### Recommended build order

1. Scaffold Vite + TypeScript + Three.js with tests.
2. Implement the pure netlist and MNA modules and unit tests first.
3. Build the schematic editor without animation.
4. Connect the solver and inspector.
5. Add current animation and bulb brightness.
6. Add meters and misconnection warnings.
7. Add missions and teacher mode.
8. Add the 3D tabletop view.
9. Do responsive/accessibility passes.
10. Use screenshots at three viewports and fix visual regressions.

### Prompt rules

- State the constraint: “No backend, no runtime AI, no network calls.”
- Require a test for every solver rule.
- Ask the agent to write the MNA stamps and sign convention in comments before coding.
- Use hand-calculated values in tests, not snapshots of floating-point noise.
- Never let the app claim to certify real wiring or safety.
- Provide screenshots when fixing editor or 3D issues.

### What not to delegate

- The decision that the ideal-component model is pedagogically acceptable.
- The final review of meter placement and sign conventions.
- Accessibility judgment.
- Classroom pilot feedback.

### Definition of done

- All solver and interaction tests pass.
- The acceptance checklist is complete.
- A teacher can run the six missions without developer help.
- The model's simplifications are visible in the UI.

---

## 13. Future extensions

- Non-ohmic bulb model with temperature-dependent resistance.
- Capacitors and RC transient labs.
- Inductors and simple AC circuits.
- Potentiometers and variable resistors.
- Fuse and breaker behavior with reset.
- Breadboard and physical board layout.
- Mesh-current and superposition tutorial modes.
- Circuit import/export with a simple JSON format.
- Classroom worksheet generator.
- Localization.

---

## 14. References

- MIT OpenCourseWare — Circuits and Electronics: https://ocw.mit.edu/
- All About Circuits — DC network analysis: https://www.allaboutcircuits.com/
- Khan Academy — Electric circuits: https://www.khanacademy.org/science/physics/circuits-topic
- Three.js documentation: https://threejs.org/docs/
- MDN Web APIs: https://developer.mozilla.org/en-US/docs/Web/API
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/

---

**Plan version:** 1.0
**Created:** 2026-10-28
**Next step:** scaffold the project, then implement M1 (netlist + MNA + tests) before building the editor.
