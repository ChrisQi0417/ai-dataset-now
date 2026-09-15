const state = {
  snapshot: null,
  items: [],
  query: "",
  source: "all",
  sort: "score",
  live: false,
  loading: false
};

const feedList = document.querySelector("#feed-list");
const searchInput = document.querySelector("#search-input");
const sourceSelect = document.querySelector("#source-select");
const sortSelect = document.querySelector("#sort-select");
const refreshButton = document.querySelector("#refresh-button");
const feedStatus = document.querySelector("#feed-status");
const heroStatus = document.querySelector("#hero-status");

function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(Math.round(number));
}

function formatDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ageLabel(value) {
  if (!value) return "时间未知";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "时间未知";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return "刚刚更新";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days} 天前` : formatDate(value);
}

function setStatus(message, tone = "") {
  if (feedStatus) feedStatus.textContent = message;
  if (heroStatus) heroStatus.textContent = message;
  if (feedStatus) feedStatus.dataset.tone = tone;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

const TERM_TRANSLATIONS = [
  ["artificial intelligence", "人工智能"],
  ["ai for science", "AI 科学研究"],
  ["large language models", "大语言模型"],
  ["large language model", "大语言模型"],
  ["natural language processing", "自然语言处理"],
  ["convolutional neural networks", "卷积神经网络"],
  ["deep neural networks", "深度神经网络"],
  ["feature extraction", "特征提取"],
  ["text classification", "文本分类"],
  ["text generation", "文本生成"],
  ["image to image", "图像到图像"],
  ["data analysis", "数据分析"],
  ["data labels", "数据标签"],
  ["data mining", "数据挖掘"],
  ["data science", "数据科学"],
  ["research software", "科研软件"],
  ["scientific software", "科研软件"],
  ["software engineering", "软件工程"],
  ["high performance computing", "高性能计算"],
  ["paper triage", "论文筛选"],
  ["battery management systems", "电池管理系统"],
  ["capacity degradation", "容量衰减"],
  ["hybrid learning", "混合学习"],
  ["lithium ion battery", "锂离子电池"],
  ["performance evaluation", "性能评测"],
  ["model cards", "模型卡"],
  ["open dataset", "开放数据集"],
  ["awesome list", "精选清单"],
  ["ai safety", "AI 安全"],
  ["ai assisted", "AI 辅助"],
  ["source datasets", "来源数据集"],
  ["deep learning", "深度学习"],
  ["machine learning", "机器学习"],
  ["computer vision", "计算机视觉"],
  ["speaker diarization", "说话人分离"],
  ["object detection", "目标检测"],
  ["image classification", "图像分类"],
  ["image segmentation", "图像分割"],
  ["data quality", "数据质量"],
  ["data security", "数据安全"],
  ["embodied ai", "具身 AI"],
  ["agentic ai", "智能体 AI"],
  ["ai agent", "AI 智能体"],
  ["open source", "开源"],
  ["time series", "时间序列"],
  ["timeseries", "时间序列"],
  ["anomaly detection", "异常检测"],
  ["fraud detection", "欺诈检测"],
  ["benchmark", "基准测试"],
  ["evaluation", "评测"],
  ["multimodal", "多模态"],
  ["robotics", "机器人"],
  ["humanoid", "人形机器人"],
  ["datasets", "数据集"],
  ["dataset", "数据集"],
  ["database", "数据库"],
  ["tracking", "跟踪"],
  ["latency", "延迟"],
  ["prices", "价格"],
  ["price", "价格"],
  ["cost", "成本"],
  ["logs", "日志"],
  ["log", "日志"],
  ["processing", "处理"],
  ["framework", "框架"],
  ["tools", "工具"],
  ["tool", "工具"],
  ["library", "库"],
  ["research", "研究"],
  ["science", "科学"],
  ["repository", "代码仓库"],
  ["software", "软件"],
  ["preprint", "预印本"],
  ["presentation", "演示文稿"],
  ["journal", "期刊"],
  ["poster", "海报"],
  ["sft", "监督微调"],
  ["security", "安全"],
  ["models", "模型"],
  ["model", "模型"],
  ["training", "训练"],
  ["synthetics", "合成数据"],
  ["synthetic", "合成"],
  ["rollouts", "轨迹"],
  ["classification", "分类"],
  ["generation", "生成"],
  ["translation", "翻译"],
  ["language", "语言"],
  ["papers", "论文"],
  ["paper", "论文"],
  ["features", "特征"],
  ["feature", "特征"],
  ["images", "图像"],
  ["image", "图像"],
  ["video", "视频"],
  ["audio", "音频"],
  ["text", "文本"],
  ["tabular", "表格"],
  ["data", "数据"],
  ["ai", "AI"],
  ["radar", "雷达"],
  ["agent", "智能体"]
];

const TOPIC_RULES = [
  [/benchmark|evaluation|eval/, "模型评测"],
  [/multimodal/, "多模态"],
  [/language|llm|nlp|text|translation|dialog/, "语言与文本"],
  [/vision|image|video|segmentation|object detection/, "计算机视觉"],
  [/audio|speech|voice|diarization/, "语音与音频"],
  [/robot|embodied|humanoid|lerobot/, "机器人与具身智能"],
  [/tabular|csv|parquet|dataframe/, "表格数据"],
  [/time series|timeseries|temporal/, "时间序列"],
  [/(?:ai for science|scientific|physics|chemistry|biology|protein|enzyme)/, "AI 科学研究"],
  [/security|cyber|safety|attack|privacy/, "安全与可靠性"],
  [/anomaly|fraud|log/, "异常与日志分析"]
];

const bilingualCache = new WeakMap();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function translateTerms(value) {
  let text = String(value || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  TERM_TRANSLATIONS.forEach(([source, target]) => {
    text = text.replace(new RegExp(`\\b${escapeRegExp(source)}\\b`, "gi"), target);
  });
  return text.replace(/\s+([,.;:!?])/g, "$1");
}

function stripMarkup(value) {
  const container = document.createElement("div");
  container.innerHTML = String(value || "");
  return (container.textContent || "").replace(/\s+/g, " ").trim();
}

function getChineseTopics(item) {
  const haystack = `${item.title || ""} ${item.description || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  return TOPIC_RULES.filter(([pattern]) => pattern.test(haystack)).map(([, label]) => label).slice(0, 3);
}

