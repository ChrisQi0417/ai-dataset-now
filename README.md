# AI Dataset Now

AI Dataset Now 是一个独立部署的 AI 数据集雷达：从公开的 Hugging Face、GitHub、Zenodo 数据源拉取候选记录，按新鲜度、社区使用信号和资料完整度计算质量分，展示本期最高信号的 50 条。

## 运行方式

```text
GitHub main
   ├─ 每日 05:17 UTC / Actions workflow_dispatch
   │    └─ 拉取公开 API → 评分 → 更新 src/data/datasets.json
   │          └─ 推送 main → Cloudflare Pages 自动部署
   └─ Cloudflare Pages Function /api/refresh
        └─ 页面点击“刷新”时即时拉取并展示最新结果
```

“刷新”会在当前页面即时替换结果；每日任务会把快照写回仓库，因此页面重新打开仍会看到最近一次自动同步的结果。GitHub Actions 页面也提供了手动运行入口。

## 本地运行

需要 Node.js 22 或更高版本。项目不依赖第三方 npm 包：

```powershell
npm ci
npm run fetch-data
npm run build
npm run preview
```

打开 `http://127.0.0.1:4173` 查看构建结果。`/api/refresh` 是 Cloudflare Pages Function，本地的静态预览只提供仓库快照，不模拟该 API。

## 评分逻辑

- 新鲜度 42%：以最近更新时间为核心，时间越近分越高。
- 社区信号 40%：综合下载量、点赞、GitHub stars 与 forks 的对数尺度，避免单一大数垄断。
- 资料完整度 18%：描述、许可、任务/领域标签和来源质量。

这是一个可解释的发现排序，不代表数据集本身的法律合规、偏差、标注质量或安全性已经被人工审计；使用前仍应打开原始数据卡。

## Cloudflare Pages 设置

创建独立 Pages 项目并连接本仓库：

| 设置 | 值 |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空 |
| Node.js | `.node-version` 中的 `22` |

Cloudflare Pages 会自动识别根目录的 `functions/`，并将 `/api/refresh` 作为 Pages Function 部署。该函数只访问公开数据源，不需要把任何 GitHub 或 Cloudflare 密钥放进前端。

## 数据源

- Hugging Face Hub datasets API：AI、instruction、multimodal 关键词的最新/热门数据集。
- GitHub repository search API：最近更新与高 stars 的 AI / machine-learning dataset 项目。
- Zenodo records API：按 AI dataset 关键词检索近期公开记录。
