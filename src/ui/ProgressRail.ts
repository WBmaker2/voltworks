export function progressRail(value: number, max = 1, label = ''): string {
  const clamped = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return `
    <div class="progress-rail" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}" aria-label="${label}">
      <span style="width:${Math.round(clamped * 100)}%"></span>
    </div>
  `;
}

export function difficultyDots(difficulty: number): string {
  return `<span class="difficulty" role="img" aria-label="난이도 ${difficulty}">${Array.from(
    { length: 3 },
    (_, index) => `<i class="${index < difficulty ? 'is-on' : ''}"></i>`
  ).join('')}</span>`;
}
