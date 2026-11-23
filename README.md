# 好想睡觉的ppt小屋 · 增强克隆版

一句话生成一套能直接讲的课件：**联网找资料 → 自动拆分章节 → 选风格配色 → 带动画放映 → 一键导出 .pptx**。

**在线使用**：<https://zhixiao-xjy.github.io/ppt-ai-pro/>

纯静态网页，不需要服务器、不需要数据库、不需要构建：打开网页，填一次自己的大模型 API Key 就能用；**不填 Key 也可以直接打开三套示例课件**。

> 本项目是 <https://github.com/cet4listening/ppt-ai> 的独立增强克隆版，界面、5 步流程、18 套主题与导出能力均保留；新增了自动配图、免 Key 示例、导出兜底和存储配额保护。原项目版权归原作者，详见文末「来源与致谢」。

---

## 这个版本解决了什么

原版有一个会直接影响交付的问题：**模型生成了带图注的图文页、但用户没有上传图片时，页面会显示“图片占位 / 在编辑区上传 / 选择一个素材”，导出的 PPTX 里则写“（未提供图片）”。**

增强版在三条链路上都做了兜底：

1. **网页渲染**：没有图片时按本页主题自动绘制示意图；图片加载失败会重绘；再不济用内联 SVG，绝不出现空占位；
2. **PPTX 导出**：原生版和图片版都会先补齐图片；嵌入失败自动换成生成图；再失败也画一张设计化色块，不会出现“未提供图片”；
3. **编辑界面**：大纲里显示「自动配图 / 网络图 / 已配图 / 待配图」，可单页「重绘」，也可一键「重新补全配图」。

---

## 功能

| 环节 | 说明 |
| --- | --- |
| 1. 需求 | 对话框里说清“年级 + 学科 + 课题 + 时长”，可上传资料一起参考 |
| 上传 | 支持 txt / md / csv / json / html / pdf / docx / pptx / 图片 / 视频 / 音频；文档本地抽取文字，图片和视频生成缩略图 |
| 联网检索 | 打开「联网检索」后，经公共 CORS 代理抓 Bing / DuckDuckGo / 中文维基；全部失败自动降级为模型自有知识 |
| 2. 内容结构 | 模型把内容拆成 12–18 页（封面 / 章节 / 要点 / 两栏 / 图文 / 引言 / 数据 / 清单 / 结束），可改标题、改要点、调顺序、增删页；讲稿提示自动生成 |
| 3. 风格配色 | **18 种版式风格 × 22 套配色 × 12 种字体 × 14 种动画**，右侧实时预览 |
| 4. 成品 | 缩略图、点击放大、全屏放映（← → 翻页、N 看讲稿、ESC 退出）、导出可编辑 PPTX、导出像素级图片版 PPTX、打印 PDF |
| 自动配图 | 9 类教学示意图模板，按主题/关键词选择，Canvas 离线绘制；可选优先搜 Wikimedia Commons |
| 示例课件 | 三套免 Key 示例：沃克环流、英语 Hello、光的折射 |

---

## 快速开始

### 方式 A：直接看示例（不需要 API Key）

1. 用静态服务器打开本站（见下方「本地运行」）；
2. 首页点任意一张示例卡片；
3. 自动进入大纲，插图页会自动配图；可直接改内容、换风格、导出 PPTX。

### 方式 B：生成自己的课件

1. 右上角「设置」；
2. 填 **API Key**（默认 `https://api.deepseek.com/v1` + `deepseek-chat`；任何 OpenAI 兼容接口都可以，换 Base URL + 模型名即可）；
3. 回到对话框输入需求，例如：`帮我生成一个小学三年级英语第一节课内容的 PPT`；
4. 依次走完 5 步，点「导出 PPTX」。

> API Key 只保存在本机浏览器 localStorage，页面不会把它发到除你填的模型接口以外的任何地方。

---

## 自动配图怎么工作

- 触发：`type === 'image'` 且没有 `src`，且不是视频/音频；
- 选模板：按标题、副标题、图注、要点里的关键词匹配——
  `walker`（沃克/厄尔尼诺）、`refraction`（折射）、`alphabet`（字母）、`dialogue`（对话）、`compare`（对比）、`timeline`（时间线）、`cycle`（循环）、`flow`（流程/实验）、`concept`（默认）；
- 绘制：1600×900 Canvas，颜色取自当前风格/配色，深色主题自动出深色版；
- 元数据：写入 `image.auto = true`、`template`、`credit = "示意图 · 课件工坊自动绘制"`，图注下方显示小字 credit；
- 在线优先：设置里勾选「优先网络图片」后，先查 Wikimedia Commons，失败自动回退本地绘制；
- 缓存：同页同主题命中缓存，重绘/刷新不会重复计算。

生成图是 JPEG dataURL，`html2canvas` 与 `PptxGenJS` 都能直接嵌入，所以网页预览和两种导出看到的都是同一张图。

---

## 三套示例

| id | 课件 | 页数 | 主题 | 适合 |
| --- | --- | --- | --- | --- |
| `walker` | 高中地理 · 沃克环流与厄尔尼诺 | 14 | editorial / ocean | 高中地理选择性必修一 |
| `english` | 小学三年级英语 · 第一课 Hello! | 12 | playful / candy | 三年级英语 starter |
| `refraction` | 初中物理 · 光的折射 | 10 | tech / ice | 八年级物理 |

示例是内置 JSON（`assets/samples.js`），不调用模型、不需要 Key；加载后与正常生成的课件完全同权，可以编辑、换主题、导出。

---

## 本地运行

