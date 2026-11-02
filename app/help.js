import plugin from '../model/plugin-base.js'
import { CONFIG, loadConfig, needTextOnly } from '../model/config.js'
import { TPL_HELP, renderTo, renderFailBrief } from '../model/render.js'
import { sendImage } from '../model/send.js'
import { PLUGIN_NAME, versionLine } from '../model/version.js'

/** 抽卡帮助（priority 5，排在抽卡本体前面，否则 #模拟抽卡帮助 会被当成抽卡） */
export class gachaHelp extends plugin {
  constructor() {
    super({
      name: PLUGIN_NAME,
      dsc: '抽卡插件的帮助（图片版）',
      event: 'message',
      priority: 5,
      rule: [{ reg: /^[#＃/／]?\s*(模拟抽卡|抽卡插件)(帮助|说明|help)(?=$|[\s])/i, fnc: 'help' }]
    })
  }

  async help(e) {
    loadConfig()

    if (needTextOnly()) {
      await e.reply(this.helpText())
      return true
    }

    const img = await renderTo(TPL_HELP, 'gacha-help', {
      dailyText: CONFIG.dailyLimit > 0 ? `每天 ${CONFIG.dailyLimit} 次` : '抽卡次数不限',
      refreshText: CONFIG.refreshMinutes > 0 ? `卡池每 ${CONFIG.refreshMinutes} 分钟同步` : '卡池按需同步',
      recallText: CONFIG.recallNoGold > 0 ? `没出金 ${CONFIG.recallNoGold} 秒后撤回` : '结果不自动撤回',
      groups: [
        {
          name: '抽卡',
          cls: 'wish',
          items: [
            { icon: '🎴', cmd: '#抽卡 / #十连', desc: '角色池十连（默认每天 10 次）' },
            { icon: '🎯', cmd: '#单抽', desc: '角色池单抽' },
            { icon: '⚔️', cmd: '#抽卡武器', desc: '武器池十连，可 #定轨<武器> 指定' },
            { icon: '🗿', cmd: '#抽卡常驻', desc: '常驻池十连' },
            { icon: '🎭', cmd: '#抽卡池2', desc: '当期第二个角色池' },
            { icon: '💯', cmd: '#抽卡百连', desc: '一次 100 抽（主人开启后可用）' }
          ]
        },
        {
          name: '卡池与定轨',
          cls: 'dps',
          items: [
            { icon: '🗂️', cmd: '#卡池', desc: '当期四个卡池一览' },
            { icon: '🎯', cmd: '#定轨苍耀', desc: '武器池定轨，定轨值满 2 必出' },
            { icon: '🔁', cmd: '#卡池更新', desc: '手动同步卡池（主人 / 群管）' }
          ]
        },
        {
          name: '记录与统计',
          cls: 'record',
          items: [
            { icon: '📜', cmd: '#模拟抽卡记录', desc: '抽卡记录，可带页码翻页' },
            { icon: '✨', cmd: '#模拟抽卡记录五星', desc: '只看五星' },
            { icon: '📊', cmd: '#模拟抽卡统计', desc: '出金率 / 平均抽数 / 各池垫抽' },
            { icon: '🏆', cmd: '#欧皇榜', desc: '群内平均出金排行（满 20 抽）' }
          ]
        },
        {
          name: '主人维护',
          cls: 'admin',
          items: [
            { icon: '⬆️', cmd: '#抽卡插件更新', desc: '从 GitHub 更新插件（仅主人）' },
            { icon: '🛠️', cmd: '#抽卡插件强制更新', desc: '更新失败时用，丢弃本地改动（仅主人）' },
            { icon: '📜', cmd: '#抽卡插件更新日志', desc: '查看版本提交记录' }
          ]
        }
      ]
    })

    if (img) {
      await sendImage(e, img)
      return true
    }

    await e.reply([this.helpText(), '', `（${renderFailBrief()}）`].join('\n'))
    return true
  }

  helpText() {
    return [
      '【模拟抽卡】卡池自动跟随官方公告',
      '━━━━━━━━━━━━━━',
      '#抽卡 / #十连               角色池十连',
      '#单抽                        角色池单抽',
      '#抽卡武器 / #抽卡常驻        武器池 / 常驻池十连',
      '#抽卡池2                     当期第二个角色池',
      '#卡池                        当期四个卡池一览',
      '#定轨苍耀                    武器池定轨（直接接武器名）',
      '#抽卡百连                    一次 100 抽（主人开启后可用）',
      '#卡池更新                    同步卡池（主人 / 群管）',
      '━━━━━━━━━━━━━━',
      '#模拟抽卡记录 [五星|页码]    抽卡记录',
      '#模拟抽卡统计                出金率与各池垫抽',
      '#欧皇榜                      群内出金排行',
      '━━━━━━━━━━━━━━',
      '#抽卡插件更新 / 强制更新     更新插件（仅主人）',
      '#抽卡插件更新日志            查看版本提交记录',
      '━━━━━━━━━━━━━━',
      versionLine()
    ].join('\n')
  }
}

try {
  Bot.makeLog('mark', '[抽卡插件] 帮助插件已加载', false)
} catch {
  /* 忽略 */
}

export default gachaHelp
