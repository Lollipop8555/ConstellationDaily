<script setup>
/**
 * 单张运势卡牌，按类型渲染三种版式：
 *  - score  分维度运势（环形分值 + 星级 + 解读）
 *  - guide  今日指引（幸运元素 + 宜忌 + 箴言）
 *  - traits 星座性格（关键词 + 核心/阴影/成长 + 洞察）
 */
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import ScoreRing from './ScoreRing.vue'

const props = defineProps({
  card: { type: Object, required: true },
  sign: { type: Object, required: true },
  /** 兜底：视口矮到任何卡宽都放不下内容时，允许卡牌内容内部滚动 */
  scroll: { type: Boolean, default: false },
  /** 长条卡：正文左右分栏（手机横屏等超扁比例） */
  wide: { type: Boolean, default: false },
  /** 环形图尺寸，由布局引擎按卡的实际形状给出 */
  ringSize: { type: Number, default: 0 },
})

const starList = computed(() =>
  Array.from({ length: 5 }, (_, index) => index < props.card.stars),
)
const ring = computed(() => props.ringSize || 118)

/**
 * 长条卡的自校正缩放。
 * 布局引擎能算准卡的外形，却算不准卡内文案 —— 星座简介、宜忌条目、箴言的长短
 * 都随星座和日期变，而且"再收一档字号"会让段落少折一行、栏宽变化又会换一条折行，
 * 是阶梯式的，没法用一个几何公式一次算对。
 * 所以这里量一次真实内容：还溢出就把字号再收 2%，直到装下（下限 0.6，剩下的交给滚动兜底）。
 */
const FIT_MIN = 0.6
const FIT_STEP = 0.02

const rootEl = ref(null)

function autoFit() {
  const el = rootEl.value
  const body = el && el.querySelector('.fcard__body')
  if (!props.wide || !body) {
    if (el) el.style.removeProperty('--fit')
    return
  }
  // 每次都从 1 起测，避免上一次的收缩把这次的判断带偏
  el.style.setProperty('--fit', '1')
  let scale = 1
  while (scale > FIT_MIN && body.scrollHeight > body.clientHeight + 0.5) {
    scale = Math.max(FIT_MIN, Number((scale - FIT_STEP).toFixed(2)))
    el.style.setProperty('--fit', String(scale))
  }
}

let observer = null
let fitFrame = 0

/**
 * autoFit 内部是一圈"写字号 → 读 scrollHeight"的循环，每一步都会强制同步布局，
 * 一次视口变化里连着跑好几遍很贵。ResizeObserver 又可能在同一帧回调多次，
 * 所以先合并到一帧里，只跑最后一次。
 */
function scheduleFit() {
  if (fitFrame) return
  fitFrame = window.requestAnimationFrame(() => {
    fitFrame = 0
    autoFit()
  })
}

onMounted(() => {
  autoFit()
  // 视口变化会改卡的外形（进而改字号档位）与栏宽，两者都会影响折行，得重新量
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(scheduleFit)
    observer.observe(rootEl.value)
  }
})

onBeforeUnmount(() => {
  if (fitFrame) window.cancelAnimationFrame(fitFrame)
  fitFrame = 0
  if (observer) observer.disconnect()
  observer = null
})

watch(
  () => [props.wide, props.card, props.sign],
  () => nextTick(scheduleFit),
)
</script>

