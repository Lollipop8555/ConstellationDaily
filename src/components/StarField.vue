<script setup>
/**
 * 沉浸式星空背景
 * - Canvas 绘制缓慢漂移的星点、微微呼吸的星座连线与偶发流星；
 * - CSS 渐变叠加星云与暗角，营造深空氛围；
 * - 尊重「减少动态效果」偏好，并在页面不可见时暂停渲染。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvasEl = ref(null)

let ctx = null
let rafId = 0
let running = false
let width = 0
let height = 0
let dpr = 1
let lastTs = 0
let meteorCountdown = 6

let stars = []
let constellations = []
let meteors = []

const prefersReduced =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const rand = (min, max) => min + Math.random() * (max - min)

function buildStars() {
  const count = Math.round(Math.min(320, Math.max(90, (width * height) / 8200)))
  stars = Array.from({ length: count }, () => {
    const depth = rand(0.35, 1)
    const roll = Math.random()
    return {
      x: rand(0, width),
      y: rand(0, height),
      r: rand(0.35, 1.5) * depth,
      alpha: rand(0.22, 0.88) * depth,
      speed: rand(0.0006, 0.0026),
      phase: rand(0, Math.PI * 2),
      vx: rand(-0.04, 0.04) * depth,
      vy: rand(-0.028, 0.028) * depth,
      hue: roll < 0.14 ? rand(188, 214) : roll < 0.28 ? rand(272, 296) : 0,
    }
  })
}

function buildConstellations() {
  const groups = width < 700 ? 2 : width < 1100 ? 3 : 4
  const step = Math.min(width, 900) * 0.17
  const list = []
  for (let g = 0; g < groups; g += 1) {
    const nodeCount = 5 + Math.floor(Math.random() * 3)
    let x = rand(width * 0.12, width * 0.88)
    let y = rand(height * 0.1, height * 0.86)
    const nodes = []
    for (let i = 0; i < nodeCount; i += 1) {
      nodes.push({ x, y })
      x = Math.min(width - 26, Math.max(26, x + rand(-step, step)))
      y = Math.min(height - 26, Math.max(26, y + rand(-step * 0.82, step * 0.82)))
    }
    list.push({
      nodes,
      phase: rand(0, Math.PI * 2),
      speed: rand(0.00016, 0.00036),
    })
  }
  return list
}

function spawnMeteor() {
  const dir = Math.random() < 0.5 ? 1 : -1
  meteors.push({
    x: dir === 1 ? rand(-width * 0.15, width * 0.6) : rand(width * 0.4, width * 1.15),
    y: rand(-30, height * 0.45),
    vx: dir * rand(0.32, 0.66),
    vy: rand(0.26, 0.5),
    life: 0,
    maxLife: rand(950, 1650),
  })
}

function resize() {
  if (!canvasEl.value) return
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = canvasEl.value.clientWidth || window.innerWidth
  height = canvasEl.value.clientHeight || window.innerHeight

  canvasEl.value.width = Math.floor(width * dpr)
  canvasEl.value.height = Math.floor(height * dpr)
  ctx = canvasEl.value.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  buildStars()
  constellations = buildConstellations()
  meteors = []

  if (prefersReduced) renderFrame(0)
}

function renderStars(ts) {
  for (const star of stars) {
    star.x += star.vx
    star.y += star.vy
    if (star.x < -4) star.x = width + 4
    if (star.x > width + 4) star.x = -4
    if (star.y < -4) star.y = height + 4
    if (star.y > height + 4) star.y = -4

    const twinkle = 0.5 + 0.5 * Math.sin(ts * star.speed + star.phase)
    const alpha = star.alpha * (0.45 + 0.55 * twinkle)
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
    ctx.fillStyle = star.hue
      ? `hsla(${star.hue}, 88%, 84%, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`
    ctx.fill()
  }
}

function renderConstellations(ts) {
  ctx.lineWidth = 1
  for (const group of constellations) {
    const pulse = 0.09 + 0.15 * (0.5 + 0.5 * Math.sin(ts * group.speed + group.phase))

    ctx.strokeStyle = `rgba(154, 123, 255, ${pulse})`
    ctx.beginPath()
    group.nodes.forEach((node, index) => {
      if (index === 0) ctx.moveTo(node.x, node.y)
      else ctx.lineTo(node.x, node.y)
    })
    ctx.stroke()

    for (const node of group.nodes) {
      const strength = Math.min(0.9, pulse * 3)
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 18)
      glow.addColorStop(0, `rgba(214, 222, 255, ${strength})`)
      glow.addColorStop(0.35, `rgba(154, 123, 255, ${strength * 0.42})`)
      glow.addColorStop(1, 'rgba(154, 123, 255, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(node.x, node.y, 18, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(node.x, node.y, 1.75, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.92, pulse * 3.6)})`
      ctx.fill()
    }
  }
}

function renderMeteors(dt) {
  meteorCountdown -= dt / 1000
  if (meteorCountdown <= 0) {
    spawnMeteor()
    meteorCountdown = rand(6, 16)
  }

  meteors = meteors.filter((meteor) => meteor.life < meteor.maxLife)

  for (const meteor of meteors) {
    meteor.life += dt
    meteor.x += meteor.vx * dt
    meteor.y += meteor.vy * dt

    if (meteor.x < -240 || meteor.x > width + 240 || meteor.y > height + 240) {
      meteor.life = meteor.maxLife
      continue
    }

    const progress = meteor.life / meteor.maxLife
    const alpha = Math.sin(Math.PI * progress) * 0.85
    const tailMs = 135
    const tailX = meteor.x - meteor.vx * tailMs
    const tailY = meteor.y - meteor.vy * tailMs

    const gradient = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY)
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    gradient.addColorStop(0.3, `rgba(160, 214, 255, ${alpha * 0.5})`)
    gradient.addColorStop(1, 'rgba(154, 123, 255, 0)')

    ctx.strokeStyle = gradient
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(meteor.x, meteor.y)
    ctx.lineTo(tailX, tailY)
    ctx.stroke()
  }
}

function renderFrame(ts) {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  renderStars(ts)
  renderConstellations(ts)
  if (!prefersReduced) renderMeteors(16)
}

function loop(ts) {
  if (!running) return
  const dt = lastTs ? Math.min(48, ts - lastTs) : 16
  lastTs = ts

  ctx.clearRect(0, 0, width, height)
  renderStars(ts)
  renderConstellations(ts)
  renderMeteors(dt)

  rafId = window.requestAnimationFrame(loop)
}

function start() {
  if (running || prefersReduced || !ctx) return
  running = true
  lastTs = 0
  rafId = window.requestAnimationFrame(loop)
}

function stop() {
  running = false
  if (rafId) window.cancelAnimationFrame(rafId)
  rafId = 0
}

function handleVisibility() {
  if (document.hidden) stop()
  else start()
}

let resizeTimer = 0
function handleResize() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    resize()
    if (prefersReduced) renderFrame(0)
  }, 160)
}

onMounted(() => {
  resize()
  start()
  window.addEventListener('resize', handleResize)
  window.addEventListener('orientationchange', handleResize)
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => {
  stop()
  window.clearTimeout(resizeTimer)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('orientationchange', handleResize)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<template>
  <div class="starfield" aria-hidden="true">
    <div class="starfield__nebula starfield__nebula--violet"></div>
    <div class="starfield__nebula starfield__nebula--cyan"></div>
    <div class="starfield__nebula starfield__nebula--gold"></div>
    <canvas ref="canvasEl" class="starfield__canvas"></canvas>
    <div class="starfield__grain"></div>
    <div class="starfield__vignette"></div>
  </div>
</template>

<style scoped>
.starfield {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 50% -10%, #101634 0%, #07091a 42%, #04050c 100%);
}

.starfield__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.starfield__nebula {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.42;
  animation: drift 22s ease-in-out infinite;
}

.starfield__nebula--violet {
  width: 46vmax;
  height: 46vmax;
  top: -16vmax;
  left: -12vmax;
  background: radial-gradient(circle, rgba(122, 92, 255, 0.55), transparent 68%);
}

.starfield__nebula--cyan {
  width: 38vmax;
  height: 38vmax;
  right: -12vmax;
  top: 18vh;
  background: radial-gradient(circle, rgba(74, 178, 210, 0.42), transparent 68%);
  animation-delay: -7s;
  animation-duration: 28s;
}

.starfield__nebula--gold {
  width: 42vmax;
  height: 42vmax;
  left: 22vw;
  bottom: -22vmax;
  background: radial-gradient(circle, rgba(232, 201, 122, 0.26), transparent 70%);
  animation-delay: -14s;
  animation-duration: 34s;
}

.starfield__grain {
  position: absolute;
  inset: 0;
  opacity: 0.05;
  background-image: radial-gradient(rgba(255, 255, 255, 0.6) 0.5px, transparent 0.6px);
  background-size: 3px 3px;
  mix-blend-mode: overlay;
}

.starfield__vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(100% 70% at 50% 42%, transparent 36%, rgba(3, 4, 10, 0.72) 100%),
    linear-gradient(180deg, rgba(3, 4, 10, 0.55) 0%, transparent 22%, transparent 74%, rgba(3, 4, 10, 0.72) 100%);
}
</style>
