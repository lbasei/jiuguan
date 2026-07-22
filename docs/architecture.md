# Architecture

这套系统怎么工作:核心隐喻、双端架构、四层引擎、数据流。

## 核心隐喻

```
待办事项 = 原料        预计时间 = 比例        任务类型 = 风味类别
精力消耗 = 浓度        情绪负担 = 风味强度    完成状态 = 口感
任务顺序 = 调配顺序    一天结果 = 今日特调    复盘 = 配方点评
管理方法 = 调酒师 / 小精灵
```

七类基础原料(`category → name`):

| category | 中文名 | 含义 | 调制手法(执行时显示) |
|---|---|---|---|
| `deep_work` | 深度茶底 | 深度工作与核心任务 | 慢熬 |
| `creative` | 创意糖浆 | 创作、构思、表达 | 发酵 |
| `communication` | 沟通气泡 | 会议、讨论、消息流 | 打气 |
| `admin` | 琐事小料 | 碎片任务与杂事 | 速调 |
| `recovery` | 恢复奶泡 | 休息、运动、状态恢复 | 打发 |
| `urgent` | 姜汁浓缩液 | 紧急、截止、冲刺 | 浓缩 |
| `review` | 肉桂封口 | 复盘与收束 | 收口 |

五位预设调酒师 / 小精灵:迷迭香(结构)· 姜味(启动)· 薄荷(恢复)· 蒜香(专注)· 香菜(灵活)。每位的 `strategy` 字段驱动排序引擎的不同分支。

## 用户主线(5 步)

```
1. 选小精灵 (BartenderPage)    —— 轮播左右翻 / 拖动选一只,选定后形象全程锁定
2. 倒出待办 (TodoPage)         —— 自然语言一段话 → LLM 拆成结构化 Todo
3. 小精灵优化 (OptimizePage)   —— 给建议 + 可手动拖动排序 + 吸收 EvoMap 经验进化(只改策略,不改小精灵)
4. 执行 (ExecutePage)          —— 点「开始」→ 小精灵摇杯 + 倒计时;桌宠上也可点原料入杯完成
5. 揭晓 (RevealPage)           —— 第一次展示原料瓶 + 今日特调卡
```

**关键设计:原料/茶底/今日特调全程隐藏,直到第 5 步才揭晓。**优化阶段只谈任务层(`adviseManagement` 不点名原料),执行阶段的手法气泡用"慢熬中/打气中"代替"茶底/气泡"。这是产品的核心惊喜点,改 UI 时务必守住。

## 双端架构

```
                                     ┌─────────────────────────┐
   ┌────────────────────┐  POST       │ Mac 桌宠 (Electron)     │
   │ 网页端 (Vite/React)│ /state     │ desktop/                │
   │ http://localhost   ├────────────▶│ HTTP 桥 :7878           │
   │   :5173            │  (heartbeat │ 透明置顶窗 + 像素精灵   │
   │                    │   每 2.5s)  │ 状态驱动: idle/brewing  │
   │ 心跳从执行页发出   │             │ /done + 可操作清单      │
   └────────────────────┘             └─────────────────────────┘
            ▲                              │
            │ GET /state {actions}         │ IPC pet-send-action
            │ (每 2.5s 轮询)               │ 点击原料 → 完成动作
            └──────────────────────────────┘
            │ POST /api/llm/* (Gemini key 仅服务端)
            ▼
   ┌────────────────────┐
   │ Gemini API         │   仅用于:
   │ (via /api/llm)     │   - 自然语言 → 结构化待办
   │                    │   - 自然语言 → 推荐小精灵
   └────────────────────┘
```

**桌宠不是纯展示,是可操作的调酒台**:点击清单里的原材料,该任务会被标记完成,原料「飞入」杯子,杯子按完成顺序分层。全部完成后点击杯子/小精灵打开揭晓页。

**小精灵形象全程锁定**:BartenderPage 选定后 `lockedBartenderId` 写入 store,之后进化、重置新的一天都只清空任务和杯子,不换小精灵。桌宠主进程也锁定第一次收到的 `bartenderId`,防止任何异常推送导致换色。

**桌宠不是必需的**:不开也不影响网页。`petBridge` fire-and-forget,推送失败静默,只是网页右上徽标显示「⚪ 未开」。

**自动匹配靠心跳**:网页进执行页就开 2.5s 心跳重推当前状态——桌宠无论何时启动,几秒内自动接上,不用回去重点一次。

## 四层引擎(`src/engine/`,纯函数)

**关键原则:engine 是项目的大脑,与 UI 解耦。**所有规则都是纯函数,UI 只负责展示。后续接真实 LLM 只换 engine 入口、不动 UI。

