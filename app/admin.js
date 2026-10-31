import plugin from '../../../lib/plugins/plugin.js'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { loadConfig } from '../model/config.js'
import { log } from '../model/log.js'
import { PLUGIN_NAME as PKG_NAME, VERSION, REPO_URL } from '../model/version.js'
import { PLUGIN_ROOT, PLUGIN_DIR_NAME } from '../model/render.js'

const execFileAsync = promisify(execFile)
const DISPLAY_NAME = '抽卡插件'

/** 正在更新中（防止并发 pull） */
let updating = false

/** 取当前 git 短提交号；不是 git 仓库时返回空串 */
async function gitShortRev() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: PLUGIN_ROOT,
      timeout: 15000
    })
    return stdout.trim()
  } catch {
    return ''
  }
}

/** 可以当仓库根目录用（有 .git 才算） */
function isGitRepo() {
  try {
    return fs.existsSync(path.join(PLUGIN_ROOT, '.git'))
  } catch {
    return false
  }
}

/**
 * config.yaml 是插件自己会改的文件（配置迁移 / 锅巴保存），
 * pull 前把内容抽出来、工作区恢复成 HEAD，避免「本地改动会被覆盖」导致更新失败
 */
async function takeConfigAside() {
  const abs = path.join(PLUGIN_ROOT, 'config', 'config.yaml')
  let text = null
  try {
    text = fs.readFileSync(abs, 'utf8')
  } catch {
    return null
  }
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--', 'config/config.yaml'], {
      cwd: PLUGIN_ROOT,
      timeout: 15000
    })
    if (stdout.trim()) {
      await execFileAsync('git', ['checkout', '--', 'config/config.yaml'], {
        cwd: PLUGIN_ROOT,
        timeout: 15000
      })
    }
  } catch {
    /* 不是 git 仓库之类：交给后面的 pull 去报错 */
  }
  return text
}

/** 把抽走的配置写回（更新后文件可能被 pull 删掉或改写） */
function putConfigBack(text) {
  if (text === null || text === undefined) return
  try {
    fs.mkdirSync(path.join(PLUGIN_ROOT, 'config'), { recursive: true })
    fs.writeFileSync(path.join(PLUGIN_ROOT, 'config', 'config.yaml'), text, 'utf8')
  } catch {
    /* 写不回去也不该让更新失败 */
  }
}

/** 比较配置内容时忽略换行符差异（git 存 LF，Windows 工作区是 CRLF） */
function normCfg(s) {
  return String(s ?? '').replace(/\r\n/g, '\n').trim()
}

/** 深比较用的稳定序列化（键排序，忽略书写顺序） */
function stableJson(v) {
  if (Array.isArray(v)) return v.map(stableJson)
  if (v && typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v).sort()) o[k] = stableJson(v[k])
    return o
  }
  return v
}

/** 两份配置是否等价（文本一致，或解析后内容一致 —— 注释/顺序不同不算改过） */
async function sameCfg(a, b) {
  if (normCfg(a) === normCfg(b)) return true
  try {
    const yaml = (await import('yaml')).default
    return JSON.stringify(stableJson(yaml.parse(a) ?? {})) ===
      JSON.stringify(stableJson(yaml.parse(b) ?? {}))
  } catch {
    return false
  }
}

/** 更新失败回执：原因 + git 原始输出 + 下一步（对齐云崽自带 #更新 的样式） */
function updateFailMsg({ force, cmdText, detail, before, reason }) {
  const lines = String(detail || '')
    .split('\n')
    .map(l => l.replace(/\s+$/, ''))
    .filter(l => l.trim())
    .filter(l => !/^\s*(From|来自)\s/i.test(l))
  const remote = (String(detail).match(/\b[0-9a-f]{6,40}\.\.([0-9a-f]{6,40})\b/) || [])[1] || ''
  const body = lines.slice(0, 14).map(l => l.slice(0, 160))
  if (lines.length > body.length) body.push('…')
  if (!body.length) body.push('（git 没有任何输出）')

  return [
    `😵 ${force ? '强制更新' : '更新'}失败：${reason}`,
    `Command failed: ${cmdText}`,
    `来自 ${REPO_URL}`,
    ...body,
    '',
    `更新 ${before || '（未知）'}..${remote || '最新'}`,
    force
      ? '若仍失败，检查机器人的网络与磁盘权限'
      : '若修改过文件请手动更新，否则发送 #抽卡插件强制更新'
  ].join('\n')
}

