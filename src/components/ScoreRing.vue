<script setup>
/**
 * 环形分值：入场时进度条与数字一起缓动增长。
 */
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  size: { type: Number, default: 128 },
  stroke: { type: Number, default: 7 },
  label: { type: String, default: '' },
  tone: { type: String, default: 'mid' },
  caption: { type: String, default: '' },
})

const TONES = {
  high: ['#ffe6a8', '#e8c97a'],
  mid: ['#a9ecf5', '#6fd7e8'],
  low: ['#b9b6ff', '#8d93b8'],
}

const tones = computed(() => TONES[props.tone] || TONES.mid)
const gradientId = `score-ring-${Math.random().toString(36).slice(2, 9)}`

const progress = ref(0)
const shownValue = ref(0)

const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => circumference.value * (1 - progress.value / 100))

onMounted(() => {
  const duration = 1150
  const startAt = performance.now()
  const tick = (now) => {
    const t = Math.min(1, (now - startAt) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    progress.value = props.value * eased
    shownValue.value = Math.round(props.value * eased)
    if (t < 1) window.requestAnimationFrame(tick)
  }
  window.requestAnimationFrame(tick)
})
</script>

<template>
  <div class="ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" role="img"
      :aria-label="`${label}${value}分`">
      <defs>
        <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="tones[0]" />
          <stop offset="100%" :stop-color="tones[1]" />
        </linearGradient>
      </defs>
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="rgba(150, 165, 225, 0.14)"
        :stroke-width="stroke"
      />
      <circle
        class="ring__bar"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="`url(#${gradientId})`"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>
    <div class="ring__center">
      <strong>{{ shownValue }}</strong>
      <span>{{ caption || '综合指数' }}</span>
    </div>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.ring svg {
  position: absolute;
  inset: 0;
  filter: drop-shadow(0 0 14px rgba(232, 201, 122, 0.28));
}

.ring__bar {
  transition: stroke-dashoffset 0.25s linear;
}

.ring__center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.ring__center strong {
  /* 数值字号同样跟随卡宽（--card-scale 由根节点下发），不跟随视口 */
  font-size: clamp(26px, calc(22px + 12px * var(--card-scale, 1)), 34px);
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-0);
  text-shadow: 0 0 26px rgba(154, 123, 255, 0.45);
}

.ring__center span {
  margin-top: 4px;
  font-size: 10.5px;
  letter-spacing: 0.22em;
  color: var(--ink-3);
}
</style>
