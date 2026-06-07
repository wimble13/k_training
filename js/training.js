// 训练段落调度
// 遍历 STAGE_CONFIG[stageId].sections,每个 section 内部展开为原子 step
// 段落类型:
//   shou       长收缩(秒)
//   fang       放松(秒)
//   kuai_set   快收组合:reps 次 (kuai 1s + fang 1s)
//
// 内部将所有 section 展开为"原子 step 数组",
// 每 step 是 { type: 'shou'|'fang'|'kuai', sec, sectionIndex, repIndex?, totalReps? }
//
// 启动流程(两段式):
//   1. start() 被调 → 立刻播 start.mp3 + 振动,UI 进入 "pre_start" 阶段
//   2. START_PROMPT_DURATION_MS 后才真正开始计时 + 播第一段(shou/fang) + BGM
//   3. pre_start 期间按"暂停"键视为取消:不入库统计,跳反馈页
//
// UI 提示:
//   - shou/fang:大字"收"/"放"
//   - kuai_set:大字"快收" + 角标"n / total"
//
// 回调:
//   onPreStart()                            — start 音开始播
//   onSectionStart(step)                    — 进入新 step 时
//   onSectionTick({ step, stepIndex, ... }) — RAF 每帧
//   onComplete({ elapsedMs, endedEarly, cancelled })  — 训练结束(cancelled 表示 pre_start 取消)

import { audio } from './audio.js';
import { createTimer } from './timer.js';
import { START_PROMPT_DURATION_MS } from './config.js';

const ACTION_LABEL = {
  shou: '收',
  fang: '放',
  kuai: '快收',
};

// 将 sections 展开为原子 step 数组
function expandSteps(sections) {
  const steps = [];
  sections.forEach((sec, sectionIndex) => {
    if (sec.type === 'kuai_set') {
      const reps = sec.reps || 10;
      const each = sec.sec || 1;
      for (let r = 0; r < reps; r++) {
        steps.push({ type: 'kuai', sec: each, sectionIndex, repIndex: r, totalReps: reps, section: sec });
        steps.push({ type: 'fang', sec: each, sectionIndex, repIndex: r, totalReps: reps, section: sec });
      }
    } else {
      steps.push({ type: sec.type, sec: sec.sec, sectionIndex, section: sec });
    }
  });
  return steps;
}

export function runTraining({
  stageId,
  sections,
  onPreStart,
  onSectionStart,
  onSectionTick,
  onComplete,
  onPauseChange,
}) {
  const steps = expandSteps(sections);
  const totalMs = steps.reduce((a, s) => a + s.sec * 1000, 0);

  const stepStarts = [];
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    stepStarts.push(acc);
    acc += steps[i].sec * 1000;
  }

  let currentStepIndex = 0;
  let endedEarly = false;
  let paused = false;
  let phase = 'idle'; // 'idle' | 'pre_start' | 'running' | 'finished'
  let _preStartTimer = 0;

  const timer = createTimer({
    durationMs: totalMs,
    onTick: ({ elapsedMs, status }) => {
      if (status !== 'running') return;
      let idx = 0;
      for (let i = 0; i < stepStarts.length; i++) {
        if (elapsedMs >= stepStarts[i]) idx = i;
        else break;
      }
      if (idx !== currentStepIndex) {
        currentStepIndex = idx;
        const step = steps[idx];
        onSectionStart && onSectionStart(step);
        audio.playOneShot(step.type);
        audio.vibrate();
      }
      onSectionTick && onSectionTick({
        step: steps[idx],
        stepIndex: idx,
        stepElapsedMs: elapsedMs - stepStarts[idx],
        stepDurationMs: steps[idx].sec * 1000,
        sectionIndex: steps[idx].sectionIndex,
        section: steps[idx].section,
        totalElapsedMs: elapsedMs,
        totalDurationMs: totalMs,
        remainingMs: totalMs - elapsedMs,
      });
    },
    onFinish: ({ status }) => {
      endedEarly = status === 'ended_early';
      onComplete && onComplete({
        elapsedMs: timer.currentElapsedMs(),
        endedEarly,
        cancelled: false,
      });
    },
  });

  function start() {
    if (phase !== 'idle') return;
    phase = 'pre_start';
    // 立刻播 start 提示音 + 振动
    audio.playOneShot('start');
    audio.vibrate(120);
    onPreStart && onPreStart();
    // 等 start 音播完才真正开始
    _preStartTimer = setTimeout(() => {
      _preStartTimer = 0;
      if (phase !== 'pre_start') return; // 期间被取消
      beginRun();
    }, START_PROMPT_DURATION_MS);
  }

  function beginRun() {
    phase = 'running';
    const first = steps[0];
    onSectionStart && onSectionStart(first);
    audio.playOneShot(first.type);
    audio.vibrate();
    audio.playBgm();
    timer.start();
  }

  function cancelFromPreStart() {
    if (phase !== 'pre_start') return;
    if (_preStartTimer) {
      clearTimeout(_preStartTimer);
      _preStartTimer = 0;
    }
    phase = 'finished';
    onComplete && onComplete({
      elapsedMs: 0,
      endedEarly: true,
      cancelled: true, // pre_start 期间取消
    });
  }

  function pause() {
    if (phase === 'pre_start') {
      // pre_start 期间按"暂停" → 视为取消训练
      cancelFromPreStart();
      return;
    }
    if (phase !== 'running' || paused) return;
    paused = true;
    timer.pause();
    audio.stopBgm();
    onPauseChange && onPauseChange(true);
  }

  function resume() {
    if (phase !== 'running' || !paused) return;
    paused = false;
    timer.resume();
    audio.playBgm();
    onPauseChange && onPauseChange(false);
  }

  function togglePause() {
    if (phase === 'pre_start') {
      cancelFromPreStart();
      return;
    }
    if (paused) resume();
    else pause();
  }

  function isPaused() {
    return phase === 'pre_start' ? false : paused;
  }

  function getPhase() {
    return phase;
  }

  function endEarly() {
    if (phase === 'pre_start') {
      cancelFromPreStart();
      return;
    }
    if (phase !== 'running' || endedEarly) return;
    endedEarly = true;
    audio.stopBgm();
    audio.playOneShot('finish');
    timer.endEarly();
  }

  function destroy() {
    if (_preStartTimer) {
      clearTimeout(_preStartTimer);
      _preStartTimer = 0;
    }
    audio.stopBgm();
    timer.destroy();
  }

  function getCurrentStep() {
    return steps[currentStepIndex] || null;
  }

  return {
    start,
    pause,
    resume,
    togglePause,
    isPaused,
    getPhase,
    endEarly,
    destroy,
    getCurrentStep,
    getSteps: () => steps.slice(),
    getSectionCount: () => sections.length,
  };
}

export { ACTION_LABEL };
