/**
 * 云崽 plugin 基类解析：在云崽里用框架的基类，在 alemon 里用内置壳。
 * 业务代码只管 new + 调方法，两边行为一致。
 */
class PluginShell {
  constructor(opt = {}) {
    Object.assign(this, opt)
  }
}

let base = PluginShell

try {
  const mod = await import('../../../lib/plugins/plugin.js')
  if (typeof mod?.default === 'function') base = mod.default
} catch {
  /* 非云崽环境：用壳 */
}

export default base
