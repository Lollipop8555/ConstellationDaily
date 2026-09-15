<script setup>
/**
 * 运势展示页
 * 星座档案、今日总览、各维度运势、今日指引与性格特质全部作为卡牌承载，
 * 由牌组按顺序堆叠切换，页面本身不再重复陈列信息。
 */
import FortuneDeck from './FortuneDeck.vue'

defineProps({
  sign: { type: Object, required: true },
  deck: { type: Array, required: true },
})
</script>

<template>
  <div class="fortune">
    <FortuneDeck :cards="deck" :sign="sign" />
  </div>
</template>

<style scoped>
.fortune {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