<template>
  <article
    ref="rootEl"
    class="fcard"
    :class="[
      `fcard--${card.level}`,
      `fcard--${card.type}`,
      { 'is-scroll': scroll, 'is-wide': wide },
    ]"
  >
    <span class="fcard__corner" aria-hidden="true">{{ card.glyph }}</span>
    <span class="fcard__hairline" aria-hidden="true"></span>

    <header class="fcard__head">
      <span class="fcard__glyph" aria-hidden="true">{{ card.glyph }}</span>
      <span class="fcard__titles">
        <h3>{{ card.name }}</h3>
        <small>{{ card.en }}</small>
      </span>
      <span v-if="card.levelLabel" class="fcard__badge">{{ card.levelLabel }}</span>
    </header>

    <!-- 维度运势 -->
    <div v-if="card.type === 'score'" class="fcard__body fcard__body--score">
      <ScoreRing
        :value="card.score"
        :tone="card.level"
        :label="card.name"
        :size="ring"
        :stroke="7"
        :caption="`${card.name}指数`"
      />
      <div class="score-detail">
        <div class="score-stars" :aria-label="`${card.stars} 星`">
          <span v-for="(filled, index) in starList" :key="index" :class="{ 'is-on': filled }">★</span>
        </div>
        <p class="fcard__text">{{ card.text }}</p>
        <p v-if="card.note" class="fcard__note">{{ card.note }}</p>
      </div>
    </div>

    <!-- 今日总览：综合分环形图 + 各维度速览条 -->
    <div v-else-if="card.type === 'overall'" class="fcard__body fcard__body--overall">
      <ScoreRing
        :value="card.score"
        :tone="card.level"
        :label="card.name"
        :size="ring"
        :stroke="7"
      />

      <ul class="dim-bars">
        <li
          v-for="item in card.breakdown"
          :key="item.key"
          :class="`dim-bars__row--${item.level}`"
        >
          <span class="dim-bars__name">{{ item.name }}</span>
          <span class="dim-bars__track">
            <i :style="{ width: `${item.score}%` }"></i>
          </span>
          <span class="dim-bars__score">{{ item.score }}</span>
        </li>
      </ul>

      <!-- 长条卡里整块成为独立一栏；常规卡里 display:contents 使其不参与布局 -->
      <div class="overall-note">
        <p class="fcard__text">{{ card.text }}</p>
        <p v-if="card.note" class="fcard__note">{{ card.note }}</p>
      </div>
    </div>

    <!-- 今日指引 -->
    <div v-else-if="card.type === 'guide'" class="fcard__body fcard__body--guide">
      <p class="guide-motto">「{{ card.text }}」</p>

      <div class="lucky-grid">
        <div class="lucky-item">
          <span class="lucky-item__label">幸运色</span>
          <span class="lucky-item__value">
            <i class="lucky-swatch" :style="{ background: card.lucky.color.hex }"></i>
            {{ card.lucky.color.name }}
          </span>
        </div>
        <div class="lucky-item">
          <span class="lucky-item__label">幸运数字</span>
          <span class="lucky-item__value">{{ card.lucky.number }}</span>
        </div>
        <div class="lucky-item">
          <span class="lucky-item__label">幸运方位</span>
          <span class="lucky-item__value">{{ card.lucky.direction }}</span>
        </div>
        <div class="lucky-item">
          <span class="lucky-item__label">幸运日</span>
          <span class="lucky-item__value">{{ card.lucky.day }}</span>
        </div>
        <div class="lucky-item lucky-item--wide">
          <span class="lucky-item__label">幸运时段</span>
          <span class="lucky-item__value">{{ card.lucky.timeSlot }}</span>
        </div>
        <div class="lucky-item lucky-item--wide">
          <span class="lucky-item__label">贵人星座</span>
          <span class="lucky-item__value">
            {{ card.lucky.friend.name }}
            <em>{{ card.lucky.friend.glyph }}</em>
          </span>
        </div>
      </div>

      <div class="do-avoid">
        <div class="do-avoid__col do-avoid__col--good">
          <h4>宜</h4>
          <ul>
            <li v-for="item in card.good" :key="item">{{ item }}</li>
          </ul>
        </div>
        <div class="do-avoid__col do-avoid__col--bad">
          <h4>忌</h4>
          <ul>
            <li v-for="item in card.bad" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 星座档案 -->
    <div v-else-if="card.type === 'sign'" class="fcard__body fcard__body--sign">
      <!-- 长条卡里两块各成一栏；常规卡里 display:contents 使其不参与布局 -->
      <div class="sign-col sign-col--lead">
        <p class="sign-tagline">{{ sign.tagline }}</p>
        <p class="sign-summary">{{ card.text }}</p>
      </div>

      <div class="sign-col sign-col--facts">
        <ul class="sign-facts">
          <li>
            <span>日期</span>
            <strong>{{ sign.range }}</strong>
          </li>
          <li>
            <span>元素</span>
            <strong>{{ sign.element }}象 · {{ sign.quality }}</strong>
          </li>
          <li>
            <span>守护星</span>
            <strong>{{ sign.ruler }}</strong>
          </li>
          <li>
            <span>象征物</span>
            <strong>{{ sign.symbolName }}</strong>
          </li>
          <li>
            <span>原型</span>
            <strong>{{ sign.archetype }}</strong>
          </li>
          <li>
            <span>幸运色</span>
            <strong class="sign-facts__colors">
              <i
                v-for="color in sign.colors"
                :key="color.name"
                :style="{ background: color.hex }"
                :title="color.name"
              ></i>
              {{ sign.colors.map((color) => color.name).join(' / ') }}
            </strong>
          </li>
          <li>
            <span>幸运数字</span>
            <strong>{{ sign.numbers.join(' · ') }}</strong>
          </li>
          <li>
            <span>幸运日</span>
            <strong>{{ sign.days.join(' / ') }}</strong>
          </li>
        </ul>

        <p class="trait-keywords">
          <span v-for="keyword in sign.keywords" :key="keyword">{{ keyword }}</span>
        </p>
      </div>
    </div>

    <!-- 性格特质（单条） -->
    <div v-else class="fcard__body fcard__body--trait">
      <p class="trait-em">{{ card.em }}</p>
      <p class="trait-text">{{ card.text }}</p>
    </div>

    <footer class="fcard__foot">
      <span>{{ sign.glyph }} {{ sign.name }}</span>
      <span>{{ sign.range }}</span>
    </footer>
  </article>