```powershell
cd ppt-ai-pro
node serve.js 8099
# 打开 http://127.0.0.1:8099/
```

`serve.js` 是零依赖的静态服务器；也可以用任意静态服务器（nginx、`python -m http.server`、VS Code Live Server 等），根目录指向 `ppt-ai-pro/`。

> 不要用 `file://` 直接打开：CSP、fetch、Canvas 都会受限，示例和导出可能不工作。

---

## 导出 PPTX

### 默认：图片版 + 逐条拆页

- 每页是网页渲染的 **1600×900 像素级截图**（html2canvas），字体、配色、圆角、阴影与网页一致；
- 每一「块」内容展开成一页，放映时点鼠标/空格逐条出现；
- 写入 `<p:transition><p:fade/>`，WPS / PowerPoint / Keynote 翻页有淡入；
- 体积参考：14 页 ≈ 1.1MB；开启逐条拆页后约 41 页 ≈ 2.5MB。

### 可编辑文字版

设置 → 取消勾选「图片版导出」，或调用 `EXPORTER.toPptx(deck, theme, { mode: 'native' })`。样式为近似还原，个别风格有差异，但文字可改。

两种模式在导出前都会执行 `IMAGES.ensureDeckSync()`；没有图的插图页会先补图，再嵌入。

---

## 目录结构

```text
ppt-ai-pro/
├─ index.html            页面骨架（5 个 stage 面板 + 设置 dialog）
├─ serve.js              零依赖本地静态服务器
├─ assets/
│  ├─ app.css            界面样式
│  ├─ themes.css         18 套幻灯片主题 + 动画 + 图文 credit
│  ├─ media.css          图文版式（右/左/整页/背景）
│  ├─ welcome.css/js     首次进入开场动画
│  ├─ app.js             主流程 + 自动配图接入 + 配额保护
│  ├─ images.js          自动配图引擎（9 模板 + 在线检索）
│  ├─ samples.js         三套免 Key 示例
│  ├─ presets.js         风格/配色/字体/动画预设
│  ├─ search.js          多通道联网检索 + 降级
│  ├─ files.js           txt/md/csv/json/html/pdf/docx/pptx/图片/视频解析
│  ├─ render.js          1280×720 渲染 + 放映 + 无图兜底
│  └─ export.js          PPTX 导出 + 无图兜底
├─ vendor/               jszip / mammoth / html2canvas / pptxgen / pdfjs
├─ security/             Cloudflare Worker 代理示例
├─ SPEC.md               模块接口契约
├─ 拆解报告.md            原站拆解 + 改造说明 + 验证记录
└─ README.md
```

---

## 数据模型

```js
Deck = { title, subtitle, meta, slides: [Slide] }

Slide = {
  type: 'cover' | 'section' | 'bullets' | 'two-col' | 'image'
      | 'quote' | 'stats' | 'list' | 'end',
  title, subtitle,
  bullets: string[],
  columns: [{ title, items }],
  quote, author,
  stats: [{ value, label }],
  image: { src, caption, kind, layout },  // layout: right / left / full / bg
  homework, notes
}

Theme = { styleId, paletteId, fontId, animId }
```

`normalizeDeck()` 负责白名单、图片协议校验、默认页补全；现在还会保留 `image.auto / online / credit / template / generatedAt / stale` 这些增强字段。

---

## 存储与配额

- 状态存 `localStorage['pptai.state.v1']`；
- 自动生成的图片**不写入** localStorage：保存时剥离 `src`、标记 `stale`，刷新后按需重绘；
- 用户自己上传/填写的图片会正常保存（并清掉 `auto` 标记，避免被误剥离）；
- 配额仍不足时，`save()` 会清空对话记录再重试一次，避免整次保存静默丢失。

---

## 已知限制

- **联网检索**依赖公共 CORS 代理，国内网络有时不通；不通时自动降级并在对话里提示。想稳定可自己部署 `security/worker-cf.js`，把地址填进「设置 → 搜索代理」。
- **文本模型看不懂图片内容**，上传图片只作为素材，不会被理解。
- **PPTX 动画**：导出的是静态排版；动画只在网页放映模式出现（图片版用淡入过渡模拟）。
- **在线图片**只做 Wikimedia Commons 检索，许可证/作者信息以 credit 形式显示；商用前请自行核对。
- **离线配图是教学示意图**，不是照片级素材；需要真实照片时请在大纲里上传。
- 浏览器端解析大文件（>50MB 视频）只记录元信息，避免卡死。
- 移动端 760px 以下大纲卡片较拥挤，建议桌面端编辑、手机端放映。

---

## 安全与隐私

- 纯静态站，资料不上传服务器；文件在本地解析；
- Key 默认以混淆形式存本机，可在设置里改成「仅本会话」；
- 已启用 CSP、图片协议白名单、错误信息打码；
- 想让 Key 完全不进浏览器：`security/worker-cf.js` 提供 Cloudflare Worker 代理（藏 Key + 限流 + Origin 白名单），详见 `security/README.md`。

---

## 来源与致谢

- 原项目：**好想睡觉的ppt小屋**，<https://github.com/cet4listening/ppt-ai>，线上 <https://cet4listening.github.io/ppt-ai/>；
- 本仓库为独立目录中的增强克隆版，保留原品牌视觉与流程，仅用于学习、教学与二次开发演示；
- 第三方库：JSZip、Mammoth、html2canvas、PptxGenJS、PDF.js（均本地化在 `vendor/`，遵循各自许可证）。

如果这个版本帮到了你，请优先给原项目点 Star。
