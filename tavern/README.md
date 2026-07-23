# Life Kitchen 进化酒馆

一个用「调酒」隐喻管理待办的个人助理 Agent。每个待办被萃取成原料,时间决定比例,任务类型决定风味,完成状态决定口感,一天调配成「今日特调」。

由网页端 + Mac 桌宠两部分组成:网页是你和小精灵的工作台,桌宠是它在你做事那段时间里的真·分身。

## 两端跑起来

### 网页端

```bash
npm install
cp .env.local.example .env       # 把 GEMINI_API_KEY 填到服务端环境变量（不要加 VITE_）
npm run dev                       # http://localhost:5173
```

不填 Gemini key 也能跑——自动降级本地规则解析,demo 不会崩。自然语言解析走后端 `/api/llm/*`，key 不会进前端。

### Mac 桌宠

新开一个终端:

```bash
npm run pet          # 一键启动桌宠(等价于 cd desktop && npm start)
```

启动后右下角出现一只透明置顶的小精灵,在 `http://localhost:7878` 起了一个本地 HTTP 桥;网页执行页一旦点「开始」做事,桌宠就当场摇杯/熬煮——状态自动同步,不用手动连。

你也可以直接在桌宠上点击原材料完成任务:原料会飞入杯子,杯子按完成顺序一层层叠起来。全部完成后点击杯子/小精灵,浏览器自动打开揭晓页。

## 详细文档

| 文档 | 给谁看 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 想搞懂"这套系统是怎么工作的"——萃取/排序/进化/复盘四层引擎、双端通信、数据流 |
| [docs/runbook.md](docs/runbook.md) | 想跑起来 / 调试 / 排障——环境变量、端口、常见故障 |
| [CLAUDE.md](CLAUDE.md) | 给在这个仓库写代码的 AI 看的项目规范 |
| [Life Kitchen2.md](Life%20Kitchen2.md) | 原始 PRD(只读参考) |
