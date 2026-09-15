/**
 * 确定性伪随机工具
 * -------------------------------------------------------------
 * 目标是「可复现」：同样的字符串种子永远得到同样的随机序列。
 * 因此「同一星座 + 同一日期」在任何设备、任何时刻都会得到同一份运势，
 * 用户反复切换星座再切回来，结果也不会变化。
 */

/** 字符串 -> 32 位无符号整数种子（xmur3 变体） */
export function hashSeed(str) {
  let h = 1779033703 ^ String(str).length
  for (let i = 0; i < String(str).length; i += 1) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function finalize() {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/** mulberry32：小巧且分布良好的 32 位 PRNG */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 用任意字符串创建随机数发生器 */
export function createRng(seedString) {
  return mulberry32(hashSeed(seedString)())
}

/** 随机取一个元素 */
export function pick(rng, list) {
  if (!list || list.length === 0) return undefined
  return list[Math.floor(rng() * list.length) % list.length]
}

/** 不重复地取 n 个元素（保持随机顺序） */
export function pickMany(rng, list, count) {
  const pool = [...list]
  const result = []
  const size = Math.min(count, pool.length)
  for (let i = 0; i < size; i += 1) {
    const index = Math.floor(rng() * pool.length) % pool.length
    result.push(pool.splice(index, 1)[0])
  }
  return result
}

/** [min, max] 闭区间整数 */
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

/** 从一个带权重倾向的分布里取分值：多数落在中上区间，偶有低谷 */
export function rollScore(rng) {
  const r = rng()
  if (r < 0.08) return intBetween(rng, 48, 63)
  if (r < 0.3) return intBetween(rng, 64, 74)
  if (r < 0.8) return intBetween(rng, 75, 88)
  return intBetween(rng, 89, 99)
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
