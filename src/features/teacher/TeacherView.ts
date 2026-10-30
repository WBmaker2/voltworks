import type { AppContext } from '../../app/context';
import type { Mission } from '../../circuit/types';
import { MISSIONS } from '../../data/missions';
import { solutionCircuit } from '../../data/solutions';
import { renderCircuitPreview } from '../../render/preview';
import { esc } from '../../ui/escape';
import { difficultyDots, progressRail } from '../../ui/ProgressRail';
import { CONCEPT_LABEL, missionScore } from '../inspector/summary';

const targetPreviewCache = new Map<string, string>();

function targetPreview(mission: Mission): string {
  const solution = solutionCircuit(mission.id);
  if (!solution) return '';
  let image = targetPreviewCache.get(mission.id);
  if (!image) {
    image = renderCircuitPreview(solution, 640, 310, 'light');
    if (image) targetPreviewCache.set(mission.id, image);
  }
  if (!image) return '';
  return `
    <details class="teacher-target">
      <summary>목표 회로 보기</summary>
      <img src="${image}" alt="${esc(mission.titleKo)} 목표 회로" />
    </details>
  `;
}

function answerLabel(missionId: string, value: string, kind: 'prediction' | 'explanation'): string {
  const mission = MISSIONS.find((item) => item.id === missionId);
  if (!mission) return value;
  const source = kind === 'prediction' ? mission.prediction.options : mission.explanation.options;
  return source.find((option) => option.id === value)?.labelKo ?? value;
}

export function renderTeacher(context: AppContext): string {
  const state = context.store.get();
  const reveal = state.ui.teacherReveal;
  const completed = MISSIONS.filter((mission) =>
    state.mission.completed.includes(mission.id)
  ).length;

  return `
    <div class="route-inner teacher-inner">
      <header class="route-head">
        <div>
          <div class="section-kicker">교사용</div>
          <h1>수업 준비와 진행 관리</h1>
          <p>정답을 공개하거나 진행 상황을 초기화하고, 회로 도해가 포함된 학습지를 인쇄할 수 있습니다. 이 화면은 학생의 로컬 기록만 다룹니다.</p>
        </div>
        <div class="route-stat">
          <strong>${completed}<span>/6</span></strong>
          <span>완료</span>
        </div>
      </header>

      <div class="teacher-toolbar">
        <button class="btn ${reveal ? 'btn--primary' : ''}" type="button" data-action="toggle-reveal">
          ${reveal ? '정답 숨기기' : '정답 보기'}
        </button>
        <button class="btn" type="button" data-action="print-worksheet">학습지 인쇄</button>
        <button class="btn btn--danger" type="button" data-action="reset-progress">진행 초기화</button>
        <span class="teacher-toolbar-note">${reveal ? '교실 화면에 정답이 보입니다.' : '정답은 기본적으로 가려져 있습니다.'}</span>
      </div>

      <section class="teacher-list" aria-label="미션별 진행과 정답">
        ${MISSIONS.map((mission, index) => {
          const progress = state.mission.progress[mission.id];
          const done = state.mission.completed.includes(mission.id);
          const score = missionScore(mission, progress);
          return `
            <article class="teacher-mission ${done ? 'is-complete' : ''}">
              <div class="teacher-mission-index">${String(index + 1).padStart(2, '0')}</div>
              <div class="teacher-mission-main">
                <div class="card-topline">
                  <span class="tag">${esc(CONCEPT_LABEL[mission.concept])}</span>
                  ${difficultyDots(mission.difficulty)}
                  <span class="status-pill ${done ? 'is-complete' : progress ? 'is-started' : ''}">${done ? `완료 · ${score}점` : progress?.prediction ? '진행 중' : '시작 전'}</span>
                </div>
                <h3>${esc(mission.titleKo)}</h3>
                <p>${esc(mission.promptKo)}</p>
                ${progressRail(done ? 3 : progress?.measured ? 2 : progress?.prediction ? 1 : 0, 3, `${mission.titleKo} 진행`)}
                ${
                  reveal
                    ? `
                      <div class="teacher-answer">
                        <div class="answer-grid">
                          <div><span>예측 정답</span><strong>${esc(answerLabel(mission.id, mission.prediction.answer, 'prediction'))}</strong></div>
                          <div><span>설명 정답</span><strong>${esc(answerLabel(mission.id, mission.explanation.answer, 'explanation'))}</strong></div>
                          <div><span>기대 측정값</span><strong>${esc(mission.teacher?.expectedKo ?? '—')}</strong></div>
                        </div>
                        <p>${esc(mission.explanation.bodyKo)}</p>
                        <p class="teacher-solution">${esc(mission.teacher?.solutionKo ?? '')}</p>
                        ${targetPreview(mission)}
                      </div>
                    `
                    : ''
                }
              </div>
              <div class="teacher-mission-actions">
                <button class="btn btn--small" type="button" data-action="start-mission" data-id="${mission.id}" data-focus-key="teacher-start-${mission.id}">
                  회로 열기
                </button>
              </div>
            </article>
          `;
        }).join('')}
      </section>

      <section class="teacher-notes">
        <div class="section-kicker">수업 메모</div>
        <ul>
          <li>이 앱은 이상적 부품 모델을 사용합니다. 전선 0Ω, 전류계 0Ω, 전압계 1GΩ, 전구는 일정 저항입니다.</li>
          <li>단락 실험은 실제 전지로 재현하지 마세요. 이 모델은 교육용 저전압 회로만 다룹니다.</li>
          <li>학습지에는 회로 도해와 빈 측정표가 포함됩니다. 인쇄 후 학생이 예측과 측정값을 적을 수 있습니다.</li>
          <li>진행 초기화는 이 브라우저의 VoltWorks 기록만 삭제합니다.</li>
        </ul>
      </section>
    </div>
  `;
}
