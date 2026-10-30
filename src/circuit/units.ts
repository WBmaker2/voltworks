function significant(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 10 ? 3 : 2;
  let text = value.toPrecision(digits);
  if (text.includes('e')) {
    text = value.toFixed(abs >= 10 ? 2 : 3);
  }
  if (text.includes('.')) {
    text = text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  return text === '-0' ? '0' : text;
}

function withPrefix(
  value: number,
  units: Array<{ threshold: number; factor: number; suffix: string }>,
  baseSuffix: string,
  zeroLabel: string
): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs < 1e-12) return zeroLabel;
  for (const unit of units) {
    if (abs >= unit.threshold) {
      return `${significant(value / unit.factor)} ${unit.suffix}`;
    }
  }
  return `${significant(value)} ${baseSuffix}`;
}

export function formatVoltage(value: number): string {
  return withPrefix(
    value,
    [
      { threshold: 1000, factor: 1000, suffix: 'kV' },
      { threshold: 1, factor: 1, suffix: 'V' },
      { threshold: 1e-3, factor: 1e-3, suffix: 'mV' },
      { threshold: 1e-6, factor: 1e-6, suffix: 'µV' }
    ],
    'V',
    '0 V'
  );
}

export function formatVoltageMilli(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1) return `${significant(value * 1000)} mV`;
  return formatVoltage(value);
}

export function formatCurrent(value: number): string {
  return withPrefix(
    value,
    [
      { threshold: 1, factor: 1, suffix: 'A' },
      { threshold: 1e-3, factor: 1e-3, suffix: 'mA' },
      { threshold: 1e-6, factor: 1e-6, suffix: 'µA' }
    ],
    'A',
    '0 A'
  );
}

export function formatResistance(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value >= 1e6) return `${significant(value / 1e6)} MΩ`;
  if (value >= 1e3) return `${significant(value / 1e3)} kΩ`;
  if (value < 1) return `${significant(value)} Ω`;
  return `${significant(value)} Ω`;
}

export function formatPower(value: number): string {
  return withPrefix(
    value,
    [
      { threshold: 1000, factor: 1000, suffix: 'kW' },
      { threshold: 1, factor: 1, suffix: 'W' },
      { threshold: 1e-3, factor: 1e-3, suffix: 'mW' },
      { threshold: 1e-6, factor: 1e-6, suffix: 'µW' }
    ],
    'W',
    '0 W'
  );
}

export function formatVoltsShort(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1) return `${significant(value)}V`;
  return `${significant(value * 1000)}mV`;
}

export function formatCurrentShort(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1) return `${significant(value)}A`;
  if (abs >= 1e-3) return `${significant(value * 1000)}mA`;
  return `${significant(value * 1e6)}µA`;
}

export function formatOhmsShort(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1000) return `${significant(value / 1000)}kΩ`;
  return `${significant(value)}Ω`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}
