/**
 * 视口布局引擎（纯计算，无副作用）
 *
 * 不再用媒体查询去"试"各种尺寸，而是先量出视口，再按从外到内的顺序分配：
 *   1. 顶栏（品牌 / 重新选择按钮 + 日期）——任何尺寸都不抢卡牌两侧的宽度
 *   2. 底部：切换控件（左右箭头 + 指示点）与提示行
 *   3. 剩余整块 = 卡牌舞台 box
 *   4. 按 box 的长宽比决定牌组形态：横向富余就扇形展开，否则收起堆叠
 *   5. 按内容真实所需的高度反推卡牌长宽比，优先让内容完整展示
 *   6. 页脚只有在真有余量时才出现
 *
 * 形态优先级：纵向标准比例（16:9）的扇形展开 → 收起堆叠 → 长条卡。
 * 只有"又扁又矮"（长宽比与尺寸两个阈值同时触底）的极端横屏才退化成横条卡；
 * 足够大的带鱼屏纵向富余，仍然是竖卡扇形展开居中展示。
 * 只有当盒子矮到任何宽度都放不下内容时，才让卡牌内容内部滚动（兜底）。
 */

const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi)

export const MAXW = 1140

/** 卡内密度的参考卡宽：卡宽等于它时 `--card-scale` 为 1 */
export const REF_CARD_W = 560

/** 卡牌几何约束 */
export const CARD = {
  min: 300,
  /** 舒适宽度区间：再宽只会拉长行宽、把卡片压成横条，阅读体验反而变差 */
  comfort: [360, 560],
  /** 允许的高宽比区间（高 / 宽） */
  aspect: [1.12, 1.9],
  /**
   * "塔罗感"的目标高宽比：纵向有余量时把卡拉到这个比例再停。
   * 卡宽是跟着盒子放大的（桌面端能到 560），如果高度还只贴着内容走，
   * 比例就会掉到 1.17 左右，看上去像个方块，塔罗长卡的感觉全没了。
   * 所以内容装得下时，多出来的高度用来把卡拉长，而不是全留给居中和页脚。
   * 取 16:9（≈1.78）作为纵向标准比例：比原先的 1.45 更修长，
   * 接近真实塔罗牌（70×120mm ≈ 1.71）的长条观感。
   */
  tarot: 16 / 9,
  /**
   * 内容所需高度按宽度分档（实测：牌组里最高的是"星座档案"卡）。
   * 越宽越矮，640px 之后基本不再变矮。
   * 每档取"该宽度下 12 星座的最高值"——各星座简介长短不一，
   * 差一行就是 25px，取平均会让最长的那个星座被裁掉一行。
   */
  heightSteps: [
    [640, 631],
    [450, 656],
    [360, 681],
    [315, 706],
    [300, 731],
  ],
}

/**
 * 长条卡（手机横屏这类超扁比例）
 * 竖排卡在这个比例下只有 ~290px 高，无论多宽都放不下竖排内容，只能卡内滚动。
 * 改成横条后正文左右分栏，所需高度几乎减半，于是又能完整展示。
 */
export const WIDE = {
  /**
   * 长条卡的门槛必须"长宽比"与"尺寸"同时满足，缺一不可：
   *   · 长宽比够扁 —— 接近方形时把卡拉成长条只会更难看；
   *   · 尺寸够小 —— 带鱼屏同样很扁，但它高度富余，竖卡扇形展开放得下，
   *     这时不该被压成一条。
   * 两个阈值之间是渐进的：尺寸变小 → 先按盒子的形状压缩卡的尺寸与比例，
   * 触底之后才换形态。
   */
  minBoxAspect: 1.85,
  /** 盒子高过它就不必压扁：那时常规竖卡已经放得下内容 */
  maxBoxH: 520,
  /** 长条卡的高/宽允许区间 */
  aspect: [0.26, 0.86],
  /** 再窄就分不出两栏了 */
  minW: 470,
  /** 太长会拉长行宽，限制上限 */
  maxW: 880,
  /** 再高就不像"一条"了，剩下的纵向空间留给页脚 */
  maxH: 400,
}

