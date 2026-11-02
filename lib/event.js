import { Format, useMessage, isMaster } from 'alemonjs'
import { log } from '../model/log.js'

/** 从 message.send 的返回值里挖出消息 id（各平台结构不同） */
function pickId(res) {
  const arr = Array.isArray(res) ? res : [res]
  for (const item of arr) {
    if (!item) continue
    const id =
      item.message_id ??
      item.MessageId ??
      item.msg_id ??
      item.data?.message_id ??
      item.data?.MessageId ??
      item.data?.id ??
      null
    if (id) return String(id)
  }
  return null
}

/**
 * 把 alemon 事件包装成云崽插件认识的 e 对象。
 * 业务代码（app/、model/）完全不知道自己在哪个框架里跑。
 */
export function createContext(event) {
  const [message] = useMessage(event)

  const sendRaw = async payload => {
    const format = Format.create()
    if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
      format.addImage(Buffer.isBuffer(payload) ? payload : Buffer.from(payload))
    } else if (payload && typeof payload === 'object' && payload.type === 'image') {
      format.addImage(payload.file)
    } else {
      format.addText(String(payload ?? '').trim() || ' ')
    }
    const res = await message.send({ format })
    return { message_id: pickId(res) }
  }

  const isGroup = !event.IsPrivate

  const e = {
    msg: String(event.MessageText ?? '').trim(),
    user_id: String(event.UserId ?? ''),
    group_id: String(event.ChannelId ?? ''),
    isGroup,
    isMaster: Boolean(isMaster?.(String(event.UserId ?? ''), event.Platform)),
    sender: { user_id: String(event.UserId ?? ''), nickname: String(event.UserName ?? '') },
    reply: sendRaw
  }

  if (isGroup) {
    e.group = {
      group_id: e.group_id,
      sendMsg: sendRaw,
      recallMsg: async id => {
        if (!id) return false
        const res = await message.delete({ messageId: String(id) })
        const one = Array.isArray(res) ? res[0] : res
        return one?.code === 2000 || one?.code === 'Ok'
      },
      // alemon 没有群成员列表接口，欧皇榜只能显示 QQ 号
      getMemberMap: async () => new Map()
    }
  } else {
    e.friend = { user_id: e.user_id, sendMsg: sendRaw }
  }

  return e
}

export { log }
