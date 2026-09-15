<script setup>
/**
 * 塔罗式牌组
 * - 卡牌尺寸完全一致，全部由布局引擎按视口算出（宽、高、舞台宽来自 CSS 变量）
 * - 排列方式随可用空间切换：
 *     · 横向有富余（展开模式）：向左右两侧扇形展开
 *     · 否则（收起模式）：在同一位置左右轻微错开地堆叠
 * - 切换方式：点击卡牌 / 左右滑动 / 左右方向键 / 指示点
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FortuneCard from './FortuneCard.vue'
import { useLayoutContext } from '../core/layoutContext.js'

const props = defineProps({
  cards: { type: Array, required: true },
  sign: { type: Object, required: true },
})

const layout = useLayoutContext()
/** 空间够就展开成扇形，不够就收起堆叠——由布局引擎判定 */
const mode = computed(() => (layout && layout.value ? layout.value.deck.mode : 'stack'))
const scroll = computed(() => (layout && layout.value ? layout.value.deck.scroll : false))
const showHint = computed(() => (layout && layout.value ? layout.value.hint : false))
/** 超扁比例下引擎会给出长条卡：正文左右分栏，避免退化成卡内滚动 */
const wide = computed(() => (layout && layout.value ? !!layout.value.deck.wide : false))
const ringSize = computed(() => (layout && layout.value ? layout.value.deck.ring : 0))

/** 两种排列方式下的逐层位移（depth 从 0 起，0 为最前面的当前卡） */
const PRESETS = {
  // 窄屏堆叠：左右（正负交替）错开，与左右滑动的切换方向一致；
  // 不缩放，位移即露出的宽度，x 控制在 13px 内——加上 transform-origin: center
  // 旋转带来的约 3px 外扩，仍留在视口两侧的留白里，不会出现横向滚动。
  stack: [
    { x: '0px', y: '0px', r: 0, s: 1, o: 1, z: 50 },
    { x: '6px', y: '0px', r: 0.5, s: 1, o: 0.85, z: 40 },
    { x: '-8px', y: '0px', r: -0.5, s: 1, o: 0.62, z: 30 },
    { x: '11px', y: '0px', r: 0.5, s: 1, o: 0.4, z: 20 },
    { x: '-13px', y: '0px', r: -0.5, s: 1, o: 0.22, z: 10 },
  ],
  // 宽屏扇形：位移全部按卡宽派生成 CSS 变量（见 .deck__stage--fan），
  // 这样大屏把卡放宽后，扇面同步撑开，不会溢出容器或与卡牌打架。
  fan: [
    { x: '0px', y: '0px', r: 0, s: 1, o: 1, z: 50 },
    { x: 'var(--fan-x1)', y: 'var(--fan-y1)', r: 4.2, s: 0.955, o: 0.68, z: 40 },
    { x: 'calc(var(--fan-x1) * -1)', y: 'var(--fan-y1)', r: -4.2, s: 0.955, o: 0.68, z: 39 },
    { x: 'var(--fan-x2)', y: 'var(--fan-y2)', r: 8, s: 0.91, o: 0.38, z: 30 },
    { x: 'calc(var(--fan-x2) * -1)', y: 'var(--fan-y2)', r: -8, s: 0.91, o: 0.38, z: 29 },
    // 末层只是"没有更多卡了"的占位：与前一层同几何且完全透明。
    // 若继续按更远的位移铺开，宽卡时会把扇面撑出容器，产生横向滚动。
    { x: 'var(--fan-x2)', y: 'var(--fan-y2)', r: 8, s: 0.91, o: 0, z: 20 },
  ],
}

const active = ref(0)
const dragging = ref(false)
const dotsEl = ref(null)
const stageEl = ref(null)

/** 拖动时的跟手比例：卡走多远 / 手指走多远 */
const FOLLOW = 0.5
/** 每像素位移转成的倾角，以及倾角上限 */
const TILT = 0.018
const TILT_MAX = 6
/** 位移超过它就不再算"点了一下" */
const TAP_SLOP = 8
/** 触发翻牌的手势位移阈值 */
const SWIPE = 48
/** 判定手势方向前先吃掉的手抖 */
const AXIS_SLOP = 6

/** 与 layerStyle 用同一个写法，位移才能逐项插值而不是退化成矩阵插值 */
function transformOf(x, y, scale, rotate) {
  return `translate3d(${x}, ${y}, 0) scale(${scale}) rotate(${rotate}deg)`
}

