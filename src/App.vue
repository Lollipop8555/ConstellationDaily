<script setup>
/**
 * 应用根组件
 * - 视图状态只有两种：未选星座（选择页）/ 已选星座（运势页）
 * - 选中的星座写入 localStorage，下次打开自动选中
 * - 跨过本地零点时自动刷新日期，从而重新计算运势
 * - 回选择页的入口收在左上角品牌的"每日星座"标题上，不再单独占一个按钮
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import StarField from './components/StarField.vue'
import SignPicker from './components/SignPicker.vue'
import FortuneView from './components/FortuneView.vue'
import { getSignById } from './data/signs.js'
import { buildFortuneDeck, getFortune } from './core/fortune.js'
import { REF_CARD_W, computeLayout } from './core/layout.js'
import { provideLayout } from './core/layoutContext.js'
import { useViewport } from './core/useViewport.js'
import { formatDateCN, msUntilNextDay, toDateKey } from './core/zodiac.js'
import {
  clearSelectedSignId,
  loadSelectedSignId,
  pruneFortunes,
  saveSelectedSignId,
} from './core/storage.js'

/**
 * 布局：量出视口 → 算出这一屏各部分的位置与尺寸 → 写进 CSS 变量
 * 组件里不再出现媒体查询，所有自适应都由这份计算结果驱动
 */
const { size } = useViewport()
const layout = computed(() => computeLayout(size.value))
provideLayout(layout)

const shellStyle = computed(() => {
  const l = layout.value
  const px = (value) => `${Number(value.toFixed(2))}px`
  return {
    /* 容器高度直接用引擎量到的可见高度，避免 CSS 的 100vh 在移动端
       等于"地址栏隐藏后的大视口"，与引擎算出来的可用高度对不上 */
    '--app-h': px(size.value.vh),
    '--top-h': px(l.topH),
    '--page-pad-top': px(l.pagePadTop),
    '--page-pad-bottom': px(l.pagePadBottom),
    '--controls-h': px(l.controlsH),
    '--deck-gap': px(l.gap),
    '--hint-h': px(l.hintH),
    '--footer-h': px(l.footerH),
    '--card-w': px(l.deck.cardW),
    '--card-h': px(l.deck.cardH),
    '--stage-w': px(l.deck.stageW),
    '--stage-h': px(l.deck.stageH),
    '--fan-drop': px(l.deck.stageH - l.deck.cardH),
    '--box-h': px(l.boxH),
    /* 选择页有自己的一份高度预算与间距（没有底部控件，也不放页脚）。
       牌阵是把 12 个星座一次摊开：几行几列、卡多大、卡内字号放多少，
       都由引擎拿这块额度在横纵两个方向上一起夹出来（行列数与卡尺寸走内联样式）。 */
    '--picker-h': px(l.pickerH),
    '--picker-gap': px(l.pickerGap),
    '--picker-pad-v': px(l.picker.padV),
    '--picker-scale': String(l.picker.typeScale.scale),
    /* 环形图尺寸也由引擎按卡的形状给出：竖卡按宽度、长条卡按高度 */
    '--ring-size': px(l.deck.ring),
    /* 卡内密度的唯一基准：1.0 = 参考卡宽 560。
       卡内字号/留白只能跟它走，绝不能再写 vw —— 宽而矮的窗口里卡会很窄，
       而 vw 却很大，卡内排版就会和卡的实际宽度脱节。 */
    '--card-scale': String(Number((l.deck.cardW / REF_CARD_W).toFixed(4))),
    /* 长条卡的字号缩放：横条的高度就是内容天花板，卡矮就整体收一档，
       避免个别文案偏长的卡溢出到卡内滚动。非长条卡恒为 1。 */
    '--wide-scale': String(Number(l.deck.typeScale.toFixed(4))),
    /* 容器的左右留白也由引擎给出：引擎是用这个值反推可用宽度的，
       两处各写一份迟早会漂移，导致卡牌溢出或留白过头 */
    '--container-pad': px(l.containerPad),
  }
})

const signId = ref(loadSelectedSignId())
const dateKey = ref(toDateKey())
let midnightTimer = 0

const sign = computed(() => (signId.value ? getSignById(signId.value) : null))
const fortune = computed(() => (sign.value ? getFortune(sign.value.id, dateKey.value) : null))
const deck = computed(() =>
  sign.value && fortune.value ? buildFortuneDeck(sign.value, fortune.value) : [],
)
const dateLabel = computed(() => formatDateCN(dateKey.value))
const accentStyle = computed(() => ({
  '--accent': sign.value ? sign.value.theme.from : '#e8c97a',
  '--accent-deep': sign.value ? sign.value.theme.to : '#6b5a2a',
}))

function selectSign(id) {
  signId.value = id
  saveSelectedSignId(id)
}