</template>

<style scoped>
.fcard {
  /* 卡内一切尺寸都从 --card-scale 来（1 = 参考卡宽 560px）。
     用"下限 + 随卡宽增长"的插值，而不是媒体查询：
     窗口很宽但很矮时卡可能只有 350px 宽，媒体查询按视口判断会完全失效。 */
  --cs: var(--card-scale, 1);
  --card-pad-y: calc(20px + 4px * var(--cs));
  --card-pad-x: calc(16px + 6px * var(--cs));
  --card-gap: calc(13px + 3px * var(--cs));
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--card-gap);
  /* 卡牌高度由布局引擎算好（同屏所有卡牌尺寸一致），不再随内容伸缩 */
  height: var(--card-h, 100%);
  padding: var(--card-pad-y) var(--card-pad-x) calc(var(--card-pad-y) - 4px);
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
  /* 底色必须不透明：牌堆里上下层会互相重叠，底色一旦带 alpha，下面那张的
     内容就会从上面这张里透出来，叠几层就是一团糊。 */
  background:
    radial-gradient(120% 90% at 12% 0%, rgba(154, 123, 255, 0.16), transparent 58%),
    linear-gradient(160deg, #1c2140 0%, #0e1124 55%, #080a16 100%);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  isolation: isolate;
}

.fcard::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid transparent;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.1), transparent 42%) border-box;
  -webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.fcard--high {
  border-color: rgba(232, 201, 122, 0.3);
}

.fcard--low {
  border-color: rgba(140, 150, 200, 0.2);
}

.fcard__hairline {
  position: absolute;
  top: 0;
  left: 8%;
  width: 84%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(232, 201, 122, 0.6), transparent);
}

.fcard__corner {
  position: absolute;
  right: 16px;
  bottom: 12px;
  font-size: calc(56px + 18px * var(--cs));
  line-height: 1;
  color: rgba(255, 255, 255, 0.035);
  pointer-events: none;
  user-select: none;
}

