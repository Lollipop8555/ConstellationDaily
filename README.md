# 每日星座 · Constellation Daily

**在线体验**：<https://lollipop8555.github.io/ConstellationDaily/>

这是一个静态的星座运势网站，可以为用户提供每日的运势计算。

## 功能

- 本地记录：在用户选择星座之后，会在浏览器本地保存已选择的星座，在下次打开的时候，自动选中星座
- 星座运势：在用户选择星座之后，会根据用户选择的星座，计算出用户的星座运势，并显示在页面上
- 每日一次：运势记录会在浏览器本地保存，以自然日为单位，当日计算结果不再变化
- 可控计算：运势的计算与日期、星座等关联，相同星座相同日期下，计算结果保持一致

## 交互

- 栅格化：UI 适配移动端与桌面端，在不同的屏幕上能正确显示
- 星座选择：用户可以选择星座，星座以卡牌形式展示，卡牌上展示星座符号与星座中文名
- 再次选择：选择星座后，每次打开自动选择，但是可以通过左上角的按钮，再次重新选择
- 运势展示：星座选择后，自动根据星座计算出运势，并展示在页面上，如果用户切换多个星座，那么需要确保反复切换，运势计算结果不变
- 展示内容：运势需要多维度的展示运势内容，需要展示星座性格特征

## UI

- 现代化：使用现代化 UI 和交互，完善的动画效果
- 神秘：深色的底色，衬托流动的星星组成的星座，带来一种神秘的沉浸感
- 卡牌：星座以卡牌形式展示，在运势展示页面，不同维度的运势结果是不同的卡牌，堆叠切换的卡牌有一种塔罗牌的感觉

## 技术栈

- 静态的网站网页，确保能在 GitHub Pages 上正常展示，附带 GitHub Pages 的相关配置
- 基于 Vue 开发，使用现代化结构和交互风格
- 沉浸式网页风格

具体实现：`Vue 3（组合式 API + 单文件组件）` + `Vite`，无路由、无后端、无第三方 UI 库，构建产物为纯静态文件。

---

## 快速开始

```bash
npm install     # 安装依赖
npm run dev     # 本地开发，默认 http://localhost:5173
npm run build   # 构建静态产物到 dist/
npm run preview # 本地预览构建产物
```

## 部署到 GitHub Pages

仓库已内置工作流 `.github/workflows/deploy.yml`，推送到 `main` 分支即自动构建并发布：

1. 打开仓库 **Settings → Pages**
2. 在 **Build and deployment** 中将 **Source** 选择为 **GitHub Actions**
3. 推送到 `main`（或手动触发 `workflow_dispatch`），等待 Actions 完成

`vite.config.js` 中 `base: './'` 使用相对路径，因此部署在 `https://<user>.github.io/<repo>/` 这类子路径下也无需修改配置。

> 如需部署到**用户主页仓库**（`<user>.github.io`）或自定义域名，同样无需改动。
> 若部署到其他平台（如 Cloudflare Pages / Netlify），构建命令填 `npm run build`，输出目录填 `dist` 即可。

## 目录结构

```
.
├── .github/workflows/deploy.yml   # GitHub Pages 自动部署
├── index.html                     # HTML 入口
├── vite.config.js                 # 构建配置（相对 base，适配子路径）
├── public/.nojekyll               # 关闭 Jekyll 处理
├── src
│   ├── main.js                    # 应用入口
│   ├── App.vue                    # 根组件：选择状态、本地记忆、跨零点刷新、视图切换
│   ├── components
│   │   ├── StarField.vue          # Canvas 星空背景（星点漂移 / 星座连线 / 流星 / 星云）
│   │   ├── SignPicker.vue         # 星座选择页
│   │   ├── SignCard.vue           # 星座卡牌
│   │   ├── FortuneView.vue        # 运势展示页（仅承载牌组，信息全部在卡牌上）
│   │   ├── FortuneDeck.vue        # 塔罗式堆叠牌组（点击 / 滑动 / 方向键切换）
│   │   ├── FortuneCard.vue        # 单张窄卡（档案 / 总览 / 维度 / 指引 / 特质）
│   │   └── ScoreRing.vue          # 环形分值（入场缓动计数）
│   ├── core
│   │   ├── random.js              # 可复现随机数（hash seed + mulberry32）
│   │   ├── zodiac.js              # 本地自然日 key、日期格式化、日期反查星座
│   │   ├── fortune.js             # 确定性运势引擎 + 当日缓存 + 牌组组装
│   │   └── storage.js             # localStorage 封装（读取失败时降级为内存）
│   ├── data
│   │   ├── signs.js               # 十二星座数据（日期 / 元素 / 守护星 / 性格 / 幸运元素 / 主题色）
│   │   └── fortune-texts.js       # 六维文案池、宜忌、箴言、幸运方位与时段
│   └── styles/main.css            # 设计变量、重置、通用组件与动画
└── doc/                           # 参考素材（非交付内容）
```

## 运势是怎么算出来的

```
fortune = f(星座, 自然日)
```

- 以 `"<星座 id>@<YYYY-MM-DD>"` 作为种子，经 `xmur3` 哈希后交给 `mulberry32` 生成确定性的随机序列；
- 引擎内部**不读取当前时间、不使用 `Math.random()`**，因此同一星座 + 同一天在任何设备上都会得到完全相同的结果，反复切换星座再切回来结果也不会变；
- 综合分由五个分项加权后再混合一次自身波动，避免出现「各维度都不错但综合分很低」的割裂感；
- 分值落在三档（`≥85` / `70–84` / `<70`）之一，再按档位从对应文案池取一条解读，所以低分日的文案是「蓄力」而非「灾难」；
- 幸运色、幸运数字、幸运方位、幸运时段、贵人星座、宜忌与箴言同样由种子派生，彼此组合稳定；
- `App.vue` 会根据距离下一个本地零点的毫秒数设置定时器，跨过零点自动重新计算。

### 本地存储

| Key | 用途 |
| --- | --- |
| `constellation-daily:v1:selected-sign` | 记住用户选择的星座，下次打开自动选中 |
| `constellation-daily:v1:fortune:<signId>` | 该星座当日的运势结果，含日期与引擎版本，跨日或版本变更即失效重算 |

零点之后 `pruneFortunes()` 会清理非当日的缓存记录。若浏览器禁用存储（如无痕模式），封装层会自动降级为内存存储，页面功能不受影响。

## 内容维护

- 想调整运势文案：改 `src/data/fortune-texts.js` 中对应维度的 `high / mid / low` 数组即可，条数不限；
- 想增删维度：在 `DIMENSIONS` 中增删条目（`key` 需与 `fortune.js` 中 `subKeys` 对应），能量条与牌阵会自动跟随；
- 想调整星座资料（性格、幸运色、守护星、日期区间）：改 `src/data/signs.js`；
- 改完文案后请把 `src/core/fortune.js` 中的 `ENGINE_VERSION` 加一，让旧的本地缓存自动失效，用户刷新后即可看到新内容。

## 说明

星座运势是一种自我观察的镜面，而非对未来的预测。站内所有数据仅保存在访问者自己的浏览器中，不做任何上报。

## 协议

以 [MIT 协议](LICENSE) 开源，Copyright © 2026 Lollipop8555。