/**
 * 长条卡字号的起手缩放（真正落地由卡组件的运行时自校正微调）。
 * 横条的高度就是内容的天花板，而横条高度完全由视口决定、跟内容多少无关：
 * 同一份文案在 390px 高的横屏有 196px 可用，到 360px 高的横屏只剩 152px。
 * 与其让内容溢出、退回卡内滚动，不如卡矮时整体收一档字号。
 *
 * 这里只给一个平缓的起手值 —— 实测"刚好装下"的缩放值在视口之间跳得并不平滑
 * （收字号会让段落少一行、栏宽变化会让某条改折行，是阶梯式的），
 * 所以精确落点交给组件量完真实内容后再补，这里只负责别一上来就离谱。
 */
const WIDE_TYPE = { hLo: 258, sLo: 0.84, hHi: 330, sHi: 1 }

export function wideTypeScale(cardH) {
  const t = (cardH - WIDE_TYPE.hLo) / (WIDE_TYPE.hHi - WIDE_TYPE.hLo)
  const scale = WIDE_TYPE.sLo + t * (WIDE_TYPE.sHi - WIDE_TYPE.sLo)
  return Number(clamp(scale, WIDE_TYPE.sLo, WIDE_TYPE.sHi).toFixed(4))
}

/** 扇形牌组的几何特征 */
export const FAN = {
  /** 扇面视觉宽度 / 卡宽（实测值，已含两侧最远层的旋转外扩） */
  span: 1.87,
  /** 后层底边相对前卡底边的下探量 / 卡宽 */
  drop: 0.137,
  /** 后层缩放后上移带来的抵消量 / 卡高 */
  rise: 0.045,
  /**
   * 展开所需的横向空间门槛：再窄两侧扇面会挤没。这是唯一的形态门槛。
   *
   * 这里曾经还要求"盒子的高宽比"够扁（0.85），本意是别在竖着的盒子里摊开，
   * 但那等于把"盒子有多高"也算进了门槛：视口越高 boxH 越夸张（1440×3440 的
   * 竖屏演示里 boxH 有 3210），比值必然很小，明明横向绰绰有余也被判成展不开，
   * 白白退回收起堆叠。而展开真正需要的只是"够宽"：横向由本门槛把关，
   * 纵向由下面的卡高 + 下探量复核，盒子的整体高宽比跟能不能摊开无关。
   */
  minBoxW: 660,
}

/** 底部区块的固定高度（px） */
export const CHROME = {
  footerMin: 76,
  footer: 66,
  footerMax: 72,
}

/**
 * 选择页牌阵：把 12 个星座一次摊在桌上。
 *
 * 这版不再横向滚动。滚动列表的形态有两处硬伤：
 *   · 一屏只看得见其中几张，"还有多少张"要靠两端渐隐去暗示 ——
 *     而渐隐是一块盖住星空的纯色矩形，边缘还是直角，比它要解决的问题更难看；
 *   · 卡被容器边缘硬切一半，读起来像排版坏了而不是"还能往右滑"。
 *
 * 改成"行列一起解、12 张全部放进一屏"：卡的形状仍然固定（2:3，宽由高推出），
 * 但候选牌阵从 1×12 到 6×2 全试一遍，谁能让卡最大就用谁。
 * 宽屏自然摊成 1~2 行的大卡，窄屏自动收成 4×3 —— 永远不会出现"卡被切一半"，
 * 也永远不需要滚动。这正是运势页摊牌的思路，只是那边是 3 张、这边是 12 张。
 */
