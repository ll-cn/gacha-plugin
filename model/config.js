import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CONFIG_FILE = path.join(__dirname, '..', 'config', 'config.yaml')

const DEFAULTS = {
  imageScale: 2,
  jpegQuality: 90,
  textOnly: false,
  timeout: 25000,
  dailyLimit: 10,
  refreshMinutes: 360,
  pityTip: true,
  recallNoGold: 8
}

/** 配置文件缺失/为空时写回的默认内容 */
const DEFAULT_YAML = `# ===================== 抽卡插件配置 =====================
# 改完保存即时生效（每次抽卡会检查文件是否变动，不用重启）。
# 删掉本文件后，下次抽卡会自动重新生成这份默认配置。

# 配置版本（插件用它自动升级配置项，一般不用管）
configVersion: 1

# 出图清晰度倍数（1=原尺寸；2=两倍像素，手机上更清晰，图也更大）
imageScale: 2

# 出图质量（0-100，越低图越小）
jpegQuality: 90

# 只发文字不发图（默认关闭）
textOnly: false

# ===================== 模拟抽卡 =====================

# 拉取卡池公告 / 角色资料的单次请求超时（毫秒）
timeout: 25000

# 每人每天可抽次数，一次十连算 1 次（0 = 不限制）
dailyLimit: 10

# 卡池自动刷新间隔（分钟，0 = 只在启动和卡池过期时刷新）
refreshMinutes: 360

# 抽卡卡片底部是否显示保底进度
pityTip: true

# 没出五星（金）时，抽卡结果自动撤回（秒；0 = 不撤回，最高 120）
recallNoGold: 8
`

export const CONFIG = { ...DEFAULTS }

let yamlLib
try {
  yamlLib = (await import('yaml')).default
} catch {
  yamlLib = null
}

function posNum(v, def) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : def
}

/** 允许 0 的正整数（0 = 关闭限次 / 关闭定时刷新） */
function zeroNum(v, def) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def
}

/** 生成默认配置文件（缺失或空文件时） */
function ensureConfigFile() {
  try {
    if (fs.existsSync(CONFIG_FILE) && fs.statSync(CONFIG_FILE).size > 0) return
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
    fs.writeFileSync(CONFIG_FILE, DEFAULT_YAML, 'utf8')
    globalThis.logger?.mark?.(`[抽卡插件] 配置文件不存在，已生成默认配置：${CONFIG_FILE}`)
  } catch (err) {
    globalThis.logger?.warn?.(`[抽卡插件] 生成默认配置失败：${err?.message ?? err}`)
  }
}

/** 把默认配置拆成「键 + 上面的注释」块 */
function splitBlocks(text) {
  const out = []
  let pending = []
  let cur = null
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):/)
    if (m) {
      if (cur) out.push(cur)
      cur = { key: m[1], lines: [...pending, line] }
      pending = []
    } else if (/^#/.test(line)) {
      pending.push(line)
    } else if (cur && line.trim()) {
      cur.lines.push(line)
    }
  }
  if (cur) out.push(cur)
  return out.map(b => ({ key: b.key, text: b.lines.join('\n').replace(/\s+$/, '') }))
}

/** 配置模板版本：调整默认值 / 加新键时 +1 */
const CONFIG_VERSION = 1

/** 把默认配置里新增的键补进用户配置（保留用户已有内容与注释） */
function syncConfigFile() {
  try {
    const text = fs.readFileSync(CONFIG_FILE, 'utf8')
    const oldVer = Number((text.match(/^configVersion:\s*(\d+)/m) || [])[1] || 1)
    let out = text
    const notes = []

    const have = new Set([...out.matchAll(/^([A-Za-z_][\w-]*):/gm)].map(m => m[1]))
    const missing = splitBlocks(DEFAULT_YAML).filter(b => !have.has(b.key))
    if (missing.length) {
      out = `${out.replace(/\s+$/, '')}\n\n${missing.map(b => b.text).join('\n\n')}\n`
      notes.push(`新增 ${missing.map(b => b.key).join('、')}`)
    }

    if (oldVer < CONFIG_VERSION) {
      if (/^configVersion:\s*\d+/m.test(out)) {
        out = out.replace(/^configVersion:\s*\d+/m, `configVersion: ${CONFIG_VERSION}`)
      } else {
        out = `configVersion: ${CONFIG_VERSION}\n${out}`
      }
      notes.push(`配置版本 v${oldVer} → v${CONFIG_VERSION}`)
    }

    if (out === text) return
    fs.writeFileSync(CONFIG_FILE, out, 'utf8')
    globalThis.logger?.mark?.(`[抽卡插件] 已升级配置：${notes.join('；')}`)
  } catch (err) {
    globalThis.logger?.warn?.(`[抽卡插件] 合并默认配置失败：${err?.message ?? err}`)
  }
}

