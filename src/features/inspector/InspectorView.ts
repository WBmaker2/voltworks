import type { AppContext } from '../../app/context';
import { BULB_RATING, RESISTOR_VALUES } from '../../circuit/constants';
import { summarizeCircuit } from '../../circuit/power';
import { buildNetlist } from '../../circuit/netlist';
import type { CircuitComponent, CircuitWarning, SolveResult } from '../../circuit/types';
import {
  formatCurrent,
  formatPower,
  formatResistance,
  formatVoltage,
  formatVoltsShort
} from '../../circuit/units';
import { catalogItem } from '../../data/components';
import { icon } from '../../ui/icons';
import { componentLabel, describeCircuit, meterFraction, readingForMeter } from './summary';

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function gaugeSvg(fraction: number, reading: string, label: string): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const angle = Math.PI + clamped * Math.PI;
  const needleX = 60 + Math.cos(angle) * 38;
  const needleY = 56 + Math.sin(angle) * 38;
  const ticks = Array.from({ length: 7 }, (_, index) => {
    const tickAngle = Math.PI + (index / 6) * Math.PI;
    const x1 = 60 + Math.cos(tickAngle) * 45;
    const y1 = 56 + Math.sin(tickAngle) * 45;
    const x2 = 60 + Math.cos(tickAngle) * 50;
    const y2 = 56 + Math.sin(tickAngle) * 50;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
  }).join('');
  return `
    <svg class="gauge" viewBox="0 0 120 72" role="img" aria-label="${esc(label)} ${esc(reading)}">
      <path class="gauge-arc" d="M10 56 A50 50 0 0 1 110 56" />
      <g class="gauge-ticks">${ticks}</g>
      <line class="gauge-needle" x1="60" y1="56" x2="${needleX.toFixed(1)}" y2="${needleY.toFixed(1)}" />
      <circle class="gauge-hub" cx="60" cy="56" r="3.5" />
      <text class="gauge-reading" x="60" y="69" text-anchor="middle">${esc(reading)}</text>
    </svg>
  `;
}

function stat(label: string, value: string, hint = ''): string {
  return `
    <div class="stat">
      <span class="stat-label">${esc(label)}</span>
      <strong class="stat-value">${esc(value)}</strong>
      ${hint ? `<span class="stat-hint">${esc(hint)}</span>` : ''}
    </div>
  `;
}

function warningsSection(warnings: CircuitWarning[]): string {
  if (warnings.length === 0) {
    return `
      <div class="status-ok">
        ${icon('check', 15)}
        <span>경고 없음 · 회로가 정상적으로 계산되었습니다.</span>
      </div>
    `;
  }
  return `
    <div class="warning-list" aria-live="polite" aria-label="회로 경고">
      ${warnings
        .map(
          (warning, index) => `
          <button class="warning-card" type="button" data-action="select-warning" data-index="${index}" data-focus-key="warning-${index}">
            <span class="warning-mark">${icon('warning', 16)}</span>
            <span>${esc(warning.messageKo)}</span>
          </button>
        `
        )
        .join('')}
    </div>
  `;
}

