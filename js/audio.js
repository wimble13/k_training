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
    this._bgmElements = new Set(); // 追踪所有 BGM 实例,防止 iOS 孤儿音频继续播
    this._oneshotPool = {};
    // 一次性音的 clone 池,用于 playOneShot 轮换播放
    // iOS Safari 同时存在的 <audio> 数量有限,池化避免长时间训练触发上限
    this._clonePoolSize = 4;
    this._cloneRoundRobin = {}; // { name: nextIndex }
    this._soundOn = true;
    this._vibrationOn = true;
    this._unlockHandlers = [];
    this._audioCtx = null;
  }

  // 首次手势解锁(挂一次性监听)
  installUnlockHandlers() {
    const handler = () => {
      this.unlock().then((ok) => {
        const hint = document.getElementById('audio-unlock-hint');
        if (ok) {
          document.removeEventListener('click', handler, true);
          document.removeEventListener('touchend', handler, true);
          document.removeEventListener('pointerdown', handler, true);
          if (hint) hint.classList.add('hidden');
        } else if (hint) {
          // 解锁失败:保留监听,提示用户再点一次
          const sub = hint.querySelector('.hint-sub');
          if (sub) sub.textContent = '音频解锁失败,请再点击一次';
        }
      });
    };
    document.addEventListener('click', handler, true);
    document.addEventListener('touchend', handler, true);
    document.addEventListener('pointerdown', handler, true);
  }

  // 真正的解锁动作
  // 返回 Promise<boolean> true = 解锁成功, false = 解锁失败
  // 注意:iOS 要求 play() 在用户手势的同步调用栈内触发,不能 await 之后再 play
  unlock() {
    if (this._unlocked) return Promise.resolve(true);
    try {
      // 1. 预加载所有一次性音频(同步)
      for (const key of Object.keys(AUDIO_FILES)) {
        if (key === 'bgm') continue;
        if (!this._oneshotPool[key]) {
          this._oneshotPool[key] = this._makeAudio(AUDIO_FILES[key]);
        }
      }
      // 2. 哨兵音(音量 0,同步 play):确认提示音链路已激活
      const sentinel = this._oneshotPool['start'];
      let sentinelOk = false;
      if (sentinel) {
        try {
          sentinel.volume = 0;
          sentinel.play();
          sentinelOk = true;
          sentinel.pause();
          sentinel.currentTime = 0;
          sentinel.volume = 0.85;
        } catch (e) {
          sentinelOk = false;
          sentinel.volume = 0.85;
        }
      }
      // 3. BGM 探针(音量 0,同步 play):激活 BGM 链路,测完立刻销毁
      let bgmProbe = null;
      try {
        bgmProbe = this._createBgmElement();
        bgmProbe.volume = 0;
        bgmProbe.play();
      } catch (e) { /* BGM 探针失败不阻断解锁 */ }
      if (bgmProbe) this._killAudioElement(bgmProbe);
      // 4. AudioContext resume(放 play 之后,不阻塞手势链)
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this._audioCtx = this._audioCtx || new Ctx();
        if (this._audioCtx.state === 'suspended') {
          this._audioCtx.resume().catch(() => {});
        }
      }
      if (sentinelOk) {
        this._unlocked = true;
        return Promise.resolve(true);
      }
      this.stopBgm();
      return Promise.resolve(false);
    } catch (e) {
      console.warn('[audio] unlock failed', e);
      return Promise.resolve(false);
    }
  }

  _makeAudio(src) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.playsInline = true;
    a.setAttribute('playsinline', '');
    return a;
  }

  _createBgmElement() {
    const a = this._makeAudio(AUDIO_FILES.bgm);
    a.loop = true;
    a.volume = 0.35;
    a.setAttribute('data-kegel-bgm', '1');
    document.body.appendChild(a);
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

  // 背景音乐
  playBgm() {
    this._bgmWantPlay = true;
    if (!this._unlocked || !this._soundOn) return;
    // 每次播放前确保只有一个活跃实例(只销毁元素,不清 _bgmWantPlay)
    if (!this._bgm || this._bgm._destroyed) {
      for (const el of Array.from(this._bgmElements)) this._killAudioElement(el);
      this._bgm = this._createBgmElement();
    }
    try {
      this._bgm.volume = 0.35;
      const p = this._bgm.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      // ignore
    }
  }

  stopBgm() {
    this._bgmWantPlay = false;
    // 停掉所有 BGM 实例(iOS 上 pause 对 loop 元素常失效,需逐个卸载)
    const all = Array.from(this._bgmElements);
    for (const el of all) this._killAudioElement(el);
    this._bgm = null;
  }

  // 一次性提示音
  // 用池化 + 轮换避免 iOS Safari 同时存在的 <audio> 数量超限
  playOneShot(name) {
    if (!this._unlocked || !this._soundOn) return;
    const src = this._oneshotPool[name];
    if (!src) return;
    // 每个 name 维护 N 个 clone,轮换使用
    if (!src._clones) {
      src._clones = [];
      this._cloneRoundRobin[name] = 0;
    }
    // 按需补足 clone 数量
    while (src._clones.length < this._clonePoolSize) {
      src._clones.push(src.cloneNode(true));
    }
    const idx = this._cloneRoundRobin[name] % this._clonePoolSize;
    this._cloneRoundRobin[name] = (idx + 1) % this._clonePoolSize;
    const clone = src._clones[idx];
    try {
      clone.currentTime = 0;
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