export const PICKER = {
  /** 卡牌固定比例（宽 / 高）：2:3 的长条牌形，宽度永远由高度推出来 */
  ratio: 2 / 3,
  /**
   * 候选牌阵 [行, 列]，行列相乘必须等于星座数。
   * 从上往下越来越"抱团"，求解时逐个试，取卡最大的那个。
   */
  grids: [
    [1, 12],
    [2, 6],
    [3, 4],
    [4, 3],
    [6, 2],
  ],
  /**
   * 卡高 / 卡宽的允许区间：再小就读不出星座名了。
   * 这两个下限同时也是"哪套牌阵算合格"的门槛 —— 390 宽的竖屏上，
   * 3×4 给出 82×123 的卡，恰好压着线过；门槛再高一点它就被判出局，
   * 只能退到更抱团的牌阵，结果反而多排出几行、撑出滚动。
   */
  hMin: 110,
  wMin: 72,
  hMax: 384,
  /** 卡内排版的自然高度：卡高与它之比就是卡内字号的缩放基准 */
  refH: 208,
  /**
   * 紧凑牌阵（低于这个卡高）：英文名与"火象 / 基本"那行先退场。
   * 小卡上硬塞五行，字号会被压到 11px 往下，又小又挤；
   * 让次要信息先走，省下的高度全给"符号 + 星座名 + 日期区间"，反而看得更清楚。
   */
  compactH: 180,
  /** 紧凑牌阵的字号基准：三行内容比五行矮约四分之一（140 × 行高校准 ≈ 156） */
  refHCompact: 156,
  /**
   * 卡内字号缩放区间。
   * 下限必须低于 hMin / refHCompact（110 / 156 ≈ 0.705），否则最矮的卡会被下限顶住、
   * 字号收不下去，内容溢出卡外被 overflow 裁掉 —— 手机上的 12 张卡就是这么丢了一截。
   * 上限不必贴到 hMax / refH，留白本身就是塔罗卡的一部分。
   */
  typeScale: [0.68, 1.45],
  /** 卡间距（都跟着视口走：窄屏要挤得下 12 张，宽屏可以松一点） */
  gapX: [8, 18],
  gapY: [10, 16],
  /** 牌阵上下留白：卡悬停会上浮 8px 并发光，不留余量会顶到相邻区块上 */
  padV: 16,
  /** 说明区（标题 + 描述）的两种预算 */
  introFull: 184,
  /** 极矮视口只留标题，把高度全让给牌 */
  introSlim: 78,
  /** 选择页提示行的固定占用 */
  hint: 20,
}

/** 内容在给定卡宽下需要的高度 */
export function contentHeight(cardW) {
  for (const [w, h] of CARD.heightSteps) if (cardW >= w) return h
  return CARD.heightSteps[CARD.heightSteps.length - 1][1]
}

/**
 * 能完整放下内容的最小卡宽；放不下返回 0（需要滚动）。
 * 表是按宽度降序排的，从最窄的一档往回找：第一个满足的就最窄，
 * 这样"卡能收多窄"才是真的最窄 —— 从宽的一头找会把卡白白撑宽。
 */
export function minWidthForHeight(boxH) {
  for (let i = CARD.heightSteps.length - 1; i >= 0; i -= 1) {
    const [w, h] = CARD.heightSteps[i]
    if (boxH >= h) return w
  }
  return 0
}

/** 扇形后层相对前卡底边的下探量 */
export function fanDrop(cardW, cardH) {
  return Math.max(0, FAN.drop * cardW - FAN.rise * cardH)
}

/** 环形图尺寸：跟着卡的实际形状走，长条卡按高度、竖卡按宽度 */
export function ringSize(cardW, cardH, wide) {
  const raw = wide ? cardH * 0.42 : cardW * 0.21
  return wide ? clamp(Math.round(raw), 86, 116) : clamp(Math.round(raw), 104, 132)
}

/**
 * 超扁盒子里的长条卡。
 * 高度直接用满可用空间（受 maxH 限制），而不是去猜"内容需要多高"：
 * 猜错就会把明明能放的形态算成放不下，退回到最差的卡内滚动。
 * 卡片正文用 safe center 居中，真遇到个别卡差几个像素也只是它自己滚一点，
 * 不会顶掉整张卡的排版。
 */
export function solveWide(boxW, boxH) {
  if (boxH > WIDE.maxBoxH) return null
  if (boxW / Math.max(boxH, 1) < WIDE.minBoxAspect) return null
  if (boxW < WIDE.minW) return null

  const w = Math.min(boxW, WIDE.maxW)
  const h = Math.min(boxH, WIDE.maxH)
  const ratio = h / Math.max(w, 1)
  if (ratio > WIDE.aspect[1] || ratio < WIDE.aspect[0]) return null

  return {
    mode: 'wide',
    wide: true,
    cardW: w,
    cardH: h,
    stageW: w,
    stageH: h,
    scroll: false,
    ring: ringSize(w, h, true),
    typeScale: wideTypeScale(h),
  }
}

/**
 * 在给定盒子里解出卡牌尺寸。
 *
 * 纵向标准比例（16:9）是追求，不是硬指标：高度定死在 boxH 上，
 * 宽度取 boxH / 16:9，比例就自然落在标准比例上。
 * 但卡变窄会让内容变高，所以"比例"永远让位于"内容放得下"：
 * 拉不到 16:9 时就在内容允许的范围内取最窄的宽度，比例尽量贴近标准比例。
 * 实在放不下（矮到任何宽度都装不下）才允许卡内滚动。
 */
