// 训练页:水波进度环 + 动作提示 + 倒计时 + 暂停/继续 + 声音/震动开关 + 长按提前结束
//
// 启动流程:
//   1. 渲染 + 显示医学提示
//   2. 用户点 OK / banner 消失 → 调 trainer.start()
//   3. trainer.start() 进入 pre_start 阶段:播 start 提示音 + 振动
//   4. START_PROMPT_DURATION_MS 后才真正开始计时 + 播 shou + 起 BGM
//   5. pre_start 期间按"取消"按钮 = 取消训练,不入库,直接跳反馈页

import { STAGE_CONFIG, LONG_PRESS_MS, START_PROMPT_DURATION_MS } from '../config.js';
import { audio } from '../audio.js';
import { runTraining, ACTION_LABEL } from '../training.js';
import { bindLongPress } from '../timer.js';
import { showMedicalHint } from '../medicalHint.js';

export function trainingView(rootSel, { stageId, slot, onComplete }) {
  const root = document.querySelector(rootSel);
  if (!root) return { destroy() {} };

  const cfg = STAGE_CONFIG[stageId];
  if (!cfg) {
    onComplete({ elapsedMs: 0, endedEarly: true });
    return { destroy() {} };
  }

  // 渲染 UI
  root.innerHTML = `
    <div class="training-wrap">
      <div class="training-stage">
        <div class="wave-ring">
          <div class="wave-fill" id="wave-fill" style="height:0%"></div>
        </div>
        <div class="wave-center">
          <div class="wave-action" id="wave-action">准备</div>
          <div class="wave-time" id="wave-time">00</div>
          <div class="wave-section" id="wave-section"></div>
        </div>
      </div>

      <div class="training-actions">
        <button class="t-btn toggle ${audio.isSoundOn() ? 'on' : 'off'}" id="btn-sound">
          ${audio.isSoundOn() ? '🔊 声音' : '🔇 静音'}
        </button>
        <button class="t-btn toggle ${audio.isVibrationOn() ? 'on' : 'off'}" id="btn-vibrate">
          ${audio.isVibrationOn() ? '📳 震动' : '✋ 关闭'}
        </button>
        <button class="t-btn pause" id="btn-pause">⏸ 暂停</button>
      </div>

      <div class="training-hint">
        长按 <b>暂停</b> 键 ${LONG_PRESS_MS / 1000} 秒 = 提前结束
      </div>
    </div>
  `;

  const waveFill = root.querySelector('#wave-fill');
  const waveAction = root.querySelector('#wave-action');
  const waveTime = root.querySelector('#wave-time');
  const waveSection = root.querySelector('#wave-section');
  const btnSound = root.querySelector('#btn-sound');
  const btnVibrate = root.querySelector('#btn-vibrate');
  const btnPause = root.querySelector('#btn-pause');

  // 启动训练
  const startTs = Date.now();
  let preStartLeft = START_PROMPT_DURATION_MS; // pre_start 倒计时剩余

  const trainer = runTraining({
    stageId,
    sections: cfg.sections,
    onPreStart: () => {
      // 等待 start 音播放,中央显示"准备"+ 倒计时
      waveAction.textContent = '准备';
      waveSection.textContent = '准备中…';
      preStartLeft = START_PROMPT_DURATION_MS;
      btnPause.textContent = '✕ 取消';
    },
    onSectionStart: (step) => {
      waveAction.textContent = ACTION_LABEL[step.type] || '';
      btnPause.textContent = '⏸ 暂停';
    },
    onSectionTick: ({ step, totalElapsedMs, totalDurationMs, remainingMs }) => {
      // 进度:在 pre_start 期间也要显示(进度条置 0);开始后才填
      if (trainer.getPhase() === 'pre_start') {
        // 简化:不刷 wave-fill,只显示剩余秒数
        const secLeft = Math.max(0, Math.ceil(preStartLeft / 1000));
        waveTime.textContent = `${secLeft}`;
      } else {
        const pct = Math.min(100, Math.max(0, (totalElapsedMs / totalDurationMs) * 100));
        waveFill.style.height = `${pct}%`;
        const secLeft = Math.ceil(remainingMs / 1000);
        waveTime.textContent = `${secLeft}`;

        const inKuaiSet = step.section && step.section.type === 'kuai_set';
        if (inKuaiSet) {
          const totalReps = step.totalReps || 1;
          const repNum = (step.repIndex || 0) + 1;
          waveSection.textContent = `快收 ${repNum} / ${totalReps}`;
        } else {
          const stepIdx = (trainer.getCurrentStep()?.sectionIndex ?? 0) + 1;
          const secCount = trainer.getSectionCount();
          waveSection.textContent = `动作 ${stepIdx} / ${secCount}`;
        }
      }
    },
    onComplete: ({ elapsedMs, endedEarly, cancelled }) => {
      trainer.destroy();
      onComplete({
        elapsedMs,
        endedEarly,
        cancelled,
        stageId,
        slot,
        startTs,
      });
    },
    onPauseChange: (isPaused) => {
      // pre_start 期间不走 onPauseChange
      if (trainer.getPhase() === 'running') {
        btnPause.textContent = isPaused ? '▶ 继续' : '⏸ 暂停';
      }
    },
  });

  // pre_start 倒计时显示
  const preStartInterval = setInterval(() => {
    if (trainer.getPhase() !== 'pre_start') {
      clearInterval(preStartInterval);
      return;
    }
    preStartLeft -= 100;
    if (preStartLeft < 0) preStartLeft = 0;
    waveTime.textContent = String(Math.ceil(preStartLeft / 1000));
  }, 100);

  // 训练前先显示医学提示(首次模态 / 后续 banner)
  showMedicalHint().then(() => {
    trainer.start();
  });

  // 暂停/继续 / 取消
  btnPause.addEventListener('click', () => {
    if (trainer.getPhase() === 'pre_start') {
      // 取消训练
      trainer.pause();
      return;
    }
    if (!trainer.isPaused()) trainer.pause();
    else trainer.resume();
  });

  // 长按暂停 = 提前结束(仅在 running 阶段有效)
  const unbindLongPress = bindLongPress(btnPause, LONG_PRESS_MS, () => {
    if (trainer.getPhase() !== 'running') return;
    const ok = window.confirm('确定要提前结束本次训练吗?');
    if (ok) trainer.endEarly();
  });

  // 声音开关
  btnSound.addEventListener('click', () => {
    const next = !audio.isSoundOn();
    audio.setSoundOn(next);
    btnSound.textContent = next ? '🔊 声音' : '🔇 静音';
    btnSound.classList.toggle('on', next);
    btnSound.classList.toggle('off', !next);
  });

  // 震动开关
  btnVibrate.addEventListener('click', () => {
    const next = !audio.isVibrationOn();
    audio.setVibrationOn(next);
    if (next) audio.vibrate(60);
    btnVibrate.textContent = next ? '📳 震动' : '✋ 关闭';
    btnVibrate.classList.toggle('on', next);
    btnVibrate.classList.toggle('off', !next);
  });

  function onVisibility() {
    if (document.visibilityState === 'visible' && trainer.getPhase() === 'running' && !trainer.isPaused()) {
      audio.playBgm();
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    destroy() {
      clearInterval(preStartInterval);
      trainer.destroy();
      unbindLongPress();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
