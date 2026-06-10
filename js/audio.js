// 音频管理:iOS Safari 音频解锁 + BGM/一次性提示/震动

import { VIBRATE_MS } from './config.js';

const AUDIO_FILES = {
  bgm: 'assets/audio/bgm.mp3',
  start: 'assets/audio/start.mp3',
  finish: 'assets/audio/finish.mp3',
  shou: 'assets/audio/shou.mp3',
  fang: 'assets/audio/fang.mp3',
  kuai: 'assets/audio/kuai.mp3',
};

const ONESHOT_KEYS = Object.keys(AUDIO_FILES).filter((k) => k !== 'bgm');

class AudioManager {
  constructor() {
    this._unlocked = false;
    this._bgm = null;
    this._bgmWantPlay = false;
    this._bgmElements = new Set();
    // 每个提示音 2 个 DOM 元素轮换(iOS 上 cloneNode 不可靠)
    this._oneShotSlots = {};
    this._oneShotIdx = {};
    this._soundOn = true;
    this._vibrationOn = true;
    this._audioCtx = null;
    this._mount = null;
  }

  installUnlockHandlers() {
    const handler = () => {
      const ok = this._doUnlock();
      const hint = document.getElementById('audio-unlock-hint');
      if (ok) {
        document.removeEventListener('click', handler, true);
        document.removeEventListener('touchend', handler, true);
        document.removeEventListener('pointerdown', handler, true);
        if (hint) hint.classList.add('hidden');
      } else if (hint) {
        const sub = hint.querySelector('.hint-sub');
        if (sub) sub.textContent = '音频解锁失败,请再点击一次';
      }
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchend', handler, true);
    document.addEventListener('pointerdown', handler, true);
  }

  // 在用户手势的同步调用栈内执行
  unlock() {
    if (this._unlocked) return Promise.resolve(true);
    const ok = this._doUnlock();
    return Promise.resolve(ok);
  }

  _getMount() {
    if (!this._mount) {
      this._mount = document.createElement('div');
      this._mount.id = 'audio-mount';
      this._mount.setAttribute('aria-hidden', 'true');
      this._mount.style.cssText =
        'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none';
      document.body.appendChild(this._mount);
    }
    return this._mount;
  }

  _makeAudio(src) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.playsInline = true;
    a.setAttribute('playsinline', '');
    a.setAttribute('webkit-playsinline', '');
    this._getMount().appendChild(a);
    return a;
  }

  _ensureOneShotSlots() {
    for (const key of ONESHOT_KEYS) {
      if (!this._oneShotSlots[key]) {
        this._oneShotSlots[key] = [
          this._makeAudio(AUDIO_FILES[key]),
          this._makeAudio(AUDIO_FILES[key]),
        ];
        this._oneShotIdx[key] = 0;
      }
    }
  }

  // 同步预热:在用户手势内 play 一次(音量 0)
  _warmElement(el) {
    try {
      const prev = el.volume;
      el.volume = 0;
      el.play();
      el.pause();
      el.currentTime = 0;
      el.volume = prev > 0 ? prev : 0.85;
      return true;
    } catch (e) {
      try {
        el.volume = 0.85;
      } catch (e2) { /* ignore */ }
      return false;
    }
  }

  _doUnlock() {
    if (this._unlocked) return true;
    try {
      this._ensureOneShotSlots();
      let warmed = 0;
      for (const key of ONESHOT_KEYS) {
        for (const el of this._oneShotSlots[key]) {
          if (this._warmElement(el)) warmed += 1;
        }
      }
      let bgmProbe = null;
      try {
        bgmProbe = this._createBgmElement();
        bgmProbe.volume = 0;
        if (this._warmElement(bgmProbe)) warmed += 1;
      } catch (e) { /* ignore */ }
      if (bgmProbe) this._killAudioElement(bgmProbe);

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this._audioCtx = this._audioCtx || new Ctx();
        if (this._audioCtx.state === 'suspended') {
          this._audioCtx.resume().catch(() => {});
        }
      }

      if (warmed > 0) {
        this._unlocked = true;
        return true;
      }
      this.stopBgm();
      return false;
    } catch (e) {
      console.warn('[audio] unlock failed', e);
      return false;
    }
  }

  _createBgmElement() {
    const a = this._makeAudio(AUDIO_FILES.bgm);
    a.loop = true;
    a.volume = 0.35;
    a.setAttribute('data-kegel-bgm', '1');
    this._bgmElements.add(a);
    return a;
  }

  _killAudioElement(a) {
    if (!a) return;
    try {
      a.loop = false;
      a.volume = 0;
      a.pause();
      a.currentTime = 0;
    } catch (e) { /* ignore */ }
    try {
      a.removeAttribute('src');
      a.src = '';
      a.load();
    } catch (e) { /* ignore */ }
    a._destroyed = true;
    this._bgmElements.delete(a);
    if (a.parentNode) a.parentNode.removeChild(a);
    if (this._bgm === a) this._bgm = null;
  }

  isUnlocked() {
    return this._unlocked;
  }

  setSoundOn(on) {
    this._soundOn = !!on;
    if (!on) this.stopBgm();
    else if (this._bgmWantPlay) this.playBgm();
  }

  setVibrationOn(on) {
    this._vibrationOn = !!on;
  }

  isSoundOn() {
    return this._soundOn;
  }

  isVibrationOn() {
    return this._vibrationOn;
  }

  playBgm() {
    this._bgmWantPlay = true;
    if (!this._unlocked || !this._soundOn) return;
    this._startBgm(false);
  }

  _startBgm(isRetry) {
    if (!this._bgm || this._bgm._destroyed) {
      for (const el of Array.from(this._bgmElements)) this._killAudioElement(el);
      this._bgm = this._createBgmElement();
    }
    try {
      this._bgm.volume = 0.35;
      const p = this._bgm.play();
      if (p && p.catch) {
        p.catch(() => {
          if (!isRetry) {
            this._killAudioElement(this._bgm);
            this._bgm = null;
            this._startBgm(true);
          }
        });
      }
    } catch (e) {
      if (!isRetry) {
        this._killAudioElement(this._bgm);
        this._bgm = null;
        this._startBgm(true);
      }
    }
  }

  stopBgm() {
    this._bgmWantPlay = false;
    const all = Array.from(this._bgmElements);
    for (const el of all) this._killAudioElement(el);
    this._bgm = null;
  }

  playOneShot(name) {
    if (!this._unlocked || !this._soundOn) return;
    this._ensureOneShotSlots();
    const slots = this._oneShotSlots[name];
    if (!slots) return;

    const idx = this._oneShotIdx[name] || 0;
    const alt = 1 - idx;
    this._oneShotIdx[name] = alt;

    this._playSlot(slots[idx], slots[alt]);
  }

  _playSlot(primary, fallback) {
    const tryPlay = (el, canRetry) => {
      try {
        el.pause();
        el.currentTime = 0;
        el.volume = 0.85;
        const p = el.play();
        if (p && p.catch && canRetry) {
          p.catch(() => tryPlay(fallback, false));
        }
      } catch (e) {
        if (canRetry) tryPlay(fallback, false);
      }
    };
    tryPlay(primary, true);
  }

  vibrate(ms = VIBRATE_MS) {
    if (!this._vibrationOn) return;
    if (navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        // ignore
      }
    }
  }
}

export const audio = new AudioManager();
