<script setup>
/**
 * 塔罗式牌组
 * - 卡牌尺寸完全一致，全部由布局引擎按视口算出（宽、高、舞台宽来自 CSS 变量）
 * - 排列方式随可用空间切换：
 *     · 横向有富余（展开模式）：以当前卡为中心左右交替铺成扇形。每张卡的左右站位
 *       跟着卡自己走 —— 翻一张，它只是往中间靠一格，绝不会被换到对面去；
 *       层号每翻一张整体错开一格，扇面于是自己照镜子似的左右交替
 *     · 否则（收起模式）：在同一位置朝同一侧轻微错开地堆叠（窄屏塞不下对称扇面）
 * - 所有卡牌常驻 DOM（v-for 覆盖全部卡），切换只改各层的位置与层级，
 *   不重新挂载任何一张卡，也不做透明度淡出：后层是不透明的实体卡，层次由
 *   "被前卡压住多少"给出；看不见的深层用 display: none 挡在绘制之外，
 *   见 stacked / layerStyle
 * - 切换方式：点击卡牌 / 左右滑动 / 左右方向键 / 指示点
 *   手势只有"翻到下一张"这一个动作，左右滑动都是。
 *   牌堆几何决定了压在前卡底下的永远是下一张（depth 1 就是 active + 1），
 *   所以往哪个方向拖，露出来的都是它 —— 那就两个方向都翻它，
 *   露出的卡和松手后切到的卡才永远一致。
 *   回上一张只由底部 ‹ 和指示点负责（方向键 ← 同理），不占用手势。
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
  // 窄屏堆叠：只做横向错开，且逐层朝同一侧递进 —— 一摞牌里，压在上面那张
  // 总是把它下面那张推向同一侧，正负交替会读成"散落"而不是"一叠"。
  // 不缩放，位移即露出的宽度，x 控制在 13px 内——加上 transform-origin: center
  // 旋转带来的约 3px 外扩，仍留在视口两侧的留白里，不会出现横向滚动。
  // 层层都不设 opacity：后层是不透明的实体卡，层次由"被前卡压住多少"给出。
  // 半透明会让下层的内容透上来，一层叠一层就是穿帮。
  stack: [
    { x: '0px', y: '0px', r: 0, s: 1, z: 50 },
    { x: '4px', y: '0px', r: 0.2, s: 1, z: 40 },
    { x: '7px', y: '0px', r: 0.3, s: 1, z: 30 },
    { x: '10px', y: '0px', r: 0.4, s: 1, z: 20 },
    { x: '13px', y: '0px', r: 0.5, s: 1, z: 10 },
  ],
  // 宽屏扇形：位移全部按卡宽派生成 CSS 变量（见 .deck__stage--fan），
  // 这样大屏把卡放宽后，扇面同步撑开，不会溢出容器或与卡牌打架。
  // 这张表只写"站在右侧"时的几何，站左侧的卡由 layerStyle 把 x 和倾角一起取负，
  // 所以相邻两层是对称的 ±x1 / ±x2，扇面自己是左右对称的 ——
  // 而谁站左谁站右由卡片自己的奇偶决定（见 stacked 里的 side），不随层号跑。
  // 于是层号每变一格，两个几何相同的层正好落在同一侧：末层永远被它上面那层
  // 整张盖住，只负责给刚滑出可见区的卡一个落脚处，不必在过渡途中卸载。
  fan: [
    { x: '0px', y: '0px', r: 0, s: 1, z: 50 },
    { x: 'var(--fan-x1)', y: 'var(--fan-y1)', r: 4.2, s: 0.955, z: 40 },
    { x: 'var(--fan-x1)', y: 'var(--fan-y1)', r: 4.2, s: 0.955, z: 39 },
    { x: 'var(--fan-x2)', y: 'var(--fan-y2)', r: 8, s: 0.91, z: 30 },
    { x: 'var(--fan-x2)', y: 'var(--fan-y2)', r: 8, s: 0.91, z: 29 },
    { x: 'var(--fan-x2)', y: 'var(--fan-y2)', r: 8, s: 0.91, z: 20 },
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
    const count = preset.value.length
    return {
      card,
      index,
      depth: Math.min(raw, count - 1),
      // 左右站位是卡自己的属性，不是层号的属性：奇偶定下来就一辈子不变。
      // 这样翻一张牌时，只有"往中间靠一格"这一种位移，任何一张卡都不会
      // 从左边被甩到右边（那才是反直觉的那一下）。
      // 层号由 raw 给出、每翻一张整体减一，两侧的层号恰好互换 ——
      // 扇面因此自己左右交替：拿走右边那张，顶上来的是左边那张。
      // 窄屏堆叠不交替（见 PRESETS.stack），一律站右侧。
      side: mode.value === 'fan' ? (index % 2 ? 1 : -1) : 1,
      // 能露出来的只有最前面 count 层，再深的卡彼此完全重合在同一处。
      // 多出的每一层都是一张近全屏、带 90px 模糊阴影的光栅图：切一次牌，
      // 合成器要重画十几层，手机上的"闪一下"就是从这里来的。
      // 多放行一层（raw === count）是因为它下一刻就要滑进可见区 ——
      // 提前留着，它才不必在过渡中途重新挂载。
      visible: raw <= count,
    }
  }),
)

function layerStyle(depth, visible, side) {
  const layer = preset.value[depth] || preset.value[preset.value.length - 1]
  // 站左侧的卡：把"右侧"的几何整条绕中心翻过去 —— 横向位移取负，倾角也取负。
  // var() 和 calc() 都能嵌在 calc 里相乘，所以这里只加一层 * -1，
  // 不必为左侧再定义一套 CSS 变量（也就不会有两份需要同步的数值）。
  const x = side < 0 ? `calc(${layer.x} * -1)` : layer.x
  return {
    // x/y 允许写成 px 或 var()：扇形展开的偏移量就挂在舞台上的 CSS 变量里
    transform: transformOf(x, layer.y, layer.s, layer.r * side),
    // 只改位置：层级决定谁压住谁，卡本身始终是实体，不做透明度淡出
    zIndex: layer.z,
    // 看不见的深层直接不生成盒子：不进绘制列表、不占光栅图。
    // 用 display 而不是 visibility —— 后者照样会保留层和已光栅的内容。
    display: visible ? '' : 'none',
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

  // 手势只有"翻到下一张"这一个动作：往哪个方向拖开，前卡底下露出来的都是
  // depth 1（也就是下一张），所以左右都认。这样"露出的卡"和"切到的卡"永远一致，
  // 不会出现松手后换成另一张的抖动。回上一张走底部 ‹ 或指示点。
  if (horizontal && Math.abs(delta) >= SWIPE) next()
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
      :class="[mode === 'fan' ? 'deck__stage--fan' : 'deck__stage--stack', { 'is-dragging': dragging }]"
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
        :style="layerStyle(item.depth, item.visible, item.side)"
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

    <p v-if="showHint" class="deck__hint">
      第 {{ active + 1 }} / {{ total }} 张 · 点击卡牌或左右滑动翻到下一张
    </p>
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
  /* 只让 transform 参与过渡：一次切换就是"把卡挪到新位置"，不动透明度、不动颜色，
     观感上是一摞牌在推挤，而不是有几张卡淡入淡出。卡上的 box-shadow 半径近百像素，
     一旦把 filter 之类放进过渡区间，整张卡每帧都要重新光栅化，必掉帧。
     缓动必须是 --ease-out 这种没有过冲的曲线：翻一张是六层同时换位，用带回弹的
     曲线（--ease-spring 过冲 42%）就是所有卡一起往外弹过头再收回，扇面会明显
     "鼓"一次 —— 那一下才是"整个扇面被重新摊开"的来源，跟槽位左右交替无关。 */
  transition: transform 0.42s var(--ease-out);
  /* 每个可见层都常驻合成层，且"常驻"是关键：
     切牌时前卡会失去 .is-front，如果提升与否跟着这个类切换，内核就正好在
     那一张的过渡跑到一半时把它的层拆掉重建 —— 重建的那一帧它按没有
     transform 的样子绘制，于是"底下那张闪一下压到前面"。
     常驻提升的显存开销由 stacked 限制住了：真正参与绘制的层数已被压到
     preset 长度 +1（堆叠 6 层 / 扇形 7 层），比原来那十几层还少。 */
  will-change: transform;
}

