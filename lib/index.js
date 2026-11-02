import './shim.js'
import { Router, useEvent } from 'alemonjs'
import { registerRenderTarget } from '../model/render.js'
import { renderTemplate } from './render.js'
import { createContext } from './event.js'
import { genshinGacha } from '../app/gacha.js'
import { genshinGachaRecord } from '../app/record.js'
import { genshinGachaPool } from '../app/pool.js'
import { gachaHelp } from '../app/help.js'
import { gachaAdmin } from '../app/admin.js'
import { startScheduler } from '../model/wish/banner.js'

const EVENTS = ['message.create', 'private.message.create']

let booted = false
/** 首次收到消息时：挂上无头浏览器渲染后端 + 卡池定时刷新 */
function boot() {
  if (booted) return
  booted = true
  registerRenderTarget('alemon-browser', (name, payload) => renderTemplate(name, payload))
  try {
    startScheduler()
  } catch (err) {
    logger?.warn?.(`[抽卡插件] 卡池定时刷新启动失败：${err?.message ?? err}`)
  }
}

const plugins = [
  new genshinGacha(),
  new genshinGachaRecord(),
  new genshinGachaPool(),
  new gachaHelp(),
  new gachaAdmin()
]

/** 把云崽的 rule 数组映射成 alemon 路由 */
function bind(router, plugin) {
  for (const rule of plugin.rule) {
    const fn = plugin[rule.fnc].bind(plugin)
    router.res(
      { events: [...EVENTS], regular: rule.reg },
      () => ({
        default: async () => {
          boot()
          const [ref] = useEvent({ selects: EVENTS })
          await fn(createContext(ref.current))
        }
      })
    )
  }
}

export default defineChildren({
  register() {
    const router = Router.create({ events: EVENTS })
    for (const plugin of plugins) bind(router, plugin)
    return { responseRouter: router.define }
  }
})
