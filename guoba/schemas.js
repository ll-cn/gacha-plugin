/** 锅巴面板表单：字段名与 config/config.yaml 的键一一对应 */
export default [
  { component: 'SOFT_GROUP_BEGIN', label: '出图' },
  {
    field: 'imageScale',
    label: '清晰度倍数',
    helpMessage: '倍数越高字越清楚，图也越大',
    component: 'Select',
    componentProps: {
      options: [
        { label: '1 倍（原尺寸，最小）', value: 1 },
        { label: '2 倍（推荐）', value: 2 },
        { label: '3 倍（最清晰，图最大）', value: 3 }
      ]
    }
  },
  {
    field: 'jpegQuality',
    label: 'JPEG 质量',
    helpMessage: '越低图越小，30 以下会明显糊',
    component: 'Slider',
    componentProps: { min: 30, max: 100, step: 1 }
  },
  {
    field: 'textOnly',
    label: '只发文字不发图',
    helpMessage: '开启后抽卡结果只回文字，不出图',
    component: 'Switch'
  },

  { component: 'SOFT_GROUP_BEGIN', label: '模拟抽卡' },
  {
    field: 'timeout',
    label: '请求超时',
    helpMessage: '单位毫秒，拉取卡池公告 / 角色资料的单次超时',
    component: 'InputNumber',
    componentProps: { min: 5000, max: 60000, step: 1000, placeholder: '25000' }
  },
  {
    field: 'dailyLimit',
    label: '每人每天抽卡次数',
    helpMessage: '一次十连算 1 次，填 0 表示不限制',
    component: 'InputNumber',
    componentProps: { min: 0, max: 100, step: 1, placeholder: '10' }
  },
  {
    field: 'refreshMinutes',
    label: '卡池自动刷新间隔',
    helpMessage: '单位分钟。填 0 表示只在启动和卡池过期时刷新',
    bottomHelpMessage: '改完需要重启机器人才会按新间隔走，其余配置项保存即生效',
    component: 'InputNumber',
    componentProps: { min: 0, max: 1440, step: 30, placeholder: '360' }
  },
  {
    field: 'pityTip',
    label: '显示保底进度',
    helpMessage: '抽卡卡片底部是否显示还差多少抽保底',
    component: 'Switch'
  },
  {
    field: 'recallNoGold',
    label: '没出金自动撤回',
    helpMessage: '抽卡结果里没有五星时，多少秒后自动撤回；填 0 表示不撤回',
    bottomHelpMessage: '出了五星就保留不撤。撤回需要机器人是群管理员，否则只记日志',
    component: 'InputNumber',
    componentProps: { min: 0, max: 120, step: 1, placeholder: '8' }
  }
]
