// 五位预设调酒师种种。每位是一套个性化管理方法，不是皮肤。
// strategy 字段被 engine/plan.js 的排序逻辑消费。

import rosemarySpriteUrl from '../../assets/sprites/rosemary.png'
import mintSpriteUrl from '../../assets/sprites/mint.png'
import lemonSpriteUrl from '../../assets/sprites/lemon.png'
import garlicSpriteUrl from '../../assets/sprites/garlic.png'
import gingerSpriteUrl from '../../assets/sprites/ginger.png'
import cilantroSpriteUrl from '../../assets/sprites/cilantro.svg'

export const BARTENDERS = [
  {
    id: 'rosemary',
    name: '迷迭香种种',
    plant: 'rosemary',
    emoji: '🌿',
    image: rosemarySpriteUrl,
    style: '老派主厨型',
    fit: '计划乱成一锅粥、 deadline 压顶的日子',
    strategy: 'deep_first', // 高优先级前置，先主线后碎片
    reminderTone: '直接、不绕弯',
    blurb: '先把主茶底熬稳，再撒碎料。顺序错了，整杯都会散。',
  },
  {
    id: 'ginger',
    name: '姜种种',
    plant: 'ginger',
    emoji: '🫚',
    image: gingerSpriteUrl,
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
    image: mintSpriteUrl,
    style: '温柔缓冲型',
    fit: '疲惫、焦虑、能量低的日子',
    strategy: 'recovery_buffer', // 高强度任务后加入恢复
    reminderTone: '轻、不催',
    blurb: '累了就垫一层奶泡，别把自己熬干。',
  },
  {
    id: 'lemon',
    name: '柠檬种种',
    plant: 'lemon',
    emoji: '🍋',
    image: lemonSpriteUrl,
    style: '清醒吐槽型',
    fit: '脑子发黏、需要一点酸味把注意力拧回来的时候',
    strategy: 'ignite_first',
    reminderTone: '犀利、轻快',
    blurb: '先挤一点酸，醒醒神。别磨叽，今天要爽快开局。',
  },
  {
    id: 'garlic',
    name: '葱蒜种种',
    plant: 'garlic',
    emoji: '🧄',
    image: garlicSpriteUrl,
    style: '边界守护型',
    fit: '消息不断、被打断到崩溃的日子',
    strategy: 'batch_admin', // 合并碎片任务，保护深度块
    reminderTone: '冷静、坚定',
    blurb: '先把边界立住。该挡的挡掉，该集中处理的集中处理。',
  },
  {
    id: 'cilantro',
    name: '香菜种种',
    plant: 'cilantro',
    emoji: '🌾',
    image: cilantroSpriteUrl,
    style: '随性入门型',
    fit: '不想被管太死、对计划有抗拒感的时候',
    strategy: 'light_first', // 从轻任务进入，允许调整顺序
    reminderTone: '商量、随和',
    blurb: '从轻的开始，顺序随你心情调。',
  },
]

export const getBartender = (id, customBartenders = []) =>
  customBartenders.find((b) => b.id === id) || BARTENDERS.find((b) => b.id === id) || BARTENDERS[0]
