/**
 * 设置页自检：用假的 React / slots 跑一遍插件，确认
 *   - 注册了 settings.section，id 正确，组件能渲染
 *   - 默认尺寸是 52px / 1.4
 *   - cookie 里的自定义值会覆盖 CONFIG
 *
 * 用法：先 `node serve.mjs`（53901），再 `node verify-settings.mjs`。
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')

const previewDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(previewDir, '..')
const bundle = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage()
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const clearCookies = () =>
  page.evaluate(() => {
    document.cookie = 'thinking_fx_size=; path=/; max-age=0'
    document.cookie = 'thinking_fx_scale=; path=/; max-age=0'
    document.cookie = 'thinking_fx_color=; path=/; max-age=0'
  })

await page.goto('http://127.0.0.1:53901/preview/preview.html?fx=none')
await clearCookies()

await page.evaluate(() => {
  const fakeReact = {
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    createElement: (...args) => ({ args }),
  }
  window.__ModuleLoader__ = {
    load({ factory }) {
      window.__plugin = factory((name) => {
        if (name === 'react') return fakeReact
        throw new Error(`unexpected require(${name})`)
      })
    },
  }
  window.__fakeCtx = {
    effect: (fn) => {
      const dispose = fn()
      window.__lastDispose = dispose
      return dispose
    },
    slots: {
      inject: (name, callback) => {
        window.__slotName = name
        return callback()
      },
      register: (definition, component) => {
        window.__slotDefinition = definition
        window.__slotComponent = component
        return () => {}
      },
    },
  }
})
await page.addScriptTag({ content: bundle })
await page.evaluate(() => window.__plugin.apply(window.__fakeCtx))

const state = await page.evaluate(() => {
  const size = document.documentElement.style.getPropertyValue('--tfx-size')
  const scale = document.documentElement.style.getPropertyValue('--tfx-text-scale')
  let componentOk = false
  let componentError = ''
  try {
    const element = window.__slotComponent()
    const inner = element.args[0]
    inner()
    componentOk = true
  } catch (error) {
    componentError = String(error)
  }
  return {
    slot: window.__slotName,
    id: window.__slotDefinition?.id,
    name: window.__slotDefinition?.name,
    label: window.__slotDefinition?.label?.(),
    size,
    scale,
    componentOk,
    componentError,
  }
})

check('slot name', state.slot === 'settings.section', state.slot)
check('section name', state.name === 'settings.section', state.name)
check('section id', state.id === 'thinking-fx', state.id)
check('section label', state.label === '深度思考表情包', state.label)
check('default size', state.size === '52px', state.size)
check('default text scale', state.scale === '1.4', state.scale)
check('settings component renders', state.componentOk, state.componentError)

await page.evaluate(() => {
  document.cookie = 'thinking_fx_size=64; path=/'
  document.cookie = 'thinking_fx_scale=1.6; path=/'
  window.__plugin.apply(window.__fakeCtx)
})
const custom = await page.evaluate(() => ({
  size: document.documentElement.style.getPropertyValue('--tfx-size'),
  scale: document.documentElement.style.getPropertyValue('--tfx-text-scale'),
}))
check('stored size wins', custom.size === '64px', custom.size)
check('stored scale wins', custom.scale === '1.6', custom.scale)

await page.evaluate(() => {
  window.__lastDispose?.()
  document.cookie = 'thinking_fx_color=ff3366; path=/'
  window.__plugin.apply(window.__fakeCtx)
})
const colored = await page.evaluate(() => {
  const row = document.querySelector('[data-chat-running]')
  const tag = document.querySelector('style[data-plugin-css="dsh-thinking-fx/custom-color.css"]')
  return {
    rule: tag?.textContent ?? '',
    value: row ? getComputedStyle(row).getPropertyValue('--dsw-alias-label-deep-diving').trim() : '',
  }
})
check('color tag applied', colored.rule.includes('#ff3366'), colored.rule.slice(0, 80))
check('row color token', colored.value === '#ff3366', colored.value)

await page.evaluate(() => {
  window.__lastDispose?.()
  document.cookie = 'thinking_fx_color=; path=/; max-age=0'
  window.__plugin.apply(window.__fakeCtx)
})
const resetColor = await page.evaluate(
  () => document.querySelector('style[data-plugin-css="dsh-thinking-fx/custom-color.css"]') === null,
)
check('color tag removed', resetColor)

await clearCookies()
await browser.close()
console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAIL`)
process.exit(failures.length === 0 ? 0 : 1)
