/**
 * Single home for electrical and editor constants.
 * Keep magic numbers out of solvers, renderers, and the UI.
 */

/** Voltages available on the battery part. */
export const BATTERY_VOLTAGES = [1.5, 3, 9] as const;

/** Fixed resistors available in the part tray. */
export const RESISTOR_VALUES = [10, 47, 100, 220, 470, 1000] as const;

/** The MVP bulb is a constant-resistance 3 V / 0.6 W lamp (15 Ω). */
export const BULB_RATING = { voltage: 3, power: 0.6 } as const;

export const AMMETER_VOLTAGE = 0;
export const VOLTMETER_RESISTANCE = 1e9;
export const CLOSED_SWITCH_RESISTANCE = 1e-3;

/** A voltage source whose terminals become the same electrical node is a dead short. */
export const SHORT_RESISTANCE = 0.05;
export const SHORT_CURRENT = 10;

export const OPEN_CIRCUIT_CURRENT = 1e-6;
export const VOLTAGE_EPSILON = 1e-9;

export const MAX_COMPONENTS = 30;
export const MAX_NODES = 40;

/** Passive leakage used only to keep a floating matrix solvable if filtering misses a node. */
export const GMIN = 1e-12;

export const GRID_CELL_PX = 20;
export const GRID_SUBSTEP_PX = 10;
export const SCENE_UNITS_PER_CELL = 0.5;

export const STORAGE_KEY = 'voltworks.progress.v1';
export const CIRCUIT_STORAGE_PREFIX = 'voltworks.circuit.v1.';
