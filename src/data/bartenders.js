// 五位预设调酒师种种。每位是一套个性化管理方法，不是皮肤。
// strategy 字段被 engine/plan.js 的排序逻辑消费。

export const BARTENDERS = [
  {
    id: 'rosemary',
    name: '迷迭香种种',
    plant: 'rosemary',
    emoji: '🌿',
    style: '老派主厨型',
    fit: '计划乱成一锅粥、 deadline 压顶的日子',
    strategy: 'deep_first', // 高优先级前置，先主线后碎片
    reminderTone: '直接、不绕弯',
    blurb: '先把主茶底熬稳，再撒碎料。顺序错了，整杯都会散。',
  },
  {
    id: 'ginger',
    name: '姜味种种',
    plant: 'ginger',
    emoji: '🫚',
    style: '点火推进型',
    fit: '拖着不想开始、容易卡住的早晨',
    strategy: 'ignite_first', // 先做 10 分钟启动任务
    reminderTone: '催促但带点暖意',
    blurb: '别想着一次做完，先开火。锅热了，后面自然顺。',
  },
  {
    id: 'mint',
    name: '薄荷种种',
    plant: 'mint',
    emoji: '🌱',
    style: '温柔缓冲型',
    fit: '疲惫、焦虑、能量低的日子',
    strategy: 'recovery_buffer', // 高强度任务后加入恢复
    reminderTone: '轻、不催',
    blurb: '累了就垫一层奶泡，别把自己熬干。',
  },
  {
    id: 'garlic',
    name: '蒜香种种',
    plant: 'garlic',
    emoji: '🧄',
    style: '边界守护型',
    fit: '消息不断、被打断到崩溃的日子',
    strategy: 'batch_admin', // 合并碎片任务，保护深度块
    reminderTone: '冷静、坚定',
    blurb: '把深度块圈起来，碎片事攒一攒再处理。',
  },
  {
    id: 'cilantro',
    name: '香菜种种',
    plant: 'cilantro',
    emoji: '🌾',
    style: '随性入门型',
    fit: '不想被管太死、对计划有抗拒感的时候',
    strategy: 'light_first', // 从轻任务进入，允许调整顺序
    reminderTone: '商量、随和',
    blurb: '从轻的开始，顺序随你心情调。',
  },
]

export const getBartender = (id) => BARTENDERS.find((b) => b.id === id) || BARTENDERS[0]
