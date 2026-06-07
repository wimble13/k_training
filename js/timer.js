// 倒计时状态机
// 算法:基于 Date.now() 差值,切到后台 / 锁屏回来后不会补跑或卡住

/**
 * createTimer({ durationMs, onTick, onFinish })
 *   onTick({ remainingMs, elapsedMs, status, sectionIndex })
 *   onFinish({ elapsedMs, status: 'finished' | 'ended_early' })
 */
export function createTimer({ durationMs, onTick, onFinish, sectionIndex = 0 }) {
  let status = 'idle'; // idle | running | paused | finished | ended_early
  let startTs = 0;
  let pausedAt = 0;
  let pausedAccumMs = 0;
  let rafId = 0;
  let _finished = false;
  let _externalDuration = durationMs;

  function setDuration(ms) {
    _externalDuration = ms;
  }

  function currentElapsedMs() {
    if (status === 'idle') return 0;
    if (status === 'paused') return pausedAt - startTs - pausedAccumMs;
    if (status === 'finished' || status === 'ended_early') {
      return _externalDuration; // 近似
    }
    return Date.now() - startTs - pausedAccumMs;
  }

  function tick() {
    if (status !== 'running') return;
    const elapsed = currentElapsedMs();
    const remaining = Math.max(0, _externalDuration - elapsed);
    onTick && onTick({ remainingMs: remaining, elapsedMs: elapsed, status, sectionIndex });
    if (remaining <= 0 && !_finished) {
      finish('finished');
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (status === 'running') return;
    status = 'running';
    _finished = false;
    startTs = Date.now();
    pausedAccumMs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    if (status !== 'running') return;
    status = 'paused';
    pausedAt = Date.now();
    cancelAnimationFrame(rafId);
  }

  function resume() {
    if (status !== 'paused') return;
    pausedAccumMs += Date.now() - pausedAt;
    status = 'running';
    rafId = requestAnimationFrame(tick);
  }

  function toggle() {
    if (status === 'running') pause();
    else if (status === 'paused') resume();
  }

  function finish(outcome) {
    if (_finished) return;
    _finished = true;
    status = outcome; // 'finished' or 'ended_early'
    cancelAnimationFrame(rafId);
    const elapsed = currentElapsedMs();
    onFinish && onFinish({ elapsedMs: Math.min(elapsed, _externalDuration), status });
  }

  function endEarly() {
    finish('ended_early');
  }

  function getStatus() {
    return status;
  }

  function getRemainingMs() {
    if (status === 'idle') return _externalDuration;
    return Math.max(0, _externalDuration - currentElapsedMs());
  }

  function destroy() {
    cancelAnimationFrame(rafId);
  }

  return {
    start,
    pause,
    resume,
    toggle,
    endEarly,
    finish: () => finish('finished'),
    setDuration,
    getStatus,
    getRemainingMs,
    currentElapsedMs,
    destroy,
  };
}

/**
 * 长按检测:在指定元素上按下超过 longPressMs 触发回调
 * 若手指移出元素 / 提前松开则取消
 */
export function bindLongPress(el, longPressMs, onLongPress) {
  let timer = 0;
  let triggered = false;
  let active = false;
  let startX = 0;
  let startY = 0;

  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  }

  function onStart(e) {
    if (active) return;
    active = true;
    triggered = false;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    el.classList && el.classList.add('pressing');
    timer = setTimeout(() => {
      triggered = true;
      onLongPress && onLongPress();
    }, longPressMs);
  }

  function onMove(e) {
    if (!active) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (dx > 12 || dy > 12) {
      clear();
    }
  }

  function onEnd() {
    if (!active) return;
    active = false;
    el.classList && el.classList.remove('pressing');
    clear();
  }

  // 触屏优先
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: true });
  el.addEventListener('touchend', onEnd);
  el.addEventListener('touchcancel', onEnd);
  // 鼠标(桌面调试)
  el.addEventListener('mousedown', onStart);
  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseup', onEnd);
  el.addEventListener('mouseleave', onEnd);

  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onEnd);
    el.removeEventListener('mousedown', onStart);
    el.removeEventListener('mousemove', onMove);
    el.removeEventListener('mouseup', onEnd);
    el.removeEventListener('mouseleave', onEnd);
  };
}
