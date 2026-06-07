// 简单 hash 路由
// 路由表:
//   #/home
//   #/stage/:id
//   #/training/:stageId/:slot
//   #/feedback/:sessionId
//   #/record

const routes = [];

export function registerRoute(pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:([^/]+)/g, (_, k) => {
        keys.push(k);
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ regex, keys, handler });
}

let _cleanup = null;

export function startRouter(defaultHash = '#/home') {
  if (!location.hash) location.hash = defaultHash;

  function go() {
    const hash = location.hash || defaultHash;
    const path = hash.replace(/^#/, '');

    // 先调 cleanup
    if (typeof _cleanup === 'function') {
      try {
        _cleanup();
      } catch (e) {
        console.warn('[router] cleanup error', e);
      }
      _cleanup = null;
    }

    for (const r of routes) {
      const m = path.match(r.regex);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        // 隐藏所有视图
        document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
        const result = r.handler(params);
        if (result && typeof result.destroy === 'function') {
          _cleanup = () => result.destroy();
        }
        return;
      }
    }
    // 未匹配 → 回首页
    location.hash = defaultHash;
  }

  window.addEventListener('hashchange', go);
  go();
}

export function navigate(hash) {
  if (location.hash === hash) {
    // 强制重渲染
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}
