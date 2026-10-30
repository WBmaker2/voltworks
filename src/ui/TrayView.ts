import type { AppContext } from '../app/context';
import { BATTERY_VOLTAGES, RESISTOR_VALUES } from '../circuit/constants';
import type { ComponentKind } from '../circuit/types';
import { formatOhmsShort, formatVoltsShort } from '../circuit/units';
import { CATALOG, CATEGORY_LABELS } from '../data/components';
import { missionById } from '../data/missions';
import { PRESET_META, presetKeys } from '../data/presets';
import { icon, type IconName } from './icons';

const ICONS: Record<ComponentKind, IconName> = {
  battery: 'battery',
  bulb: 'bulb',
  resistor: 'resistor',
  switch: 'switch',
  ammeter: 'ammeter',
  voltmeter: 'voltmeter'
};

const ORDER: Array<'source' | 'load' | 'control' | 'meter'> = [
  'source',
  'load',
  'control',
  'meter'
];

export function renderTray(context: AppContext): string {
  const state = context.store.get();
  const mission = missionById(state.mission.currentId);
  const allowed = mission?.setup.allowedComponents;

  const config = `
    <div class="tray-config">
      <label class="mini-field">
        <span>새 전지</span>
        <select data-action="placement-battery" data-focus-key="placement-battery" aria-label="새 전지 전압">
          ${BATTERY_VOLTAGES.map(
            (voltage) =>
              `<option value="${voltage}" ${state.editor.placementValues.battery === voltage ? 'selected' : ''}>${formatVoltsShort(voltage)}</option>`
          ).join('')}
        </select>
      </label>
      <label class="mini-field">
        <span>새 저항</span>
        <select data-action="placement-resistor" data-focus-key="placement-resistor" aria-label="새 저항 값">
          ${RESISTOR_VALUES.map(
            (value) =>
              `<option value="${value}" ${state.editor.placementValues.resistor === value ? 'selected' : ''}>${formatOhmsShort(value)}</option>`
          ).join('')}
        </select>
      </label>
    </div>
  `;

  const groups = ORDER.map((category) => {
    const items = CATALOG.filter((item) => item.category === category);
    if (items.length === 0) return '';
    return `
      <section class="tray-group" aria-labelledby="tray-${category}">
        <h3 id="tray-${category}" class="group-label">${CATEGORY_LABELS[category]}</h3>
        <div class="tray-list">
          ${items
            .map((item) => {
              const disabled = allowed ? !allowed.includes(item.kind) : false;
              const armed = state.editor.armedKind === item.kind;
              return `
                <button
                  class="tray-item ${armed ? 'is-armed' : ''} ${disabled ? 'is-disabled' : ''}"
                  type="button"
                  data-kind="${item.kind}"
                  data-focus-key="tray-${item.kind}"
                  aria-pressed="${armed}"
                  ${disabled ? 'disabled aria-disabled="true"' : ''}
                  title="${disabled ? '이 미션에서는 사용할 수 없습니다.' : item.hintKo}"
                >
                  <span class="tray-icon">${icon(ICONS[item.kind], 26)}</span>
                  <span class="tray-copy">
                    <strong>${item.labelKo}</strong>
                    <small>${item.specKo}</small>
                  </span>
                  <span class="tray-state">${armed ? '놓는 중' : disabled ? '잠김' : ''}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </section>
    `;
  }).join('');

  return `
    ${config}
    ${groups}
    <div class="tray-presets">
      <label class="mini-field">
        <span>예제 회로</span>
        <select data-action="load-preset" data-focus-key="load-preset" aria-label="예제 회로 불러오기" ${mission ? 'disabled' : ''}>
          <option value="" selected disabled>예제 불러오기</option>
          ${presetKeys()
            .filter((key) => key !== 'one-bulb-gap')
            .map((key) => `<option value="${key}">${PRESET_META[key].nameKo}</option>`)
            .join('')}
        </select>
      </label>
      ${mission ? '<p class="mini-note">미션 중에는 예제를 불러올 수 없습니다.</p>' : ''}
    </div>
    <p class="tray-note">부품을 고른 뒤 작업대를 클릭하세요. Tab과 Enter로도 놓을 수 있습니다.</p>
  `;
}
