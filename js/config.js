// 训练阶段配置
// 医学参考:NIH / Mayo Clinic 凯格尔训练分阶段方案
//   阶段 1 感知(基础感知期):短收缩短放松,建立神经-肌肉控制
//   阶段 2 耐力(耐力建立期):延长收缩,提升慢肌纤维(I 型)耐力
//   阶段 3 强化(强化收缩期):长收缩 + 快肌训练,提升 II 型快肌力量
//   阶段 4 巩固(整合巩固期):长收缩 + 快收 + 场景触发,形成自动化反应
//
// 段落类型:
//   shou       长收缩(秒)
//   fang       放松(秒)
//   kuai_set   快收组合:reps 次 (1s 收 + 1s 放)

export const STAGE_CONFIG = {
  1: {
    name: '感知阶段',
    desc: '入门训练,适合初学者建立节奏感。',
    sections: Array.from({ length: 30 }, () => [
      { type: 'shou', sec: 3 },
      { type: 'fang', sec: 4 },
    ]).flat(),
  },
  2: {
    name: '耐力阶段',
    desc: '在感知之上,延长收缩与放松时间。',
    sections: Array.from({ length: 30 }, () => [
      { type: 'shou', sec: 5 },
      { type: 'fang', sec: 6 },
    ]).flat(),
  },
  3: {
    name: '强化阶段',
    desc: '长收缩 + 快肌训练,接近中级练习。',
    sections: [
      ...Array.from({ length: 30 }, () => [
        { type: 'shou', sec: 8 },
        { type: 'fang', sec: 9 },
      ]).flat(),
      { type: 'kuai_set', sec: 1, reps: 10, label: '快收 10 次' },
      { type: 'kuai_set', sec: 1, reps: 10, label: '快收 10 次' },
    ],
  },
  4: {
    name: '巩固阶段',
    desc: '长收缩 + 双组快收 + 场景整合,挑战极限。',
    sections: [
      ...Array.from({ length: 30 }, () => [
        { type: 'shou', sec: 10 },
        { type: 'fang', sec: 11 },
      ]).flat(),
      { type: 'kuai_set', sec: 1, reps: 10, label: '快收 10 次' },
      { type: 'kuai_set', sec: 1, reps: 10, label: '快收 10 次' },
    ],
  },
};

// 时段
export const SLOTS = {
  morning: { key: 'morning', name: '晨间', icon: '☀️', sub: '起床后唤醒' },
  noon: { key: 'noon', name: '午间', icon: '🌤️', sub: '午后调整' },
  night: { key: 'night', name: '晚间', icon: '🌙', sub: '睡前放松' },
};

// 解锁规则(医学建议)
export const UNLOCK_RULE = {
  2: { type: 'consecutive', days: 14 },    // 连续 14 天完成感知阶段
  3: { type: 'cumulative', sessions: 60 }, // 累计完成 60 次训练
  4: { type: 'exp', value: 300 },           // 累计 300 EXP
};

// 每分钟训练 = EXP 1
export const EXP_PER_MINUTE = 1;

// 训练记录(反馈页)心得是否必填
// true = 必填且 ≥15 字(旧规则); false = 选填,空字符串也允许提交
export const NOTE_REQUIRED = false;

// 若 NOTE_REQUIRED 为 true,至少字数;否则忽略
export const NOTE_MIN_LENGTH = 15;

// 短震动持续时间(ms)
export const VIBRATE_MS = 80;

// 长按提前结束的判定时长(ms)
export const LONG_PRESS_MS = 2000;

// 默认震动 / 声音开关
export const DEFAULT_VIBRATION_ON = true;
export const DEFAULT_SOUND_ON = true;

// 训练前医学提示是否已看过(写入 localStorage 的 key)
export const MEDICAL_HINT_KEY = 'kegel_medical_hint_seen_v1';

// 开始提示音的实际时长(ms)
export const START_PROMPT_DURATION_MS = 9000;
