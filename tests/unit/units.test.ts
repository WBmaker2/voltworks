import { describe, expect, it } from 'vitest';
import {
  formatCurrent,
  formatPower,
  formatResistance,
  formatVoltage,
  formatVoltsShort
} from '../../src/circuit/units';

describe('unit formatting', () => {
  it('formats resistance without eating significant zeros', () => {
    expect(formatResistance(10)).toBe('10 Ω');
    expect(formatResistance(47)).toBe('47 Ω');
    expect(formatResistance(100)).toBe('100 Ω');
    expect(formatResistance(220)).toBe('220 Ω');
    expect(formatResistance(470)).toBe('470 Ω');
    expect(formatResistance(1000)).toBe('1 kΩ');
  });

  it('uses the right prefix for voltage and current', () => {
    expect(formatVoltage(0)).toBe('0 V');
    expect(formatVoltage(3)).toBe('3 V');
    expect(formatVoltage(0.5)).toBe('500 mV');
    expect(formatVoltage(1500)).toBe('1.5 kV');
    expect(formatCurrent(0.2)).toBe('200 mA');
    expect(formatCurrent(0.0005)).toBe('500 µA');
    expect(formatCurrent(2)).toBe('2 A');
    expect(formatPower(0.6)).toBe('600 mW');
    expect(formatPower(0.15)).toBe('150 mW');
  });

  it('uses compact labels on the schematic', () => {
    expect(formatVoltsShort(3)).toBe('3V');
    expect(formatVoltsShort(1.5)).toBe('1.5V');
  });

  it('never prints NaN or Infinity', () => {
    expect(formatVoltage(Number.NaN)).toBe('—');
    expect(formatCurrent(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatPower(Number.NaN)).toBe('—');
    expect(formatResistance(Number.NaN)).toBe('—');
  });
});
