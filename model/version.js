import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { IS_YUNZAI } from './plugin-base.js'

/** 插件名（显示在图片页脚、更新提示里） */
export const PLUGIN_NAME = 'gacha-plugin'

/** 插件版本号（发版时改这里，页脚会自动跟着变） */
export const VERSION = '1.5.5'

/** 仓库地址（更新日志末尾显示） */
export const REPO_URL = 'https://github.com/ll-cn/gacha-plugin.git'

const require = createRequire(import.meta.url)
const PLUGIN_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 云崽各分支的显示名（与 miao-plugin 同一套口径） */
const YUNZAI_NAMES = {
  'trss-yunzai': 'TRSS-Yunzai',
  'miao-yunzai': 'Miao-Yunzai',
  'mangocat-yunzai': 'MangoCat-Yunzai',
  'a-yunzai': 'A-Yunzai',
  'yunzai-bot': 'Yunzai-Bot'
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

/** 云崽根目录：插件在 <根>/plugins/<插件名> 下，往上两级就是根 */
function yunzaiPackage() {
  for (const dir of [path.join(PLUGIN_ROOT, '..', '..'), process.cwd()]) {
    const pkg = readJson(path.join(dir, 'package.json'))
    if (pkg?.name && /-?yunzai$/i.test(String(pkg.name))) return pkg
  }
  return null
}

/** alemonjs 版本：先走模块解析，再逐层找 node_modules */
function alemonVersion() {
  try {
    const v = require('alemonjs/package.json')?.version
    if (v) return String(v)
  } catch {
    /* 继续往下找 */
  }
  let dir = PLUGIN_ROOT
  for (let i = 0; i < 5; i += 1) {
    const pkg = readJson(path.join(dir, 'node_modules', 'alemonjs', 'package.json'))
    if (pkg?.version) return String(pkg.version)
    dir = path.dirname(dir)
  }
  return ''
}

/** 当前运行的框架；识别不出来就是 null（页脚只显示插件版本） */
const framework = (() => {
  if (IS_YUNZAI) {
    const pkg = yunzaiPackage()
    if (pkg?.version) {
      const key = String(pkg.name).toLowerCase()
      return { name: YUNZAI_NAMES[key] || pkg.name, version: String(pkg.version) }
    }
  }
  const version = alemonVersion()
  if (version) return { name: 'ALemonJS', version }
  return null
})()

/** 框架名（没识别出来返回空串） */
export function frameworkName() {
  return framework?.name || ''
}

/** 框架版本（没识别出来返回空串） */
export function frameworkVersion() {
  return framework?.version || ''
}

/** 纯文本版本串：TRSS-Yunzai v3.1.3 · gacha-plugin v1.5.2 */
export function versionLine() {
  const head = framework ? `${framework.name} v${framework.version}` : ''
  return [head, `${PLUGIN_NAME} v${VERSION}`].filter(Boolean).join(' · ')
}

/** 带高亮样式的版本串（模板里用 {{@versionHtml}} 输出） */
export function versionHtml() {
  const head = framework
    ? `${framework.name} <span class="ver">v${framework.version}</span> <span class="dot">·</span> `
    : ''
  return `${head}${PLUGIN_NAME} <span class="ver">v${VERSION}</span>`
}
