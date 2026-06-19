# Runbook

环境变量、端口、常用命令、踩过的坑。

## 环境变量

`.env`(项目根,git 已忽略;复制 `.env.local.example` 起步):

| 变量 | 默认 | 说明 |
|---|---|---|
| `VITE_LLM_API_KEY` | (空) | DeepSeek API key。**不填就走规则解析,demo 不崩。** |
| `VITE_LLM_MODEL` | `deepseek-v4-flash` | 模型 ID。改成其他 OpenAI 兼容模型也行(如 `deepseek-chat`)。 |
| `VITE_LLM_BASE_URL` | `/deepseek` | dev 默认走 Vite 代理绕 CORS。指向其他 OpenAI 兼容 endpoint 时覆盖。 |

桌宠无环境变量。

## 端口

| 端口 | 用途 |
|---|---|
| `5173` | 网页 dev server (Vite) |
| `7878` | 桌宠本地 HTTP 桥(Electron 主进程) |
| (代理转发到) `api.deepseek.com:443` | Vite dev proxy `/deepseek` → DeepSeek |

## 常用命令

```bash
# 网页
npm run dev          # dev server
npm run build        # 生产构建,完成前必跑这个验收

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

# DeepSeek 经代理通?(网页 dev 必须在跑)
KEY=$(grep '^VITE_LLM_API_KEY=' .env | cut -d= -f2-)
curl -s http://localhost:5173/deepseek/chat/completions \
  -H "content-type: application/json" -H "authorization: Bearer $KEY" \
  -d '{"model":"deepseek-v4-flash","max_tokens":20,"messages":[{"role":"user","content":"通"}]}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('llm ok:',d['choices'][0]['message']['content']) if 'choices' in d else print('ERR:',d)"

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

### DeepSeek 浏览器直连会被 CORS 拦

`api.deepseek.com` 没给浏览器开直连 header。`vite.config.js` 配了 dev proxy `/deepseek` → `https://api.deepseek.com`,网页打同源 `/deepseek/chat/completions` 就行。**生产部署需要另配后端代理**——纯前端调 LLM 会把 key 打进浏览器 bundle,只适合 localhost demo。

### `__dirname` 在 ESM 模块下不存在

如果在 `desktop/renderer/` 写脚本想读相对路径,用 `import.meta.url` + `fileURLToPath`,别用 `__dirname`。

### 桌宠没 Dock 图标,关不掉?

`pkill -f electron`。后续可以加托盘菜单。

### `npm run build` 失败但 dev 能跑

通常是 ESM/CJS 不一致或者引了不存在的导出。先看 vite 的 transform 报错(`transforming...` 行的下一段),不要先动业务逻辑。

## 路径速查

```
src/engine/llm.js           ← LLM 接入点(改模型/换 provider 在这)
src/engine/petBridge.js     ← 网页 → 桌宠通信
src/store/store.jsx         ← reducer + localStorage 持久化(key 'life-kitchen-v2')
vite.config.js              ← dev proxy 配置(/deepseek)
desktop/main.js             ← 桌宠主进程(窗口 + HTTP 桥)
desktop/renderer/pet.js     ← 桌宠状态驱动渲染
```
