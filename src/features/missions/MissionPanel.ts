import type { AppContext } from '../../app/context';
import { missionProgress } from '../../app/state';
import type { Mission, MissionProgress } from '../../circuit/types';
import { MISSIONS, missionById } from '../../data/missions';
import { esc } from '../../ui/escape';
import { difficultyDots, progressRail } from '../../ui/ProgressRail';
import { evaluateTarget } from './checks';
import { CONCEPT_LABEL, missionScore } from '../inspector/summary';

function missionNumber(id: string): string {
  const index = MISSIONS.findIndex((mission) => mission.id === id);
  return String(index + 1).padStart(2, '0');
}

function stageOf(mission: Mission, progress: MissionProgress) {
  return mission.stages?.[progress.stage] ?? null;
}

function liveCheck(context: AppContext, mission: Mission) {
  const state = context.store.get();
  const result = state.simulation.result;
  const progress = missionProgress(state, mission.id);
  const stage = stageOf(mission, progress);
  const target = stage?.target ?? mission.setup.target ?? '';
  if (!result) return null;
  return evaluateTarget(
    target,
    { components: state.editor.components, wires: state.editor.wires },
    result,
    mission
  );
}

function options(
  names: string,
  mission: Mission,
  selected: string | null,
  disabled = false,
  kind: 'prediction' | 'explanation' = 'prediction'
): string {
  const source = kind === 'prediction' ? mission.prediction.options : mission.explanation.options;
  return `
    <div class="option-list" role="radiogroup" aria-label="${kind === 'prediction' ? '예측 선택' : '설명 선택'}">
      ${source
        .map(
          (option) => `
          <label class="option ${selected === option.id ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}">
            <input
              type="radio"
              name="${esc(names)}"
              value="${esc(option.id)}"
              data-action="${kind}"
              data-focus-key="${kind}-${esc(option.id)}"
              ${selected === option.id ? 'checked' : ''}
              ${disabled ? 'disabled' : ''}
            />
            <span class="option-mark" aria-hidden="true"></span>
            <span>${esc(option.labelKo)}</span>
          </label>
        `
        )
        .join('')}
    </div>
  `;
}

function missionHeader(mission: Mission, progress: MissionProgress): string {
  const stage = stageOf(mission, progress);
  return `
    <div class="mission-head">
      <div class="mission-title-wrap">
        <div class="mission-meta">
          <span class="mission-number">M${missionNumber(mission.id)}</span>
          <span class="tag">${esc(CONCEPT_LABEL[mission.concept])}</span>
          ${difficultyDots(mission.difficulty)}
          ${stage ? `<span class="tag tag--accent">${esc(stage.titleKo)}</span>` : ''}
        </div>
        <h2>${esc(mission.titleKo)}</h2>
        <p>${esc(mission.promptKo)}</p>
      </div>
      <div class="mission-head-actions">
        <button class="btn btn--ghost btn--small" type="button" data-action="exit-mission">미션 목록</button>
      </div>
    </div>
  `;
}

function steps(progress: MissionProgress, targetOk: boolean): string {
  const prediction = Boolean(progress.prediction);
  const measured = progress.measured && targetOk;
  const explained = Boolean(progress.explanation);
  return `
    <ol class="mission-steps" aria-label="미션 진행 단계">
      <li class="${prediction ? 'is-done' : 'is-active'}"><span>1</span>예측</li>
      <li class="${measured ? 'is-done' : prediction ? 'is-active' : ''}"><span>2</span>제작·측정</li>
      <li class="${explained ? 'is-done' : measured ? 'is-active' : ''}"><span>3</span>설명</li>
    </ol>
  `;
}

