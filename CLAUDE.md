# Life Kitchen — AI 写代码须知

> 一个用「调酒」隐喻管理待办的个人助理 Agent(网页 + Mac 桌宠)。详细架构与隐喻定义见 `docs/`,这里只列下次写代码会犯错的事。

## 深入文档

| 想知道 | 看 |
|---|---|
| 系统怎么工作、四层引擎、桌宠协议、像素风规范、数据契约 | `docs/architecture.md` |
| 环境变量、端口、冒烟测试、踩过的坑 | `docs/runbook.md` |
| 原始 PRD(只读) | `Life Kitchen2.md` |
| 怎么跑起来 | `README.md` |

## 硬边界规则(违反就出 bug 或破隐喻)

- **`src/engine/` 必须是纯函数,零 UI 依赖。**萃取/排序/进化/复盘的规则都在这里,后续替换真 LLM 只动 engine,不动 UI。新增计算逻辑放 engine,不放 page/component。
- **守住揭晓惊喜:原料 / 茶底名 / 今日特调名 / 配方比例,在 1~4 步绝不展示。**优化页用 `adviseManagement`(只谈任务),揭晓页才用 `judgeRecipe`(可点名原料)。执行阶段的手法气泡用"慢熬中/打气中",不写"茶底/气泡"。这条违反 = 产品核心点被破坏。
- **隐喻一致性优先于技术简洁。** UI 文案、变量名、注释都用调酒语言:小精灵 / 原料 / 调配 / 特调 / 收口。不用"任务卡 / 完成度 / 待办项"这种通用词。
- **数据契约字段名以 PRD `Life Kitchen2.md` §9.2/§10.3/§11.4/§7.1 为准,不自创同义字段。**`taskType` 与 `category` 的取值是七类原料 key,严格枚举。

## 不要做

- 不要引重型状态库(`useReducer` 已够用)、不要加后端、不要加登录、不要做移动端优先、不要做复杂 3D 图表。
- 不要把环境变量名写成 `VITE_ANTHROPIC_*`——当前接的是 DeepSeek,统一用 `VITE_LLM_*`(详见 `docs/runbook.md`)。
- 不要让 LLM 失败把 demo 卡住——`llm.js` 任何异常必须兜回规则解析(`parseTodos` / 规则版小精灵推荐),evaluators 永远拿得到结果。
- 不要直连 `api.deepseek.com`(CORS 拦),走 Vite proxy `/deepseek`(详见 `docs/runbook.md`)。
- 不要在桌宠 HTTP 桥的 CORS 响应里漏掉 `Access-Control-Allow-Methods`,会让浏览器预检失败 POST 被静默拦截(踩过一次)。
- commit message 英文;`git push` 等 harry 指令,不自动执行。

## 完成的定义

改完任何代码,必须跑通 `npm run build`(网页根目录)再说"完成"。桌宠改动后 `cd desktop && node --check main.js preload.js renderer/pet.js renderer/sprites.js` 至少过语法。
