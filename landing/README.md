# Life Kitchen · Landing（攻略门面站）

游戏本体之外的独立门面 / 攻略站。第一屏是魔法酒馆入口（logo + 内景），点「推门进店」进入游戏；下面是攻略分栏：小精灵图鉴、原料图鉴、调配手册、酒柜藏品、玩家秘方墙。

## 设计原则

- **完全独立**：纯 HTML/CSS/JS，零构建、零依赖，不引用也不改动 `src/` 下任何游戏代码。和游戏本体的 PR 没有文件交集。
- **风格同源**：配色 / 像素质感 / 字体 / logo 全部对齐游戏 `src/styles/theme.css`（青绿魔法酒馆风）。
- **数据同源**：内容从游戏数据干净复制一份到 `data.js`，顶部注释标了每块的真实来源文件。游戏数据若有大改，同步 `data.js` 即可。

## 文件

| 文件 | 作用 |
|---|---|
| `index.html` | 页面骨架：导航 + 酒馆入口 hero + 各攻略区块容器 |
| `styles.css` | 全部样式，设计 token 对齐游戏主题 |
| `data.js`    | 内容数据（原料 / 小精灵 / 流程 / 手法 / 酒柜 / 秘方），挂在 `window.LK` |
| `app.js`     | 从 `window.LK` 渲染各区块 + 导航高亮 + 进店跳转 |
| `fonts/`     | 自托管像素字 Zpix（最像素）：`Zpix.subset.woff2` 33KB 子集（覆盖本页文字、秒开）+ `Zpix.full.woff2` 889KB 完整库（缺字时浏览器才懒加载兜底） |

## 字体（像素锐化）

标题 / 标签 / 导航用中文像素字 **Zpix**，正文保持 PingFang 可读；hero 发光 logo 与「推门进店」用花体当招牌。字体已**本地自托管**，不依赖网络。

子集是按当前页面文字生成的。**如果新增了页面文字**，子集里可能没有新字（会自动回退到完整库，不会缺字；只是想让子集也覆盖的话），重新生成一次即可：

```bash
# 在仓库根目录，需 pip install fonttools brotli
cat landing/index.html landing/data.js landing/app.js > /tmp/lk_text.txt
pyftsubset <完整Zpix.ttf> --text-file=/tmp/lk_text.txt \
  --unicodes='U+0020-007E,U+00B7,U+3001-3017,U+FF01-FF5E,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+2192,U+25BE' \
  --flavor=woff2 --output-file=landing/fonts/Zpix.subset.woff2
```

## 怎么看

直接双击 `index.html` 用浏览器打开即可（`file://` 也能跑，美术走 `../assets/` 相对引用）。
或从仓库根起个静态服务，访问 `/landing/`：

```bash
# 在仓库根目录
python3 -m http.server 8080
# 打开 http://localhost:8080/landing/
```

## 「推门进店」指向哪里

在 `data.js` 顶部改 `GAME_URL` 一行：

- 开发态（默认）：`http://localhost:5173/` —— 游戏 `npm run dev` 的地址。
- 生产态：游戏 `npm run build` 后用 `npm run preview` 起服务，或部署到独立域名，再换成对应 URL。
  （构建产物用绝对路径 `/assets/...`，不能用 `file://` 或 `../dist/index.html` 直接打开，需起静态服务。）
