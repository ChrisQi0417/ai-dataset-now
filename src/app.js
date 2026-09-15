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
  link.textContent = item.title || item.fullName || "未命名数据集";
  title.append(link);
  titleLine.append(title, createTextElement("span", "score-badge", String(item.score ?? "--")));

  const description = createTextElement("p", "dataset-description", item.description || "暂无数据卡描述。");
  const tags = document.createElement("div");
  tags.className = "dataset-tags";
  const tagValues = Array.isArray(item.tags) && item.tags.length ? item.tags.slice(0, 5) : [item.format || "Dataset"];
  tagValues.forEach((tag) => tags.append(createTextElement("span", "dataset-tag", tag)));
  content.append(titleLine, description, tags);

  const side = document.createElement("div");
  side.className = "dataset-side";
  const source = createTextElement("span", "source-badge", item.source || "Unknown");
  source.dataset.source = item.source || "";
  const opened = document.createElement("a");
  opened.className = "dataset-open";
  opened.href = item.url || "#";
  opened.target = "_blank";
  opened.rel = "noreferrer";
  opened.textContent = "打开来源 ↗";
  const metricText = item.source === "GitHub"
    ? `★ ${formatCount(item.metrics?.stars)} · 更新 ${ageLabel(item.updatedAt)}`
    : `↓ ${formatCount(item.metrics?.downloads)} · 更新 ${ageLabel(item.updatedAt)}`;
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
    const haystack = [item.title, item.fullName, item.description, item.source, ...(item.tags || [])].join(" " ).toLowerCase();
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
      errorState.append(createTextElement("strong", "", "暂时无法读取数据快照"), createTextElement("span", "", "请稍后刷新，或检查 Cloudflare Pages 构建输出。"));
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