/** 把 git 的报错翻译成一句人话 + 建议 */
function gitFailReason(detail) {
  const d = String(detail || '')
  const hit = (re, reason, tip) => (re.test(d) ? { reason, tip } : null)

  return (
    hit(/Could not resolve host|Failed to connect|Connection timed out|CONNECTTIMEOUT|Network is unreachable/i, '连不上 GitHub（网络或代理不通）', '检查机器人的网络/代理后重试。') ||
    hit(/Authentication failed|could not read Username|terminal prompts disabled|Permission to .* denied|403 Forbidden/i, 'GitHub 验证失败（凭据失效或没有权限）', '需要在机器人机器上重新配置 GitHub 凭据。') ||
    hit(/Your local changes|would be overwritten|Please commit your changes|not possible to fast-forward|diverged|rejected/i, '本地文件和远程冲突了', '用 #抽卡插件强制更新（会丢弃本地改动，配置会保留）。') ||
    hit(/not a git repository/i, '插件目录不是 git 仓库', '只能删掉重装（git clone）后才能自动更新。') ||
    hit(/SSL|certificate|unable to access/i, 'git 访问 GitHub 失败（SSL/代理）', '检查代理设置或关掉代理再试。') ||
    hit(/No space left|EBUSY|EACCES|Permission denied|Access is denied/i, '磁盘空间不足或没有写权限', '检查磁盘剩余空间和插件目录权限。') ||
    hit(/merge conflict|CONFLICT/i, '合并冲突', '用 #抽卡插件强制更新。') || {
      reason: (d.split('\n').find(l => /fatal|error/i.test(l)) || d.split('\n')[0] || '未知原因')
        .replace(/^\s*(fatal|error):\s*/i, '')
        .slice(0, 120),
      tip: '详细输出见机器人日志。'
    }
  )
}

/**
 * 读 git 提交历史（更新日志）
 * @param {number} limit 最多读多少条
 * @param {string} since 读到这个短提交号为止（只取它之后的，用于「本次更新」）
 */
async function readGitLog(limit = 50, since = '') {
  const { stdout } = await execFileAsync(
    'git',
    ['log', `-${limit}`, '--pretty=%h||[%cd] %s', '--date=format:%F %T'],
    { cwd: PLUGIN_ROOT, timeout: 20000 }
  )
  const out = []
  for (const line of String(stdout ?? '').split('\n')) {
    const [hash, text] = line.split('||')
    if (!hash || !text) continue
    if (since && hash.trim() === since) break
    if (text.includes('Merge branch')) continue
    out.push(text.trim())
  }
  return out
}

/** 构造合并转发消息（云崽 Bot 没这个 API 时自己拼一个） */
function makeForward(msgs) {
  const arr = Array.isArray(msgs) ? msgs : [msgs]
  if (typeof Bot?.makeForwardArray === 'function') return Bot.makeForwardArray(arr)
  return { type: 'node', data: arr.map(message => ({ message })) }
}

/** 发合并转发：标题 + 全部提交（一个气泡）+ 仓库地址；失败回退纯文本 */
export async function replyGitLog(e, title, lines) {
  const msgs = [title, lines.join('\n\n'), REPO_URL]
  try {
    await e.reply(makeForward(msgs))
  } catch (err) {
    log('warn', `合并转发失败，改用纯文本：${err?.message ?? err}`)
    await e.reply(msgs.join('\n'))
  }
}

