<script setup>
/**
 * 单张运势卡牌，按类型渲染三种版式：
 *  - score  分维度运势（环形分值 + 星级 + 解读）
 *  - guide  今日指引（幸运元素 + 宜忌 + 箴言）
 *  - traits 星座性格（关键词 + 核心/阴影/成长 + 洞察）
 */
import { computed } from 'vue'
import ScoreRing from './ScoreRing.vue'

const props = defineProps({
  card: { type: Object, required: true },
  sign: { type: Object, required: true },
})

const starList = computed(() =>
  Array.from({ length: 5 }, (_, index) => index < props.card.stars),
)
</script>

<template>
  <article class="fcard" :class="[`fcard--${card.level}`, `fcard--${card.type}`]">
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
        :size="118"
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
        :size="112"
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

      <p class="fcard__text">{{ card.text }}</p>
      <p v-if="card.note" class="fcard__note">{{ card.note }}</p>
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
      <p class="sign-tagline">{{ sign.tagline }}</p>
      <p class="sign-summary">{{ card.text }}</p>

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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 24px 22px 20px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--line);
  background:
    radial-gradient(120% 90% at 12% 0%, rgba(154, 123, 255, 0.16), transparent 58%),
    linear-gradient(160deg, rgba(28, 33, 64, 0.94) 0%, rgba(14, 17, 36, 0.96) 55%, rgba(8, 10, 22, 0.98) 100%);
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
  font-size: 74px;
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
  font-size: clamp(15px, 2.1vw, 18px);
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
  font-size: 15px;
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

@media (max-width: 400px) {
  .fcard {
    gap: 14px;
    padding: 20px 16px 16px;
  }
  .fcard__corner {
    font-size: 56px;
  }
  .trait-text {
    font-size: 14px;
  }
}
</style>
