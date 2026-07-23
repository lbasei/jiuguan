# Runbook

环境变量、端口、常用命令、踩过的坑。

## 环境变量

`.env`(项目根,git 已忽略;复制 `.env.local.example` 起步):

| 变量 | 默认 | 说明 |
|---|---|---|
| `GEMINI_API_KEY` | (空) | **服务端专用** Gemini API key。不填就走规则解析,demo 不崩。禁止加 `VITE_` 前缀。 |
| `GEMINI_MODEL` | `gemini-flash-latest` | Gemini 模型 ID。免费层对新用户可能限制旧模型名。 |
| `GEMINI_API_BASE` | `https://generativelanguage.googleapis.com` | 可选；自建网关或本地联调可覆盖。 |
| `HTTPS_PROXY` / `GEMINI_HTTPS_PROXY` | (空) | **关键**：Node 不会自动走系统 VPN。本机 Clash 混合端口常见为 `http://127.0.0.1:7897`。 |
| `VITE_COLLECT_BASE_URL` | `http://localhost:3000` | Adventure 深链到 data-collection 的根地址；线上填 Production，换域名只改这里。 |
| `VITE_TAVERN_BASE_URL` | (空) | 酒馆自己的线上根地址，可选，以后回流用。 |
| `VITE_ADVENTURE_CAMPAIGN` | `adventurex-2026` | 写入 collect query 的 campaign。 |

桌宠无环境变量。自然语言解析请求走 `/api/llm/parse-todos` 与 `/api/llm/suggest-bartender`。

## 端口

| 端口 | 用途 |
|---|---|
| `5173` | 网页 dev server (Vite) |
| `7878` | 桌宠本地 HTTP 桥(Electron 主进程) |
| `8787` | 可选独立 API (`npm run api`) |

## 常用命令

```bash
# 网页
npm run dev          # dev server,自动打开浏览器
npm run build        # 生产构建,完成前必跑这个验收
npm run pet          # 一键启动桌宠

# 桌宠(Mac)
cd desktop && npm start         # 启动桌宠
pkill -f electron               # 没 Dock 图标,只能这样关掉
```

## 冒烟测试

判断双端是否健康的最小一组命令:

```bash
# 网页活着?
curl -s http://localhost:5173/ -o /dev/null -w "web: %{http_code}\n"

# 桌宠桥活着?
curl -s http://localhost:7878/state -w " | bridge: %{http_code}\n"

# Gemini 经后端通?(Vite 或 npm run api 都要能读到 .env 里的 GEMINI_API_KEY)
curl -s http://localhost:5173/api/llm/status
curl -s http://localhost:5173/api/llm/parse-todos \
  -H 'content-type: application/json' \
  -d '{"text":"我今天要写完 PRD，还要回复老师消息，最好运动半小时"}'

# 模拟网页推 brewing 给桌宠(应在桌宠右下角看到摇杯)
curl -s -X POST http://localhost:7878/state -H 'content-type: application/json' \
  -d '{"state":"brewing","bartenderId":"ginger","category":"deep_work","title":"测试","durationSec":60}'
```

## 踩过的坑

### CORS 预检必须含 `Access-Control-Allow-Methods`

桌宠主进程的 HTTP 桥要返回这三个 CORS 头,缺一不可:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: content-type
```

只用 `curl` 测时不会暴露问题(curl 不走预检),浏览器从 :5173 发 JSON POST 会先发 OPTIONS,缺 `Allow-Methods` 时预检失败,POST 被静默拦截。这事踩过一次。

### Gemini key 不能放前端

`GEMINI_API_KEY` 只能写在服务端环境变量。前端通过 `/api/llm/*` 调用；Vite middleware 与 `server.mjs` / Vercel `/api` 都会走同一套 `api/db.mjs`。

### `__dirname` 在 ESM 模块下不存在

如果在 `desktop/renderer/` 写脚本想读相对路径,用 `import.meta.url` + `fileURLToPath`,别用 `__dirname`。

### 桌宠没 Dock 图标,关不掉?

`pkill -f electron`。后续可以加托盘菜单。

### `npm run build` 失败但 dev 能跑

通常是 ESM/CJS 不一致或者引了不存在的导出。先看 vite 的 transform 报错(`transforming...` 行的下一段),不要先动业务逻辑。

## 路径速查

```
src/engine/llm.js           ← LLM 接入点(改模型/换 provider 在这)
src/engine/petBridge.js     ← 网页 ↔ 桌宠通信
src/store/store.jsx         ← reducer + localStorage 持久化(key 'life-kitchen-v2')
vite.config.js              ← dev proxy 配置(/deepseek) + server.open
desktop/main.js             ← 桌宠主进程(窗口 + HTTP 桥 + 动作队列)
desktop/renderer/pet.js     ← 桌宠渲染与交互(清单/杯子/点击完成)
desktop/renderer/sprites.js ← 像素精灵与调色板
```