| 模块 | 职责 | 关键函数 |
|---|---|---|
| `parse.js` | 规则版自然语言 → Todo(LLM 兜底) | `parseTodos(text)` |
| `llm.js` | LLM 入口,经后端调 Gemini + 规则兜底 | `parseTodosSmart` / `suggestBartenderSmart` / `llmEnabled` |
| `extract.js` | 待办 → 原料 + 比例聚合 | `extractIngredients` / `aggregateRecipe` |
| `plan.js` | 排序策略 + Agent 判断 + 今日特调命名 | `orderTodos` / `nameDrink` / `judgeRecipe` / `adviseManagement` |
| `evolve.js` | EvoMap 经验匹配与吸收 | `matchExperiences` / `applyExperience` |
| `review.js` | 日度复盘卡生成 | `buildReviewCard` |
| `petBridge.js` | 网页 ↔ 桌宠 HTTP 桥 + 心跳 + 动作轮询 | `pushPetState` / `startPetSync` / `startActionPoll` |

`judgeRecipe` vs `adviseManagement`:前者**会点名原料名**(揭晓页用),后者**只谈任务**(优化页用)——这是守住惊喜的关键。

## 数据流

```
text 输入
  └─→ parseTodosSmart() ─ LLM/规则 ─→ Todo[]
        └─→ extractIngredients() ─→ Ingredient[] (含 ratio/concentration/flavor)
              └─→ aggregateRecipe() ─→ Recipe[] (按 category 聚合的比例)
                    ├─→ orderTodos(strategy) ─→ order[]    ← 执行页用
                    ├─→ adviseManagement() ─→ tips[]       ← 优化页用(不剧透)
                    ├─→ nameDrink() ─→ drinkName           ← 揭晓页用
                    ├─→ judgeRecipe() ─→ {warnings,comment} ← 揭晓页用(可剧透)
                    └─→ matchExperiences() / applyExperience() ─→ 进化后的 recipe/strategy
                          (吸收后顺序重排,但 UI 不展示配方)
执行完成
  └─→ buildReviewCard() ─→ {drinkName, completionRate, recipe, comment, suggestion}
```

## 数据契约

字段名以 PRD `Life Kitchen2.md` §9.2 / §10.3 / §11.4 / §7.1 为准,不自创同义字段。核心结构:

```js
Todo:        { id, title, estimatedTime, taskType, energyCost, emotionalLoad, priority, mustDo, status }
Ingredient:  { id, todoId, sourceTodo, category, name, emoji, color, method, ratio, concentration, flavor, statusTaste }
Bartender:   { id, name, plant, emoji, style, fit, strategy, reminderTone, blurb }
EvoMap:      { id, name, pattern, condition, strategy, recommendBartenders, effect, confidence, apply }
Store:       { ..., lockedBartenderId } // 用户选定的小精灵,全程不变
```

`taskType` 与 `category` 取值都是七类原料的 key,严格枚举。

## 桌宠通信协议

`POST http://localhost:7878/state`(主进程 HTTP 服务,CORS 已开放,必须含 `Access-Control-Allow-Methods`):

```json
// idle
{ "state": "idle", "bartenderId": "rosemary", "schedule": [{"id":"...","title":"...","estimatedTime":15,"status":"pending"}] }

// brewing
{ "state": "brewing", "bartenderId": "ginger", "category": "deep_work",
  "title": "写 PRD", "durationSec": 5400, "schedule": [...] }

// done
{ "state": "done", "bartenderId": "mint", "schedule": [...] }
```

`GET /state` 返回 `{ current, actions }`。`actions` 是桌宠点击产生的动作队列(如 `{type:"complete",todoId:"...",completedAt:123}`),网页端消费后去重执行。

桌宠收到 `brewing` 时:切换 `sprite-shake` 动画 + 显示气泡(标题 + 调制手法) + `showInactive()` 浮到前面;收到 `idle` 时显示待办清单;收到 `done` 时举着满杯,点击打开揭晓页。

## 像素风

字体 Press Start 2P(拉丁) + DotGothic16(中文)经 Google Fonts。SVG 像素精灵自建在 `src/components/sprites.js` 和 `desktop/renderer/sprites.js`(同款网格独立两份,避免跨工程耦合);`PixelSprite.jsx` / 桌宠的 `renderSprite()` 用 `shape-rendering="crispEdges"` 渲染硬边像素。

调色板:奶油 `#F1E4C3` / 木深 `#3E2A18` / 琥珀 `#E0902E` / 叶绿 `#6F8A5B`。像素投影 `4px 4px 0 #3E2A18`、3px 描边、按下"陷进去"。