function getChineseSummary(item) {
  const topics = getChineseTopics(item);
  const tags = [...new Set((item.tags || []).map((tag) => translateTerms(tag)).filter(Boolean))].slice(0, 5);
  const details = [];
  if (topics.length) details.push(`主题：${topics.join("、")}`);
  if (tags.length) details.push(`关键词：${tags.join("、")}`);
  if (item.format) details.push(`格式/载体：${translateTerms(item.format)}`);
  if (item.license && item.license !== "NOASSERTION") details.push(`许可：${item.license}`);
  return details.length ? `${details.join("；")}。` : "AI 数据资源条目，中文速览由标签与公开元数据自动整理。";
}

function getBilingualContent(item) {
  if (bilingualCache.has(item)) return bilingualCache.get(item);
  const englishTitle = item.title || item.fullName || "Unnamed dataset";
  const translatedTitle = translateTerms(englishTitle);
  const content = {
    titleZh: translatedTitle === englishTitle ? `AI 数据资源：${englishTitle}` : translatedTitle,
    titleEn: englishTitle,
    summaryZh: getChineseSummary(item),
    descriptionEn: stripMarkup(item.description) || "No dataset card description provided."
  };
  bilingualCache.set(item, content);
  return content;
}

function createDatasetCard(item, visibleRank) {
  const article = document.createElement("article");
  article.className = "dataset-item";

  const rank = createTextElement("div", "dataset-rank", `#${String(visibleRank).padStart(2, "0")}`);
  const content = document.createElement("div");
  content.className = "dataset-content";
  const titleLine = document.createElement("div");
  titleLine.className = "dataset-titleline";
  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = item.url || "#";
  link.target = "_blank";
  link.rel = "noreferrer";
  const bilingual = getBilingualContent(item);
  link.textContent = bilingual.titleZh;
  title.append(link);
  titleLine.append(title, createTextElement("span", "score-badge", String(item.score ?? "--")));

  const titleEnglish = createTextElement("p", "dataset-title-en", `English title / 英文标题：${bilingual.titleEn}`);
  const descriptionZh = createTextElement("p", "dataset-description-zh", `中文速览 / Chinese summary：${bilingual.summaryZh}`);
  const descriptionEn = createTextElement("p", "dataset-description-en", `English description / 英文简介：${bilingual.descriptionEn}`);
  const tags = document.createElement("div");
  tags.className = "dataset-tags";
  const tagValues = Array.isArray(item.tags) && item.tags.length ? item.tags.slice(0, 5) : [item.format || "Dataset"];
  tagValues.forEach((tag) => tags.append(createTextElement("span", "dataset-tag", tag)));
  const tagsBlock = document.createElement("div");
  tagsBlock.className = "dataset-tags-block";
  tagsBlock.append(createTextElement("span", "dataset-tags-label", "Tags / 标签"), tags);
  content.append(titleLine, titleEnglish, descriptionZh, descriptionEn, tagsBlock);

  const side = document.createElement("div");
  side.className = "dataset-side";
  const source = createTextElement("span", "source-badge", item.source || "Unknown");
  source.dataset.source = item.source || "";
  const opened = document.createElement("a");
  opened.className = "dataset-open";
  opened.href = item.url || "#";
  opened.target = "_blank";
  opened.rel = "noreferrer";
  opened.textContent = "打开来源 / Open source ↗";
  const metricText = item.source === "GitHub"
    ? `★ ${formatCount(item.metrics?.stars)} · 更新 / Updated ${ageLabel(item.updatedAt)}`
    : `↓ ${formatCount(item.metrics?.downloads)} · 下载 / Downloads · 更新 / Updated ${ageLabel(item.updatedAt)}`;
  side.append(source, opened, createTextElement("span", "dataset-metrics", metricText));

  article.append(rank, content, side);
  return article;
}