.fcard__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fcard__glyph {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid var(--line-strong);
  background: rgba(255, 255, 255, 0.04);
  color: var(--gold);
  font-size: 17px;
}

.fcard__titles {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  min-width: 0;
}

.fcard__titles h3 {
  font-size: 16.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.fcard__titles small {
  font-size: 10px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.fcard__badge {
  margin-left: auto;
  padding: 3px 11px;
  border-radius: 99px;
  border: 1px solid rgba(232, 201, 122, 0.32);
  background: rgba(232, 201, 122, 0.1);
  color: var(--gold);
  font-size: 11px;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.fcard--mid .fcard__badge {
  border-color: rgba(111, 215, 232, 0.32);
  background: rgba(111, 215, 232, 0.1);
  color: var(--cyan);
}

.fcard--low .fcard__badge {
  border-color: rgba(150, 160, 210, 0.28);
  background: rgba(150, 160, 210, 0.1);
  color: var(--ink-2);
}

.fcard__badge--soft {
  max-width: 46%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fcard__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 兜底：屏幕矮到任何卡宽都放不下时，只有卡牌正文滚动，页头与页脚保持可见。
   滚动条本身在文件末尾统一处理（触摸端收起、桌面端细条）。 */
.fcard.is-scroll .fcard__body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.fcard__body--score {
  align-items: center;
  justify-content: center;
  gap: 14px;
  text-align: center;
}

.fcard__ring {
  margin-bottom: 2px;
}

.score-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.score-stars {
  display: inline-flex;
  gap: 4px;
  font-size: 14px;
  color: rgba(150, 165, 225, 0.24);
  letter-spacing: 2px;
}

.score-stars .is-on {
  color: var(--gold);
  text-shadow: 0 0 12px rgba(232, 201, 122, 0.6);
}

.fcard__text {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.95;
}

.fcard__note {
  padding-left: 12px;
  border-left: 2px solid rgba(154, 123, 255, 0.5);
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.9;
}

/* ---------------- 今日总览 ---------------- */

.fcard__body--overall {
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.dim-bars {
  display: flex;
  flex-direction: column;
  gap: 11px;
  width: 100%;
}

.dim-bars li {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) 24px;
  align-items: center;
  gap: 9px;
}

.dim-bars__name {
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.dim-bars__track {
  position: relative;
  height: 6px;
  border-radius: 99px;
  background: rgba(150, 165, 225, 0.14);
  overflow: hidden;
}

.dim-bars__track i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(154, 123, 255, 0.5), rgba(154, 123, 255, 0.95));
  transition: width 0.9s var(--ease-out);
}

.dim-bars__row--high .dim-bars__track i {
  background: linear-gradient(90deg, rgba(232, 201, 122, 0.45), var(--gold));
}

.dim-bars__row--mid .dim-bars__track i {
  background: linear-gradient(90deg, rgba(111, 215, 232, 0.4), var(--cyan));
}

.dim-bars__row--low .dim-bars__track i {
  background: linear-gradient(90deg, rgba(141, 147, 184, 0.35), var(--ink-2));
}

.dim-bars__score {
  font-size: 12px;
  text-align: right;
  color: var(--ink-0);
  font-variant-numeric: tabular-nums;
}

/* ---------------- 今日指引 ---------------- */

.fcard__body--guide {
  gap: 18px;
}

.guide-motto {
  font-family: var(--font-serif);
  /* 跟随卡宽，不跟随视口 */
  font-size: clamp(15px, calc(14px + 4px * var(--cs)), 18px);
  line-height: 1.9;
  color: #f6e9c8;
  text-align: center;
  letter-spacing: 0.06em;
}

.lucky-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.lucky-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.028);
}

.lucky-item--wide {
  grid-column: 1 / -1;
}

.lucky-item__value {
  white-space: nowrap;
}

.lucky-item__label {
  font-size: 11.5px;
  letter-spacing: 0.12em;
  color: var(--ink-3);
}

.lucky-item__value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ink-0);
  letter-spacing: 0.06em;
}

