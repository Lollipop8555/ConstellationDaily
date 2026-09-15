/**
 * 视口尺寸（含安全区）的响应式读取
 * 布局引擎的唯一输入。
 *
 * 触发源刻意做冗余，因为不同环境下"视口变了"的信号并不一样：
 *  - ResizeObserver(documentElement)：窗口缩放、旋转、分屏、被 iframe 改变尺寸、
 *    浏览器缩放——最可靠的一个，只要有盒子变化就会回调
 *  - visualViewport.resize：移动端地址栏收放、软键盘
 *  - resize / orientationchange：兜底，部分旧 WebView 只发前者
 *  - pageshow / visibilitychange：从后台切回来时尺寸可能已经变了但事件早丢了
 *
 * 更新用 rAF 合并；同时挂一个定时器兜底 —— 页面在后台或被内嵌时 rAF 会被冻结，
 * 只依赖 rAF 会让布局永远停在旧尺寸上（这正是"旋转/改窗口不重新排版"的根因）。
 * 旋转后浏览器要过几帧才给出最终尺寸，所以落地后再补量两次，吃到最后那一版。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const RETRY_DELAYS = [120, 380]

function readPx(styles, name) {
  const raw = styles.getPropertyValue(name)
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : 0
}

/** 真实可见高度：移动端只有 visualViewport 说了算，桌面端退化为 innerHeight */
function readHeight() {
  const vv = window.visualViewport
  const height = vv && vv.height ? vv.height : window.innerHeight
  return Math.round(height)
}

export function measureViewport() {
  const root = document.documentElement
  const styles = getComputedStyle(root)
  return {
    vw: Math.round(root.clientWidth || window.innerWidth),
    vh: readHeight(),
    safeTop: readPx(styles, '--safe-top'),
    safeBottom: readPx(styles, '--safe-bottom'),
  }
}

function same(a, b) {
  return (
    a.vw === b.vw && a.vh === b.vh && a.safeTop === b.safeTop && a.safeBottom === b.safeBottom
  )
}

export function useViewport() {
  const size = ref(measureViewport())

  let frame = 0
  let timer = 0
  let observer = null
  const retries = []

  function commit() {
    if (frame) {
      window.cancelAnimationFrame(frame)
      frame = 0
    }
    if (timer) {
      window.clearTimeout(timer)
      timer = 0
    }
    const next = measureViewport()
    if (!same(next, size.value)) size.value = next
  }

  function sync() {
    if (frame || timer) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      commit()
    })
    // 兜底：rAF 被节流或冻结时，最迟 180ms 后仍然落地一次
    timer = window.setTimeout(() => {
      timer = 0
      commit()
    }, 180)
  }

  onMounted(() => {
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.addEventListener('pageshow', sync)
    document.addEventListener('visibilitychange', sync)
    if (window.visualViewport) window.visualViewport.addEventListener('resize', sync)
    if (window.ResizeObserver) {
      observer = new ResizeObserver(sync)
      observer.observe(document.documentElement)
    }
    for (const delay of RETRY_DELAYS) retries.push(window.setTimeout(sync, delay))
    sync()
  })

  onBeforeUnmount(() => {
    if (frame) window.cancelAnimationFrame(frame)
    if (timer) window.clearTimeout(timer)
    for (const id of retries) window.clearTimeout(id)
    if (observer) observer.disconnect()
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
    window.removeEventListener('pageshow', sync)
    document.removeEventListener('visibilitychange', sync)
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', sync)
  })

  return { size, sync }
}
