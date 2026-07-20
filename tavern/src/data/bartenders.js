// 五位预设调酒师种种。每位是一套个性化管理方法，不是皮肤。
// strategy 字段被 engine/plan.js 的排序逻辑消费。

import rosemarySpriteUrl from '../../assets/sprites/rosemary.png'
import mintSpriteUrl from '../../assets/sprites/mint.png'
import lemonSpriteUrl from '../../assets/sprites/lemon.png'
import garlicSpriteUrl from '../../assets/sprites/garlic.png'
import gingerSpriteUrl from '../../assets/sprites/ginger.png'
import cilantroSpriteUrl from '../../assets/sprites/cilantro.png'
import osmanthusSpriteUrl from '../../assets/sprites/osmanthus.jpg'
import chiliSpriteUrl from '../../assets/sprites/chili.jpg'

export const BARTENDERS = [
  {
    id: 'rosemary',
    name: '迷迭香种种',
    plant: 'rosemary',
    emoji: '🌿',
    image: rosemarySpriteUrl,
    style: '老派、挑剔、很会控场',
    fit: '事情堆在一起、你需要有人替你拍桌定顺序的时候',
    strategy: 'deep_first', // 高优先级前置，先主线后碎片
    reminderTone: '直说重点',
    blurb: '她会先皱眉看一眼清单，然后把最要紧的那件事推到你面前。',
  },
  {
    id: 'ginger',
    name: '姜种种',
    plant: 'ginger',
    emoji: '🫚',
    image: gingerSpriteUrl,
    style: '热心、急性子、爱催开局',
    fit: '明明知道要做什么，但身体迟迟不肯动的时候',
    strategy: 'ignite_first', // 先做 10 分钟启动任务
    reminderTone: '热乎乎地催你',
    blurb: '他不会讲大道理，只会把第一步缩到很小，催你先动一下。',
  },
  {
    id: 'mint',
    name: '薄荷种种',
    plant: 'mint',
    emoji: '🌱',
    image: mintSpriteUrl,
    style: '慢吞吞、会照顾人、有点撒娇',
    fit: '累到不想被催，但又希望今天别完全散掉的时候',
    strategy: 'recovery_buffer', // 高强度任务后加入恢复
    reminderTone: '轻声提醒',
    blurb: '她会把任务说得软一点，提醒你喝水、喘口气，再继续。',
  },
  {
    id: 'lemon',
    name: '柠檬种种',
    plant: 'lemon',
    emoji: '🍋',
    image: lemonSpriteUrl,
    style: '嘴快、清醒、偶尔吐槽',
    fit: '脑子糊住、想找个人把话说亮一点的时候',
    strategy: 'ignite_first',
    reminderTone: '短句吐槽',
    blurb: '她会直接戳破你绕来绕去的地方，然后丢给你一个清爽的开头。',
  },
  {
    id: 'garlic',
    name: '葱蒜种种',
    plant: 'garlic',
    emoji: '🧄',
    image: garlicSpriteUrl,
    style: '护短、警觉、很会挡人',
    fit: '消息一直弹、别人老来插队、你快被切碎的时候',
    strategy: 'batch_admin', // 合并碎片任务，保护深度块
    reminderTone: '冷静但不让步',
    blurb: '她会帮你把门关上，留出一段不被打断的时间。',
  },
  {
    id: 'cilantro',
    name: '香菜种种',
    plant: 'cilantro',
    emoji: '🌾',
    image: cilantroSpriteUrl,
    style: '随性、爱商量、有点小古怪',
    fit: '你不想被计划绑住，只想先找个舒服入口的时候',
    strategy: 'light_first', // 从轻任务进入，允许调整顺序
    reminderTone: '像朋友一样商量',
    blurb: '他不会逼你按表走，会先挑一件顺手的事陪你试试。',
  },
  {
    id: 'osmanthus',
    name: '桂花种种',
    plant: 'osmanthus',
    emoji: '✦',
    image: osmanthusSpriteUrl,
    style: '优雅、慢热、很讲节奏',
    fit: '今天事情不算少，但你想稳稳当当、有余味地做完',
    strategy: 'deep_first',
    reminderTone: '像熟客老板娘一样轻轻提点',
    blurb: '她会把事情排得不慌不忙：先闻香，再入口，最后一定要收得漂亮。',
  },
  {
    id: 'chili',
    name: '辣椒种种',
    plant: 'chili',
    emoji: '✦',
    image: chiliSpriteUrl,
    style: '爆发、直球、热得很快',
    fit: '你需要一点冲劲，把拖很久的事直接点燃的时候',
    strategy: 'ignite_first',
    reminderTone: '短促、带火花',
    blurb: '她不爱绕弯，会把最该动手的那一下直接推到你面前。',
  },
  {
    id: 'mint_osmanthus',
    name: '薄荷桂花种种',
    plant: 'mint-osmanthus',
    emoji: '✦',
    image: mintSpriteUrl,
    blendImages: [mintSpriteUrl, osmanthusSpriteUrl],
    style: '清凉、有礼、慢慢稳住',
    fit: '想放松一点，但又不想今天完全失去节奏',
    strategy: 'recovery_buffer',
    reminderTone: '轻声递茶',
    blurb: '她们会先替你降温，再把顺序摆好：不催，但也不让事情散掉。',
    unlockDays: 3,
    unlockText: '酒馆来访 3 天后解锁',
  },
  {
    id: 'lemon_chili',
    name: '柠檬辣椒种种',
    plant: 'lemon-chili',
    emoji: '✦',
    image: lemonSpriteUrl,
    blendImages: [lemonSpriteUrl, chiliSpriteUrl],
    style: '清醒、冲刺、一下子醒神',
    fit: '拖延很久、需要被点醒并快速开工的时候',
    strategy: 'ignite_first',
    reminderTone: '爽快催开局',
    blurb: '她们会先把话说亮，再点一小把火：今天别拖，先做一口。',
    unlockDays: 7,
    unlockText: '酒馆来访 7 天后解锁',
  },
]

export const getBartender = (id, customBartenders = []) =>
  customBartenders.find((b) => b.id === id) || BARTENDERS.find((b) => b.id === id) || BARTENDERS[0]
