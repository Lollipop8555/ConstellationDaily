<script setup>
/**
 * 塔罗式堆叠牌组
 * - 卡牌宽度固定为窄卡，同一牌堆内所有卡牌尺寸完全一致
 * - 排列方式随屏幕宽度切换：
 *     · 窄屏（< 1040px）：向下方错落堆叠
 *     · 宽屏（>= 1040px）：向左右两侧扇形展开
 * - 切换方式：点击卡牌 / 左右滑动 / 左右方向键 / 指示点
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FortuneCard from './FortuneCard.vue'

const props = defineProps({
  cards: { type: Array, required: true },
  sign: { type: Object, required: true },
})

/** 两种排列方式下的逐层位移（depth 从 0 起，0 为最前面的当前卡） */
const PRESETS = {
  // 窄屏堆叠：左右（正负交替）错开，与左右滑动的切换方向一致；
  // 不缩放，位移即露出的宽度，x 控制在 13px 内——加上 transform-origin: center
  // 旋转带来的约 3px 外扩，仍留在视口两侧的留白里，不会出现横向滚动。
  stack: [
    { x: 0, y: 0, r: 0, s: 1, o: 1, z: 50 },
    { x: 6, y: 0, r: 0.5, s: 1, o: 0.85, z: 40 },
    { x: -8, y: 0, r: -0.5, s: 1, o: 0.62, z: 30 },
    { x: 11, y: 0, r: 0.5, s: 1, o: 0.4, z: 20 },
    { x: -13, y: 0, r: -0.5, s: 1, o: 0.22, z: 10 },
  ],
  fan: [
    { x: 0, y: 0, r: 0, s: 1, o: 1, z: 50 },
    { x: 92, y: 12, r: 4.2, s: 0.955, o: 0.68, z: 40 },
    { x: -92, y: 12, r: -4.2, s: 0.955, o: 0.68, z: 39 },
    { x: 168, y: 26, r: 8, s: 0.91, o: 0.38, z: 30 },
    { x: -168, y: 26, r: -8, s: 0.91, o: 0.38, z: 29 },
    { x: 230, y: 40, r: 11.6, s: 0.87, o: 0, z: 20 },
  ],
}

const wide = ref(false)
const active = ref(0)
const dragging = ref(false)
const dragDelta = ref(0)
const dotsEl = ref(null)

let mql = null
let startX = null

const total = computed(() => props.cards.length)
const preset = computed(() => (wide.value ? PRESETS.fan : PRESETS.stack))

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
    transform: `translate3d(${layer.x + fan}px, ${layer.y}px, 0) scale(${layer.s}) rotate(${layer.r + tilt}deg)`,
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

function syncWide(event) {
  wide.value = event.matches
}

watch(active, async () => {
  await nextTick()
  const dot = dotsEl.value && dotsEl.value.querySelector('.deck__dot.is-active')
  if (dot && dot.scrollIntoView) dot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
})

onMounted(() => {
  mql = window.matchMedia('(min-width: 1040px)')
  wide.value = mql.matches
  if (mql.addEventListener) mql.addEventListener('change', syncWide)
  else if (mql.addListener) mql.addListener(syncWide)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (mql) {
    if (mql.removeEventListener) mql.removeEventListener('change', syncWide)
    else if (mql.removeListener) mql.removeListener(syncWide)
  }
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="deck">
    <div
      class="deck__stage"
      :class="wide ? 'deck__stage--fan' : 'deck__stage--stack'"
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
        <FortuneCard :card="item.card" :sign="sign" />
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

    <p class="deck__hint">第 {{ active + 1 }} / {{ total }} 张 · 点击卡牌或左右滑动切换</p>
  </div>
</template>

<style scoped>
.deck {
  /* 卡牌与舞台的宽度上限；小屏时由容器宽度决定，避免出现横向溢出 */
  --card-w: 352px;
  --stage-w: 352px;
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  /* 后层改为左右错开、不再向下探出，底部只留一点呼吸空间 */
  padding-bottom: 10px;
}

/* 以中心为旋转原点：若沿用 top center，0.5° 的小旋转会让底角横向外扩近 6px，
   白白吃掉两侧留给后层卡边的余量。 */
.deck__stage--stack .deck__layer {
  transform-origin: center;
}

/* 宽屏改为横向扇形展开：舞台变宽，卡牌宽度保持不变 */
.deck__stage--fan {
  --stage-w: 920px;
  grid-template-columns: minmax(0, 1fr);
  padding-bottom: 72px;
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
  gap: clamp(8px, 2vw, 16px);
  width: 100%;
  max-width: 560px;
}

.deck__nav {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
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
}

@media (max-width: 560px) {
  .deck {
    gap: 13px;
  }
  .deck__nav {
    width: 34px;
    height: 34px;
    font-size: 17px;
  }
  .deck__layer {
    transition-duration: 0.55s, 0.4s, 0.4s;
  }
  .deck__hint {
    font-size: 11px;
  }
}
</style>
