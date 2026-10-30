const PATHS = {
  cursor: '<path d="M5 3l7 17 2.2-6.8L21 11 5 3z" fill="currentColor" stroke="none"/>',
  wire: '<path d="M4 17c4 0 4-10 8-10s4 10 8 10"/><circle cx="4" cy="17" r="1.6"/><circle cx="20" cy="17" r="1.6"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  hand: '<path d="M8 11V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7M17 10.5V9a1.5 1.5 0 013 0v6a7 7 0 01-7 7h-1.5a6 6 0 01-4.8-2.4L3 14.5a1.6 1.6 0 012.5-2L8 15"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a7 7 0 017 7"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9a7 7 0 00-7 7"/>',
  play: '<path d="M7 4l13 8-13 8V4z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor" stroke="none"/>',
  grid: '<path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  moon: '<path d="M20 15.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 11.5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 115 1c0 1.7-2.5 2-2.5 4M12 17.5v.1"/>',
  rotate: '<path d="M20 8V3l-3 3a8 8 0 10 2 9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  warning: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5M12 17.5v.1"/>',
  print:
    '<path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  reset: '<path d="M4 5v6h6"/><path d="M4.5 10A8 8 0 1120 14"/>',
  cube: '<path d="M12 2l9 5v10l-9 5-9-5V7l9-5zM3 7l9 5 9-5M12 12v10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  teacher: '<path d="M3 6h18M5 6v13h14V6M8 9h8M12 9v7M9 16h6"/>',
  spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/>',
  battery: '<path d="M2 12h5M17 12h5M8 6v12M12 4v16M16 7v10"/>',
  bulb: '<circle cx="12" cy="12" r="6"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
  resistor: '<path d="M2 12h4M18 12h4"/><rect x="6" y="8.5" width="12" height="7" rx="1"/>',
  switch:
    '<path d="M2 17h6M16 17h6"/><circle cx="8" cy="17" r="1.4"/><circle cx="16" cy="17" r="1.4"/><path d="M8 17l7-7"/>',
  ammeter:
    '<path d="M2 12h4M18 12h4"/><circle cx="12" cy="12" r="6"/><path d="M10 15V9h2.2a2 2 0 010 4H10"/>',
  voltmeter: '<path d="M2 12h4M18 12h4"/><circle cx="12" cy="12" r="6"/><path d="M9 9l3 6 3-6"/>',
  chevron: '<path d="M8 10l4 4 4-4"/>',
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  copy: '<path d="M8 8h11v11H8z"/><path d="M5 16H3V3h13v2"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 18, className = ''): string {
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