function componentDetail(component: CircuitComponent, result: SolveResult | null): string {
  const state = result?.componentStates.get(component.id);
  const meta = catalogItem(component.kind);
  const controls: string[] = [];
  const stats: string[] = [];

  if (component.kind === 'battery') {
    controls.push(`
      <div class="segmented" role="group" aria-label="전지 전압">
        ${[1.5, 3, 9]
          .map(
            (voltage) => `
            <button type="button" data-action="set-voltage" data-id="${component.id}" data-value="${voltage}"
              aria-pressed="${(component.value ?? 3) === voltage}" data-focus-key="battery-${voltage}">
              ${formatVoltsShort(voltage)}
            </button>
          `
          )
          .join('')}
      </div>
    `);
    stats.push(stat('공급 전류', formatCurrent(state?.current ?? 0)));
    stats.push(stat('공급 전력', formatPower(state?.power ?? 0)));
    stats.push(stat('내부 저항', '0 Ω'));
  } else if (component.kind === 'resistor') {
    controls.push(`
      <label class="field">
        <span>저항값</span>
        <select data-action="set-resistor" data-id="${component.id}" data-focus-key="resistor-value">
          ${RESISTOR_VALUES.map(
            (value) =>
              `<option value="${value}" ${component.value === value ? 'selected' : ''}>${formatResistance(value)}</option>`
          ).join('')}
        </select>
      </label>
    `);
    stats.push(stat('저항값', formatResistance(component.value ?? 100)));
    stats.push(stat('전압', formatVoltage(state?.voltage ?? 0)));
    stats.push(stat('전류', formatCurrent(state?.current ?? 0)));
    stats.push(stat('전력', formatPower(state?.power ?? 0)));
  } else if (component.kind === 'switch') {
    controls.push(`
      <button class="btn btn--primary btn--block" type="button" data-action="toggle-switch" data-id="${component.id}" data-focus-key="toggle-switch">
        ${component.closed ? '스위치 열기' : '스위치 닫기'}
      </button>
    `);
    stats.push(stat('상태', component.closed ? '닫힘' : '열림'));
    stats.push(stat('접촉 저항', component.closed ? '1 mΩ' : '열림'));
    stats.push(stat('전압', formatVoltage(state?.voltage ?? 0)));
    stats.push(stat('전류', formatCurrent(state?.current ?? 0)));
  } else if (component.kind === 'bulb') {
    const brightness = state?.brightness ?? 0;
    const percent = Math.round(brightness * 100);
    controls.push(`
      <div class="brightness">
        <div class="brightness-head">
          <span>밝기</span>
          <strong>${percent}%</strong>
        </div>
        <div class="brightness-track" role="meter" aria-label="전구 밝기" aria-valuemin="0" aria-valuemax="150" aria-valuenow="${percent}">
          <span style="width:${Math.min(100, percent)}%"></span>
        </div>
        <p class="mini-note">정격 ${BULB_RATING.voltage}V · ${BULB_RATING.power}W · 일정 저항 15Ω</p>
        ${percent > 105 ? '<p class="overload-note">정격을 넘었습니다. 밝기 계산은 150%에서 멈춥니다.</p>' : ''}
      </div>
    `);
    stats.push(stat('저항', '15 Ω'));
    stats.push(stat('전압', formatVoltage(state?.voltage ?? 0)));
    stats.push(stat('전류', formatCurrent(state?.current ?? 0)));
    stats.push(stat('전력', formatPower(state?.power ?? 0)));
  } else if (component.kind === 'ammeter') {
    controls.push(`
      <div class="meter-large">
        <span class="meter-kind">전류계 · 직렬</span>
        <strong>${formatCurrent(state?.current ?? 0)}</strong>
        <span class="meter-sub">이상적 전류계 · 0Ω</span>
      </div>
      ${gaugeSvg(meterFraction(component, result), readingForMeter(component, result), componentLabel(component))}
    `);
    stats.push(stat('전류', formatCurrent(state?.current ?? 0)));
    stats.push(stat('전압', formatVoltage(state?.voltage ?? 0)));
    stats.push(stat('내부 저항', '0 Ω'));
  } else if (component.kind === 'voltmeter') {
    controls.push(`
      <div class="meter-large">
        <span class="meter-kind">전압계 · 병렬</span>
        <strong>${formatVoltage(state?.voltage ?? 0)}</strong>
        <span class="meter-sub">이상적 전압계 · 1GΩ</span>
      </div>
      ${gaugeSvg(meterFraction(component, result), readingForMeter(component, result), componentLabel(component))}
    `);
    stats.push(stat('전압', formatVoltage(state?.voltage ?? 0)));
    stats.push(stat('전류', formatCurrent(state?.current ?? 0)));
    stats.push(stat('내부 저항', '1 GΩ'));
  }

  return `
    <section class="inspector-section" aria-labelledby="selected-heading">
      <div class="section-head">
        <div>
          <div class="section-kicker">선택한 부품</div>
          <h2 id="selected-heading">${esc(meta.labelKo)} <span class="id-tag">${esc(component.id)}</span></h2>
        </div>
        <span class="kind-tag">${esc(meta.labelKo)}</span>
      </div>
      <p class="component-hint">${esc(meta.hintKo)}</p>
      ${controls.join('')}
      <div class="stat-grid">${stats.join('')}</div>
      <div class="button-row">
        <button class="btn" type="button" data-action="rotate" data-focus-key="rotate">${icon('rotate', 15)} 회전 <kbd>R</kbd></button>
        <button class="btn btn--danger" type="button" data-action="delete" data-focus-key="delete">${icon('trash', 15)} 삭제 <kbd>Del</kbd></button>
      </div>
    </section>
  `;
}