export function solveCard(boxW, boxH) {
  const [aMin, aMax] = CARD.aspect
  const [wMin, wComfortMax] = CARD.comfort

  const floor = Math.min(wMin, boxW)
  const widthLimit = Math.max(Math.min(boxW, wComfortMax), floor)
  // 内容放不下时可以破例放宽一点（上限 1.3 倍舒适宽）：加宽只会让内容更矮，
  // 但再宽就成横条了，宁可让它滚。
  const widenLimit = Math.max(Math.min(boxW, wComfortMax * 1.3), floor)

  // 兜底宽度：按盒子的形状取（高宽比夹在允许区间内）
  const shape = clamp(boxH / Math.max(boxW, 1), aMin, aMax)
  let w = clamp(boxH / shape, floor, widthLimit)

  // 首选"恰好 16:9"的宽度
  const ideal = clamp(boxH / CARD.tarot, floor, widthLimit)
  if (contentHeight(ideal) <= boxH + 0.5) w = ideal
  else {
    // 这个高度上凑不到 16:9：取"内容仍放得下"的最窄宽度，比例尽量贴近标准比例
    const fit = minWidthForHeight(boxH)
    if (fit) w = clamp(fit, floor, widenLimit)
  }

  const need = contentHeight(w)
  if (need > boxH + 0.5) return { w, h: boxH, need, scroll: true, stageH: boxH }

  // 内容装得下时纵向尽量用满：多出来的高度用来把卡拉长（而不是全留给居中和页脚），
  // 但不越过 16:9 —— 卡宽跟着盒子放大、高度却只贴着内容走，比例会掉到 1.2 左右，
  // 看着就是个方块（桌面端最明显）。
  const h = Math.max(need, Math.min(w * CARD.tarot, boxH))
  return { w, h, need, scroll: false, stageH: h }
}

/** 扇形是否值得展开：横向够宽、且展开后内容仍完整（纵向由卡高 + 下探量复核） */
function solveFan(availW, boxH) {
  if (availW < FAN.minBoxW) return null

  const boxW = availW / FAN.span
  if (boxW < CARD.comfort[0]) return null

  // 下探量取决于卡宽，卡宽又取决于扣掉下探量后还剩多少高度 —— 两者互相依赖，
  // 一次估算必然有偏差。这里曾经按 0.09 * boxW 预留，但那用的是"最宽的卡"
  // （boxW 本身就是卡宽上限），真落地的卡常常窄得多，白留的十几像素足以把
  // 可用高度推下内容所需的档位（631 → 656 就是一档 25px），于是 1280×800 这种
  // 横向明显富余、纵向只差一点的窗口反而展不开，而更窄更高的 800×1280
  // 因为纵向富余很多倒能展开。改成迭代：先按全高解一张卡，再用它的真实下探量
  // 重解，两步左右即收敛。
  let card = solveCard(boxW, boxH)
  for (let i = 0; i < 3; i += 1) {
    const reserve = fanDrop(card.w, card.h)
    const next = solveCard(boxW, boxH - reserve)
    card = next
    if (Math.abs(fanDrop(next.w, next.h) - reserve) < 0.5) break
  }
  if (card.scroll) return null

  const drop = fanDrop(card.w, card.h)
  if (card.h + drop > boxH + 0.5) return null

  return {
    mode: 'fan',
    wide: false,
    cardW: card.w,
    cardH: card.h,
    stageW: card.w * FAN.span,
    stageH: card.h + fanDrop(card.w, card.h),
    scroll: false,
    ring: ringSize(card.w, card.h, false),
    typeScale: 1,
  }
}

/**
 * 卡内排版：卡矮就整体收一档，保证内容永远装得进卡自己。
 *
 * 卡高同时决定两件事 —— 字号多大（scale），以及"要不要显示全部信息"（compact）。
 * 两者的关系不能反过来：先按卡高定下 compact，再用对应的基准算 scale，
 * 于是"内容刚好装满卡"这个等式在任何尺寸下都成立。
 */