const IDENTITY_TRANSFORM = transformOf('0px', '0px', 1, 0)

let pointerId = null
let frontEl = null
let startX = 0
let startY = 0
/** null = 还没定方向；'x' = 牌组接管；'y' = 让给正文纵向滚动 */
let axis = null
let dx = 0
let dy = 0
let rafId = 0

const total = computed(() => props.cards.length)
const preset = computed(() => (mode.value === 'fan' ? PRESETS.fan : PRESETS.stack))

const stacked = computed(() =>
  props.cards.map((card, index) => {
    const raw = (index - active.value + total.value) % total.value
    return { card, index, depth: Math.min(raw, preset.value.length - 1) }
  }),
)

function layerStyle(depth) {
  const layer = preset.value[depth] || preset.value[preset.value.length - 1]
  return {
    // x/y 允许写成 px 或 var()：扇形展开的偏移量就挂在舞台上的 CSS 变量里
    transform: transformOf(layer.x, layer.y, layer.s, layer.r),
    opacity: layer.o,
    zIndex: layer.z,
    pointerEvents: depth === 0 ? 'auto' : 'none',
  }
}

/**
 * 拖动全程绕开响应式：如果把"手指位移"放进 ref，每一次 pointermove 都会让
 * 六张卡一起重算样式并重排一遍 —— 手指随便动一下就是一次全量渲染，屏幕上就成了"抖"。
 * 这里只在 rAF 里直接写前卡的 transform，Vue 只负责 `dragging` 这一个布尔（进出各一次）。
 */
function paintDrag() {
  rafId = 0
  if (!frontEl) return
  const shift = dx * FOLLOW
  const tilt = Math.max(-TILT_MAX, Math.min(TILT_MAX, dx * TILT))
  frontEl.style.transform = transformOf(`${shift.toFixed(2)}px`, '0px', 1, tilt.toFixed(3))
}

function scheduleDrag() {
  if (!rafId) rafId = window.requestAnimationFrame(paintDrag)
}

/**
 * 结束一次手势。
 * @param {boolean} springBack 是否让前卡弹回原位（横向手势需要，点按不需要）
 */
function endDrag(springBack) {
  if (rafId) {
    window.cancelAnimationFrame(rafId)
    rafId = 0
  }
  const el = frontEl
  frontEl = null
  pointerId = null
  axis = null
  dx = 0
  dy = 0
  dragging.value = false
  if (!el) return
  // 先把行内 transition 撤掉，恢复 .deck__layer 上那条过渡，
  // 再把 transform 写回原位 —— 浏览器就会自己把它弹回去，而不是硬切。
  el.style.removeProperty('transition')
  if (springBack) el.style.transform = IDENTITY_TRANSFORM
  else el.style.removeProperty('transform')
}

function next() {
  active.value = (active.value + 1) % total.value
}

function prev() {
  active.value = (active.value - 1 + total.value) % total.value
}

function goTo(index) {
  active.value = index
}

function onPointerDown(event) {
  if (pointerId !== null) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const stage = stageEl.value
  if (!stage) return
  frontEl = stage.querySelector('.deck__layer.is-front')
  if (!frontEl) return

  pointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  axis = null
  dx = 0
  dy = 0
  // 过渡在拖动期间必须消失，否则卡会追着手指延迟半秒才到位
  frontEl.style.transition = 'none'
  dragging.value = true

  // 触摸指针在规范里本来就是隐式捕获给目标元素的，不需要也不该显式捕获
  // （显式捕获会把事件从卡内滚动容器那里抢走）。只有鼠标才需要，为的是
  // 拖到元素外面也还能跟手。
  if (event.pointerType === 'mouse' && stage.setPointerCapture) {
    try {
      stage.setPointerCapture(event.pointerId)
    } catch (error) {
      /* 少数环境不支持指针捕获，忽略即可 */
    }
  }
}

function onPointerMove(event) {
  if (pointerId === null || event.pointerId !== pointerId) return
  dx = event.clientX - startX
  dy = event.clientY - startY

  if (axis === null) {
    if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return
    // 方向定下来就不再改：横向归牌组，纵向还给正文滚动。
    // 不定向的话浏览器会一直准备纵向滚动，半途抛一个 pointercancel 把手势腰斩 ——
    // 这正是"按着滑却感觉时断时续"的来源。
    axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (axis === 'y') {
      endDrag(false)
      return
    }
  }
  if (axis !== 'x') return
  scheduleDrag()
}