function getFilteredItems() {
  const query = state.query.trim().toLowerCase();
  const filtered = state.items.filter((item) => {
    const matchesSource = state.source === "all" || item.sourceKey === state.source;
    if (!matchesSource) return false;
    if (!query) return true;
    const bilingual = getBilingualContent(item);
    const haystack = [item.title, item.fullName, item.description, item.source, bilingual.titleZh, bilingual.summaryZh, ...(item.tags || [])].join(" ").toLowerCase();
    return haystack.includes(query);
  });

  return filtered.sort((left, right) => {
    if (state.sort === "freshness") return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
    if (state.sort === "popularity") return (right.popularity || 0) - (left.popularity || 0);
    return (right.score || 0) - (left.score || 0) || (left.rank || 0) - (right.rank || 0);
  });
}

function renderSourceSummary(snapshot) {
  const element = document.querySelector("#source-summary");
  if (!element) return;
  element.replaceChildren();
  const counts = snapshot?.sourceCounts || {};
  const rows = [
    ["Hugging Face", counts["Hugging Face"] || 0],
    ["GitHub", counts.GitHub || 0],
    ["Zenodo", counts.Zenodo || 0]
  ];
  const max = Math.max(1, ...rows.map(([, count]) => count));
  rows.forEach(([name, count]) => {
    const row = document.createElement("div");
    row.className = "source-bar-row";
    row.append(createTextElement("span", "", name));
    const bar = document.createElement("div");
    bar.className = "source-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(3, (count / max) * 100)}%`;
    bar.append(fill);
    row.append(bar, createTextElement("strong", "", String(count)));
    element.append(row);
  });
}

function renderSnapshot() {
  const snapshot = state.snapshot;
  const items = getFilteredItems();
  const top = state.items[0];
  const maxScore = Math.max(0, Number(top?.score) || 0);
  const updated = snapshot?.generatedAt;

  document.querySelector("#hero-count")?.replaceChildren(document.createTextNode(String(snapshot?.itemCount || state.items.length || 0)));
  document.querySelector("#hero-sources")?.replaceChildren(document.createTextNode(String(Object.keys(snapshot?.sourceCounts || {}).length || 0)));
  document.querySelector("#hero-top-score")?.replaceChildren(document.createTextNode(String(maxScore || "--")));
  const scoreTrack = document.querySelector("#hero-score-track");
  if (scoreTrack) scoreTrack.style.width = `${maxScore}%`;
  document.querySelector("#hero-updated")?.replaceChildren(document.createTextNode(formatDate(updated)));
  document.querySelector("#hero-freshness")?.replaceChildren(document.createTextNode(ageLabel(top?.updatedAt)));
  document.querySelector("#result-count")?.replaceChildren(document.createTextNode(`${items.length} 条结果`));
  document.querySelector("#last-updated")?.replaceChildren(document.createTextNode(`快照时间：${formatDateTime(updated)}`));
  renderSourceSummary(snapshot);

  if (!feedList) return;
  feedList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.append(createTextElement("strong", "", "没有匹配的数据集"), createTextElement("span", "", "换一个关键词或切换来源试试。"));
    feedList.append(empty);
    return;
  }
  items.forEach((item, index) => feedList.append(createDatasetCard(item, index + 1)));
}

async function getSnapshot(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error("invalid snapshot");
  return payload;
}

async function loadSnapshot() {
  try {
    const snapshot = await getSnapshot("/data/datasets.json");
    state.snapshot = snapshot;
    state.items = snapshot.items;
    state.live = false;
    setStatus(`每日快照 · ${snapshot.itemCount} 条`);
    renderSnapshot();
  } catch (error) {
    setStatus("快照读取失败", "error");
    if (feedList) {
      feedList.replaceChildren();
      const errorState = document.createElement("div");
      errorState.className = "error-state";
      errorState.append(createTextElement("strong", "暂时无法读取数据快照"), createTextElement("span", "请稍后刷新，或检查 Cloudflare Pages 构建输出。"));
      feedList.append(errorState);
    }
    console.error(error);
  }
}

async function refreshLive() {
  if (state.loading) return;
  state.loading = true;
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.querySelector(".refresh-label")?.replaceChildren(document.createTextNode("拉取中"));
  }
  setStatus("正在从上游拉取…");
  try {
    const snapshot = await getSnapshot("/api/refresh?limit=50");
    state.snapshot = snapshot;
    state.items = snapshot.items;
    state.live = true;
    setStatus(`即时刷新 · ${snapshot.itemCount} 条`);
    renderSnapshot();
  } catch (error) {
    setStatus("刷新失败，保留最近快照", "error");
    console.error(error);
  } finally {
    state.loading = false;
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.querySelector(".refresh-label")?.replaceChildren(document.createTextNode("刷新"));
    }
  }
}

searchInput?.addEventListener("input", (event) => { state.query = event.target.value; renderSnapshot(); });
sourceSelect?.addEventListener("change", (event) => { state.source = event.target.value; renderSnapshot(); });
sortSelect?.addEventListener("change", (event) => { state.sort = event.target.value; renderSnapshot(); });
refreshButton?.addEventListener("click", refreshLive);

loadSnapshot();