function successCard(mission: Mission, progress: MissionProgress): string {
  const score = missionScore(mission, progress);
  const next = MISSIONS[MISSIONS.findIndex((item) => item.id === mission.id) + 1];
  return `
    <div class="mission-success">
      <div class="success-stamp">${score}점</div>
      <div class="success-copy">
        <div class="section-kicker">미션 완료</div>
        <h3>${esc(mission.takeawayKo)}</h3>
        <p>${esc(mission.explanation.bodyKo)}</p>
        <div class="answer-line">
          <span>예측</span>
          <strong>${esc(mission.prediction.options.find((option) => option.id === mission.prediction.answer)?.labelKo ?? '')}</strong>
          ${progress.prediction === mission.prediction.answer ? '<span class="score-note">정확히 맞혔습니다 · +40</span>' : '<span class="score-note">다시 살펴보세요 · 0</span>'}
        </div>
      </div>
      <div class="mission-success-actions">
        ${
          next
            ? `<button class="btn btn--primary btn-pulse" type="button" data-action="next-mission" data-focus-key="next-mission">다음 미션 ${esc(next.titleKo)}</button>`
            : `<button class="btn btn--primary btn-pulse" type="button" data-action="go-missions" data-focus-key="go-missions">미션 목록으로</button>`
        }
        <button class="btn" type="button" data-action="restart-mission">다시 하기</button>
      </div>
    </div>
  `;
}

export function renderMissionStrip(context: AppContext): string {
  const state = context.store.get();
  const mission = missionById(state.mission.currentId);

  if (!mission) {
    return `
      <div class="mission-free">
        <div>
          <div class="section-kicker">자유 작업대</div>
          <h2>부품을 놓고 회로를 시험하세요.</h2>
          <p>미션을 고르면 예측 → 제작 → 측정 → 설명 순서로 학습합니다.</p>
        </div>
        <div class="mission-free-actions">
          <button class="btn btn--primary btn-pulse" type="button" data-action="go-missions" data-focus-key="go-missions">미션 고르기</button>
          <button class="btn" type="button" data-action="new-circuit">새 회로</button>
        </div>
      </div>
    `;
  }

  const progress = missionProgress(state, mission.id);
  const stage = stageOf(mission, progress);
  const check = liveCheck(context, mission);
  const targetOk = Boolean(check?.ok);
  const hasNextStage = Boolean(mission.stages && progress.stage < mission.stages.length - 1);
  const finalTargetOk = targetOk && !hasNextStage;
  const completed = Boolean(progress.explanation);

  let body = '';

  if (completed) {
    body = successCard(mission, progress);
  } else if (!progress.prediction) {
    body = `
      <div class="mission-phase">
        <div class="phase-label">먼저 예측하세요</div>
        <h3>${esc(mission.prediction.questionKo)}</h3>
        ${options(`prediction-${mission.id}`, mission, null, false, 'prediction')}
        <p class="phase-note">예측을 고르면 회로를 측정할 수 있습니다. 정답은 완료 후에 공개됩니다.</p>
      </div>
    `;
  } else if (targetOk && progress.measured && !hasNextStage) {
    body = `
      <div class="mission-phase">
        <div class="phase-label">설명하기 · 측정 성공</div>
        <div class="evidence-strip">
          <span>측정 결과</span>
          <strong>${esc(check?.evidenceKo ?? '')}</strong>
        </div>
        <h3>${esc(mission.explanation.questionKo)}</h3>
        ${options(`explanation-${mission.id}`, mission, null, false, 'explanation')}
        <p class="phase-note">측정값을 근거로 가장 알맞은 설명을 고르세요.</p>
      </div>
    `;
  } else if (targetOk && progress.measured && hasNextStage) {
    body = `
      <div class="mission-phase mission-phase--success">
        <div class="phase-label">단계 완료</div>
        <h3>${esc(stage?.titleKo ?? '')} 통과</h3>
        <div class="evidence-strip">
          <span>측정 결과</span>
          <strong>${esc(check?.evidenceKo ?? '')}</strong>
        </div>
        <p class="phase-note">${esc(mission.stages?.[progress.stage + 1]?.promptKo ?? '')}</p>
        <button class="btn btn--primary btn-pulse" type="button" data-action="next-stage" data-focus-key="next-stage">다음 단계</button>
      </div>
    `;
  } else {
    const failure =
      progress.measured && check && !check.ok
        ? `
          <div class="mission-feedback">
            <div class="feedback-head">${esc(check.evidenceKo)}</div>
            <p>${esc(
              check.hintKo || state.simulation.result?.warnings[0]?.messageKo || mission.hintKo
            )}</p>
          </div>
        `
        : '';
    body = `
      <div class="mission-phase">
        <div class="phase-label">${stage ? esc(stage.titleKo) : '회로 만들기'}</div>
        <h3>${esc(stage?.promptKo ?? mission.promptKo)}</h3>
        <p class="phase-note">${esc(stage?.hintKo ?? mission.hintKo)}</p>
        ${failure}
        <div class="mission-actions">
          <button class="btn btn--primary btn-pulse" type="button" data-action="measure" data-focus-key="measure">
            ${progress.measured ? '다시 측정' : '측정하기'}
          </button>
          <button class="btn btn--ghost" type="button" data-action="restart-mission">초기 상태로</button>
        </div>
      </div>
    `;
  }

  return `
    ${missionHeader(mission, progress)}
    ${steps(progress, finalTargetOk)}
    <div class="mission-body">
      ${body}
    </div>
  `;
}