function onPointerUp(event) {
  if (pointerId === null || (event && event.pointerId !== pointerId)) return
  const horizontal = axis === 'x'
  const delta = dx
  // 点按要求两个方向都没怎么动过：正文纵向滚动结束时 dx 也接近 0，
  // 只看 dx 会把"滚了一下正文"当成"点了一下卡"，卡就自己翻页了。
  const wasTap = !horizontal && Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP

  endDrag(horizontal)

  if (horizontal && delta <= -SWIPE) next()
  else if (horizontal && delta >= SWIPE) prev()
  else if (wasTap) next()
}

/**
 * 手势被浏览器取消（来电、系统手势、被父级滚动接管）时只复位，绝不翻牌。
 */
function onPointerCancel(event) {
  if (pointerId === null || (event && event.pointerId !== pointerId)) return
  endDrag(false)
}

/**
 * 横向手势一旦确认，就由牌组独占这次触摸：
 * 浏览器即使因为 touch-action: pan-y 打算纵向滚动，也会被这里拦下，
 * 于是不会发出 pointercancel，整段手势是连续的。
 */
function onTouchMove(event) {
  if (pointerId === null || axis !== 'x') return
  if (event.cancelable) event.preventDefault()
}

function onKeydown(event) {
  if (event.key === 'ArrowRight') next()
  if (event.key === 'ArrowLeft') prev()
}

watch(active, async () => {
  await nextTick()
  const dot = dotsEl.value && dotsEl.value.querySelector('.deck__dot.is-active')
  if (dot && dot.scrollIntoView) dot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // 必须显式声明非 passive，否则 preventDefault 无效，横向手势照样会被浏览器抢走
  if (stageEl.value) stageEl.value.addEventListener('touchmove', onTouchMove, { passive: false })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (stageEl.value) stageEl.value.removeEventListener('touchmove', onTouchMove)
})
</script>

<template>
  <div class="deck">
    <div
      ref="stageEl"
      class="deck__stage"
      :class="mode === 'fan' ? 'deck__stage--fan' : 'deck__stage--stack'"
      role="group"
      aria-label="运势卡牌"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <div
        v-for="item in stacked"
        :key="item.card.id"
        class="deck__layer"
        :class="{ 'is-front': item.depth === 0, 'is-dragging': dragging && item.depth === 0 }"
        :style="layerStyle(item.depth)"
        :aria-hidden="item.depth !== 0"
      >
        <!-- 只有最前面那张允许卡内滚动：后面几张被盖住、又不接受指针事件，
             给它们开滚动容器等于在右侧叠出好几条滚动条（微信 X5 会常驻显示）。 -->
        <FortuneCard
          :card="item.card"
          :sign="sign"
          :scroll="scroll && item.depth === 0"
          :wide="wide"
          :ring-size="ringSize"
        />
      </div>
    </div>

    <div class="deck__controls">
      <button class="deck__nav" type="button" aria-label="上一张" @click="prev">‹</button>

      <div ref="dotsEl" class="deck__dots">
        <button
          v-for="(item, index) in cards"
          :key="item.id"
          type="button"
          class="deck__dot"
          :class="{ 'is-active': index === active }"
          :aria-label="item.name"
          :aria-current="index === active"
          @click="goTo(index)"
        >
          {{ item.name }}
        </button>
      </div>

      <button class="deck__nav" type="button" aria-label="下一张" @click="next">›</button>
    </div>

    <p v-if="showHint" class="deck__hint">第 {{ active + 1 }} / {{ total }} 张 · 点击卡牌或左右滑动切换</p>
  </div>
</template>

<style scoped>
.deck {
  /* 卡宽、舞台宽、间距都来自布局引擎（挂在根节点上的 CSS 变量） */
  display: flex;
  flex-direction: column;
  gap: var(--deck-gap, 14px);
  align-items: center;
  width: 100%;
}

.deck__stage {
  display: grid;
  width: 100%;
  max-width: var(--stage-w);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}

.deck__stage--stack {
  grid-template-columns: minmax(0, 1fr);
  /* 后层只在横向错开，底部留 2px 给 0.5° 旋转带来的微小外扩 */
  padding-bottom: 2px;
}

/* 以中心为旋转原点：若沿用 top center，0.5° 的小旋转会让底角横向外扩近 6px，
   白白吃掉两侧留给后层卡边的余量。 */
.deck__stage--stack .deck__layer {
  transform-origin: center;
}

