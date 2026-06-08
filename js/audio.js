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

class AudioManager {
  constructor() {
    this._unlocked = false;
    this._bgm = null;
    this._oneshotPool = {};
    this._soundOn = true;
    this._vibrationOn = true;
    this._unlockHandlers = [];
    this._audioCtx = null;
  }

  // 首次手势解锁(挂一次性监听)
  installUnlockHandlers() {
    const handler = () => {
      this.unlock().then(() => {
        document.removeEventListener('click', handler, true);
        document.removeEventListener('touchend', handler, true);
        document.removeEventListener('pointerdown', handler, true);
        const hint = document.getElementById('audio-unlock-hint');
        if (hint) hint.classList.add('hidden');
      });
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchend', handler, true);
    document.addEventListener('pointerdown', handler, true);
  }

  // 真正的解锁动作
  async unlock() {
    if (this._unlocked) return;
    try {
      // 1. Web Audio Context resume(iOS 必需)
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this._audioCtx = this._audioCtx || new Ctx();
        if (this._audioCtx.state === 'suspended') {
          await this._audioCtx.resume();
        }
      }
      // 2. 预加载所有一次性音频
      for (const key of Object.keys(AUDIO_FILES)) {
        if (key === 'bgm') continue;
        this._oneshotPool[key] = this._makeAudio(AUDIO_FILES[key]);
      }
      // 3. 准备 BGM
      this._bgm = this._makeAudio(AUDIO_FILES.bgm);
      this._bgm.loop = true;
      this._bgm.volume = 0.35;
      // 4. iOS 媒体会话激活:必须在用户手势的同步调用栈里 play() 一次
      // 用静音(volume=0)播放,这样即使后续 pause() 不可靠,也不会被用户听到
      // 等 stopBgm() 会彻底销毁这个 audio 元素
      try {
        await this._bgm.play();
      } catch (e) {
        // 忽略
      }
      this._unlocked = true;
    } catch (e) {
      console.warn('[audio] unlock failed', e);
    }
  }

  _makeAudio(src) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.playsInline = true;
    a.setAttribute('playsinline', '');
    return a;
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

  // 背景音乐
  playBgm() {
    this._bgmWantPlay = true;
    if (!this._unlocked || !this._soundOn) return;
    // 每次 playBgm 时,如无 _bgm 或 _bgm.src 为空,重建
    if (!this._bgm || !this._bgm.src || this._bgm._destroyed) {
      this._bgm = this._makeAudio(AUDIO_FILES.bgm);
      this._bgm.loop = true;
      this._bgm.volume = 0.35;
    }
    try {
      const p = this._bgm.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      // ignore
    }
  }

  stopBgm() {
    this._bgmWantPlay = false;
    if (!this._bgm) return;
    // iOS 上 audio.pause() 经常对 loop 元素不生效。
    // 暴力做法:卸载 src 引用,标记销毁,等下次 playBgm 时重建。
    try {
      this._bgm.pause();
    } catch (e) { /* ignore */ }
    try {
      // 把 src 设为空字符串 + 标记,等浏览器 GC
      this._bgm.removeAttribute('src');
      this._bgm.load(); // 触发重新加载(空 src)以确保停掉
    } catch (e) { /* ignore */ }
    this._bgm._destroyed = true;
    this._bgm = null;
  }

  // 一次性提示音
  playOneShot(name) {
    if (!this._unlocked || !this._soundOn) return;
    const a = this._oneshotPool[name];
    if (!a) return;
    try {
      // 多个并发时,clone 一份播放
      const clone = a.cloneNode(true);
      clone.volume = 0.85;
      clone.play().catch(() => {});
    } catch (e) {
      // ignore
    }
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
