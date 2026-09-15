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

/**
 * 高度死区。
 * 移动端地址栏会随着手指上下滑动不停收放，visualViewport.height 也就一直在变；
 * 而这里的排版是"整屏重算"的，一次 vh 变化 = 全页重排一次。
 * 于是"滚一下页面 → 地址栏动 → 整屏闪一下、还卡"。
 * 地址栏收放的幅度（iOS 最多约 130px，Android/微信约 60~90px）都落在这个死区里，
 * 而旋转一定会同时改变宽度、软键盘一定远大于这个幅度，两头都不会漏。
 */
const HEIGHT_DEADZONE = 160

/**
 * env(safe-area-inset-*) 只能靠探针量。
 * 直接 getComputedStyle(...).getPropertyValue('--safe-top') 是碰运气：
 * 有的内核会把 "env(safe-area-inset-top, 0px)" 原样吐回来，parseFloat 得 NaN，
 * 刘海屏的安全区就被当成 0，页头会直接钻到状态栏底下。
 * 往探针上挂 padding 再读计算值，拿到的必定是解析后的像素数。
 */
let probe = null

function readSafeInsets() {
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);' +
      'padding-right:env(safe-area-inset-right,0px);' +
      'padding-bottom:env(safe-area-inset-bottom,0px);' +
      'padding-left:env(safe-area-inset-left,0px);'
    document.body.appendChild(probe)
  }
  const styles = getComputedStyle(probe)
  return {
    safeTop: Number.parseFloat(styles.paddingTop) || 0,
    safeBottom: Number.parseFloat(styles.paddingBottom) || 0,
  }
}

/** 真实可见高度：移动端只有 visualViewport 说了算，桌面端退化为 innerHeight */
function readHeight() {
  const vv = window.visualViewport
  const height = vv && vv.height ? vv.height : window.innerHeight
  return Math.round(height)
}

export function measureViewport() {
  const root = document.documentElement
  const insets = readSafeInsets()
  return {
    vw: Math.round(root.clientWidth || window.innerWidth),
    vh: readHeight(),
    safeTop: insets.safeTop,
    safeBottom: insets.safeBottom,
  }
}

/**
 * 这张新的尺寸是否值得重排整页。
 * 宽度（旋转、分屏、窗口缩放）与安全区一律立即生效；高度则要穿过死区。
 */
function worthRepainting(next, prev) {
  if (next.vw !== prev.vw) return true
  if (next.safeTop !== prev.safeTop || next.safeBottom !== prev.safeBottom) return true
  return Math.abs(next.vh - prev.vh) >= HEIGHT_DEADZONE
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
    // 死区把"地址栏收放"这一类的微调挡在外面，避免整屏重排
    if (worthRepainting(next, size.value)) size.value = next
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
