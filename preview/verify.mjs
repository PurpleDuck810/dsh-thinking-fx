/**
 * 集成自检：把真正会被 /plugins 提供的 lib/client.js 塞进一个和官方 DOM 同构的
 * 页面里，用假的 __ModuleLoader__ / ctx 跑一遍 apply()，然后断言：
 *   - 根属性与样式表已挂上
 *   - 原版鲸鱼的两个子节点被 display:none
 *   - 图标盒实际尺寸 = CONFIG.iconSize
 *   - glyph 的 mask 真的生效、颜色跟随 currentColor
 *   - 每次「运行状态行」重新出现都会抽一张，且不连着重复
 *   - 抽中的动画（WebP 自身）在动
 *   - dispose 后一切还原
 *
 * 用法：先 `node serve.mjs`（53901），再 `node verify.mjs`。
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

const previewDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(previewDir, '..')
const url = 'http://127.0.0.1:53901/preview/preview.html?fx=none'
const bundle = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 160 }, deviceScaleFactor: 2 })

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

await page.goto(url)
await page.waitForTimeout(300)

await page.evaluate(() => {
  window.__ModuleLoader__ = {
    load({ id, factory }) {
      window.__loadedId = id
      window.__plugin = factory((name) => {
        throw new Error(`unexpected require(${name})`)
      })
    },
  }
})
await page.addScriptTag({ content: bundle })
await page.evaluate(() => {
  window.__plugin.apply({
    effect: (fn) => {
      const dispose = fn()
      window.__dispose = dispose
      return dispose
    },
  })
})
await page.waitForTimeout(200)

const read = () =>
  page.evaluate(() => {
    const root = document.documentElement
    const row = document.querySelector('[data-chat-running]')
    const icon = document.querySelector('[data-chat-running] [class*="_runningIcon"]')
    const animated = document.querySelector('[class*="_runningWhaleAnimated"]')
    const still = document.querySelector('[class*="_runningWhaleStill"]')
    const before = getComputedStyle(icon, '::before')
    const rect = icon.getBoundingClientRect()
    return {
      id: window.__loadedId,
      fx: root.dataset.thinkingFx,
      text: root.dataset.thinkingFxText,
      size: root.style.getPropertyValue('--tfx-size'),
      textScale: root.style.getPropertyValue('--tfx-text-scale'),
      fontSize: getComputedStyle(row).fontSize,
      lineHeight: getComputedStyle(row).lineHeight,
      hasStyle: document.querySelector('style[data-plugin="dsh-thinking-fx"]') !== null,
      animatedDisplay: getComputedStyle(animated).display,
      stillDisplay: getComputedStyle(still).display,
      iconWidth: Math.round(rect.width * 10) / 10,
      iconHeight: Math.round(rect.height * 10) / 10,
      background: before.backgroundColor,
      mask: (before.maskImage || before.webkitMaskImage || '').slice(0, 40),
      frame: row?.dataset.tfxFrame ?? null,
      rowGlyph: row?.style.getPropertyValue('--tfx-glyph').slice(0, 30) ?? '',
      animation: before.animationName,
    }
  })

const first = await read()
check('module id', first.id === 'dsh-thinking-fx', first.id)
check('root preset attr', first.fx === 'glyph', String(first.fx))
check('root text attr', first.text === 'keep', String(first.text))
check('size var', first.size === '52px', first.size)
check('text scale var', first.textScale === '1.4', first.textScale)
check('row font scaled', parseFloat(first.fontSize) > 16, `${first.fontSize} / ${first.lineHeight}`)
check('style injected', first.hasStyle === true)
check('shipped whale hidden', first.animatedDisplay === 'none' && first.stillDisplay === 'none', `${first.animatedDisplay}/${first.stillDisplay}`)
check('icon size 52px', first.iconWidth === 52 && first.iconHeight === 52, `${first.iconWidth}x${first.iconHeight}`)
check('pseudo uses currentColor', first.background === 'rgb(111, 150, 255)', first.background)
check('frame mask is animated webp', first.mask.startsWith('url("data:image/webp;base64,'), first.mask)
check('row has picked frame', first.frame !== null && /^[0-4]$/.test(first.frame), String(first.frame))
check('row glyph var set', first.rowGlyph.startsWith('url("data:image/webp'), first.rowGlyph)

const row = page.locator('#row')
await row.screenshot({ path: path.join(previewDir, 'random-a.png') })
await page.waitForTimeout(1200)
await row.screenshot({ path: path.join(previewDir, 'random-b.png') })
const shotA = fs.readFileSync(path.join(previewDir, 'random-a.png'))
const shotB = fs.readFileSync(path.join(previewDir, 'random-b.png'))
check('glyph animation advances', !shotA.equals(shotB), `${shotA.length} vs ${shotB.length}`)

// 模拟下一轮：运行状态行被卸载后重新挂载（克隆一份新节点，身份变了）
await page.evaluate(() => {
  const old = document.querySelector('#row')
  const next = old.cloneNode(true)
  old.replaceWith(next)
})
await page.waitForTimeout(250)
const second = await read()
check('new run re-picks', second.frame !== first.frame, `${first.frame} -> ${second.frame}`)

await page.evaluate(() => window.__dispose())
await page.waitForTimeout(100)
const after = await page.evaluate(() => ({
  fx: document.documentElement.dataset.thinkingFx ?? null,
  style: document.querySelector('style[data-plugin="dsh-thinking-fx"]') !== null,
  stillDisplay: getComputedStyle(document.querySelector('[class*="_runningWhaleStill"]')).display,
  animatedDisplay: getComputedStyle(document.querySelector('[class*="_runningWhaleAnimated"]')).display,
}))
check('dispose removes attribute', after.fx === null, String(after.fx))
check('dispose removes style', after.style === false)
check(
  'dispose restores shipped whale',
  after.animatedDisplay !== 'none' || after.stillDisplay !== 'none',
  `animated=${after.animatedDisplay} still=${after.stillDisplay}`,
)

await browser.close()
console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAIL`)
process.exit(failures.length === 0 ? 0 : 1)
