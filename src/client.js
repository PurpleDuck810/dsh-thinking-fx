/**
 * dsh-thinking-fx — 浏览器半侧。
 *
 * 作用对象是 Chat 底部的运行状态行（「深度求索中，用时 … 」）里那只鲸鱼尾巴。
 * 官方实现（@deepseek-ai/dsh-client-ui-chat）把 28×28 的 APNG 当作 mask 画在
 * 14px 的图标盒里，另外准备了一份静态 SVG 回退。这里不碰 React 组件，只在
 * 图标盒上盖自己的伪元素，并藏掉原来的两个子节点。
 *
 * 只改视觉：不读会话、不发请求、不碰模型上下文。停用插件即完全还原。
 *
 * 改参数 → 运行 `node build.mjs` → 重新生成 lib/client.js（HMR 会自己刷新页面）。
 */

window.__ModuleLoader__.load({
  id: 'dsh-thinking-fx',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const PLUGIN = 'dsh-thinking-fx'

    /**
     * 玩法参数。改这里就够了，不用碰下面的 CSS。
     *
     * preset:
     *   'glyph'  用自带的表情包当 mask（默认，颜色跟主题走）
     *   'orbit'  一圈跑动的光环 + 呼吸中心点
     *   'pulse'  心跳光圈 + 呼吸核心
     *   'emoji'  用字符/emoji 顶替（默认 🐳，可换 🐋 🧠 ✦ …）
     *   'image'  换成自己的 GIF / APNG / WebP / SVG（填 image）
     *   'off'    不要图标，只留文字
     *
     * glyphMode（只对 preset === 'glyph' 生效）:
     *   'random' 从五张动画里抽一张（默认，抽中的那张自己循环播放）
     *   'fixed'  固定用 frame 指定的那张
     *
     * randomPer: 'run' 每次运行（每一轮思考）重新抽；'page' 每次刷新页面抽一次
     * frame:     glyphMode === 'fixed' 时用第几张（0–4）
     *
     * textMode:
     *   'keep'   保留官方扫光
     *   'glow'   扫光 + 文字外发光
     *   'static' 关掉扫光副本，纯色文字
     *
     * accent   主色（空 = 跟随主题的「深度求索」蓝）
     * image    https URL 或 data: URI；本地文件路径在 http 页面里读不到
     */
    const CONFIG = {
      preset: 'glyph',
      glyphMode: 'random',
      randomPer: 'run',
      frame: 0,
      emoji: '🐳',
      image: '',
      iconSize: 52,
      textScale: 1.4,
      accent: '',
      speed: 1,
      textMode: 'keep',
      textColor: '',
      shimmerColor: '',
      textSpeed: 1,
    }

    /** 五张动画 glyph（WebP，各自循环播放），构建时内联。 */
    const FRAMES = __GLYPH_FRAMES__

    /** 对应的静态首帧（减少动效时用），构建时内联。 */
    const STILLS = __GLYPH_STILLS__

    /** 构建时由 build.mjs 把 lib/thinking-fx.css 内联到这里。 */
    const CSS = `/*__INLINE_CSS__*/`

    const PRESETS = new Set(['glyph', 'orbit', 'pulse', 'emoji', 'image', 'off'])
    const TEXT_MODES = new Set(['keep', 'glow', 'static'])
    const GLYPH_MODES = new Set(['random', 'fixed'])

    /** 上一张抽到的表情；random 模式下避免连续两次同一张。 */
    let lastPick = -1

    /** 抽一张（fixed 模式返回固定下标）。 */
    function pickIndex() {
      if (CONFIG.glyphMode === 'fixed') {
        return Math.min(Math.max(Math.trunc(Number(CONFIG.frame) || 0), 0), FRAMES.length - 1)
      }
      let i = Math.floor(Math.random() * FRAMES.length)
      if (FRAMES.length > 1 && i === lastPick) {
        i = (i + 1 + Math.floor(Math.random() * (FRAMES.length - 1))) % FRAMES.length
      }
      lastPick = i
      return i
    }

    /** CSS 字符串值转义（用于自定义属性里的引号字符串）。 */
    function quote(value) {
      return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`
    }

    /** 只接受有限正数，避免把 CSS 写坏。 */
    function positive(value, fallback) {
      const n = Number(value)
      return Number.isFinite(n) && n > 0 ? n : fallback
    }

    /** 自定义属性里允许的原始颜色/URL；去掉会提前闭合声明的字符。 */
    function raw(value) {
      return String(value).replace(/[;{}]/g, '').replace(/[\r\n]+/g, ' ').trim()
    }

    module.exports = {
      name: PLUGIN,

      /**
       * 挂样式表、写根属性、设自定义属性；dispose 时逐项还原。
       * @param ctx - client 插件上下文（这里只需要 ctx.effect）。
       */
      apply(ctx) {
        ctx.effect(() => {
          if (typeof document === 'undefined') return

          const root = document.documentElement
          const preset = PRESETS.has(CONFIG.preset) ? CONFIG.preset : 'orbit'
          const effective = preset === 'glyph' && FRAMES.length === 0 ? 'orbit' : preset
          const textMode = TEXT_MODES.has(CONFIG.textMode) ? CONFIG.textMode : 'keep'
          const size = positive(CONFIG.iconSize, 16)
          const textScale = positive(CONFIG.textScale, 1)
          const speed = positive(CONFIG.speed, 1)
          const textSpeed = positive(CONFIG.textSpeed, 1)
          const glyphMode = GLYPH_MODES.has(CONFIG.glyphMode) ? CONFIG.glyphMode : 'random'
          const randomRun = glyphMode === 'random' && CONFIG.randomPer !== 'page'
          const initialIndex = effective === 'glyph' ? pickIndex() : -1
          const rootGlyph = initialIndex >= 0 ? FRAMES[initialIndex] : ''
          const rootStill = initialIndex >= 0 ? STILLS[initialIndex] : ''

          // 1) 样式表：单独一块，停用时整块移除（连同 data-plugin 标记，便于排查）。
          const overrideRules = []
          if (CONFIG.textColor) {
            overrideRules.push(
              `html[data-thinking-fx] [data-chat-running]{--dsw-alias-label-deep-diving:${raw(CONFIG.textColor)}}`,
            )
          }
          if (CONFIG.shimmerColor) {
            overrideRules.push(
              `html[data-thinking-fx] [data-chat-running]{--dsw-alias-label-deep-diving-shimmer:${raw(CONFIG.shimmerColor)}}`,
            )
          }

          const tag = document.createElement('style')
          tag.dataset.plugin = PLUGIN
          tag.dataset.pluginCss = `${PLUGIN}/thinking-fx.css`
          tag.textContent = `${CSS}\n${overrideRules.join('\n')}`
          document.head.appendChild(tag)

          // 2) 根状态：CSS 用 html[data-thinking-fx=…] 选择器，切换 preset 只改属性。
          root.dataset.thinkingFx = effective
          root.dataset.thinkingFxText = textMode

          // 3) 尺寸 / 配色 / 速度：写在 html 的自定义属性上，可被任何皮肤覆盖。
          const vars = [
            ['--tfx-size', `${size}px`],
            ['--tfx-text-scale', String(textScale)],
            ['--tfx-speed', String(speed)],
            ['--tfx-text-speed', String(textSpeed)],
          ]
          if (CONFIG.accent) vars.push(['--tfx-accent', raw(CONFIG.accent)])
          if (preset === 'emoji') vars.push(['--tfx-emoji', quote(CONFIG.emoji || '🐳')])
          if (preset === 'image' && CONFIG.image) vars.push(['--tfx-image', `url(${quote(CONFIG.image)})`])
          if (effective === 'glyph') {
            vars.push(['--tfx-glyph', `url(${quote(rootGlyph)})`])
            vars.push(['--tfx-glyph-still', `url(${quote(rootStill)})`])
          }
          for (const [name, value] of vars) root.style.setProperty(name, value)

          // 4) random-run：每次「深度求索中」这一行重新出现时，给这一行抽一张。
          //    只认行元素的身份变化，流式文本的高频 mutation 由 rAF 合并。
          let observer = null
          let frameRequest = 0
          let currentRow = null
          if (effective === 'glyph' && randomRun && document.body !== null) {
            const syncRow = () => {
              frameRequest = 0
              const row = document.querySelector('[data-chat-running]')
              if (row === currentRow) return
              currentRow = row
              if (row === null) return
              const index = pickIndex()
              row.style.setProperty('--tfx-glyph', `url(${quote(FRAMES[index])})`)
              row.style.setProperty('--tfx-glyph-still', `url(${quote(STILLS[index])})`)
              row.dataset.tfxFrame = String(index)
            }
            const schedule = () => {
              if (frameRequest === 0) frameRequest = requestAnimationFrame(syncRow)
            }
            observer = new MutationObserver(schedule)
            observer.observe(document.body, { childList: true, subtree: true })
            syncRow()
          }

          return () => {
            if (observer !== null) observer.disconnect()
            if (frameRequest !== 0) cancelAnimationFrame(frameRequest)
            tag.remove()
            delete root.dataset.thinkingFx
            delete root.dataset.thinkingFxText
            for (const [name] of vars) root.style.removeProperty(name)
          }
        }, `${PLUGIN}: running-tail`)
      },
    }

    return module.exports
  },
})