export function pickerTypeScale(cardH) {
  const compact = cardH < PICKER.compactH
  const ref = compact ? PICKER.refHCompact : PICKER.refH
  const [lo, hi] = PICKER.typeScale
  return { compact, scale: Number(clamp(cardH / ref, lo, hi).toFixed(4)) }
}

/**
 * 解出选择页的牌阵：几行几列、每张卡多大、卡内字号放多少。
 *
 * 顺序是"先扣掉说明区与提示行，再拿剩下的整块空间去试所有候选牌阵"：
 * 卡的形状固定（2:3），宽度不是独立量，而是 cardH × ratio 的副产品；
 * 每个候选同时被"这一行能有多高"和"这一列能有多宽"两头夹，取更紧的那个，
 * 最后挑出卡最大的方案。于是任何视口下都只有一个确定结果，
 * 不会出现"卡被容器压扁、内容被裁掉"的中间态，也不需要滚动。
 */
export function solvePicker({ vw, vh, availW, available, blockGap = PICKER.gapY[0] }) {
  const gapX = clamp(vw * 0.012, PICKER.gapX[0], PICKER.gapX[1])
  const gapY = clamp(vh * 0.016, PICKER.gapY[0], PICKER.gapY[1])

  /**
   * 区块间距（说明区 / 牌阵 / 提示行之间）和卡间距是两码事：
   * 前者按视口高度给（18~46），后者是上面的 gapX / gapY。
   * 这里曾经拿卡间距去扣两份区块间距，大屏上一下就少算了 50 多像素 ——
   * 牌阵因此比它需要的高度矮了一截，最后一行装不下、上下各被裁掉一条。
   */
  const budget = available - PICKER.introFull - blockGap * 2 - PICKER.hint
  const slim = budget < PICKER.hMin
  const intro = slim ? PICKER.introSlim : PICKER.introFull

  /** 扣掉说明区、提示行与上下留白之后，牌阵能用的整块空间（还没扣卡间距） */
  const inner = Math.max(80, available - intro - blockGap * 2 - PICKER.hint - PICKER.padV * 2)

  /** 合格方案里卡最大的那个 */
  let best = null
  /** 不看可读下限、只管卡最大的那个 —— 全部不合格时用它兜底 */
  let widest = null
  for (const [rows, cols] of PICKER.grids) {
    const byH = (inner - (rows - 1) * gapY) / rows
    const byW = (availW - (cols - 1) * gapX) / cols
    const cardH = Math.min(byH, byW / PICKER.ratio)
    const cardW = cardH * PICKER.ratio
    if (!widest || cardW > widest.cardW) widest = { rows, cols, cardH, cardW }
    if (cardH < PICKER.hMin || cardW < PICKER.wMin) continue
    if (!best || cardW > best.cardW) best = { rows, cols, cardH, cardW }
  }

  /**
   * 兜底：小到所有牌阵都摆不下可读的卡。
   * 这里必须挑"卡最大"的那套，而不是固定退到最抱团的一档 ——
   * 最抱团 = 列最少 = 行最多，高度开销最大，在窄屏上正好是最差的选择
   * （390 宽的竖屏会因此多排出四行、撑出三百多像素的滚动）。
   */
  const picked = best || widest

  const { rows, cols } = picked
  const cardH = Math.round(Math.min(picked.cardH, PICKER.hMax))
  const cardW = Math.round(cardH * PICKER.ratio)

  return {
    slim,
    rows,
    cols,
    gapX,
    gapY,
    blockGap,
    padV: PICKER.padV,
    cardH,
    cardW,
    typeScale: pickerTypeScale(cardH),
    /* 牌阵的真实尺寸（含卡间距与上下留白），供外层校验与居中 */
    deckH: Math.round(rows * cardH + (rows - 1) * gapY + PICKER.padV * 2),
    deckW: Math.round(cols * cardW + (cols - 1) * gapX),
  }
}

/**
 * 主入口：给出视口尺寸，算出这一屏的全部关键尺寸。
 * 返回的数值都直接写进 CSS 变量，组件只负责摆放。
 */
