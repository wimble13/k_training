// 首页:4 阶段卡片

import { STAGE_CONFIG } from '../config.js';
import { store } from '../store.js';

const STAGE_DESCS = {
  1: '入门训练,建立节奏',
  2: '进阶训练,延长时间',
  3: '强化训练,加强耐力',
  4: '达人训练,挑战极限',
};

export function homeView(rootSel, { onSelectStage }) {
  const root = document.querySelector(rootSel);
  if (!root) return { destroy() {} };

  function render() {
    const s = store.state;
    const totalSeconds = s.totalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    root.innerHTML = `
      <div class="home-stats">
        <div class="home-stat">
          <div class="v">${s.sessions.length}</div>
          <div class="k">累计次数</div>
        </div>
        <div class="home-stat">
          <div class="v">${s.consecutiveDays}</div>
          <div class="k">连续天数</div>
        </div>
        <div class="home-stat">
          <div class="v">${timeStr}</div>
          <div class="k">累计时长</div>
        </div>
        <div class="home-stat">
          <div class="v" style="color:var(--accent)">${s.totalExp}</div>
          <div class="k">经验值</div>
        </div>
      </div>
      <div class="stage-list">
        ${[1, 2, 3, 4].map((id) => renderCard(id, s.unlockedStages.includes(id))).join('')}
      </div>
    `;
    bindEvents();
  }

  function renderCard(id, unlocked) {
    const cfg = STAGE_CONFIG[id];
    const lockedClass = unlocked ? '' : 'locked';
    const lockIcon = unlocked
      ? ''
      : `<div class="lock-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
        </div>`;
    return `
      <div class="stage-card ${lockedClass}" data-stage="${id}">
        <div class="badge">第 ${id} 阶段</div>
        <h3>${cfg.name}</h3>
        <p class="desc">${STAGE_DESCS[id]}</p>
        <div class="meta">
          <span>${cfg.sections.length} 个动作</span>
          <span>约 ${Math.round((cfg.sections.reduce((a, s) => a + s.sec, 0)) / 60)} 分钟</span>
        </div>
        ${lockIcon}
      </div>
    `;
  }

  function bindEvents() {
    root.querySelectorAll('.stage-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.stage);
        if (card.classList.contains('locked')) {
          // 提示未解锁
          import('../main.js').then((m) => m.toast('该阶段尚未解锁'));
          return;
        }
        onSelectStage(id);
      });
    });
  }

  const unsubscribe = store.subscribe(render);
  render();

  return {
    destroy() {
      unsubscribe();
    },
  };
}