.deck__layer.is-front {
  cursor: grab;
}

.deck__layer.is-dragging {
  transition: none;
  cursor: grabbing;
}

/* 悬停时前卡的"抬起"光晕。两道闸门缺一不可：
   ① 只在真有悬停能力的桌面端生效。触摸端内核会把手指按下的 :hover 粘住，
      而卡片滑走 / 换卡又会让它反复通断，光晕一明一暗 —— 看起来就是卡在
      "两个状态"之间闪。
   ② 拖动期间（.deck__stage.is-dragging）整条规则不匹配。卡是跟着手指挪开的，
      手指底下必然换成别的元素，hover 想不闪也做不到；索性等松手之后再一次性
      重新计算，中途一律不变。 */
@media (hover: hover) and (pointer: fine) {
  .deck__layer :deep(.fcard) {
    transition: border-color 0.5s var(--ease-out), box-shadow 0.5s var(--ease-out);
  }

  .deck__stage:not(.is-dragging) .deck__layer.is-front:hover :deep(.fcard) {
    border-color: rgba(232, 201, 122, 0.34);
    box-shadow: 0 42px 92px -36px rgba(0, 0, 0, 0.98), 0 0 60px -22px rgba(154, 123, 255, 0.55);
  }
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

/* 触摸端不给悬停态：点完一下之后内核会把 hover 留在按钮上，
   按钮就一直是"高亮着"的样子，和当前状态无关。 */
@media (hover: hover) and (pointer: fine) {
  .deck__nav:hover {
    transform: translateY(-2px);
    color: var(--gold);
    border-color: rgba(232, 201, 122, 0.5);
    background: rgba(232, 201, 122, 0.1);
  }
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

@media (hover: hover) and (pointer: fine) {
  .deck__dot:hover {
    color: var(--ink-1);
    background: rgba(255, 255, 255, 0.05);
  }
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