function missionCard(mission: Mission, progress: MissionProgress | undefined): string {
  const completed = Boolean(progress?.explanation);
  const started = Boolean(progress?.prediction) || Boolean(progress && progress.stage > 0);
  const score = missionScore(mission, progress);
  const stageText =
    mission.stages && progress && progress.stage > 0
      ? ` · ${Math.min(progress.stage + 1, mission.stages.length)}단계`
      : '';
  return `
    <article class="mission-card ${completed ? 'is-complete' : started ? 'is-started' : ''}">
      <div class="card-topline">
        <span class="mission-number">M${missionNumber(mission.id)}</span>
        <span class="tag">${esc(CONCEPT_LABEL[mission.concept])}</span>
        ${difficultyDots(mission.difficulty)}
      </div>
      <h3>${esc(mission.titleKo)}</h3>
      <p>${esc(mission.promptKo)}</p>
      <div class="card-status">
        <span class="status-pill ${completed ? 'is-complete' : started ? 'is-started' : ''}">
          ${completed ? '완료' : started ? '진행 중' : '시작 전'}${stageText}
        </span>
        ${completed ? `<span class="score-pill">${score}점</span>` : ''}
      </div>
      ${progressRail(progress?.explanation ? 3 : progress?.measured ? 2 : progress?.prediction ? 1 : 0, 3, `${mission.titleKo} 진행`)}
      <button class="btn btn--primary btn-pulse" type="button" data-action="start-mission" data-id="${mission.id}" data-focus-key="start-${mission.id}">
        ${completed ? '다시 보기' : started ? '이어서 하기' : '미션 시작'}
      </button>
    </article>
  `;
}

export function renderMissionList(context: AppContext): string {
  const state = context.store.get();
  const completed = MISSIONS.filter((mission) =>
    state.mission.completed.includes(mission.id)
  ).length;
  return `
    <div class="route-inner">
      <header class="route-head">
        <div>
          <div class="section-kicker">미션</div>
          <h1>예측하고, 만들고, 측정하세요.</h1>
          <p>전구의 밝기부터 단락 회로까지, 여섯 개의 회로 문제를 직접 해결합니다. 진행 상황은 이 기기에 저장됩니다.</p>
        </div>
        <div class="route-stat">
          <strong>${completed}<span>/6</span></strong>
          <span>완료한 미션</span>
        </div>
      </header>
      <div class="mission-grid">
        ${MISSIONS.map((mission) => missionCard(mission, state.mission.progress[mission.id])).join('')}
      </div>
      <div class="route-note">
        <span class="tag">교사용</span>
        <p>정답 공개, 진행 초기화, 학습지 인쇄는 교사용 화면에서 할 수 있습니다.</p>
        <button class="btn" type="button" data-action="go-teacher">교사용 열기</button>
      </div>
    </div>
  `;
}
