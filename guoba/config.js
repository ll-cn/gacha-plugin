import { CONFIG, loadConfig, updateConfig } from '../model/config.js'

/** 数值项：[最小, 最大, 默认] */
const NUM_FIELDS = {
  timeout: [5000, 60000, 25000],
  dailyLimit: [0, 100, 10],
  refreshMinutes: [0, 1440, 360],
  recallNoGold: [0, 120, 8],
  jpegQuality: [30, 100, 90]
}

const BOOL_FIELDS = ['textOnly', 'pityTip', 'hundredDraw']

function toNum(v, min, max, def) {
  const n = Number(v)
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, Math.floor(n)))
}

/** 面板读取：返回与 schema 字段同名的对象 */
export async function getConfigData() {
  loadConfig()
  return {
    imageScale: CONFIG.imageScale,
    jpegQuality: CONFIG.jpegQuality,
    textOnly: CONFIG.textOnly,
    timeout: CONFIG.timeout,
    dailyLimit: CONFIG.dailyLimit,
    refreshMinutes: CONFIG.refreshMinutes,
    pityTip: CONFIG.pityTip,
    recallNoGold: CONFIG.recallNoGold,
    hundredDraw: CONFIG.hundredDraw
  }
}

/** 面板保存：校验后写回 config.yaml，并立即生效 */
export async function setConfigData(data, { Result }) {
  if (!data || typeof data !== 'object') return Result.error('没有收到配置数据')

  const patch = {}
  for (const [key, [min, max, def]] of Object.entries(NUM_FIELDS)) {
    const v = data[key]
    if (v === undefined || v === null || v === '') continue
    patch[key] = toNum(v, min, max, def)
  }

  const scale = Number(data.imageScale)
  if (data.imageScale !== undefined && Number.isFinite(scale)) {
    patch.imageScale = Math.min(3, Math.max(1, Math.round(scale)))
  }

  for (const key of BOOL_FIELDS) {
    if (data[key] === undefined || data[key] === null) continue
    patch[key] = data[key] === true || data[key] === 'true'
  }

  const count = Object.keys(patch).length
  if (!count) return Result.error('没有可保存的配置项')
  if (!updateConfig(patch)) return Result.error('写入 config/config.yaml 失败，请查看机器人日志')

  return Result.ok(`已保存 ${count} 项，即时生效`)
}