let lastMtime = -1

export function loadConfig(force = false) {
  if (!fs.existsSync(CONFIG_FILE) || fs.statSync(CONFIG_FILE).size === 0) {
    ensureConfigFile()
    force = true
  }

  let mtime = 0
  try {
    mtime = fs.statSync(CONFIG_FILE).mtimeMs
  } catch {
    mtime = 0
  }
  if (!force && mtime === lastMtime) return
  lastMtime = mtime

  syncConfigFile()

  let raw = {}
  if (yamlLib && mtime) {
    try {
      raw = yamlLib.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) ?? {}
    } catch (err) {
      globalThis.logger?.warn?.(`[抽卡插件] config.yaml 解析失败，改用默认配置：${err?.message ?? err}`)
      raw = {}
    }
  }

  CONFIG.imageScale = Math.min(3, Math.max(1, Number(raw.imageScale) || DEFAULTS.imageScale))
  CONFIG.jpegQuality = Math.min(
    100,
    Math.max(30, Math.floor(posNum(raw.jpegQuality, DEFAULTS.jpegQuality)))
  )
  CONFIG.textOnly = raw.textOnly === true || raw.textOnly === 'true'
  CONFIG.timeout = posNum(raw.timeout, DEFAULTS.timeout)
  CONFIG.dailyLimit = zeroNum(raw.dailyLimit, DEFAULTS.dailyLimit)
  CONFIG.refreshMinutes = zeroNum(raw.refreshMinutes, DEFAULTS.refreshMinutes)
  CONFIG.pityTip = raw.pityTip !== false && raw.pityTip !== 'false'
  CONFIG.recallNoGold = Math.min(120, zeroNum(raw.recallNoGold, DEFAULTS.recallNoGold))
}

/** 是否强制纯文字输出（config.yaml 的 textOnly 开关，默认关） */
export function needTextOnly() {
  return CONFIG.textOnly === true
}

/** YAML 标量：能裸写就裸写，否则用 JSON 双引号（JSON 字符串是合法 YAML） */
function yamlScalar(v) {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  const s = String(v ?? '')
  return /^[\w\u4e00-\u9fa5][\w\u4e00-\u9fa5./-]*$/.test(s) ? s : JSON.stringify(s)
}

/** 单个配置项的 YAML 文本（对象按缩进展开） */
function blockText(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const lines = Object.entries(value).map(([k, v]) => `  ${yamlScalar(k)}: ${yamlScalar(v)}`)
    return lines.length ? `${key}:\n${lines.join('\n')}` : `${key}: {}`
  }
  return `${key}: ${yamlScalar(value)}`
}

/** 把配置项写回 config.yaml（保留注释与顺序），然后立即重载 */
export function updateConfig(patch = {}) {
  try {
    let text = ''
    try {
      text = fs.readFileSync(CONFIG_FILE, 'utf8')
    } catch {
      text = ''
    }
    if (!text.trim()) text = DEFAULT_YAML

    const defaults = new Map(splitBlocks(DEFAULT_YAML).map(b => [b.key, b.text]))

    for (const [key, value] of Object.entries(patch)) {
      if (key === 'configVersion' || !/^[A-Za-z_][\w-]*$/.test(key)) continue
      const next = blockText(key, value)
      const re = new RegExp(`^${key}:[^\\n]*(?:\\n[ \\t]+[^\\n]*)*`, 'm')

      if (re.test(text)) {
        text = text.replace(re, next)
        continue
      }
      const def = defaults.get(key)
      const body = `${text.replace(/\s+$/, '')}\n\n`
      text =
        def && !(value && typeof value === 'object')
          ? `${body}${def.replace(new RegExp(`^${key}:.*$`, 'm'), next)}\n`
          : `${body}${next}\n`
    }

    fs.writeFileSync(CONFIG_FILE, text, 'utf8')
    loadConfig(true)
    return true
  } catch (err) {
    globalThis.logger?.warn?.(`[抽卡插件] 保存配置失败：${err?.message ?? err}`)
    return false
  }
}

ensureConfigFile()
loadConfig(true)
