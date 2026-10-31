import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startScheduler } from './model/wish/banner.js'

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.join(PLUGIN_DIR, 'app')

/**
 * 老版本把抽卡数据放在 DPS-plugin/data/wish 下，拆分后第一次启动时搬过来。
 * 只在本地还没有数据时搬，之后一律用新目录。
 */
function migrateOldData() {
  const target = path.join(PLUGIN_DIR, 'data', 'wish')
  if (fs.existsSync(target)) return

  const pluginsDir = path.join(PLUGIN_DIR, '..')
  let names = []
  try {
    names = fs.readdirSync(pluginsDir)
  } catch {
    return
  }

  for (const name of names) {
    if (name === path.basename(PLUGIN_DIR)) continue
    const old = path.join(pluginsDir, name, 'data', 'wish')
    if (!fs.existsSync(old)) continue
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.cpSync(old, target, { recursive: true })
      logger?.mark?.(`[抽卡插件] 已从 ${name} 迁移抽卡数据（记录 / 卡池）`)
    } catch (err) {
      logger?.warn?.(`[抽卡插件] 迁移抽卡数据失败：${err?.message ?? err}`)
    }
    return
  }
}

migrateOldData()

let files = []
try {
  files = fs.readdirSync(APP_DIR).filter(f => f.endsWith('.js'))
} catch (err) {
  logger?.error?.(`[抽卡插件] 读取 app 目录失败：${APP_DIR} —— ${err?.message ?? err}`)
}

const results = await Promise.allSettled(
  files.map(f => import(pathToFileURL(path.join(APP_DIR, f)).href))
)

const apps = {}
files.forEach((file, i) => {
  const name = file.replace(/\.js$/, '')
  const r = results[i]
  if (r.status !== 'fulfilled') {
    logger?.error?.(`[抽卡插件] 载入插件失败：${file}`)
    logger?.error?.(r.reason)
    return
  }
  const mod = r.value ?? {}
  const cls = mod.default ?? mod[Object.keys(mod)[0]]
  if (typeof cls === 'function') apps[name] = cls
  else logger?.warn?.(`[抽卡插件] ${file} 里没有找到插件类，已跳过`)
})

/** 卡池后台同步（app 里的几个文件负责指令） */
try {
  startScheduler()
} catch (err) {
  logger?.warn?.(`[抽卡插件] 卡池定时刷新启动失败：${err?.message ?? err}`)
}

export { apps }