.lucky-item__value em {
  font-style: normal;
  color: var(--violet);
}

.lucky-swatch {
  width: 13px;
  height: 13px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 0 12px -2px currentColor;
}

.do-avoid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.do-avoid__col {
  padding: 13px 15px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.022);
}

.do-avoid__col h4 {
  margin-bottom: 8px;
  font-size: 12px;
  letter-spacing: 0.3em;
}

.do-avoid__col--good h4 {
  color: var(--mint);
}

.do-avoid__col--bad h4 {
  color: var(--rose);
}

.do-avoid__col li {
  position: relative;
  padding-left: 11px;
  font-size: 11.5px;
  line-height: 1.9;
  color: var(--ink-1);
}

.do-avoid__col li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.95em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

/* ---------------- 星座档案 ---------------- */

.sign-tagline {
  text-align: center;
  font-family: var(--font-serif);
  font-size: 14px;
  letter-spacing: 0.1em;
  color: #f1e4c4;
}

.sign-summary {
  color: var(--ink-1);
  font-size: 12.5px;
  line-height: 2;
  text-align: justify;
}

.sign-facts {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-top: 1px solid var(--line);
}

.sign-facts li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(150, 165, 225, 0.08);
}

.sign-facts span {
  flex-shrink: 0;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-3);
}

.sign-facts strong {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ink-0);
  font-size: 12.5px;
  font-weight: 500;
  text-align: right;
}

.sign-facts__colors i {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.trait-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.trait-keywords span {
  padding: 3px 11px;
  border-radius: 99px;
  border: 1px solid rgba(154, 123, 255, 0.32);
  background: rgba(154, 123, 255, 0.12);
  color: #dcd4ff;
  font-size: 11.5px;
  letter-spacing: 0.1em;
}

/* ---------------- 性格特质 ---------------- */

.fcard__body--trait {
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
}

.trait-em {
  padding: 3px 14px;
  border-radius: 99px;
  border: 1px solid rgba(232, 201, 122, 0.3);
  background: rgba(232, 201, 122, 0.09);
  color: var(--gold);
  font-size: 11px;
  letter-spacing: 0.24em;
}

.trait-text {
  font-family: var(--font-serif);
  font-size: clamp(14px, calc(13px + 2px * var(--cs)), 15px);
  line-height: 2.1;
  letter-spacing: 0.05em;
  color: #efe3c6;
}

.fcard__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--ink-3);
  font-size: 11px;
  letter-spacing: 0.16em;
}

/* ---------------- 长条卡（手机横屏等超扁比例）：正文左右分栏 ---------------- */

.fcard.is-wide {
  /* 横条更矮，留白收紧，把高度全留给内容 */
  --card-pad-y: 10px;
  --card-pad-x: 18px;
  --card-gap: 9px;
  /* 字号缩放 = 引擎按卡高给的起手值 × 组件量完真实内容后的自校正系数 */
  --ws: calc(var(--wide-scale, 1) * var(--fit, 1));
}

/* 分栏容器：常规卡里"透明"（子项照旧直接参与正文的竖排），
   长条卡里各自成为独立一栏 —— grid 的行是两栏共享的，
   只有把一栏包成单个网格项，栏与栏的高度才真正互不干扰。 */
.sign-col,
.overall-note {
  display: contents;
}

.fcard.is-wide .sign-col,
.fcard.is-wide .overall-note {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 8px;
}

.fcard.is-wide .fcard__head {
  gap: 10px;
}

.fcard.is-wide .fcard__glyph {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  font-size: 14px;
}

.fcard.is-wide .fcard__titles h3 {
  font-size: calc(15px * var(--ws));
}

/* 长条卡里所有正文都按 --ws 收一档：卡越矮，字越紧 */
.fcard.is-wide .fcard__text {
  font-size: calc(14px * var(--ws));
  line-height: 1.75;
}

