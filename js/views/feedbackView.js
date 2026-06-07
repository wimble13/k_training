// 反馈页:训练结束后填写感受 + 心得

import { NOTE_REQUIRED, NOTE_MIN_LENGTH } from '../config.js';
import { store } from '../store.js';

const FEELINGS = [
  { key: 'easy', label: '轻松', emoji: '😊' },
  { key: 'mid', label: '适中', emoji: '🙂' },
  { key: 'hard', label: '困难', emoji: '😣' },
];

export function feedbackView(rootSel, { onSubmit, onSkip }) {
  const root = document.querySelector(rootSel);
  if (!root) return { destroy() {} };

  const pending = JSON.parse(sessionStorage.getItem('kegel_pending_session') || 'null');
  let feeling = null;
  let note = '';

  function render() {
    if (!pending) {
      root.innerHTML = `
        <div class="feedback-wrap">
          <p style="color:var(--text-dim);text-align:center;margin-top:40px;">没有待反馈的训练</p>
        </div>
      `;
      return;
    }
    const minutes = Math.floor(pending.elapsedMs / 60000);
    const seconds = Math.floor((pending.elapsedMs % 60000) / 1000);
    const expPreview = Math.max(0, Math.floor((pending.elapsedMs / 60000) * 1));

    root.innerHTML = `
      <div class="feedback-wrap">
        <h2 class="feedback-title">训练完成!</h2>
        <p class="feedback-sub">花 10 秒记录今天的感受,坚持打卡</p>
        <div class="feedback-summary">
          <div>
            <div class="label">本次时长</div>
            <div class="value">${minutes} 分 ${seconds} 秒</div>
          </div>
          <div>
            <div class="label">本次经验</div>
            <div class="value exp">+${expPreview} EXP</div>
          </div>
        </div>
        <div class="feedback-section">
          <h3>本次感受</h3>
          <div class="feeling-group">
            ${FEELINGS.map(
              (f) => `
              <button class="feeling-btn ${feeling === f.key ? 'selected ' + f.key : ''}" data-feel="${f.key}">
                <span class="emoji">${f.emoji}</span>
                <span>${f.label}</span>
              </button>
            `
            ).join('')}
          </div>
        </div>
        <div class="feedback-section">
          <h3>心得(可选)</h3>
          <textarea class="feedback-textarea" id="fb-note" maxlength="500" placeholder="今天训练的感觉如何?有什么收获?(选填)">${escapeHtml(note)}</textarea>
          <div class="char-count" id="fb-count">${note.length} 字</div>
        </div>
        <button class="feedback-submit" id="fb-submit" disabled>提交并记录</button>
      </div>
    `;
    bindEvents();
    validate();
  }

  function bindEvents() {
    const textarea = root.querySelector('#fb-note');
    const count = root.querySelector('#fb-count');
    const submit = root.querySelector('#fb-submit');

    textarea.addEventListener('input', () => {
      note = textarea.value;
      count.textContent = `${note.length} 字`;
      // 选填模式下,字数提示不再上色
      count.classList.remove('warn', 'ok');
      validate();
    });

    root.querySelectorAll('.feeling-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        feeling = btn.dataset.feel;
        render();
      });
    });

    submit.addEventListener('click', () => {
      if (!validate()) return;
      // 写入 store
      store.recordSession({
        stageId: pending.stageId,
        slot: pending.slot,
        startTs: pending.startTs,
        elapsedMs: pending.elapsedMs,
        endedEarly: pending.endedEarly,
        feeling,
        note: note.trim(),
      });
      sessionStorage.removeItem('kegel_pending_session');
      // 反馈完成 → 提示
      import('../main.js').then((m) => m.toast('已记录本次训练'));
      onSubmit();
    });
  }

  function validate() {
    const submit = root.querySelector('#fb-submit');
    if (!submit) return false;
    // 选填模式:只需要选了感受即可
    const noteOk = NOTE_REQUIRED ? note.trim().length >= NOTE_MIN_LENGTH : true;
    const ok = !!feeling && noteOk;
    submit.disabled = !ok;
    return ok;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  render();

  return {
    destroy() {},
  };
}
