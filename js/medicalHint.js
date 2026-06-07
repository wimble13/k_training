// 训练前医学提示
// - 首次进入训练页:整页模态,显示姿势 / 呼吸 / 禁忌,底部"我知道了"按钮
// - 后续进入:顶部 3 秒 banner 自动消失,可手动关闭
// 用 localStorage 标记是否已看过

import { MEDICAL_HINT_KEY } from './config.js';

const HINT_HTML = `
  <div class="medical-modal">
    <div class="medical-modal-card">
      <div class="medical-modal-title">训练前请阅读</div>
      <div class="medical-modal-body">
        <div class="medical-hint-section">
          <div class="medical-hint-h">姿势</div>
          <p>起始建议仰卧位(双腿屈曲),熟练后可改为坐位或站位。身体保持放松。</p>
        </div>
        <div class="medical-hint-section">
          <div class="medical-hint-h">呼吸</div>
          <p>腹式呼吸,收缩时缓慢呼气,放松时自然吸气。<b>不要憋气</b>。</p>
        </div>
        <div class="medical-hint-section">
          <div class="medical-hint-h">动作要点</div>
          <p>尝试"中断尿流"或"阻止放屁"的感觉,定位盆底肌。避免收缩腹肌、臀肌或大腿肌。</p>
        </div>
        <div class="medical-hint-section">
          <div class="medical-hint-h">禁忌</div>
          <p><b>不要在排尿时做训练</b>,可能引起尿潴留或感染。怀孕、产后、盆腔手术后或严重尿失禁者,请先咨询医生。</p>
        </div>
      </div>
      <button class="medical-modal-btn" id="medical-modal-ok">我知道了,开始训练</button>
    </div>
  </div>
`;

const BANNER_HTML = `
  <div class="medical-banner" id="medical-banner">
    <span>腹式呼吸,不要憋气;不要在排尿时训练。</span>
    <button class="medical-banner-close" id="medical-banner-close" aria-label="关闭">×</button>
  </div>
`;

/**
 * 显示训练前医学提示
 * - 首次:模态(强制点 OK)
 * - 已看过:顶部 banner 3 秒后自动消失
 *   banner 同时会调 audio.unlock()(因为是用户手势)
 * 返回 Promise:resolve 时模态/banner 已处理,调用方应在此之后启动训练
 */
export function showMedicalHint() {
  return new Promise((resolve) => {
    const seen = localStorage.getItem(MEDICAL_HINT_KEY) === '1';

    if (!seen) {
      showModal(() => {
        localStorage.setItem(MEDICAL_HINT_KEY, '1');
        resolve();
      });
    } else {
      showBanner(() => resolve());
    }
  });
}

function showModal(onDone) {
  const wrap = document.createElement('div');
  wrap.innerHTML = HINT_HTML.trim();
  const modal = wrap.firstElementChild;
  document.body.appendChild(modal);
  // 防止背景滚动
  document.body.style.overflow = 'hidden';

  const btn = modal.querySelector('#medical-modal-ok');
  btn.addEventListener('click', () => {
    modal.classList.add('closing');
    setTimeout(() => {
      modal.remove();
      document.body.style.overflow = '';
      onDone();
    }, 200);
  }, { once: true });
}

function showBanner(onDone) {
  const wrap = document.createElement('div');
  wrap.innerHTML = BANNER_HTML.trim();
  const banner = wrap.firstElementChild;
  document.body.appendChild(banner);
  // 触发动画
  requestAnimationFrame(() => banner.classList.add('show'));

  const closeBtn = banner.querySelector('#medical-banner-close');
  const close = () => {
    banner.classList.remove('show');
    setTimeout(() => {
      banner.remove();
      onDone();
    }, 250);
  };
  closeBtn.addEventListener('click', close);
  // 3 秒后自动消失
  setTimeout(close, 3000);
}

/**
 * 调试用:清除"已看过"标记
 */
export function resetMedicalHint() {
  localStorage.removeItem(MEDICAL_HINT_KEY);
}
