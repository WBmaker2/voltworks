import { CIRCUIT_STORAGE_PREFIX, STORAGE_KEY } from '../circuit/constants';
import type { Circuit, MissionProgress, ProgressData } from '../circuit/types';

const DEFAULT_PREFERENCES: ProgressData['preferences'] = {
  reducedMotion: false,
  theme: 'light',
  view: 'schematic',
  overlays: {
    current: true,
    voltages: false,
    labels: true,
    grid: true
  }
};

export function defaultProgress(): ProgressData {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    completed: [],
    lastMissionId: null,
    answers: {},
    preferences: { ...DEFAULT_PREFERENCES, reducedMotion: prefersReducedMotion }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadProgress(): ProgressData {
  const fallback = defaultProgress();
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const completed = Array.isArray(parsed.completed)
      ? parsed.completed.filter((id): id is string => typeof id === 'string')
      : [];
    const answers: Record<string, MissionProgress> = {};
    if (isRecord(parsed.answers)) {
      for (const [id, value] of Object.entries(parsed.answers)) {
        if (!isRecord(value)) continue;
        answers[id] = {
          prediction: typeof value.prediction === 'string' ? value.prediction : null,
          explanation: typeof value.explanation === 'string' ? value.explanation : null,
          stage: typeof value.stage === 'number' ? value.stage : 0,
          measured: value.measured === true,
          targetPassed: value.targetPassed === true
        };
      }
    }
    const preferences = isRecord(parsed.preferences) ? parsed.preferences : {};
    const overlays = isRecord(preferences.overlays) ? preferences.overlays : {};
    return {
      completed,
      lastMissionId: typeof parsed.lastMissionId === 'string' ? parsed.lastMissionId : null,
      answers,
      preferences: {
        reducedMotion:
          typeof preferences.reducedMotion === 'boolean'
            ? preferences.reducedMotion
            : fallback.preferences.reducedMotion,
        theme: preferences.theme === 'dark' ? 'dark' : 'light',
        view: preferences.view === 'tabletop' ? 'tabletop' : 'schematic',
        overlays: {
          current:
            typeof overlays.current === 'boolean'
              ? overlays.current
              : DEFAULT_PREFERENCES.overlays.current,
          voltages:
            typeof overlays.voltages === 'boolean'
              ? overlays.voltages
              : DEFAULT_PREFERENCES.overlays.voltages,
          labels:
            typeof overlays.labels === 'boolean'
              ? overlays.labels
              : DEFAULT_PREFERENCES.overlays.labels,
          grid:
            typeof overlays.grid === 'boolean' ? overlays.grid : DEFAULT_PREFERENCES.overlays.grid
        }
      }
    };
  } catch {
    return fallback;
  }
}

export function saveProgress(progress: ProgressData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable in private mode. The app still works in memory.
  }
}

export function saveCircuitSnapshot(missionId: string, circuit: Circuit): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`${CIRCUIT_STORAGE_PREFIX}${missionId}`, JSON.stringify(circuit));
  } catch {
    // Ignore quota errors; a snapshot is a convenience, not the source of truth.
  }
}

export function loadCircuitSnapshot(missionId: string): Circuit | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CIRCUIT_STORAGE_PREFIX}${missionId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (!Array.isArray(parsed.components) || !Array.isArray(parsed.wires)) return null;
    return parsed as unknown as Circuit;
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(CIRCUIT_STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}