export function computeLayout({ vw, vh, safeTop = 0, safeBottom = 0, maxw = MAXW }) {
  const aspect = vw / vh

  // 顶栏在所有尺寸下都留在顶部：它只占高度，不抢卡牌两侧的宽度。
  // 横向越吃紧（手机横屏、极扁的窗口）越该把宽度整块让给卡牌 ——
  // 竖栏会切掉 60px 宽，宽度本就紧张时这笔开销比省下的那几像素高度值钱得多。
  const compact = vh <= 900

  const topH = compact ? 48 : 64
  const pagePadTop = compact ? 8 : clamp(vh * 0.03, 10, 40)
  const pagePadBottom = compact ? 8 : clamp(vh * 0.016, 8, 32)
  const controlsH = vw <= 560 || compact ? 34 : 38
  const gap = clamp(vh * 0.014, 10, 18)
  const hintH = vh >= 940 ? 20 : 0

  const containerPad = clamp(vw * 0.045, 18, 44)
  const contentW = Math.min(vw, maxw)
  const availW = Math.max(240, contentW - containerPad * 2)

  const usedChrome =
    safeTop + topH + pagePadTop + pagePadBottom + safeBottom + controlsH + gap + (hintH ? gap + hintH : 0)
  const boxH = Math.max(160, vh - usedChrome)

  /**
   * 选择页的区块间距按视口高度给，而不是按宽度。
   * 它的瓶颈永远是高度（牌格要纵向滚动），宽度再大也换不来一行卡片；
   * 原先跟着 4.4vw 走，1280 宽的矮屏上白白吃掉 92px 的牌格高度。
   */
  const pickerGap = clamp(vh * 0.03, 18, 46)

  const card = solveCard(availW, boxH)
  const stacked = {
    mode: 'stack',
    wide: false,
    cardW: card.w,
    cardH: card.h,
    stageW: card.w,
    stageH: card.h,
    scroll: card.scroll,
    ring: ringSize(card.w, card.h, false),
    typeScale: 1,
  }
  // 形态优先级：纵向标准比例的扇形展开 > 收起堆叠 > 长条卡。
  // solveFan 只会在"展开后内容仍完整"时成立，先问它不会牺牲可读性；
  // 真轮到长条卡时，说明竖卡已经既展不开、又放不下内容了（极端横屏）。
  // 两者不会互相抢：扇形要求卡高装得下内容（≥631），长条卡只在很矮的盒子里成立。
  const fanSolved = solveFan(availW, boxH)
  const wideSolved = fanSolved ? null : solveWide(availW, boxH)
  const deck = fanSolved || wideSolved || stacked

  // 页脚：牌组摆完之后还有富余才出现
  const leftover = boxH - deck.stageH
  const footerH = leftover >= CHROME.footerMin ? Math.min(CHROME.footer, CHROME.footerMax) : 0

  /**
   * 选择页的可用高度 = 从顶栏下沿到页脚上沿之间的全部空间。
   * 它没有底部的切换控件，那部分（controlsH + gap）理应借给牌格 ——
   * 沿用运势页的 boxH 等于凭空扣掉 44px，1280×720 这种横屏正好卡在
   * 临界点上。
   *
   * 但页脚是全局的（两个视图都渲染），选择页同样要给它让位，
   * 所以必须扣掉 footerH：原先漏了这一笔，页脚一出现就把牌格顶出屏幕，
   * 页面跟着多出一条滚动条。
   * 运势页那份 hint 占用也要还回来 —— 选择页自己的 hint 由 solvePicker 扣。
   */
  const pickerH = boxH + controlsH + gap + (hintH ? gap + hintH : 0) - footerH
  /**
   * 牌阵本身（几行几列、卡多大、卡内字号放多少）。
   * 宽高都要交给它：牌阵是从"总额度里扣掉说明区与间距"之后，
   * 再拿横向、纵向两个方向一起夹出来的 —— 只给高度就会摆出放不下的列数。
   * 区块间距也必须一并给，扣错了牌阵就会矮一截、最后一行被裁掉。
   */
  const picker = solvePicker({ vw, vh, availW, available: pickerH, blockGap: pickerGap })

  return {
    vw,
    vh,
    compact,
    aspect,
    topH,
    pagePadTop,
    // 页脚会自己带上底部安全区，没有页脚时就把安全区还给页面
    pagePadBottom: pagePadBottom + (footerH ? 0 : safeBottom),
    controlsH,
    gap,
    hintH,
    containerPad,
    availW,
    boxH,
    pickerH,
    pickerGap,
    picker,
    deck,
    footerH,
    leftover: Math.round(leftover),
    hint: hintH > 0,
  }
}
