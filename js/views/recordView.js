// 记录页:统计数据 + 日历 + 训练历史

import { store } from '../store.js';
import { createCalendar } from '../calendar.js';
import { STAGE_CONFIG, SLOTS } from '../config.js';

const FEELING_LABEL = {
  easy: '轻松',
  mid: '适中',
  hard: '困难',
};

export function recordView(rootSel, { onBack }) {
  const root = document.querySelector(rootSel);
  if (!root) return { destroy() {} };

  const cal = createCalendar();

  function render() {
    const s = store.state;
    const hours = Math.floor(s.totalSeconds / 3600);
    const minutes = Math.floor((s.totalSeconds % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;

    // 最近 10 条记录(倒序)
    const recent = [...s.sessions]
      .sort((a, b) => b.startTs - a.startTs)
      .slice(0, 10);

    root.innerHTML = `
      <div class="record-wrap">
        <div class="record-hero">
          <div class="record-stat">
            <div class="v">${s.sessions.length}</div>
            <div class="k">训练次数</div>
          </div>
          <div class="record-stat">
            <div class="v">${timeStr}</div>
            <div class="k">累计时长</div>
          </div>
          <div class="record-stat exp">
            <div class="v">${s.totalExp}</div>
            <div class="k">经验值</div>
          </div>
        </div>
        <div class="record-streak">
          <div class="v">${s.consecutiveDays} 天</div>
          <div class="k">当前连续训练</div>
        </div>
        <div class="calendar" id="cal-mount"></div>
        <div class="record-list">
          <h3>最近记录</h3>
          ${
            recent.length === 0
              ? `<div class="record-empty">还没有训练记录,开始第一次吧</div>`
              : recent.map(renderItem).join('')
          }
        </div>
      </div>
    `;

    cal.mount('#cal-mount', { onMonthChange: () => {} });
  }

  function renderItem(sess) {
    const dt = new Date(sess.startTs);
    const dateStr = `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    const stageName = STAGE_CONFIG[sess.stageId]?.name || `阶段${sess.stageId}`;
    const slotName = SLOTS[sess.slot]?.name || sess.slot;
    const minutes = Math.floor(sess.elapsedMs / 60000);
    const seconds = Math.floor((sess.elapsedMs % 60000) / 1000);
    const feel = sess.feeling ? FEELING_LABEL[sess.feeling] : '-';
    const feelClass = sess.feeling || '';
    return `
      <div class="record-item">
        <div>
          <div class="r">${stageName} · ${slotName} ${sess.endedEarly ? '(提前结束)' : ''}</div>
          <div class="l">${dateStr} · ${minutes}分${seconds}秒 · +${sess.expEarned}EXP</div>
        </div>
        <div class="r ${feelClass}">${feel}</div>
      </div>
    `;
  }

  const unsubscribe = store.subscribe(render);
  render();

  return {
    destroy() {
      unsubscribe();
    },
  };
}
