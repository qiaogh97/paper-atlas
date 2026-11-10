# PaperAtlas · 论文索引

无需注册，按数据集、实验指标、会议、年份与提取状态检索已处理论文。

线上地址：**https://qiaogh97.github.io/paper-atlas/**  
仓库：https://github.com/qiaogh97/paper-atlas

## 当前发布快照

2026-11-10 快照共 **43,139 篇**，覆盖 CVPR、ICCV、ICLR、ECCV、NeurIPS，年份为 2022–2026。

| 提取状态 | 论文数 | 含义 |
|---|---:|---|
| 检查通过 | 18,764 | 来源哈希、逐字证据与格式检查通过；不等于人工语义核准 |
| 待核结果 | 24,360 | 有可校验的提取记录，同时保留归属、完整性或其他疑点 |
| 历史样本 | 15 | 原网站已发布、尚未被本轮结果替代的记录 |

索引保留 **82,426** 个数据集名称与 **162,760** 个指标名称，按原始写法去重。
数据集与指标是论文级集合，不表示任意指标都在任意数据集上报告，不提供分数或排行榜。
无命名数据集、无报告指标和理论论文如实保留空字段。此库不是会议完整录用清单。

本次冻结输入有 46,058 篇已尝试记录，其中 2,788 篇失败。失败记录及原文证据校验未通过的记录不作为论文提取结果发布。
提取进程继续运行；本站是明确时间点的快照，不会自动把后续候选当作已上线数据。

## 功能

- 标题、数据集、指标、会议、年份全文检索；同组筛选取“或”，不同组取“且”。
- 五会议、五年份及“检查通过 / 待核结果 / 历史样本”筛选；筛选条件保存在 URL 中。
- 数据集用途区分主实验基准、预训练、构建、定性测试及其他用途。
- 详情按需载入原文证据、行号、用途及待核说明；首屏不下载全部证据文本。
- CSV 导出全部匹配结果与提取状态，包含 UTF-8 BOM 和公式起始字符保护。
- 每页 12 篇；桌面和手机布局；无需账户、数据库或线上密钥。
- 分面先显示前 100 项，可输入名称查找其余名称。

## 来源与链接

发布前从有效提取索引导入记录，重新检查归一化全文哈希和每个逐字证据锚点。
`source/snapshot.json` 固定时间、数量、状态、分块哈希与输入索引哈希；
`source/snapshot/*.jsonl` 保存独立可重建的记录、状态、证据及链接。
旧版 `source/selection.json`、`source/records/` 与 `source/links.json` 保留作历史来源，不再决定当前发布数量。
原始提取记录与论文语料未被修改。

43,127 篇有官方 PDF 直链；12 篇提供明确标注的 OpenReview 官方检索入口，不伪造论坛 ID。
链接来自原下载清单和 CVF、ECVA/ECCV、NeurIPS、ICLR 官方会议元数据。
ICLR 2023–2025 使用官方会议节目表的 OpenReview 链接匹配标题。
外部 PDF 的可达性可能随访问环境变化；`qa/link-check.json` 是旧版快照的历史检查，不代表本次全部链接均已发出请求验证。

## 本地启动与构建

```bash
python3 scripts/serve.py --port 8877
# http://127.0.0.1:8877/
```

构建只需 Python 标准库；检索逻辑测试使用 Node.js：

```bash
python3 scripts/build_data.py
npm test
python3 scripts/build_site.py
```

`data/papers.json` 为检索索引，`data/details/` 的 256 个分块按需提供证据。
索引约 40.0 MiB，gzip 约 7.3 MiB；详情不阻塞首屏。
`dist/` 包含全部可独立部署资源，不包含完整 PDF、密钥、node_modules 或上游原文文件。

## 从提取工作区更新快照

在完整 paper_dataset 工作区中执行：

```bash
python3 scripts/sync_extraction.py
python3 scripts/build_data.py
npm test
npm run test:browser
```

同步器读取兄弟上游目录中的有效结果与本地官方链接元数据，语料严格只读。
导入审计和未纳入记录报告保存在工作区的 `site_publish_work/`，不上传整个提取工作区。
若重新获取 ICLR 官方节目表，应放到同步器指定的本地元数据目录后再同步。
GitHub Actions 不读取本机语料，只从提交的独立快照重建网站。

## 发布和验证

GitHub Pages 的 `.github/workflows/pages.yml` 在 main 推送后验证分块哈希、重建数据、运行核心测试并发布 dist。
用户授权发布后，在本仓库提交并推送：

```bash
git add .
git commit -m "feat: publish processed paper snapshot"
git push origin main
```

浏览器验证使用独立的本机 Chrome，不读取日常浏览器资料：

```bash
# 先启动本地服务
TEST_URL=http://127.0.0.1:8877 npm run test:browser
```

当前 9 项核心测试及 19 项浏览器验收覆盖完整索引/详情对应、组合筛选、状态区分、ECCV 2022、NeurIPS、证据延迟加载、CSV、URL、分页与手机无横向溢出。
截图与本地验收报告位于 qa/；发布后还需直接读取线上数据并验证线上交互。
