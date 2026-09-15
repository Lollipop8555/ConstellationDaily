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
const dragDelta = ref(0)
const dotsEl = ref(null)

let startX = null

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
  const front = depth === 0
  const fan = front && dragging.value ? dragDelta.value * 0.3 : 0
  const tilt = front && dragging.value ? dragDelta.value * 0.012 : 0
  return {
    // x/y 允许写成 px 或 var()，用 calc 拼接即可同时兼容拖动时的像素偏移
    transform: `translate3d(calc(${layer.x} + ${fan}px), calc(${layer.y}), 0) scale(${layer.s}) rotate(${layer.r + tilt}deg)`,
    opacity: layer.o,
    filter: layer.o < 0.7 ? 'blur(1px)' : 'none',
    zIndex: layer.z,
    pointerEvents: front ? 'auto' : 'none',
  }
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
  if (event.button !== undefined && event.button !== 0) return
  startX = event.clientX
  dragging.value = true
  dragDelta.value = 0
  const target = event.currentTarget
  if (target && target.setPointerCapture) {
    try {
      target.setPointerCapture(event.pointerId)
    } catch (error) {
      /* 少数浏览器不支持指针捕获，忽略即可 */
    }
  }
}

function onPointerMove(event) {
  if (!dragging.value || startX === null) return
  dragDelta.value = event.clientX - startX
}

function onPointerUp() {
  if (!dragging.value) return
  const delta = dragDelta.value
  const wasTap = Math.abs(delta) < 8
  dragging.value = false
  startX = null
  dragDelta.value = 0

  if (delta <= -48 || wasTap) next()
  else if (delta >= 48) prev()
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
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="deck">
    <div
      class="deck__stage"
      :class="mode === 'fan' ? 'deck__stage--fan' : 'deck__stage--stack'"
      role="group"
      aria-label="运势卡牌"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        v-for="item in stacked"
        :key="item.card.id"
        class="deck__layer"
        :class="{ 'is-front': item.depth === 0, 'is-dragging': dragging && item.depth === 0 }"
        :style="layerStyle(item.depth)"
        :aria-hidden="item.depth !== 0"
      >
        <FortuneCard
          :card="item.card"
          :sign="sign"
          :scroll="scroll"
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
  will-change: transform, opacity;
  transition: transform 0.72s var(--ease-spring), opacity 0.5s var(--ease-out),
    filter 0.5s var(--ease-out);
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
  scrollbar-width: none;
  padding: 4px 2px;
}

.deck__dots::-webkit-scrollbar {
  display: none;
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
