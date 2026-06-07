# 凯格尔训练 — 手机 Web 版

一个面向 iPhone Safari 的纯前端凯格尔训练 Web 应用。

## 功能

- 4 个训练阶段(感知 / 耐力 / 强化 / 巩固),按医学建议的解锁条件逐级开放
- 阶段页选择时段(晨 / 午 / 晚)
- 训练页:水波进度环、收/放/快收语音 + 震动、倒计时
- **训练前医学提示**:首次整页模态(姿势/呼吸/动作/禁忌),后续 3 秒 banner
- 暂停 / 继续、长按暂停 2 秒 = 提前结束(带二次确认)
- 训练后填写感受(轻松 / 适中 / 困难),心得选填
- 记录页:累计时长 / 次数 / 天数 / 经验值,当月训练日历

## 目录

```
.
├── index.html
├── assets/audio/        # 5 段音频(占位)
├── css/                 # 样式(按视图拆分)
└── js/                  # 逻辑(ES Modules)
    ├── config.js
    ├── store.js
    ├── audio.js
    ├── timer.js
    ├── progress.js
    ├── calendar.js
    ├── training.js
    ├── router.js
    ├── main.js
    └── views/
```

## 本地运行

iOS Safari 对部分 API(震动 / Service Worker)有要求,**建议用本地 HTTPS 或 `localhost` 访问**。

```bash
# 推荐:用 serve 起本地服务
npx serve .

# 或 Python
python3 -m http.server 8080
```

iPhone 真机调试:把电脑和手机接同一 Wi-Fi,电脑用上面命令启动,手机 Safari 访问 `http://<电脑IP>:8080`(iPhone 需允许跨域音频,可能需要 `https://` 配合自签证书;`localhost` 不会有问题)。

## 解锁规则

| 阶段 | 名称     | 解锁条件                         |
| ---- | -------- | -------------------------------- |
| 1    | 感知阶段 | 默认解锁                         |
| 2    | 耐力阶段 | 连续 14 天完成感知阶段           |
| 3    | 强化阶段 | 累计完成 60 次训练               |
| 4    | 巩固阶段 | 累计获得 300 EXP                 |

> 规则在 `js/config.js` 的 `UNLOCK_RULE` 中配置,改完保存即生效,刷新页面会重新计算。

## 训练段落配置

`js/config.js` 中 `STAGE_CONFIG` 可调(医学参考:NIH / Mayo Clinic 凯格尔训练分期):

| 阶段 | 名称     | 段落配置                                | 单次总时长 |
| ---- | -------- | --------------------------------------- | ---------- |
| 1    | 感知阶段 | 10 组 × (3s 收 + 3s 放)                 | ~60s       |
| 2    | 耐力阶段 | 12 组 × (5s 收 + 5s 放)                 | ~120s      |
| 3    | 强化阶段 | 15 组 × (8s 收 + 8s 放) + 1 组快收 10 次 | ~280s      |
| 4    | 巩固阶段 | 20 组 × (10s 收 + 10s 放) + 2 组快收 10 次 | ~480s  |

> 快收(快肌训练):1s 强力收缩 + 1s 放松,连续 10 次,UI 显示"快收 1/10" → "快收 10/10"。

## 数据存储

全部数据存在 `localStorage.key = 'kegel_state_v1'`:

```ts
{
  sessions: Session[],   // 训练记录
  totalExp: number,      // 累计 EXP
  totalSeconds: number,  // 累计秒数
  consecutiveDays: number, // 当前连续天数
  lastTrainingDate: string, // YYYY-MM-DD
  unlockedStages: number[], // [1] 默认
}
```

## 音频

6 段音频放在 `assets/audio/`:

- `bgm.mp3` — 训练中循环背景音乐
- `start.mp3` — 开始训练提示音
- `finish.mp3` — 训练结束提示音
- `shou.mp3` — 收缩提示语音
- `fang.mp3` — 放松提示语音
- `kuai.mp3` — 快收提示语音(阶段 3/4 末尾快收训练用)
- `fang.mp3` — 放松提示语音

> 当前为占位空文件,正式使用前请替换为真实音频。

## 倒计时后台运行

不使用 Wake Lock(屏幕会自然息屏)。采用 `Date.now()` 差值算法,切到后台 / 锁屏后回到前台,倒计时不会"补跑"或"卡住"。

## 范围外

- PWA / 离线安装
- 后端同步 / 多设备
- 单元测试
- 国际化(默认中文)
- iOS < 16 兼容
