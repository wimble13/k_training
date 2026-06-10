// 阶段页:选择时段(晨/午/晚)

import { STAGE_CONFIG, SLOTS } from '../config.js';
import { store } from '../store.js';
import { audio } from '../audio.js';

export function stageView(rootSel, { stageId, onBack, onSelectSlot }) {
  const root = document.querySelector(rootSel);
  if (!root) return { destroy() {} };

  const cfg = STAGE_CONFIG[stageId];
  if (!cfg) {
    // 兜底
    onBack();
    return { destroy() {} };
  }

  function render() {
    const slotKeys = ['morning', 'noon', 'night'];
    root.innerHTML = `
      <div class="stage-header">
        <h2>${cfg.name}</h2>
        <p>${cfg.desc}</p>
      </div>
      <div class="slot-list">
        ${slotKeys
          .map((k) => {
            const s = SLOTS[k];
            const trainedDays = countTrainedDays(stageId, k);
            return `
              <div class="slot-card" data-slot="${k}">
                <div class="slot-icon ${k === 'noon' ? 'noon' : k === 'night' ? 'night' : ''}">${s.icon}</div>
                <div class="slot-body">
                  <h3>${s.name}</h3>
                  <div class="meta">
                    <span>${s.sub}</span>
                    <span>已训练 <b>${trainedDays}</b> 天</span>
                  </div>
                </div>
                <div class="slot-arrow">›</div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
    bindEvents();
  }

  function bindEvents() {
    root.querySelectorAll('.slot-card').forEach((card) => {
      card.addEventListener('click', () => {
        audio.unlock();
        const slot = card.dataset.slot;
        onSelectSlot(stageId, slot);
      });
    });
  }

  function countTrainedDays(stageId, slot) {
    const set = new Set();
    for (const sess of store.state.sessions) {
      if (sess.stageId === stageId && sess.slot === slot) {
        set.add(dateKeyOf(new Date(sess.startTs)));
      }
    }
    return set.size;
  }

  function dateKeyOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const unsubscribe = store.subscribe(render);
  render();

  return {
    destroy() {
      unsubscribe();
    },
  };
}