/** 插件更新 / 更新日志（priority 5，排在抽卡本体前面，先接管 #抽卡插件* 这类指令） */
export class gachaAdmin extends plugin {
  constructor() {
    super({
      name: PKG_NAME,
      dsc: '抽卡插件的更新与日志',
      event: 'message',
      priority: 5,
      rule: [
        { reg: /^[#＃/／]?\s*抽卡插件(更新日志|更新说明|changelog)(?=$|[\s])/i, fnc: 'changelog' },
        { reg: /^[#＃/／]?\s*抽卡插件强制更新(?=$|[\s])/i, fnc: 'forceUpdate' },
        { reg: /^[#＃/／]?\s*抽卡插件(更新|升级|update)(?=$|[\s])/i, fnc: 'update' }
      ]
    })
  }

  /** #抽卡插件更新 —— 从 GitHub 拉取最新代码（git pull） */
  async update(e) {
    return this.pluginUpdate(e, false)
  }

  /** #抽卡插件强制更新 —— 丢弃本地改动，直接对齐远程分支 */
  async forceUpdate(e) {
    return this.pluginUpdate(e, true)
  }

  async pluginUpdate(e, force) {
    loadConfig()

    if (!e.isMaster) {
      await e.reply('更新插件仅限机器人主人。')
      return true
    }
    if (updating) {
      await e.reply('正在更新中，请稍候再试。')
      return true
    }

    if (!fs.existsSync(path.join(PLUGIN_ROOT, '.git'))) {
      await e.reply(
        [
          '😵 这个插件不是用 git 克隆安装的，没法自动更新。',
          `插件目录：${PLUGIN_ROOT}`,
          '',
          '用下面的命令重装一次，之后就能用 #抽卡插件更新 了：',
          `  git clone ${REPO_URL} "${path.join('plugins', PLUGIN_DIR_NAME)}"`
        ].join('\n')
      )
      return true
    }

    updating = true
    try {
      const before = await gitShortRev()

      // 强制更新会丢弃本地改动：先留一份配置，并判断用户有没有改过它
      const cfgFile = path.join(PLUGIN_ROOT, 'config', 'config.yaml')
      let cfgBackup = null
      let cfgUntouched = false
      if (force) {
        try {
          cfgBackup = fs.readFileSync(cfgFile, 'utf8')
        } catch {
          cfgBackup = null
        }
        if (cfgBackup !== null && before) {
          try {
            const { stdout } = await execFileAsync('git', ['show', `${before}:config/config.yaml`], {
              cwd: PLUGIN_ROOT,
              timeout: 15000
            })
            cfgUntouched = await sameCfg(stdout, cfgBackup)
          } catch {
            /* 旧版本没有这个文件，按「改过」处理 */
          }
        }
      }

      // 普通更新：配置是插件自己会改的（配置迁移 / 锅巴保存），先抽走内容再恢复，避免 pull 冲突
      const cfgAside = force ? null : await takeConfigAside()

      let cmdText = 'git pull --ff-only'
      try {
        if (force) {
          const { stdout: br } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: PLUGIN_ROOT,
            timeout: 15000
          })
          const branch = br.trim() || 'main'
          cmdText = `git reset --hard origin/${branch}`
          await execFileAsync('git', ['fetch', '--all', '--prune'], {
            cwd: PLUGIN_ROOT,
            timeout: 60000
          })
          await execFileAsync('git', ['reset', '--hard', `origin/${branch}`], {
            cwd: PLUGIN_ROOT,
            timeout: 30000
          })
        } else {
          await execFileAsync('git', ['pull', '--ff-only'], {
            cwd: PLUGIN_ROOT,
            timeout: 60000
          })
        }
      } catch (err) {
        putConfigBack(cfgAside)
        const detail = String(err?.stderr || err?.stdout || err?.message || err).trim()
        log('error', `更新失败(${force ? '强制' : '普通'})：${detail.slice(0, 600)}｜目录 ${PLUGIN_ROOT}`)
        const { reason } = gitFailReason(detail)
        await e.reply(updateFailMsg({ force, cmdText, detail, before, reason }))
        return true
      }

      // 配置原样写回（pull 可能删掉或改写了它）
      putConfigBack(cfgAside)

      // 用户改过的配置要保留；没改过就用新版默认
      if (cfgBackup !== null && !cfgUntouched) {
        try {
          fs.writeFileSync(cfgFile, cfgBackup)
        } catch {
          /* 忽略 */
        }
      }

      const after = await gitShortRev()
      if (!force && before && after && before === after) {
        await e.reply(`✅ 已是最新版本\n${PKG_NAME} v${VERSION}｜${after}`)
        return true
      }

      await e.reply(
        [
          force
            ? cfgUntouched
              ? '✅ 已强制更新（本地改动已丢弃，配置没改过 → 已同步成新版默认）'
              : '✅ 已强制更新（本地改动已丢弃，你自己改过的配置已保留）'
            : '✅ 更新完成',
          `${before || '（未知）'} → ${after || '（未知）'}`,
          '',
          '★ 重启机器人后新版本才会生效（插件入口是 index.js，不参与热重载）。'
        ].join('\n')
      )
      try {
        const lines = await readGitLog(50, before)
        if (lines.length) await replyGitLog(e, `${DISPLAY_NAME} 本次更新，共 ${lines.length} 条`, lines)
      } catch {
        /* 日志失败不影响更新结果 */
      }
      return true
    } finally {
      updating = false
    }
  }

  /** #抽卡插件更新日志 */
  async changelog(e) {
    loadConfig()

    if (!isGitRepo()) {
      await e.reply(
        [
          '这个插件不是用 git 克隆安装的，读不到更新日志。',
          '用下面的命令重装一次即可：',
          `  git clone ${REPO_URL} "plugins/${PLUGIN_DIR_NAME}"`
        ].join('\n')
      )
      return true
    }

    try {
      const lines = await readGitLog(50)
      if (!lines.length) {
        await e.reply('暂无更新日志。')
        return true
      }
      await replyGitLog(e, `${DISPLAY_NAME} 更新日志，共 ${lines.length} 条`, lines)
    } catch (err) {
      log('error', `读取更新日志失败：${err?.message ?? err}`)
      await e.reply('😵 读取更新日志失败，请查看机器人日志。')
    }
    return true
  }
}

export default gachaAdmin
