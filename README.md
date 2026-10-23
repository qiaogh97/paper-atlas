# PaperAtlas · 论文索引

无需注册，通过数据集、实验指标、会议与年份检索论文的静态网站。首版固定使用 2026-10-23 进度核对中的 **205 篇 `status=ok` 论文**；不会自动纳入持续提取中的新记录。

线上地址：**https://qiaogh97.github.io/paper-atlas/**  
源代码仓库：https://github.com/qiaogh97/paper-atlas

## 本地启动

只需 Python 3，无需安装任何依赖：

```bash
cd /Volumes/WD1TB/MacMini/qiaoguanhui/code/paper_dataset/project
python3 scripts/serve.py
```

打开 **http://127.0.0.1:8877/**。运行服务的终端需保持开启，`Ctrl+C` 停止。端口占用时用 `python3 scripts/serve.py --port 8878`。也可使用 `npm start`。请通过 HTTP 服务访问，直接双击 HTML 无法加载 JSON 数据。

## 功能

- 搜索论文标题、数据集与指标名称，也可搜索会议和年份；支持 `/` 快捷键。
- 会议、年份、数据集、指标均可多选：同组取“或”，不同组取“且”。
- 数据集和指标筛选项带名称搜索与当前可匹配论文数量；数据集用途可选主实验基准、预训练、构建来源、定性测试、其他。
- 显示完整论文标题、会议、年份、数据集和指标；提供官方原文及 PDF 下载链接。
- 详情中查看全部条目、用途、原文逐字证据、行号与提取说明。仅缓存来源在卡片和详情注明。
- 年份/标题排序、每页 12 篇、空结果提示、清除条件。
- 筛选条件保存在网址，可复制分享、刷新保留及用浏览器前进后退恢复。
- 导出全部当前匹配论文的 CSV，不限于当前页；UTF-8 BOM 兼容 Excel，保护公式起始字符。
- 手机布局与可折叠筛选栏；检索在浏览器本地执行，不需要账户、数据库、后端或密钥。

## 数据口径

- 205 篇论文，3 个会议（CVPR / ICCV / ICLR），4 个年份（2023–2026）。这是样本库，不是完整会议录用清单。
- 754 个数据集名称与 741 个指标名称按原始名称去重统计。大小写、缩写与版本尚未做语义合并，`CIFAR10` 与 `CIFAR-10` 等写法可分别搜索。
- 数据集按角色保留；**指标与数据集是论文级集合，不表示任意一个指标在任意一个数据集上均有报告**。本版不展示分数和排行榜。
- 来源包括 200 篇 Markdown 全文、4 篇 PDF 提取文本、1 篇仅缓存来源。逐字锚点校验不等于人工语义审查。
- `source/selection.json` 固定论文名单；`source/records/` 保留对应原始提取记录；`source/links.json` 保留官方链接及来源。原始记录仅复制，未修改上游提取结果或论文语料。
- 运行 `python3 scripts/build_data.py` 可单独从 `project/source/` 重建 `data/papers.json`，不依赖兄弟目录。输出包含原始记录的 SHA-256。

## 链接核验

PDF 来自 CVF 或 OpenReview。CVPR 与 ICLR 2026 使用原下载清单；ICCV 使用出版方规范文件名并请求验证；其余 ICLR 通过 OpenReview 官方检索补齐。

2026-10-23 实测：**197 个 CVF PDF 地址返回 HTTP 200 且类型为 PDF**；8 个 OpenReview 地址在当前环境返回 HTTP 403。因此这些 OpenReview 地址保留为官方来源链接，但实际下载可达性尚未通过本机检查。外部站点可能随访问环境、策略或版本变化。

核验报告：`qa/link-check.json`。重新检测：

```bash
python3 scripts/check_links.py
```

## 后续上线

网站使用 GitHub Pages 发布。`.github/workflows/pages.yml` 在 `main` 推送后自动重建固定论文目录、运行 8 项核心测试，并只发布 `dist/` 中的静态网站。

日常更新在 `project/` 仓库中提交并推送即可：

```bash
git add .
git commit -m "Update PaperAtlas"
git push origin main
```

部署进度：https://github.com/qiaogh97/paper-atlas/actions 。`source/selection.json` 仍然固定 205 篇，后续扩容需要同时调整数据生成与测试中的数量断言。

生成独立部署目录：

```bash
python3 scripts/build_site.py
# 或 npm run build
```

把 **`dist/` 内全部文件** 上传到支持静态站点的服务器即可；无需安装 Node、Python 或数据库作为生产后端。可以部署在域名根目录或子目录，资源全部使用相对路径。支持普通 Nginx、对象存储静态托管、GitHub Pages 等。根路径和带查询条件的网址均由 `index.html` 承载，不需要 SPA 路由回退。

可先预览上线包：

```bash
python3 -m http.server 8878 --bind 127.0.0.1 --directory dist
```

公开部署只上传 `dist/`，无需上传 `node_modules/`、`source/`、测试与截图。PDF 使用官方外链，不复制托管论文。

## 开发与验证

运行网站不需要前端依赖；浏览器测试才需要 Playwright：

```bash
npm ci
npm test
npm run test:browser
```

浏览器测试使用本机已安装的 Google Chrome 独立无头实例，不读取日常浏览器资料；先在另一个终端启动 8877 本地服务。可用 `TEST_URL=http://127.0.0.1:8878 npm run test:browser` 测试其他地址。

- `tests/core.test.js`：8 项数据完整性、组合筛选、角色归属、分面统计、URL 特殊字符、排序与 CSV 测试。
- `tests/browser.mjs`：16 项桌面和手机交互验收，含检索、筛选、URL 刷新、证据详情、分页、空状态、CSV 与控制台错误。
- `qa/desktop.png`、`qa/mobile.png`、`qa/detail.png`：界面截图。
- `qa/browser-check.json`：浏览器检查结果。

## 文件布局

```text
project/
  index.html / styles.css / app.js / core.js / favicon.svg
  data/papers.json       网站直接读取的完整目录
  source/                固定名单、205 篇原始记录和官方链接
  scripts/               数据生成、本地服务器、静态打包、链接核验
  tests/                 筛选逻辑和浏览器验收
  qa/                    截图、CSV 与检查报告
  dist/                  可直接上线的静态文件
  package.json / package-lock.json
```