/* 横向有富余时扇形展开：逐层位移按卡宽成比例，底部补上后层下探的量 */
.deck__stage--fan {
  --fan-x1: calc(var(--card-w) * 0.26);
  --fan-x2: calc(var(--card-w) * 0.478);
  --fan-y1: calc(var(--card-w) * 0.034);
  --fan-y2: calc(var(--card-w) * 0.074);
  grid-template-columns: minmax(0, 1fr);
  /* 最外两层会低于前卡底边，这段高度由布局引擎算好后传进来 */
  padding-bottom: var(--fan-drop, 0px);
}

.deck__layer {
  grid-area: 1 / 1;
  justify-self: center;
  align-self: stretch;
  width: 100%;
  max-width: var(--card-w);
  transform-origin: top center;
  /* 只让 transform 与 opacity 参与过渡：卡上的 box-shadow 半径近百像素，
     一旦把 filter 也放进过渡区间，整张卡每帧都要重新光栅化，必掉帧。 */
  transition: transform 0.5s var(--ease-spring), opacity 0.36s var(--ease-out);
}

/* 只提升"正在动的那一张"为合成层：卡上的大范围阴影不提升就会每帧重绘。
   六层全提等于几十 MB 显存，手机上得不偿失。 */
.deck__layer.is-front,
.deck__layer.is-dragging {
  will-change: transform;
}

.deck__layer.is-front {
  cursor: grab;
}

.deck__layer.is-dragging {
  transition: none;
  cursor: grabbing;
}

.deck__layer :deep(.fcard) {
  transition: border-color 0.5s var(--ease-out), box-shadow 0.5s var(--ease-out);
}

.deck__layer.is-front:hover :deep(.fcard) {
  border-color: rgba(232, 201, 122, 0.34);
  box-shadow: 0 42px 92px -36px rgba(0, 0, 0, 0.98), 0 0 60px -22px rgba(154, 123, 255, 0.55);
}

.deck__controls {
  display: flex;
  align-items: center;
  gap: clamp(8px, calc(6px + 10px * var(--card-scale, 1)), 16px);
  width: 100%;
  /* 与卡牌同宽：宽而矮的窗口里卡会收窄，控件不能还停在 560px 上 */
  max-width: var(--card-w, 560px);
  min-height: var(--controls-h, 38px);
}

.deck__nav {
  display: grid;
  place-items: center;
  width: var(--controls-h, 38px);
  height: var(--controls-h, 38px);
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  background: rgba(16, 20, 40, 0.7);
  color: var(--ink-1);
  font-size: 19px;
  line-height: 1;
  padding-bottom: 3px;
  transition: transform 0.35s var(--ease-spring), border-color 0.35s var(--ease-out),
    color 0.35s var(--ease-out), background 0.35s var(--ease-out);
}

.deck__nav:hover {
  transform: translateY(-2px);
  color: var(--gold);
  border-color: rgba(232, 201, 122, 0.5);
  background: rgba(232, 201, 122, 0.1);
}

.deck__dots {
  display: flex;
  flex: 1;
  gap: 5px;
  overflow-x: auto;
  overflow-y: hidden;
  /* 指示点条在窄屏上会横向溢出，但它不该出现滚动条：
     scrollbar-width / -ms-overflow-style 覆盖标准与老 IE 内核，
     ::-webkit-scrollbar 覆盖 WebKit/X5 —— 三个一起写才不会有平台漏网。 */
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
  padding: 4px 2px;
}

.deck__dots::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.deck__dot {
  flex-shrink: 0;
  padding: 5px 11px;
  border-radius: 99px;
  border: 1px solid transparent;
  color: var(--ink-3);
  font-size: 11.5px;
  letter-spacing: 0.06em;
  white-space: nowrap;
  transition: color 0.35s var(--ease-out), background 0.35s var(--ease-out),
    border-color 0.35s var(--ease-out), transform 0.35s var(--ease-spring);
}

.deck__dot:hover {
  color: var(--ink-1);
  background: rgba(255, 255, 255, 0.05);
}

.deck__dot.is-active {
  color: #0d0f1e;
  border-color: rgba(232, 201, 122, 0.5);
  background: linear-gradient(120deg, #f3dda0, var(--gold));
  box-shadow: 0 8px 26px -12px rgba(232, 201, 122, 0.8);
}

.deck__hint {
  color: var(--ink-3);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  height: var(--hint-h, auto);
}
</style>
