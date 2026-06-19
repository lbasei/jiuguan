// 五位预设调酒师种种。每位是一套个性化管理方法，不是皮肤。
// strategy 字段被 engine/plan.js 的排序逻辑消费。

export const BARTENDERS = [
  {
    id: 'rosemary',
    name: '迷迭香种种',
    plant: 'rosemary',
    emoji: '🌿',
    style: '严格结构型',
    fit: 'deadline、深度工作、计划混乱',
    strategy: 'deep_first', // 高优先级前置，先主线后碎片
    reminderTone: '直接干脆',
    blurb: '高优先级前置，先把主茶底熬稳，再处理碎料。',
  },
  {
    id: 'ginger',
    name: '姜味种种',
    plant: 'ginger',
    emoji: '🫚',
    style: '启动推进型',
    fit: '拖延、卡住、迟迟不开始',
    strategy: 'ignite_first', // 先做 10 分钟启动任务
    reminderTone: '点火催促',
    blurb: '先用一个短任务点火，重点不是做完，是先开火。',
  },
  {
    id: 'mint',
    name: '薄荷种种',
    plant: 'mint',
    emoji: '🌱',
    style: '恢复安抚型',
    fit: '疲惫、焦虑、低能量',
    strategy: 'recovery_buffer', // 高强度任务后加入恢复
    reminderTone: '轻柔不催',
    blurb: '降低任务密度，在高强度任务后垫一层恢复奶泡。',
  },
  {
    id: 'garlic',
    name: '蒜香种种',
    plant: 'garlic',
    emoji: '🧄',
    style: '专注隔离型',
    fit: '频繁被消息打断',
    strategy: 'batch_admin', // 合并碎片任务，保护深度块
    reminderTone: '冷静守护',
    blurb: '合并碎片任务，把深度工作块圈起来不被切断。',
  },
  {
    id: 'cilantro',
    name: '香菜种种',
    plant: 'cilantro',
    emoji: '🌾',
    style: '宽松灵活型',
    fit: '不想被强制管理、计划抗拒感强',
    strategy: 'light_first', // 从轻任务进入，允许调整顺序
    reminderTone: '随和商量',
    blurb: '从低压力任务进入，顺序随你心情调。',
  },
]

export const getBartender = (id) => BARTENDERS.find((b) => b.id === id) || BARTENDERS[0]
