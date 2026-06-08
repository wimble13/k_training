// localStorage 封装
// 所有状态持久化在单一 key 下

import { EXP_PER_MINUTE, UNLOCK_RULE } from './config.js';

const STORAGE_KEY = 'kegel_state_v1';
// 当日全流程完成 ≥ 2 次才算 1 个训练日
const MIN_SESSIONS_PER_TRAINING_DAY = 2;

const defaultState = () => ({
  sessions: [],
  totalExp: 0,
  totalSeconds: 0,
  consecutiveDays: 0,
  lastTrainingDate: null,
  unlockedStages: [1],
});

let _cache = null;
const _listeners = new Set();

function load() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _cache = defaultState();
    } else {
      const parsed = JSON.parse(raw);
      _cache = { ...defaultState(), ...parsed };
      recomputeDerivedStats(_cache);
    }
  } catch (e) {
    console.warn('[store] load failed, resetting', e);
    _cache = defaultState();
  }
  return _cache;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
  } catch (e) {
    console.warn('[store] persist failed', e);
  }
  _listeners.forEach((fn) => {
    try {
      fn(_cache);
    } catch (e) {
      console.warn('[store] listener error', e);
    }
  });
}

export const store = {
  get state() {
    return load();
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  // 记录一次完整训练
  // session: { stageId, slot, startTs, elapsedMs, endedEarly, feeling, note }
  recordSession(session) {
    const s = load();
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expEarned = computeExp(session.elapsedMs);
    const record = {
      id,
      stageId: session.stageId,
      slot: session.slot,
      startTs: session.startTs,
      elapsedMs: session.elapsedMs,
      endedEarly: !!session.endedEarly,
      feeling: session.feeling || null,
      note: session.note || '',
      expEarned,
    };
    s.sessions.push(record);
    recomputeDerivedStats(s);
    persist();
    return record;
  },

  // 检查某阶段是否解锁
  isStageUnlocked(stageId) {
    return load().unlockedStages.includes(stageId);
  },

  // 统计数据
  getStats() {
    const s = load();
    return {
      totalExp: s.totalExp,
      totalSeconds: s.totalSeconds,
      totalSessions: s.qualifiedSessionCount || 0,
      consecutiveDays: s.consecutiveDays,
      lastTrainingDate: s.lastTrainingDate,
      sessions: s.sessions,
    };
  },

  // 给定年和月(0-11),返回当月有训练的日期集合(YYYY-MM-DD)
  getMonthMarkedDays(year, month) {
    const s = load();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dailyCounts = new Map();
    for (const sess of s.sessions) {
      if (!isQualifiedSession(sess)) continue;
      const k = dateKeyOf(new Date(sess.startTs));
      if (!k.startsWith(prefix)) continue;
      dailyCounts.set(k, (dailyCounts.get(k) || 0) + 1);
    }
    const set = new Set();
    for (const [k, count] of dailyCounts) {
      if (count >= MIN_SESSIONS_PER_TRAINING_DAY) set.add(k);
    }
    return set;
  },

  // 某阶段的训练统计
  getStageStats(stageId) {
    const s = load();
    const dailyCounts = new Map();
    let totalSeconds = 0;
    let sessions = 0;
    for (const sess of s.sessions) {
      if (sess.stageId !== stageId || !isQualifiedSession(sess)) continue;
      sessions += 1;
      totalSeconds += Math.floor(sess.elapsedMs / 1000);
      const k = dateKeyOf(new Date(sess.startTs));
      dailyCounts.set(k, (dailyCounts.get(k) || 0) + 1);
    }
    let days = 0;
    for (const count of dailyCounts.values()) {
      if (count >= MIN_SESSIONS_PER_TRAINING_DAY) days += 1;
    }
    return { sessions, days, totalSeconds };
  },

  // 按日期分组当日训练次数
  getDayCount(dateKey) {
    const s = load();
    let n = 0;
    for (const sess of s.sessions) {
      if (!isQualifiedSession(sess)) continue;
      if (dateKeyOf(new Date(sess.startTs)) === dateKey) n += 1;
    }
    return n;
  },

  // 重置(仅调试使用)
  reset() {
    _cache = defaultState();
    persist();
  },
};

// 全流程完成(非提前结束)才算有效训练
function isQualifiedSession(sess) {
  return !sess.endedEarly;
}

function getDailyQualifiedCounts(sessions, stageId) {
  const dailyCounts = new Map();
  for (const sess of sessions) {
    if (!isQualifiedSession(sess)) continue;
    if (stageId != null && sess.stageId !== stageId) continue;
    const k = dateKeyOf(new Date(sess.startTs));
    dailyCounts.set(k, (dailyCounts.get(k) || 0) + 1);
  }
  return dailyCounts;
}

function isQualifiedTrainingDay(count) {
  return count >= MIN_SESSIONS_PER_TRAINING_DAY;
}

function computeConsecutiveQualifiedDays(sessions) {
  const dailyCounts = getDailyQualifiedCounts(sessions);
  const qualified = new Set();
  for (const [k, count] of dailyCounts) {
    if (isQualifiedTrainingDay(count)) qualified.add(k);
  }
  if (qualified.size === 0) return 0;

  let streak = 0;
  const d = new Date();
  let started = false;
  for (let i = 0; i < 3650; i++) {
    const k = dateKeyOf(d);
    if (qualified.has(k)) {
      streak += 1;
      started = true;
      d.setDate(d.getDate() - 1);
    } else if (started) {
      break;
    } else {
      d.setDate(d.getDate() - 1);
    }
  }
  return streak;
}

function recomputeDerivedStats(s) {
  const qualified = s.sessions.filter(isQualifiedSession);
  s.qualifiedSessionCount = qualified.length;
  s.totalExp = qualified.reduce((sum, sess) => sum + (sess.expEarned ?? computeExp(sess.elapsedMs)), 0);
  s.totalSeconds = qualified.reduce((sum, sess) => sum + Math.floor(sess.elapsedMs / 1000), 0);
  s.consecutiveDays = computeConsecutiveQualifiedDays(s.sessions);
  if (qualified.length > 0) {
    const last = qualified.reduce((a, b) => (a.startTs > b.startTs ? a : b));
    s.lastTrainingDate = dateKeyOf(new Date(last.startTs));
  } else {
    s.lastTrainingDate = null;
  }
  s.unlockedStages = computeUnlocked(s);
}

function computeExp(elapsedMs) {
  const minutes = elapsedMs / 1000 / 60;
  return Math.max(0, Math.floor(minutes * EXP_PER_MINUTE));
}

function computeUnlocked(state) {
  const unlocked = [1];
  for (const stageId of [2, 3, 4]) {
    const rule = UNLOCK_RULE[stageId];
    if (!rule) continue;
    if (matchRule(rule, state)) unlocked.push(stageId);
  }
  return unlocked;
}

function matchRule(rule, state) {
  switch (rule.type) {
    case 'consecutive':
      return state.consecutiveDays >= rule.days;
    case 'cumulative':
      return (state.qualifiedSessionCount || 0) >= rule.sessions;
    case 'exp':
      return state.totalExp >= rule.value;
    default:
      return false;
  }
}

function dateKeyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(aKey, bKey) {
  // aKey、bKey 都是 'YYYY-MM-DD',返回 b - a 的天数
  const a = new Date(aKey + 'T00:00:00');
  const b = new Date(bKey + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

export { dateKeyOf };
