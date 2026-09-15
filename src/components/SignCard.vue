<script setup>
/**
 * 星座卡牌：栅格入场带错落延迟，悬停时上浮发光，点击即选择。
 */
const props = defineProps({
  sign: { type: Object, required: true },
  index: { type: Number, default: 0 },
})

const emit = defineEmits(['select'])

const cardStyle = {
  '--from': props.sign.theme.from,
  '--to': props.sign.theme.to,
  '--delay': `${props.index * 55}ms`,
}
</script>

<template>
  <button
    type="button"
    class="sign-card"
    :style="cardStyle"
    :aria-label="`选择 ${sign.name}`"
    @click="emit('select')"
  >
    <span class="sign-card__aura" aria-hidden="true"></span>
    <span class="sign-card__shine" aria-hidden="true"></span>

    <span class="sign-card__index">{{ String(sign.index).padStart(2, '0') }}</span>
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
  gap: 5px;
  width: 100%;
  padding: 22px 12px 18px;
  border-radius: var(--radius-lg);
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
  border-color: color-mix(in srgb, var(--from) 55%, transparent);
  box-shadow: 0 26px 54px -26px rgba(0, 0, 0, 0.95),
    0 0 40px -14px color-mix(in srgb, var(--from) 60%, transparent);
}

.sign-card:active {
  transform: translateY(-3px) scale(0.985);
}

.sign-card__aura {
  position: absolute;
  top: -46%;
  left: 50%;
  z-index: -1;
  width: 150%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--from) 62%, transparent),
    transparent 62%
  );
  opacity: 0.2;
  filter: blur(26px);
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

.sign-card__index {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.sign-card__glyph {
  font-size: clamp(28px, 3.4vw, 36px);
  line-height: 1.3;
  color: color-mix(in srgb, var(--from) 84%, #ffffff);
  text-shadow: 0 0 22px color-mix(in srgb, var(--from) 70%, transparent);
  transition: transform 0.55s var(--ease-spring), text-shadow 0.55s var(--ease-out);
}

.sign-card:hover .sign-card__glyph {
  transform: scale(1.12) rotate(-4deg);
  text-shadow: 0 0 34px color-mix(in srgb, var(--from) 92%, transparent);
}

.sign-card__name {
  margin-top: 4px;
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--ink-0);
}

.sign-card__en {
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-3);
  transition: color 0.4s var(--ease-out);
}

.sign-card:hover .sign-card__en {
  color: color-mix(in srgb, var(--from) 72%, #ffffff);
}

.sign-card__range {
  margin-top: 6px;
  font-size: 11.5px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.sign-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
}

.sign-card__meta em {
  font-style: normal;
}

.sign-card__meta i {
  width: 1px;
  height: 9px;
  background: var(--line-strong);
}

@media (max-width: 560px) {
  .sign-card {
    padding: 16px 8px 14px;
  }
  .sign-card__range {
    font-size: 10.5px;
  }
}
</style>
