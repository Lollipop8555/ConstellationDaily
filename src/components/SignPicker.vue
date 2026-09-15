<script setup>
/**
 * 星座选择页 —— 12 个星座一次摊在桌上。
 *
 * 这里不再有横向列表：滚动、"滑到两端"的渐隐、滚轮横滚、滚动量测量全部删掉了。
 * 一屏放不下 12 张卡时，靠"换一套牌阵"去适应（1×12 → 2×6 → 3×4 → 4×3 → 6×2），
 * 而不是让用户去滑。滑动列表有两个绕不过去的毛病：
 *   · 一屏只看得到其中几张，"右边还有"只能用两端渐隐暗示，
 *     而那块渐隐是盖在星空上的纯色矩形（近黑的直角块），比它要解决的问题更碍眼；
 *   · 卡被容器边缘硬切一半，读起来像排版坏了。
 * 摊成一屏就没有这两件事：每张卡都是完整的，也没有"滚到哪去了"的问题。
 *
 * 行列数、卡尺寸、卡内字号全部由布局引擎给出，这里只把结果写成样式。
 */
import { computed } from 'vue'
import { SIGNS } from '../data/signs.js'
import SignCard from './SignCard.vue'
import { useLayoutContext } from '../core/layoutContext.js'

const emit = defineEmits(['select'])

const layout = useLayoutContext()
const picker = computed(
  () =>
    layout?.value?.picker ?? {
      rows: 2,
      cols: 6,
      cardW: 160,
      cardH: 240,
      gapX: 14,
      gapY: 14,
      slim: false,
      typeScale: { compact: false, scale: 1 },
    },
)
/** 极矮视口（手机横屏）：说明区只留标题，把高度让给牌阵 */
const slim = computed(() => picker.value.slim)
/** 卡矮到装不下五行时，卡内只留符号、星座名与日期区间 */
const compact = computed(() => picker.value.typeScale.compact)

/**
 * 行列都必须是整数，而 `repeat(var(--cols), ...)` 这种写法不合法，
 * 所以栅格尺寸只能用内联样式给出。
 * 卡宽高一律写死：牌阵是引擎按可用空间解出来的，容器不得再压缩它 ——
 * 让 flex / grid 去"挤一挤"，就是把某张卡挤出牌阵、裁掉一角。
 */
const gridStyle = computed(() => {
  const p = picker.value
  return {
    gridTemplateColumns: `repeat(${p.cols}, ${p.cardW}px)`,
    gridTemplateRows: `repeat(${p.rows}, ${p.cardH}px)`,
    columnGap: `${p.gapX}px`,
    rowGap: `${p.gapY}px`,
  }
})
</script>

<template>
  <section class="picker" :class="{ 'picker--slim': slim }">
    <div class="picker__intro animate-in">
      <p class="section-label">Select Your Sign</p>
      <h1 class="picker__title">今夜，星星为谁而亮</h1>
      <p class="picker__desc">
        选择你的星座，读取属于今天的能量。<br />
        选择会保存在这台设备上，明天打开时它还在那里。
      </p>
    </div>

    <div class="picker__deck">
      <div class="picker__grid" :style="gridStyle">
        <SignCard
          v-for="(item, index) in SIGNS"
          :key="item.id"
          :sign="item"
          :index="index"
          :compact="compact"
          @select="emit('select', item.id)"
        />
      </div>
    </div>

    <p class="picker__hint animate-in">
      不确定自己的星座？对照卡片下方的日期区间即可找到。
    </p>
  </section>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: var(--picker-gap, clamp(18px, 3vh, 46px));
  /* 受布局引擎给出的"选择页可用高度"约束：说明区与提示行恒完整保留，
     多出来的高度归牌阵。牌阵的尺寸是引擎按这个额度解出来的，只会小于它。 */
  max-height: var(--picker-h, none);
  min-height: 0;
  /* 内容比 max-height 矮时整体居中；safe 保证真超高时也不会把顶部裁到滚不到。
     老 WebView（微信 X5）不认 safe 关键字，整条会被丢掉、退回默认的 flex-start，
     所以先给一条普通 center 兜底。 */
  justify-content: center;
  justify-content: safe center;
}

.picker__intro {
  max-width: 620px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: none;
}

.picker__title {
  font-family: var(--font-serif);
  font-size: clamp(30px, 6vw, 52px);
  letter-spacing: 0.06em;
  line-height: 1.28;
  background: linear-gradient(120deg, #ffffff 0%, #d9d4ff 42%, var(--gold) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 0 60px rgba(154, 123, 255, 0.28);
}

.picker__desc {
  color: var(--ink-2);
  font-size: clamp(13.5px, 1.5vw, 15px);
  line-height: 2;
}

/* 极矮视口：描述先让位，标题收一档 —— 换来的高度直接变成更大的牌 */
.picker--slim .picker__intro {
  gap: 8px;
}

.picker--slim .picker__title {
  font-size: clamp(24px, 3.6vw, 34px);
}

.picker--slim .picker__desc {
  display: none;
}

/* 牌阵：整体居中，宽度就是牌阵自身的宽度（不撑满容器，免得宽屏上被拉散）。
   上下留白是给悬停上浮与发光留的余量。 */
.picker__deck {
  display: flex;
  justify-content: center;
  flex: none;
  padding-block: var(--picker-pad-v, 16px);
}

.picker__grid {
  display: grid;
  justify-content: center;
  align-content: center;
}

/* 悬停/聚焦的卡要浮在相邻卡之上：否则它会钻到右边那张的下面，
   上浮与光晕被吃掉一半。
   悬停只在真有悬停能力的桌面端给 —— 触摸端内核会把 hover 粘在手指按过的
   那张卡上，于是相邻两张卡会反复抢层级、一起闪。 */
.picker__grid > *:focus-visible {
  z-index: 2;
}

@media (hover: hover) and (pointer: fine) {
  .picker__grid > *:hover {
    z-index: 2;
  }
}

.picker__hint {
  text-align: center;
  color: var(--ink-3);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  animation-delay: 0.7s;
  flex: none;
}
</style>
