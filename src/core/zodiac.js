/**
 * 日期与星座的相互转换工具
 * -------------------------------------------------------------
 * 全部基于「本地自然日」，与用户所在时区一致：
 * 用户看到的「今天」就是他自己日历上的今天。
 */

import { SIGNS } from '../data/signs.js'

const WEEKDAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 把 Date 转成本地自然日 key：YYYY-MM-DD */
export function toDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** 展示用中文日期：2026年9月15日 周二 */
export function formatDateCN(dateKey) {
  const date = parseDateKey(dateKey)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS_CN[date.getDay()]}`
}

/** 距离下一个自然日零点的毫秒数 */
export function msUntilNextDay(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 2)
  return next.getTime() - date.getTime()
}

/** 判断 (month, day) 是否落在 [start, end] 区间内，支持跨年（摩羯座） */
function isWithin(month, day, start, end) {
  const value = month * 100 + day
  const from = start[0] * 100 + start[1]
  const to = end[0] * 100 + end[1]
  if (from <= to) return value >= from && value <= to
  // 跨年区间，例如 12.22 - 1.19
  return value >= from || value <= to
}

/** 根据月/日获取星座 id */
export function signIdByMonthDay(month, day) {
  const matched = SIGNS.find((sign) => isWithin(month, day, sign.dates.start, sign.dates.end))
  return matched ? matched.id : SIGNS[0].id
}

/** 根据任意日期获取星座 id */
export function signIdByDate(date = new Date()) {
  return signIdByMonthDay(date.getMonth() + 1, date.getDate())
}

/** 某一天的「太阳星座」（本站在此日给出的默认星座依据） */
export function signByDateKey(dateKey) {
  const date = parseDateKey(dateKey)
  return signIdByDate(date)
}
