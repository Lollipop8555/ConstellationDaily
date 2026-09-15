<script setup>
/**
 * 星座卡牌：栅格入场带错落延迟，悬停时上浮发光，点击即选择。
 *
 * 卡的形状由选择页的牌阵决定（固定 2:3，宽高都不由内容决定），
 * 所以卡内排版一律用 em：字号是唯一的旋钮，由 `--picker-scale` 给出，
 * 内容因此永远装得进卡里，不会出现"卡被压扁、文字被裁掉"。
 * 卡小到盛不下全部五行时，引擎会把 `compact` 打开，英文名与元素那行先退场 ——
 * 与其把字压到读不出来，不如少显示两行、让主要的几行更大。
 */
const props = defineProps({
  sign: { type: Object, required: true },
  index: { type: Number, default: 0 },
  /**
   * 紧凑排版：卡矮到装不下五行时（手机竖屏的 3×4 牌阵），
   * 英文名与"元素 / 属性"那行退场，把高度留给符号、星座名与日期区间。
   * 由布局引擎判定：它同时决定字号基准，两者必须同源，不能各判一次。
   */
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['select'])

function parseHex(hex) {
  const raw = String(hex || '').trim().replace(/^#/, '')
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw
  if (full.length !== 6) return null
  const num = Number.parseInt(full, 16)
  if (!Number.isFinite(num)) return null
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

/** 供 rgba(var(--from-rgb), α) 用 */
function toRgbTriplet(hex) {
  const rgb = parseHex(hex)
  return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '232, 201, 122'
}

/** 等价于 color-mix(in srgb, <hex> ratio, #ffffff)，只是提前在 JS 里算好 */
function mixWithWhite(hex, ratio) {
  const rgb = parseHex(hex)
  if (!rgb) return '#ffffff'
  const blend = (channel) => Math.round(channel * ratio + 255 * (1 - ratio))
  return `rgb(${blend(rgb.r)}, ${blend(rgb.g)}, ${blend(rgb.b)})`
}

const cardStyle = {
  '--from': props.sign.theme.from,
  '--to': props.sign.theme.to,
  // color-mix() 需要 Chrome 111+，微信内置的 X5 内核够不到，
  // 一条不认就会把整条 border-color / background 声明丢掉，卡就没有主题色了。
  // 颜色统一在这里算好，CSS 只用 rgba() / rgb()，任何内核都画得出来。
  '--from-rgb': toRgbTriplet(props.sign.theme.from),
  '--from-ink': mixWithWhite(props.sign.theme.from, 0.84),
  '--from-ink-soft': mixWithWhite(props.sign.theme.from, 0.72),
  '--delay': `${props.index * 55}ms`,
}
</script>

<template>
  <button
    type="button"
    class="sign-card"
    :class="{ 'sign-card--compact': compact }"
    :style="cardStyle"
    :aria-label="`选择 ${sign.name}`"
    @click="emit('select')"
  >
    <span class="sign-card__aura" aria-hidden="true"></span>
    <span class="sign-card__shine" aria-hidden="true"></span>

    <span class="sign-card__glyph">{{ sign.glyph }}</span>
    <span class="sign-card__name">{{ sign.name }}</span>
    <span class="sign-card__en">{{ sign.en }}</span>
    <span class="sign-card__range">{{ sign.range }}</span>

    <span class="sign-card__meta">
      <em>{{ sign.element }}象</em>
      <i></i>
      <em>{{ sign.quality }}</em>
    </span>
  </button>
</template>

<style scoped>
.sign-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.33em;
  width: 100%;
  height: 100%;
  /* 卡内唯一的基准：15px 是"自然尺寸"，--picker-scale 由布局引擎按卡高给出。
     卡内不得再出现 vw —— 卡宽是卡高的副产品，跟视口宽度没有关系。 */
  font-size: calc(15px * var(--picker-scale, 1));
  padding: 1.47em 0.8em 1.2em;
  border-radius: max(12px, 1.33em);
  border: 1px solid var(--line);
  background: linear-gradient(165deg, rgba(26, 31, 60, 0.78), rgba(10, 12, 26, 0.82));
  overflow: hidden;
  isolation: isolate;
  animation: fade-up 0.85s var(--ease-out) both;
  animation-delay: var(--delay);
  transition: transform 0.5s var(--ease-spring), border-color 0.5s var(--ease-out),
    box-shadow 0.5s var(--ease-out);
}

.sign-card:hover,
.sign-card:focus-visible {
  transform: translateY(-8px) scale(1.025);
  border-color: rgba(var(--from-rgb), 0.55);
  box-shadow: 0 26px 54px -26px rgba(0, 0, 0, 0.95),
    0 0 40px -14px rgba(var(--from-rgb), 0.6);
}

.sign-card:active {
  transform: translateY(-3px) scale(0.985);
}

.sign-card__aura {
  position: absolute;
  top: -46%;
  left: 50%;
  z-index: -1;
  width: 156%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  /* 柔光直接由渐变本身给（多段衰减），不用 filter: blur()。
     12 张卡各带一个 26px 模糊层，滚动时整块牌列每帧都要重新光栅化，
     实测这是掉帧的第二来源；渐变只是一次插值，观感几乎一样。 */
  background: radial-gradient(
    circle,
    rgba(var(--from-rgb), 0.52) 0%,
    rgba(var(--from-rgb), 0.21) 44%,
    transparent 72%
  );
  opacity: 0.2;
  transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out);
}

.sign-card:hover .sign-card__aura {
  opacity: 0.5;
  transform: translateX(-50%) scale(1.08);
}

.sign-card__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 32%,
    rgba(255, 255, 255, 0.16) 48%,
    transparent 62%
  );
  transform: translateX(-120%);
  transition: transform 0.9s var(--ease-out);
  pointer-events: none;
}

.sign-card:hover .sign-card__shine {
  transform: translateX(120%);
}

.sign-card__glyph {
  font-size: 2.4em;
  line-height: 1.3;
  color: var(--from-ink);
  text-shadow: 0 0 22px rgba(var(--from-rgb), 0.7);
  transition: transform 0.55s var(--ease-spring), text-shadow 0.55s var(--ease-out);
}

.sign-card:hover .sign-card__glyph {
  transform: scale(1.12) rotate(-4deg);
  text-shadow: 0 0 34px rgba(var(--from-rgb), 0.92);
}

.sign-card__name {
  margin-top: 0.27em;
  font-size: 0.97em;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--ink-0);
  white-space: nowrap;
}

.sign-card__en {
  font-size: 0.67em;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-3);
  white-space: nowrap;
  transition: color 0.4s var(--ease-out);
}

.sign-card:hover .sign-card__en {
  color: var(--from-ink-soft);
}

.sign-card__range {
  margin-top: 0.4em;
  font-size: 0.77em;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  white-space: nowrap;
}

.sign-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.47em;
  margin-top: 0.4em;
  font-size: 0.7em;
  color: var(--ink-3);
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.sign-card__meta em {
  font-style: normal;
}

.sign-card__meta i {
  width: 1px;
  height: 0.86em;
  background: var(--line-strong);
}

/* 紧凑卡：英文名与元素属性退场。
   注意是"隐藏"而不是"缩小" —— 卡内一切的尺度都由 em 决定，
   挤在卡里的行数少了，同一张卡才腾得下更大的字号（见 PICKER.refHCompact）。 */
.sign-card--compact .sign-card__en,
.sign-card--compact .sign-card__meta {
  display: none;
}
</style>
