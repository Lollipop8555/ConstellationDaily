<script setup>
import { SIGNS } from '../data/signs.js'
import SignCard from './SignCard.vue'

const emit = defineEmits(['select'])
</script>

<template>
  <section class="picker">
    <div class="picker__intro animate-in">
      <p class="section-label">Select Your Sign</p>
      <h1 class="picker__title">今夜，星星为谁而亮</h1>
      <p class="picker__desc">
        选择你的星座，读取属于今天的能量。<br />
        选择会保存在这台设备上，明天打开时它还在那里。
      </p>
    </div>

    <div class="picker__grid">
      <SignCard
        v-for="(item, index) in SIGNS"
        :key="item.id"
        :sign="item"
        :index="index"
        @select="emit('select', item.id)"
      />
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
  gap: clamp(28px, 4.4vw, 46px);
}

.picker__intro {
  max-width: 620px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
  gap: clamp(10px, 1.6vw, 18px);
}

.picker__hint {
  text-align: center;
  color: var(--ink-3);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  animation-delay: 0.7s;
}

@media (min-width: 700px) {
  .picker__grid {
    grid-template-columns: repeat(auto-fill, minmax(172px, 1fr));
  }
}
</style>
