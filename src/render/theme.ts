export interface Palette {
  paper: string;
  panel: string;
  ink: string;
  inkSoft: string;
  muted: string;
  gridLine: string;
  gridMajor: string;
  wire: string;
  wireMuted: string;
  accent: string;
  accentSoft: string;
  warning: string;
  glow: string;
  needle: string;
  table: string;
}

const LIGHT: Palette = {
  paper: '#f7f7f5',
  panel: '#ffffff',
  ink: '#111111',
  inkSoft: '#3b3b3b',
  muted: '#767672',
  gridLine: 'rgba(17, 17, 17, 0.055)',
  gridMajor: 'rgba(17, 17, 17, 0.13)',
  wire: '#2b2f35',
  wireMuted: '#b8b8b2',
  accent: '#ff4f00',
  accentSoft: 'rgba(255, 79, 0, 0.14)',
  warning: '#d42a00',
  glow: 'rgba(255, 79, 0, 0.55)',
  needle: '#ff4f00',
  table: '#e9e6de'
};

const DARK: Palette = {
  paper: '#0c1015',
  panel: '#121821',
  ink: '#f2f1ec',
  inkSoft: '#d6d8da',
  muted: '#9ca2aa',
  gridLine: 'rgba(255, 255, 255, 0.055)',
  gridMajor: 'rgba(255, 255, 255, 0.14)',
  wire: '#c8cdd4',
  wireMuted: '#4e5762',
  accent: '#ff6a2a',
  accentSoft: 'rgba(255, 106, 42, 0.18)',
  warning: '#ff7a45',
  glow: 'rgba(255, 106, 42, 0.6)',
  needle: '#ff6a2a',
  table: '#151c25'
};

export function paletteFor(theme: 'light' | 'dark'): Palette {
  return theme === 'dark' ? DARK : LIGHT;
}

export const CANVAS_FONT =
  '"Helvetica Neue", "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif';
export const CANVAS_MONO = '"SF Mono", "IBM Plex Mono", ui-monospace, "Menlo", monospace';

export function withAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return hex;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
