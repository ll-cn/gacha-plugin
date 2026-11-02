/**
 * alemon 环境补齐云崽的全局对象，让共用业务代码不用改。
 * 必须在 app/ 与 model/ 之前加载。
 */
if (typeof globalThis.Bot === 'undefined') {
  globalThis.Bot = {
    makeLog(level, message) {
      try {
        const fn = logger?.[level === 'mark' ? 'info' : level] ?? logger?.info
        fn?.(message)
      } catch {
        /* 日志失败不影响业务 */
      }
    }
  }
}

// 云崽用 segment.image(buffer) 包图片消息；alemon 侧直接收 Buffer
if (typeof globalThis.segment === 'undefined') {
  globalThis.segment = { image: file => ({ type: 'image', file }) }
}