function wireDetail(context: AppContext): string {
  const state = context.store.get();
  const wire = state.editor.wires.find((item) => item.id === state.editor.selection.id);
  if (!wire) return '';
  return `
    <section class="inspector-section">
      <div class="section-head">
        <div>
          <div class="section-kicker">선택한 전선</div>
          <h2>전선 <span class="id-tag">${esc(wire.id)}</span></h2>
        </div>
        <span class="kind-tag">이상적 도선</span>
      </div>
      <p class="component-hint">전선은 저항이 0Ω인 이상적 도선입니다. 교차점에 점이 없으면 연결되지 않습니다.</p>
      <div class="stat-grid">
        ${stat('구간', String(wire.points.length - 1))}
        ${stat('저항', '0 Ω')}
      </div>
      <button class="btn btn--danger" type="button" data-action="delete" data-focus-key="delete">${icon('trash', 15)} 전선 삭제 <kbd>Del</kbd></button>
    </section>
  `;
}

function metersSection(result: SolveResult | null, components: CircuitComponent[]): string {
  const meters = components.filter(
    (component) => component.kind === 'ammeter' || component.kind === 'voltmeter'
  );
  if (meters.length === 0) return '';
  return `
    <section class="inspector-section">
      <div class="section-kicker">계측기</div>
      <div class="meter-list" role="status" aria-live="polite">
        ${meters
          .map((meter) => {
            const reading = readingForMeter(meter, result);
            return `
              <div class="meter-row">
                <div class="meter-row-copy">
                  <strong>${esc(catalogItem(meter.kind).labelKo)} ${esc(meter.id)}</strong>
                  <span>${meter.kind === 'ammeter' ? '회로와 직렬' : '측정 부품과 병렬'}</span>
                </div>
                <div class="meter-row-reading">${esc(reading)}</div>
              </div>
            `;
          })
          .join('')}
      </div>
    </section>
  `;
}

export function renderInspector(context: AppContext): string {
  const state = context.store.get();
  const result = state.simulation.result;
  const circuit = { components: state.editor.components, wires: state.editor.wires };
  const selectedComponent =
    state.editor.selection.kind === 'component'
      ? state.editor.components.find((component) => component.id === state.editor.selection.id)
      : null;
  const netlist = buildNetlist(circuit);
  const summary = result ? summarizeCircuit(circuit, netlist, result) : null;
  const description = describeCircuit(circuit, result);

  const summaryBlock = `
    <section class="inspector-section">
      <div class="section-kicker">회로 요약</div>
      ${
        summary && summary.batteryId
          ? `
            <div class="hero-reading">
              <strong>${formatCurrent(summary.sourceCurrent)}</strong>
              <span>전지가 공급하는 전류</span>
            </div>
            <div class="stat-grid">
              ${stat('전지 전압', formatVoltage(summary.sourceVoltage))}
              ${stat('전체 전력', formatPower(summary.totalPower))}
              ${stat('등가 저항', summary.equivalentResistance === null ? '—' : formatResistance(summary.equivalentResistance))}
              ${stat('부품 수', String(state.editor.components.length))}
            </div>
          `
          : `<p class="empty-copy">전지를 놓고 전선으로 회로를 닫으면 계산이 시작됩니다.</p>`
      }
      ${warningsSection(result?.warnings ?? [])}
    </section>
  `;

  const detail = selectedComponent
    ? componentDetail(selectedComponent, result)
    : state.editor.selection.kind === 'wire'
      ? wireDetail(context)
      : '';

  return `
    <div class="inspector-scroll">
      ${detail}
      ${summaryBlock}
      ${metersSection(result, state.editor.components)}
      <section class="inspector-section">
        <details class="read-panel">
          <summary>회로 읽기</summary>
          ${description.map((line) => `<p>${esc(line)}</p>`).join('')}
        </details>
      </section>
      <section class="inspector-section model-note">
        <div class="section-kicker">모델 안내</div>
        <p>전선 0Ω · 전류계 0Ω · 전압계 1GΩ · 전구는 일정 저항으로 계산합니다. 교육용 저전압 회로 모델이며 실제 배선의 안전을 보증하지 않습니다.</p>
      </section>
    </div>
  `;
}
