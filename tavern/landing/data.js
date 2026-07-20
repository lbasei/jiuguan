/* ============================================================================
 * Life Kitchen · Landing 数据层
 * ----------------------------------------------------------------------------
 * 这是「门面站」的独立内容源，与游戏本体解耦。为了让本页能直接 file:// 打开、
 * 零构建零依赖，这里把游戏的核心数据干净复制一份，挂在 window.LK 上。
 *
 * 真实来源（只读对照，不在本目录改动）：
 *   原料   → ../src/data/ingredients.js
 *   小精灵 → ../src/data/bartenders.js
 *   进化配方 → ../src/data/evomap.js
 *   手法/命名 → ../src/engine/plan.js（NAME_PREFIX / NAME_SUFFIX / 手法）
 *
 * 隐喻锁定（与游戏 CLAUDE.md 一致）：小精灵 / 原料 / 调配 / 特调 / 收口，
 * 不用「任务卡 / 完成度 / 待办项」这类通用词。
 * ========================================================================== */

window.LK = (function () {
  // —— 「推门进店」跳转游戏的地址。按部署改这一行即可。——
  // 开发态（默认）: 游戏 `npm run dev` 跑在 http://localhost:5173/
  // 生产态: 把游戏 `npm run build` 后用 `npm run preview` 起服务，或部署到独立域名，再换成对应 URL
  //   注意：构建产物 dist/index.html 用绝对路径 /assets/...，不能直接 file:// 或 ../dist 打开，需起静态服务
  const GAME_URL = 'http://localhost:5173/'

  // —— 七类基础原料（每个待办 = 一种原料）——
  const INGREDIENTS = [
    { category: 'deep_work',     name: '深度茶底',   emoji: '🍵', color: '#7EDFD8', method: '慢熬', methodKey: 'slow_brew', desc: '深度工作与核心任务', taste: '主茶底，决定整杯的骨架' },
    { category: 'creative',      name: '创意糖浆',   emoji: '🍯', color: '#FFD978', method: '发酵', methodKey: 'ferment',   desc: '创作、构思与表达',   taste: '回甘，给整杯添香气与层次' },
    { category: 'communication', name: '沟通气泡',   emoji: '🫧', color: '#9DD3FF', method: '打气', methodKey: 'aerate',    desc: '会议、讨论与消息流', taste: '气泡感，多了会冲淡主味' },
    { category: 'admin',         name: '琐事小料',   emoji: '🧂', color: '#F8B1D4', method: '速调', methodKey: 'quick_mix', desc: '碎片任务与杂事',     taste: '点缀，过量会变成碎料奶茶' },
    { category: 'recovery',      name: '恢复奶泡',   emoji: '🥛', color: '#FFF3B8', method: '打发', methodKey: 'whip',      desc: '休息、运动与状态恢复', taste: '绵密缓冲，少了整杯偏燥' },
    { category: 'urgent',        name: '姜汁浓缩液', emoji: '🫚', color: '#FF9FBD', method: '浓缩', methodKey: 'shot',      desc: '紧急、截止与冲刺',   taste: '辛辣浓烈，过量会透支' },
    { category: 'review',        name: '肉桂封口',   emoji: '🍂', color: '#9BE8B6', method: '收口', methodKey: 'seal',      desc: '复盘与收束',         taste: '尾韵，替整杯收口定味' },
  ]

  // —— 六位小精灵（每位是一套管理方法，不是皮肤）——
  const BARTENDERS = [
    { id: 'rosemary', name: '迷迭香种种', plant: 'rosemary', emoji: '🌿', img: '../assets/sprites/rosemary.png',
      style: '老派主厨型', fit: '计划乱成一锅粥、deadline 压顶的日子', strategyName: '先浓后淡',
      strategy: 'deep_first', tone: '直接、不绕弯',
      blurb: '先把主茶底熬稳，再撒碎料。顺序错了，整杯都会散。' },
    { id: 'ginger', name: '姜种种', plant: 'ginger', emoji: '🫚', img: '../assets/sprites/ginger.png',
      style: '点火推进型', fit: '拖着不想开始、容易卡住的早晨', strategyName: '先点火',
      strategy: 'ignite_first', tone: '催促但带点暖意',
      blurb: '别想着一次做完，先开火。锅热了，后面自然顺。' },
    { id: 'mint', name: '薄荷种种', plant: 'mint', emoji: '🌱', img: '../assets/sprites/mint.png',
      style: '温柔缓冲型', fit: '疲惫、焦虑、能量低的日子', strategyName: '奶泡缓冲',
      strategy: 'recovery_buffer', tone: '轻、不催',
      blurb: '累了就垫一层奶泡，别把自己熬干。' },
    { id: 'lemon', name: '柠檬种种', plant: 'lemon', emoji: '🍋', img: '../assets/sprites/lemon.png',
      style: '清醒吐槽型', fit: '脑子发黏、需要一点酸味把注意力拧回来的时候', strategyName: '先点火',
      strategy: 'ignite_first', tone: '犀利、轻快',
      blurb: '先挤一点酸，醒醒神。别磨叽，今天要爽快开局。' },
    { id: 'garlic', name: '葱蒜种种', plant: 'garlic', emoji: '🧄', img: '../assets/sprites/garlic.png',
      style: '边界守护型', fit: '消息不断、被打断到崩溃的日子', strategyName: '碎料集中',
      strategy: 'batch_admin', tone: '冷静、坚定',
      blurb: '先把边界立住。该挡的挡掉，该集中处理的集中处理。' },
    { id: 'cilantro', name: '香菜种种', plant: 'cilantro', emoji: '🌾', img: '../assets/sprites/cilantro.svg',
      style: '随性入门型', fit: '不想被管太死、对计划有抗拒感的时候', strategyName: '轻任务起手',
      strategy: 'light_first', tone: '商量、随和',
      blurb: '从轻的开始，顺序随你心情调。' },
  ]

  // —— 调配流程（这些酒是怎么调出来的）——
  const BREW_FLOW = [
    { step: 1, title: '倒出待办', sub: '一段话讲给种种听', desc: '把今天想做的事，自然语言一口气说出来。种种替你拆成一条条结构化待办。' },
    { step: 2, title: '萃取原料', sub: '每件事 → 一种原料', desc: '按任务类型，每个待办萃取成七类基础原料之一；时间长短决定它在杯中的比例。' },
    { step: 3, title: '定浓度口感', sub: '精力 / 情绪 / 完成', desc: '精力消耗定浓度，情绪负担定风味强度，完成状态定口感——同样写 PRD，有人清澈有人发苦。' },
    { step: 4, title: '排杯序', sub: '种种的调法', desc: '选定的种种按自己的策略排执行顺序：先熬主茶底，还是先点火，还是先垫奶泡。' },
    { step: 5, title: '收口揭晓', sub: '端出今日特调', desc: '一天收尾，所有原料按比例分层调成一杯，生成今日特调名与一张可收藏的特调卡。' },
  ]

  // —— 七种调制手法（执行时杯面显示的动作）——
  const METHODS = [
    { method: '慢熬', for: '深度茶底', desc: '小火久煮，主茶底要稳，急不得。' },
    { method: '发酵', for: '创意糖浆', desc: '给灵感一点时间回甘、起香。' },
    { method: '打气', for: '沟通气泡', desc: '快速打出气泡，沟通讲究节奏。' },
    { method: '速调', for: '琐事小料', desc: '一勺入杯，碎事顺手收掉。' },
    { method: '打发', for: '恢复奶泡', desc: '打出绵密奶泡，给整杯垫一层缓冲。' },
    { method: '浓缩', for: '姜汁浓缩液', desc: '高压萃取，急件一击命中。' },
    { method: '收口', for: '肉桂封口', desc: '最后一道收束，替整杯定味。' },
  ]

  // —— 酒柜：今日特调藏品。名字用游戏的命名引擎（前缀[主原料]+后缀[次原料]）造，
  //    不是瞎编。unlock = 过怎样的一天才能调出这一杯。——
  const CABINET = [
    { id: 'deep-cold',  name: '深焙冷萃',   recipe: ['deep_work', 'deep_work'], rarity: 'common',
      layers: ['#A8ECE7', '#7EDFD8', '#5FBFB8'], unlocked: true,
      flavor: '主茶底极稳，一整天扎进核心任务，清澈见底。', unlock: '深度工作占整杯的大头，几乎没被打断。' },
    { id: 'deep-seal',  name: '深焙收口茶', recipe: ['deep_work', 'review'], rarity: 'common',
      layers: ['#9BE8B6', '#7EDFD8', '#5FBFB8'], unlocked: true,
      flavor: '熬完主茶底，临收尾还认真复了盘，尾韵干净。', unlock: '完成核心任务，并留出一段复盘收口。' },
    { id: 'fruit-tonic', name: '果香特调',  recipe: ['creative', 'creative'], rarity: 'common',
      layers: ['#FFE9A8', '#FFD978', '#F2C24B'], unlocked: true,
      flavor: '灵感连珠，整杯都是回甘的香气。', unlock: '创作 / 构思类任务唱主角的一天。' },
    { id: 'soda-bubble', name: '气泡苏打',  recipe: ['communication', 'communication'], rarity: 'common',
      layers: ['#C4E6FF', '#9DD3FF', '#73B4ED'], unlocked: true,
      flavor: '会议与消息接连不断，满杯气泡，喝着热闹。', unlock: '沟通 / 会议占满一天的节奏。' },
    { id: 'cream-tea',  name: '奶霜轻乳茶', recipe: ['recovery', 'recovery'], rarity: 'rare',
      layers: ['#FFF7D6', '#FFF3B8', '#F4E69A'], unlocked: false,
      flavor: '绵密回血，难得给自己留足缓冲的一天。', unlock: '恢复奶泡占比够高——好好休息了。' },
    { id: 'ginger-shot', name: '辛姜浓缩',  recipe: ['urgent', 'urgent'], rarity: 'rare',
      layers: ['#FFC2D5', '#FF9FBD', '#F2779B'], unlocked: false,
      flavor: '辛辣冲顶，全力冲刺 deadline 的一杯。慎饮。', unlock: '姜汁浓缩液偏多——高压冲刺日。' },
    { id: 'deep-tonic', name: '深焙特调',  recipe: ['deep_work', 'creative'], rarity: 'legendary',
      layers: ['#A8ECE7', '#7EDFD8', '#FFD978'], unlocked: false,
      flavor: '深度与创意黄金配比，结构均衡，种种眼里的满分之作。', unlock: '深度茶底与创意糖浆都厚，且留了恢复缓冲。' },
    { id: 'ginger-cold', name: '辛姜冷萃',  recipe: ['urgent', 'deep_work'], rarity: 'legendary',
      layers: ['#FF9FBD', '#7EDFD8', '#5FBFB8'], unlocked: false,
      flavor: '高压之下仍守住了深度——辛辣里压着一层冷静。', unlock: '急件缠身却没丢掉核心任务的一天。' },
  ]

  // —— 秘方墙：管理方法分享。三类卡片混排——
  //    种种调法（内置策略）· 进化配方（EvoMap）· 玩家投稿（示例）——
  const RECIPES = [
    // 种种的调法
    { kind: 'bartender', author: '迷迭香种种', title: '先浓后淡',
      body: '高优先级深度任务全部前置，碎片任务后置，最后才加恢复。顺序对了，整杯才不散。',
      tags: ['deadline 压顶', '计划混乱'] },
    { kind: 'bartender', author: '姜种种', title: '先点火',
      body: '先挑一个最短的任务做掉点火，锅热了再按深度优先推进。专治拖延不想开始。',
      tags: ['拖延', '卡壳的早晨'] },
    { kind: 'bartender', author: '薄荷种种', title: '奶泡缓冲',
      body: '每做完一个高强度任务，就插一段恢复缓冲。别把自己熬干。',
      tags: ['疲惫', '能量低'] },
    { kind: 'bartender', author: '葱蒜种种', title: '碎料集中',
      body: '把 admin 和沟通类碎事合并成一坨集中处理，保护中间的深度块不被打断。',
      tags: ['消息轰炸', '频繁打断'] },
    // 进化配方（EvoMap 内置经验）
    { kind: 'evomap', author: '酒馆进化档案', title: '先浓后淡配方', confidence: 0.84,
      body: '高认知任务多、易被琐事打断时：深度前置、碎片后置、末尾加恢复。提升核心完成率，降低切换损耗。',
      tags: ['deep_work', '少切换'] },
    { kind: 'evomap', author: '酒馆进化档案', title: '恢复奶泡缓冲', confidence: 0.79,
      body: '高情绪负担任务多、易疲劳放弃时：在高压任务后插入恢复或短休息，降低放弃率。',
      tags: ['高情绪负担', '防放弃'] },
    { kind: 'evomap', author: '酒馆进化档案', title: '碎料集中处理', confidence: 0.81,
      body: '琐碎任务多、切换损耗大时：把 admin / communication 集中安排，减少来回切换。',
      tags: ['碎事多', '减损耗'] },
    // 玩家投稿（示例内容，展示「分享区」的样子）
    { kind: 'player', author: '@夜班调酒师', title: '把一天拆成两壶',
      body: '上午只熬深度茶底、不碰消息；下午再统一打气回消息。两壶分开，互不串味。',
      tags: ['深度保护', '分时段'] },
    { kind: 'player', author: '@奶泡上瘾者', title: '番茄钟当收口',
      body: '每个深度块结束就拉肉桂收口——花两分钟写一行今天学到啥，顺手把状态收住。',
      tags: ['复盘', '小步收口'] },
    { kind: 'player', author: '@香菜本菜', title: '不排死顺序',
      body: '只定今天必出的三杯主调，其余看心情调换。给自己留弹性，反而做得更多。',
      tags: ['弹性', '低压'] },
  ]

  const RARITY = {
    common:    { label: '常驻', color: '#6AC8A7' },
    rare:      { label: '稀有', color: '#E0902E' },
    legendary: { label: '传说', color: '#C77DD6' },
  }

  return { GAME_URL, INGREDIENTS, BARTENDERS, BREW_FLOW, METHODS, CABINET, RECIPES, RARITY }
})()
