import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 云崽根目录候选：插件在 <根>/plugins/<插件名> 或 alemon 的 packages 下 */
function rootDirs() {
  const cwd = process.cwd()
  const list = [
    path.join(PLUGIN_ROOT, '..', '..'),
    path.join(cwd, 'Yunzai'),
    cwd,
    path.join(PLUGIN_ROOT, '..', '..', 'Yunzai')
  ]
  const out = []
  for (const dir of list) {
    const p = path.resolve(dir)
    if (!out.includes(p)) out.push(p)
  }
  return out
}

/** 逍遥的绑定数据：plugins/xiaoyao-cvs-plugin/data/yaml/<QQ>.yaml */
function xiaoyaoYaml(qq) {
  for (const root of rootDirs()) {
    const file = path.join(root, 'plugins', 'xiaoyao-cvs-plugin', 'data', 'yaml', `${qq}.yaml`)
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
    } catch {
      /* 换下一个 */
    }
  }
  return ''
}

/**
 * 从逍遥的 yaml 里挑原神 UID（星铁的块要跳过）。
 * 文件按 UID 分块：`"110961805":` → 下一行起是 stuid/uid/region…
 */
function pickUid(text) {
  if (!text) return ''
  const blocks = text.split(/\n(?="?\d{6,12}"?:\s*$)/m)
  for (const block of blocks) {
    const uid = (block.match(/^\s*"?uid"?:\s*"?(\d{6,12})"?\s*$/m) || [])[1]
    if (!uid) continue
    const region = (block.match(/^\s*"?region"?:\s*"?([\w-]+)"?\s*$/m) || [])[1] || ''
    const regionName = (block.match(/^\s*"?region_name"?:\s*"?([^"\n]+)"?\s*$/m) || [])[1] || ''
    if (/^(prod_|dev_)/.test(region)) continue
    if (/星穹|列车/.test(regionName)) continue
    return uid
  }
  return ''
}

/** 读 redis 里的绑定（云崽进程内才有全局 redis） */
async function fromRedis(qq) {
  const client = globalThis.redis
  if (!client?.get) return ''
  for (const key of [`miao:user-cfg:${qq}`, `genshin:user-cfg:${qq}`]) {
    try {
      const raw = await client.get(key)
      if (!raw) continue
      const uid = String(JSON.parse(raw)?.uid ?? '')
      if (/^\d{6,12}$/.test(uid)) return uid
    } catch {
      /* 换下一个键 */
    }
  }
  return ''
}

const cache = new Map()
const TTL = 5 * 60 * 1000

/** 取玩家绑定的原神 UID（取不到返回空串） */
export async function gameUidOf(qq) {
  const id = String(qq || '').trim()
  if (!/^\d{5,15}$/.test(id)) return ''

  const hit = cache.get(id)
  if (hit && Date.now() - hit.at < TTL) return hit.uid

  let uid = pickUid(xiaoyaoYaml(id))
  if (!uid) uid = await fromRedis(id)

  cache.set(id, { uid, at: Date.now() })
  return uid
}
