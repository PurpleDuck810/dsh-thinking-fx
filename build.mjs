/**
 * 把 lib/thinking-fx.css 和五张动画 glyph（含静态帧）内联进 src/client.js，
 * 产出真正被 /plugins 提供的 lib/client.js。client bundle 必须自成一体
 * （不能 import 资源），所以拼装都在这里做。
 * 改 CSS、CONFIG 或换素材后重跑：`node build.mjs`
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const cssPath = path.join(here, 'lib/thinking-fx.css')
const glyphPaths = [0, 1, 2, 3, 4].map((i) => path.join(here, `assets/glyph-${i}.webp`))
const stillPaths = [0, 1, 2, 3, 4].map((i) => path.join(here, `assets/still-${i}.png`))
const srcPath = path.join(here, 'src/client.js')
const outPath = path.join(here, 'lib/client.js')

const css = fs.readFileSync(cssPath, 'utf8')
const frames = `[${glyphPaths
  .map((p) => JSON.stringify(`data:image/webp;base64,${fs.readFileSync(p).toString('base64')}`))
  .join(', ')}]`
const stills = `[${stillPaths
  .map((p) => JSON.stringify(`data:image/png;base64,${fs.readFileSync(p).toString('base64')}`))
  .join(', ')}]`
const source = fs.readFileSync(srcPath, 'utf8')

if (!source.includes('/*__INLINE_CSS__*/')) throw new Error('CSS marker missing in src/client.js')
if (!source.includes('__GLYPH_FRAMES__')) throw new Error('frames marker missing in src/client.js')
if (!source.includes('__GLYPH_STILLS__')) throw new Error('stills marker missing in src/client.js')

const escaped = css
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${')

const out = source
  .replace('/*__INLINE_CSS__*/', () => escaped)
  .replace('__GLYPH_FRAMES__', () => frames)
  .replace('__GLYPH_STILLS__', () => stills)

fs.writeFileSync(outPath, out)
console.log(
  `built ${path.relative(here, outPath)} (${out.length} chars; css ${css.length}, frames ${frames.length}, stills ${stills.length})`,
)
