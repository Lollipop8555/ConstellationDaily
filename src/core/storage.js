/**
 * 浏览器本地存储封装
 * -------------------------------------------------------------
 * 两件需要「记住」的事：
 *  1. 用户选择的星座 —— 下次打开自动选中；
 *  2. 当日运势结果 —— 以自然日为单位缓存，当日重复打开不再变化。
 *
 * 在隐私模式或禁用存储的环境下自动降级为内存存储，保证功能不崩。
 */

const NAMESPACE = 'constellation-daily'
const VERSION = 'v1'

const SIGN_KEY = `${NAMESPACE}:${VERSION}:selected-sign`
const fortuneKey = (signId) => `${NAMESPACE}:${VERSION}:fortune:${signId}`

const memoryStore = new Map()
let storageOk = null

function canUseLocalStorage() {
  if (storageOk !== null) return storageOk
  try {
    const probe = `${NAMESPACE}:probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    storageOk = true
  } catch (error) {
    storageOk = false
  }
  return storageOk
}

function readRaw(key) {
  try {
    if (canUseLocalStorage()) return window.localStorage.getItem(key)
    return memoryStore.has(key) ? memoryStore.get(key) : null
  } catch (error) {
    return null
  }
}

function writeRaw(key, value) {
  try {
    if (canUseLocalStorage()) {
      window.localStorage.setItem(key, value)
    } else {
      memoryStore.set(key, value)
    }
  } catch (error) {
    // 写入失败（例如配额已满）时不影响页面运行
    memoryStore.set(key, value)
  }
}

function removeRaw(key) {
  try {
    if (canUseLocalStorage()) window.localStorage.removeItem(key)
  } catch (error) {
    /* ignore */
  }
  memoryStore.delete(key)
}

function readJSON(key) {
  const raw = readRaw(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    removeRaw(key)
    return null
  }
}

function writeJSON(key, value) {
  try {
    writeRaw(key, JSON.stringify(value))
  } catch (error) {
    /* ignore */
  }
}

/* ------------------------------- 星座选择 ------------------------------- */

export function loadSelectedSignId() {
  const value = readRaw(SIGN_KEY)
  return value && value.length > 0 ? value : null
}

export function saveSelectedSignId(signId) {
  writeRaw(SIGN_KEY, String(signId))
}

export function clearSelectedSignId() {
  removeRaw(SIGN_KEY)
}

/* ------------------------------- 运势缓存 ------------------------------- */

/**
 * 读取某星座的当日运势缓存。
 * 只有「缓存日期 === 今天」且「引擎版本一致」时才算命中，
 * 以此保证跨自然日自动重新计算。
 */
export function loadCachedFortune(signId, dateKey, engineVersion) {
  const cached = readJSON(fortuneKey(signId))
  if (!cached) return null
  if (cached.dateKey !== dateKey) return null
  if (cached.version !== engineVersion) return null
  return cached.payload || null
}

export function saveCachedFortune(signId, dateKey, engineVersion, payload) {
  writeJSON(fortuneKey(signId), { dateKey, version: engineVersion, payload })
}

/** 清理过期缓存，只保留今天的记录 */
export function pruneFortunes(dateKey) {
  try {
    if (!canUseLocalStorage()) return
    const storage = window.localStorage
    const prefix = `${NAMESPACE}:${VERSION}:fortune:`
    const stale = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (!key || !key.startsWith(prefix)) continue
      try {
        const parsed = JSON.parse(storage.getItem(key) || 'null')
        if (!parsed || parsed.dateKey !== dateKey) stale.push(key)
      } catch (error) {
        stale.push(key)
      }
    }
    stale.forEach((key) => storage.removeItem(key))
  } catch (error) {
    /* ignore */
  }
}

export const STORAGE_KEYS = {
  NAMESPACE,
  VERSION,
  SIGN_KEY,
}