/**
 * 回到星座选择页。入口是左上角品牌里的"每日星座"标题 ——
 * 没选过星座时品牌只是静态标识，点了不该有任何反应。
 */
function goHome() {
  if (!sign.value) return
  signId.value = null
  clearSelectedSignId()
}

function scheduleMidnightRefresh() {
  window.clearTimeout(midnightTimer)
  midnightTimer = window.setTimeout(() => {
    dateKey.value = toDateKey()
    pruneFortunes(dateKey.value)
    scheduleMidnightRefresh()
  }, msUntilNextDay() + 1500)
}

onMounted(() => {
  pruneFortunes(dateKey.value)
  scheduleMidnightRefresh()
})

onBeforeUnmount(() => {
  window.clearTimeout(midnightTimer)
})
</script>

<template>
  <div class="app" :style="{ ...accentStyle, ...shellStyle }">
    <StarField />

    <header class="topbar">
      <div class="container topbar__inner">
        <!-- 品牌常驻左上角。选过星座之后，标题本身就是"回选择页"的入口：
             没选时渲染成 div，免得在页面上留一个点了没反应的按钮。 -->
        <component
          :is="sign ? 'button' : 'div'"
          class="brand"
          :class="{ 'brand--home': sign }"
          :type="sign ? 'button' : undefined"
          :title="sign ? '返回星座选择' : undefined"
          :aria-label="sign ? '返回星座选择' : undefined"
          @click="goHome"
        >
          <span class="brand__mark" aria-hidden="true">✧</span>
          <span class="brand__text">
            <strong>每日星座</strong>
            <small>Constellation Daily</small>
          </span>
        </component>

        <span v-if="!sign" class="topbar__date">{{ dateLabel }}</span>
      </div>
    </header>

    <main class="page">
      <div class="container view-wrap">
        <Transition name="view" mode="out-in">
          <SignPicker v-if="!sign" key="picker" @select="selectSign" />
          <FortuneView v-else key="fortune" :sign="sign" :deck="deck" />
        </Transition>
      </div>
    </main>

    <footer v-if="layout.footerH" class="footer">
      <div class="container">
        <p>星座运势是一种自我观察的镜面，而非对未来的预测，请当作每日的轻松参考。</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  /* 高度基准与布局引擎同一个来源（它量到的可见高度） */
  min-height: var(--app-h, 100dvh);
}

/* 顶栏占位完全由布局引擎给出（含安全区），内容在安全区之内垂直居中 */
.topbar {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  height: calc(var(--safe-top) + var(--top-h));
  padding-top: var(--safe-top);
}

.topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 0;
}

/* 品牌既是标识、又是"回选择页"的入口：button 与 div 共用这一套排版，
   所以按钮的默认外观要全部抹掉，只留内容本身 */
.brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
}

.brand--home {
  cursor: pointer;
}

.brand--home .brand__mark,
.brand--home .brand__text strong {
  transition: color 0.35s var(--ease-out), border-color 0.35s var(--ease-out),
    background 0.35s var(--ease-out);
}

/* 触摸端不给悬停态：内核会把手指按下的 hover 留在品牌上，
   返回按钮就一直亮着，和当前状态无关。 */
@media (hover: hover) and (pointer: fine) {
  .brand--home:hover .brand__text strong {
    color: var(--gold);
  }

  .brand--home:hover .brand__mark {
    border-color: rgba(232, 201, 122, 0.6);
    background: linear-gradient(150deg, rgba(232, 201, 122, 0.32), rgba(154, 123, 255, 0.18));
  }
}

/* 键盘用户要看得见焦点；鼠标与触摸点击不额外画框 */
.brand--home:focus-visible {
  outline: 2px solid rgba(232, 201, 122, 0.55);
  outline-offset: 5px;
  border-radius: 12px;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  border: 1px solid rgba(232, 201, 122, 0.38);
  background: linear-gradient(150deg, rgba(232, 201, 122, 0.22), rgba(154, 123, 255, 0.12));
  color: var(--gold);
  font-size: 15px;
  box-shadow: 0 0 22px -6px rgba(232, 201, 122, 0.5);
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand__text strong {
  color: var(--ink-0);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.brand__text small {
  color: var(--ink-3);
  font-size: 10px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}

.topbar__date {
  font-size: 12.5px;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.view-wrap {
  position: relative;
  /* margin-block: auto 让内容在剩余空间里垂直居中；内容超出时 auto 也不会像
     justify-content: center 那样把顶部裁到滚不到的位置 */
  margin-block: auto;
}

.footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  height: calc(var(--safe-bottom) + var(--footer-h));
  padding-bottom: var(--safe-bottom);
  text-align: center;
  font-size: 12.5px;
  color: var(--ink-3);
  line-height: 1.85;
}

@media (max-width: 560px) {
  .brand__text small {
    display: none;
  }
}
</style>
