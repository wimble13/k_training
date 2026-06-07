// 日历:渲染指定年/月,标记有训练的日期

import { store } from './store.js';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 创建日历
 * mount(sel, year, month)
 *  - month: 0-11
 * 返回 { destroy, refresh, setMonth, getCurrent }
 */
export function createCalendar() {
  let state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  };
  let _container = null;
  let _onMonthChange = null;

  function mount(sel, opts = {}) {
    _container = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!_container) return { destroy() {}, refresh() {}, setMonth() {}, getCurrent: () => ({ ...state }) };
    _onMonthChange = opts.onMonthChange;
    render();
    bindEvents();
    return {
      destroy: () => {
        if (_container) _container.innerHTML = '';
      },
      refresh,
      setMonth,
      getCurrent: () => ({ ...state }),
    };
  }

  function setMonth(year, month) {
    state = { year, month };
    render();
  }

  function refresh() {
    render();
  }

  function bindEvents() {
    _container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-nav]');
      if (!btn) return;
      const nav = btn.dataset.nav;
      let { year, month } = state;
      if (nav === 'prev') {
        month -= 1;
        if (month < 0) {
          month = 11;
          year -= 1;
        }
      } else if (nav === 'next') {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      } else if (nav === 'today') {
        const t = new Date();
        year = t.getFullYear();
        month = t.getMonth();
      }
      state = { year, month };
      render();
      _onMonthChange && _onMonthChange({ ...state });
    });
  }

  function render() {
    if (!_container) return;
    const { year, month } = state;
    const marked = store.getMonthMarkedDays(year, month);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ empty: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        key: k,
        marked: marked.has(k),
        isToday: k === todayKey,
      });
    }

    _container.innerHTML = `
      <div class="calendar-head">
        <div class="calendar-title">${year} 年 ${month + 1} 月</div>
        <div class="calendar-nav">
          <button data-nav="prev" aria-label="上个月">‹</button>
          <button data-nav="today" aria-label="回到本月" style="width:auto;padding:0 10px;font-size:12px;">今</button>
          <button data-nav="next" aria-label="下个月">›</button>
        </div>
      </div>
      <div class="calendar-week">
        ${WEEK_LABELS.map((w) => `<div>${w}</div>`).join('')}
      </div>
      <div class="calendar-grid">
        ${cells
          .map((c) => {
            if (c.empty) return `<div class="calendar-day empty"></div>`;
            const cls = ['calendar-day'];
            if (c.marked) cls.push('marked');
            if (c.isToday) cls.push('today');
            return `<div class="${cls.join(' ')}" data-key="${c.key}">${c.day}</div>`;
          })
          .join('')}
      </div>
      <div class="calendar-legend">
        <span><span class="dot marked"></span>已训练</span>
        <span><span class="dot today"></span>今天</span>
      </div>
    `;
  }

  return { mount };
}