.fcard.is-wide .fcard__note {
  font-size: calc(12.5px * var(--ws));
  line-height: 1.7;
}

.fcard.is-wide .dim-bars__name {
  font-size: calc(11.5px * var(--ws));
}

.fcard.is-wide .dim-bars__score {
  font-size: calc(12px * var(--ws));
}

.fcard.is-wide .score-stars {
  font-size: calc(14px * var(--ws));
}

.fcard.is-wide .fcard__corner {
  bottom: 6px;
  font-size: 62px;
}

.fcard.is-wide .fcard__foot {
  padding-top: 8px;
}

/* 所有版式的正文统一改成两栏网格：左栏放"图"，右栏放"文"。
   safe center：装得下就垂直居中，装不下时退化为顶端对齐，
   而不是把内容顶出卡片上沿（那样顶部会没救）。 */
.fcard.is-wide .fcard__body {
  display: grid;
  /* 老 WebView（微信 X5）不认 safe 关键字，整条声明会被丢掉、退回默认的 stretch，
     所以先给一条普通 center 兜底 */
  align-content: center;
  align-content: safe center;
  overflow-y: auto;
  gap: 6px 20px;
}

/* 维度运势：左环右文 */
.fcard.is-wide .fcard__body--score {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  text-align: left;
}

.fcard.is-wide .score-detail {
  align-items: flex-start;
  gap: 8px;
}

/* 今日总览：横条下拆成"环 | 速览条 | 解读"三段并列，解读不再叠在速览条下面 */
.fcard.is-wide .fcard__body--overall {
  grid-template-columns: auto minmax(0, 0.86fr) minmax(0, 1.14fr);
  align-items: center;
  gap: 0 18px;
}

.fcard.is-wide .fcard__body--overall > .ring {
  grid-column: 1;
}

.fcard.is-wide .fcard__body--overall > .dim-bars {
  grid-column: 2;
  gap: 7px;
}

.fcard.is-wide .fcard__body--overall > .overall-note {
  grid-column: 3;
}

/* 今日指引：左栏箴言 + 幸运元素，右栏宜忌 */
.fcard.is-wide .fcard__body--guide {
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
  gap: 8px 18px;
}

.fcard.is-wide .fcard__body--guide > .guide-motto {
  grid-column: 1;
  grid-row: 1;
  text-align: left;
  font-size: calc(17px * var(--ws));
  line-height: 1.7;
}

