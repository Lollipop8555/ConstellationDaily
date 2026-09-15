/**
 * 确定性运势引擎
 * -------------------------------------------------------------
 * 核心约定：运势 = f(星座, 自然日)。函数内部不读取当前时间、不使用
 * Math.random，因此：
 *  - 同一星座 + 同一天，任何设备上算出的结果完全一致；
 *  - 反复切换星座再切回来，结果不会变化；
 *  - 跨过零点进入新的一天，才会得到新的一份运势。
 */

import { SIGNS, getSignById, ELEMENTS } from '../data/signs.js'
import {
  DIMENSIONS,
  GOOD_ACTIONS,
  BAD_ACTIONS,
  MOTTOS,
  LUCKY_DIRECTIONS,
  LUCKY_TIME_SLOTS,
  ELEMENT_ADVICE,
  SCORE_THRESHOLDS,
  LEVEL_META,
} from '../data/fortune-texts.js'
import { createRng, pick, pickMany, rollScore, clamp } from './random.js'
import { loadCachedFortune, saveCachedFortune } from './storage.js'

/** 文案或算法调整时递增，可让旧的本地缓存自动失效 */
export const ENGINE_VERSION = 1

export function levelOf(score) {
  if (score >= SCORE_THRESHOLDS.high) return 'high'
  if (score >= SCORE_THRESHOLDS.mid) return 'mid'
  return 'low'
}

/** 分值换算成 1-5 星，用于卡片上的星级展示 */
export function starsOf(score) {
  return clamp(Math.round(score / 20), 1, 5)
}

/**
 * 纯函数：由星座与日期生成一份运势。
 * 注意：内部 rng 的调用顺序即「契约」，调整顺序会改变已有日期的结果。
 */
export function buildFortune(sign, dateKey) {
  const rng = createRng(`${sign.id}@${dateKey}`)

  // 1. 五个分项维度先摇分
  const subKeys = ['love', 'career', 'wealth', 'health', 'social']
  const scores = {}
  subKeys.forEach((key) => {
    scores[key] = rollScore(rng)
  })

  // 2. 综合分与分项保持一致性，避免出现「各项都很好但综合很低」的割裂感
  const weightMap = DIMENSIONS.reduce((acc, dim) => {
    acc[dim.key] = dim.weight
    return acc
  }, {})
  let weightedSum = 0
  let weightTotal = 0
  subKeys.forEach((key) => {
    const weight = weightMap[key] || 1
    weightedSum += scores[key] * weight
    weightTotal += weight
  })
  const baseline = weightedSum / weightTotal
  scores.overall = clamp(Math.round(baseline * 0.65 + rollScore(rng) * 0.35), 45, 99)

  // 3. 各维度文案按分档选取
  const levels = {}
  const texts = {}
  DIMENSIONS.forEach((dim) => {
    const score = scores[dim.key]
    const level = levelOf(score)
    levels[dim.key] = level
    texts[dim.key] = pick(rng, dim[level])
  })

  // 4. 幸运指引
  const others = SIGNS.filter((item) => item.id !== sign.id)
  const lucky = {
    color: pick(rng, sign.colors),
    number: pick(rng, sign.numbers),
    day: pick(rng, sign.days),
    direction: pick(rng, LUCKY_DIRECTIONS),
    timeSlot: pick(rng, LUCKY_TIME_SLOTS),
    friend: pick(rng, others),
  }

  // 5. 宜 / 忌 / 箴言
  const good = pickMany(rng, GOOD_ACTIONS, 3)
  const bad = pickMany(rng, BAD_ACTIONS, 2)
  const motto = pick(rng, MOTTOS)

  return {
    version: ENGINE_VERSION,
    signId: sign.id,
    dateKey,
    seed: `${sign.id}@${dateKey}`,
    scores,
    levels,
    texts,
    themeAdvice: ELEMENT_ADVICE[sign.element],
    lucky,
    good,
    bad,
    motto,
  }
}

/**
 * 带本地缓存的取用入口：当日内多次调用只会计算一次，
 * 返回的对象也是同一个引用，避免视图层反复重算。
 */
export function getFortune(signId, dateKey) {
  const sign = getSignById(signId)
  if (!sign) return null

  const cached = loadCachedFortune(signId, dateKey, ENGINE_VERSION)
  if (cached) return cached

  const fortune = buildFortune(sign, dateKey)
  saveCachedFortune(signId, dateKey, ENGINE_VERSION, fortune)
  return fortune
}

/**
 * 组装运势卡牌牌堆（塔罗式堆叠展示的内容顺序）
 * 全部信息都以卡牌承载：星座档案 → 今日总览 → 五个维度 → 今日指引 → 三条性格特质
 */
export function buildFortuneDeck(sign, fortune) {
  const scoreCard = (dim, overrides = {}) => ({
    id: dim.key,
    type: 'score',
    name: dim.name,
    en: dim.en,
    glyph: dim.glyph,
    score: fortune.scores[dim.key],
    level: fortune.levels[dim.key],
    levelLabel: LEVEL_META[fortune.levels[dim.key]].label,
    stars: starsOf(fortune.scores[dim.key]),
    text: fortune.texts[dim.key],
    note: '',
    ...overrides,
  })

  // 1. 星座档案
  const signCard = {
    id: 'sign',
    type: 'sign',
    name: sign.name,
    en: sign.en,
    glyph: sign.glyph,
    score: 0,
    level: 'flat',
    levelLabel: '',
    stars: 0,
    text: sign.profile,
  }

  const subDimensions = DIMENSIONS.filter((dim) => dim.key !== 'overall')

  // 2. 今日总览（综合分环形 + 分维度速览条，箴言只出现在今日指引卡）
  const overallCard = scoreCard(DIMENSIONS[0], {
    type: 'overall',
    name: '今日总览',
    en: 'Today',
    glyph: '✦',
    note: fortune.themeAdvice,
    breakdown: subDimensions.map((dim) => ({
      key: dim.key,
      name: dim.name,
      glyph: dim.glyph,
      score: fortune.scores[dim.key],
      level: fortune.levels[dim.key],
    })),
  })

  // 3. 五个分项维度
  const dimCards = subDimensions.map((dim) => scoreCard(dim))

  // 4. 今日指引
  const guideCard = {
    id: 'guide',
    type: 'guide',
    name: '今日指引',
    en: 'Daily Guide',
    glyph: '✧',
    score: fortune.scores.overall,
    level: fortune.levels.overall,
    levelLabel: LEVEL_META[fortune.levels.overall].label,
    stars: starsOf(fortune.scores.overall),
    text: fortune.motto,
    lucky: fortune.lucky,
    good: fortune.good,
    bad: fortune.bad,
  }

  // 5. 性格特质
  const traitCards = [
    { id: 'core', name: '核心特质', en: 'Core', glyph: '◎', em: '最天然的能量', text: sign.core },
    { id: 'shadow', name: '阴影面', en: 'Shadow', glyph: '☾', em: '需要被看见', text: sign.shadow },
    { id: 'growth', name: '成长课题', en: 'Growth', glyph: '✧', em: '可以练的方向', text: sign.growth },
  ].map((item) => ({
    ...item,
    type: 'trait',
    level: 'flat',
    levelLabel: '',
    score: 0,
    stars: 0,
  }))

  return [signCard, overallCard, ...dimCards, guideCard, ...traitCards]
}

export { ELEMENTS, LEVEL_META, DIMENSIONS }
