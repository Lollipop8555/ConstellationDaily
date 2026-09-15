<script setup>
/**
 * 应用根组件
 * - 视图状态只有两种：未选星座（选择页）/ 已选星座（运势页）
 * - 选中的星座写入 localStorage，下次打开自动选中
 * - 跨过本地零点时自动刷新日期，从而重新计算运势
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import StarField from './components/StarField.vue'
import SignPicker from './components/SignPicker.vue'
import FortuneView from './components/FortuneView.vue'
import { getSignById } from './data/signs.js'
import { buildFortuneDeck, getFortune } from './core/fortune.js'
import { formatDateCN, msUntilNextDay, toDateKey } from './core/zodiac.js'
import {
  clearSelectedSignId,
  loadSelectedSignId,
  pruneFortunes,
  saveSelectedSignId,
} from './core/storage.js'

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

function reselect() {
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
  <div class="app" :style="accentStyle">
    <StarField />

    <header class="topbar">
      <div class="container topbar__inner">
        <div class="topbar__left">
          <Transition name="fade" mode="out-in">
            <button
              v-if="sign"
              key="back"
              class="btn-reselect"
              type="button"
              title="重新选择星座"
              aria-label="重新选择星座"
              @click="reselect"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <div v-else key="brand" class="brand">
              <span class="brand__mark" aria-hidden="true">✧</span>
              <span class="brand__text">
                <strong>每日星座</strong>
                <small>Constellation Daily</small>
              </span>
            </div>
          </Transition>
        </div>

        <div class="topbar__right">
          <div v-if="sign" class="brand brand--compact">
            <span class="brand__mark" aria-hidden="true">✧</span>
            <span class="brand__text">
              <strong>每日星座</strong>
            </span>
          </div>
          <span v-else class="topbar__date">{{ dateLabel }}</span>
        </div>
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

    <footer class="footer">
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
  min-height: 100vh;
}

.topbar {
  position: relative;
  z-index: 3;
  padding-top: calc(var(--safe-top) + 18px);
}

.topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 46px;
}

.topbar__left,
.topbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
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

.brand--compact .brand__text strong {
  font-size: 13.5px;
  letter-spacing: 0.16em;
}

.brand--compact .brand__mark {
  width: 28px;
  height: 28px;
  font-size: 13px;
}

.topbar__date {
  font-size: 12.5px;
  letter-spacing: 0.1em;
  color: var(--ink-3);
}

.btn-reselect {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1px solid rgba(150, 165, 225, 0.22);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(150, 165, 225, 0.72);
  line-height: 1;
  transition: color 0.35s var(--ease-out), border-color 0.35s var(--ease-out),
    background 0.35s var(--ease-out), transform 0.45s var(--ease-spring);
}

.btn-reselect svg {
  display: block;
}

.btn-reselect:hover {
  transform: rotate(-90deg);
  color: var(--gold);
  border-color: rgba(232, 201, 122, 0.4);
  background: rgba(232, 201, 122, 0.08);
}

.view-wrap {
  position: relative;
  padding-top: clamp(26px, 5vw, 48px);
}

.footer {
  position: relative;
  z-index: 2;
  margin-top: auto;
  padding: 46px 0 calc(var(--safe-bottom) + 30px);
  text-align: center;
  font-size: 12.5px;
  color: var(--ink-3);
  line-height: 2;
}


.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s var(--ease-out), transform 0.35s var(--ease-out);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 560px) {
  .brand__text small {
    display: none;
  }
}
</style>
