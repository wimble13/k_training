// 入口

import { audio } from './audio.js';
import { startRouter, registerRoute, navigate } from './router.js';
import { store } from './store.js';
import { homeView } from './views/homeView.js';
import { stageView } from './views/stageView.js';
import { trainingView } from './views/trainingView.js';
import { feedbackView } from './views/feedbackView.js';
import { recordView } from './views/recordView.js';

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function setTitle(text) {
  const t = document.getElementById('app-title');
  if (t) t.textContent = text;
}

function setBackVisible(visible) {
  const b = document.getElementById('back-btn');
  if (!b) return;
  if (visible) b.classList.remove('hidden');
  else b.classList.add('hidden');
}

function init() {
  // 安装音频解锁监听
  audio.installUnlockHandlers();

  // 注册路由
  registerRoute('/home', () => {
    setBackVisible(false);
    setTitle('凯格尔训练');
    showView('view-home');
    return homeView('#view-home', { onSelectStage: (id) => navigate(`#/stage/${id}`) });
  });

  registerRoute('/stage/:id', ({ id }) => {
    setBackVisible(true);
    setTitle('选择时段');
    showView('view-stage');
    return stageView('#view-stage', {
      stageId: Number(id),
      onBack: () => navigate('#/home'),
      onSelectSlot: (stageId, slot) => navigate(`#/training/${stageId}/${slot}`),
    });
  });

  registerRoute('/training/:stageId/:slot', ({ stageId, slot }) => {
    setBackVisible(false);
    setTitle('训练中');
    showView('view-training');
    return trainingView('#view-training', {
      stageId: Number(stageId),
      slot,
      onComplete: ({ elapsedMs, endedEarly, cancelled, stageId, slot, startTs }) => {
        // cancelled=true:pre_start 期间被取消,不入库,直接回首页
        if (cancelled) {
          toast('已取消训练');
          navigate('#/home');
          return;
        }
        // 正常结束:记录临时 session,跳到反馈页
        const tmp = { stageId, slot, startTs, elapsedMs, endedEarly };
        sessionStorage.setItem('kegel_pending_session', JSON.stringify(tmp));
        navigate('#/feedback/pending');
      },
    });
  });

  registerRoute('/feedback/:sessionId', () => {
    setBackVisible(false);
    setTitle('训练反馈');
    showView('view-feedback');
    return feedbackView('#view-feedback', {
      onSubmit: () => navigate('#/home'),
      onSkip: () => navigate('#/home'),
    });
  });

  registerRoute('/record', () => {
    setBackVisible(true);
    setTitle('训练记录');
    showView('view-record');
    return recordView('#view-record', { onBack: () => navigate('#/home') });
  });

  // 顶部返回按钮
  document.getElementById('back-btn').addEventListener('click', () => {
    history.length > 1 ? history.back() : navigate('#/home');
  });
  // 记录按钮
  document.getElementById('record-btn').addEventListener('click', () => {
    navigate('#/record');
  });

  // 启动路由
  startRouter('#/home');

  // 订阅 store 变更(简单 toast / 红点)
  store.subscribe(() => {
    // 视图内部已自带重渲,这里只做全局副作用
  });
}

// toast 工具(供其他模块调用)
export function toast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