.fcard.is-wide .fcard__body--guide > .lucky-grid {
  grid-column: 1;
  grid-row: 2;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* 横条下"标签 / 值"改成同一行：比上下叠放矮一半，也省掉值的折行 */
.fcard.is-wide .lucky-item {
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 10px;
}

/* 标签绝不能被值挤扁：标签一旦被迫收窄就会逐字折行，
   一个"幸运时段"能把整行撑到 98px（实测），比什么都伤高度 */
.fcard.is-wide .lucky-item__label {
  flex-shrink: 0;
  font-size: calc(11.5px * var(--ws));
}

.fcard.is-wide .lucky-item__value {
  font-size: calc(13px * var(--ws));
}

/* 值偏长的两条（幸运时段 / 贵人星座）在窄栏里一行放不下，
   让它们独占整行，否则又会被挤成两行 */
.fcard.is-wide .lucky-item--wide {
  grid-column: 1 / -1;
}

.fcard.is-wide .fcard__body--guide > .do-avoid {
  grid-column: 2;
  grid-row: 1 / 3;
  align-content: start;
}

.fcard.is-wide .do-avoid__col {
  padding: 9px 12px;
}

.fcard.is-wide .do-avoid__col h4 {
  margin-bottom: 5px;
  font-size: calc(12px * var(--ws));
}

.fcard.is-wide .do-avoid__col li {
  font-size: calc(11.5px * var(--ws));
  line-height: 1.75;
}

/* 星座档案：左栏标语 + 简介，右栏档案表（表内再分两列）。
   右栏要宽一点：档案项是"标签 + 值"的横排，太窄会让值换行把表撑高。 */
.fcard.is-wide .fcard__body--sign {
  grid-template-columns: minmax(0, 0.5fr) minmax(0, 1fr);
  align-items: center;
  gap: 0 20px;
}

/* 简介是散文，栏窄一点只是多折两行；档案表是"标签 + 值"的横排，
   栏一窄就会换行，整张表变高——所以宽度优先给右栏。 */
.fcard.is-wide .sign-summary {
  font-size: calc(12px * var(--ws));
  line-height: 1.7;
}

.fcard.is-wide .sign-tagline {
  font-size: calc(14px * var(--ws));
}

.fcard.is-wide .fcard__body--sign > .sign-col--lead {
  grid-column: 1;
}

.fcard.is-wide .fcard__body--sign > .sign-col--facts {
  grid-column: 2;
}

.fcard.is-wide .sign-tagline,
.fcard.is-wide .sign-summary {
  text-align: left;
}

.fcard.is-wide .sign-facts span {
  font-size: calc(11px * var(--ws));
}

.fcard.is-wide .sign-facts strong {
  font-size: calc(12.5px * var(--ws));
}

.fcard.is-wide .trait-keywords span {
  font-size: calc(11.5px * var(--ws));
}

.fcard.is-wide .sign-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(4, auto);
  grid-auto-flow: column;
  align-content: start;
  gap: 0 16px;
  border-top: 0;
}

.fcard.is-wide .sign-facts li {
  padding: 3px 0;
}

.fcard.is-wide .trait-keywords {
  margin-top: 0;
}

/* 性格特质：左标签右正文 */
.fcard.is-wide .fcard__body--trait {
  grid-template-columns: minmax(0, 0.42fr) minmax(0, 1.58fr);
  align-items: center;
  gap: 10px 20px;
  text-align: left;
}

.fcard.is-wide .fcard__body--trait > .trait-em {
  grid-column: 1;
  justify-self: start;
}

.fcard.is-wide .fcard__body--trait > .trait-text {
  grid-column: 2;
}

/* ---------------- 卡内滚动条 ---------------- */

/* 移动端 WebView（微信 X5 等）会给每个 overflow 容器画出常驻滚动条：
   牌组里五张卡叠在一起，就是右侧那"好几条拖拽进度条"。这里统一收起，
   只在桌面端（精确指针）给一条细的。 */
.fcard.is-scroll .fcard__body,
.fcard.is-wide .fcard__body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.fcard.is-scroll .fcard__body::-webkit-scrollbar,
.fcard.is-wide .fcard__body::-webkit-scrollbar {
  width: 0;
  height: 0;
}

/* 收起滚动条之后，用贴着正文框底边的渐隐当作"下面还有"的提示 */
.fcard.is-scroll .fcard__body {
  -webkit-mask-image: linear-gradient(180deg, #000 0, #000 calc(100% - 26px), transparent 100%);
  mask-image: linear-gradient(180deg, #000 0, #000 calc(100% - 26px), transparent 100%);
}

@media (pointer: fine) {
  .fcard.is-scroll .fcard__body,
  .fcard.is-wide .fcard__body {
    scrollbar-width: thin;
    scrollbar-color: rgba(150, 165, 225, 0.35) transparent;
    -webkit-mask-image: none;
    mask-image: none;
  }

  .fcard.is-scroll .fcard__body::-webkit-scrollbar,
  .fcard.is-wide .fcard__body::-webkit-scrollbar {
    width: 5px;
  }

  .fcard.is-scroll .fcard__body::-webkit-scrollbar-thumb,
  .fcard.is-wide .fcard__body::-webkit-scrollbar-thumb {
    border-radius: 99px;
    background: rgba(150, 165, 225, 0.35);
  }
}
</style>
