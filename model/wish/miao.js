import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = path.join(__dirname, '..', '..')

/** 头像文件名优先级：脸图最贴合圆形卡片 */
const FILES = ['face.webp', 'face.png', 'card.webp', 'card.png', 'gacha.webp']

/** 角色图库可能的根目录（云崽与 alemon 两种目录结构都试一遍） */
function baseDirs() {
  const roots = []
  const push = v => {
    if (!v) return
    const p = path.resolve(v)
    if (!roots.includes(p)) roots.push(p)
  }

  push(process.env.GACHA_MIAO)
  let dir = PLUGIN_ROOT
  for (let i = 0; i < 4; i += 1) {
    dir = path.dirname(dir)
    push(dir)
  }
  push(process.cwd())
  return roots
}

const REL = [
  'miao-plugin/resources/meta-gs/character',
  'plugins/miao-plugin/resources/meta-gs/character',
  'data/miao-plugin/resources/meta-gs/character',
  'Yunzai/plugins/miao-plugin/resources/meta-gs/character',
  'Yunzai/data/miao-plugin/resources/meta-gs/character',
  'lolomi-calc/resources/meta-gs/character',
  'plugins/lolomi-calc/resources/meta-gs/character'
]

let cache
function charDir() {
  if (cache !== undefined) return cache
  cache = ''
  for (const base of baseDirs()) {
    for (const rel of REL) {
      const dir = path.join(base, rel)
      try {
        if (fs.existsSync(path.join(dir, 'data.json'))) {
          cache = dir
          return cache
        }
      } catch {
        /* 换下一个 */
      }
    }
  }
  return cache
}

const faces = new Map()

/** 本地角色头像（file:// 地址），找不到返回空串 */
export function faceOf(name) {
  const key = String(name || '').trim()
  if (!key) return ''
  if (faces.has(key)) return faces.get(key)

  let src = ''
  const dir = charDir()
  if (dir) {
    for (const file of FILES) {
      const full = path.join(dir, key, 'imgs', file)
      try {
        if (fs.existsSync(full)) {
          src = pathToFileURL(full).href
          break
        }
      } catch {
        /* 换下一个 */
      }
    }
  }

  faces.set(key, src)
  return src
}

const weapons = new Map()
let weaponRoot

/** 图库里武器是按类型分目录放的：weapon/<bow|catalyst|...>/<名字>/icon.webp */
function weaponDirs() {
  if (weaponRoot !== undefined) return weaponRoot

  weaponRoot = []
  const dir = charDir()
  const base = dir ? path.join(path.dirname(dir), 'weapon') : ''
  if (!base) return weaponRoot

  try {
    for (const name of fs.readdirSync(base)) {
      const full = path.join(base, name)
      try {
        if (fs.statSync(full).isDirectory()) weaponRoot.push(full)
      } catch {
        /* 忽略 */
      }
    }
  } catch {
    /* 没有武器图库 */
  }
  return weaponRoot
}

/** 本地武器图标（file:// 地址），找不到返回空串 */
export function weaponIconOf(name) {
  const key = String(name || '').trim()
  if (!key) return ''
  if (weapons.has(key)) return weapons.get(key)

  let src = ''
  for (const dir of weaponDirs()) {
    for (const file of ['icon.webp', 'icon.png']) {
      const full = path.join(dir, key, file)
      try {
        if (fs.existsSync(full)) {
          src = pathToFileURL(full).href
          break
        }
      } catch {
        /* 换下一个 */
      }
    }
    if (src) break
  }

  weapons.set(key, src)
  return src
}

/** 本地图库是否可用 */
export function hasLocalFaces() {
  return Boolean(charDir())
}
