const DEFAULT_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

const SOURCES = [
  {
    key: "hf-latest",
    label: "Hugging Face",
    kind: "huggingface",
    url: "https://huggingface.co/api/datasets?search=llm&limit=100&sort=lastModified&direction=-1&full=true"
  },
  {
    key: "hf-popular",
    label: "Hugging Face",
    kind: "huggingface",
    url: "https://huggingface.co/api/datasets?search=instruction&limit=100&sort=downloads&direction=-1&full=true"
  },
  {
    key: "hf-multimodal",
    label: "Hugging Face",
    kind: "huggingface",
    url: "https://huggingface.co/api/datasets?search=multimodal&limit=100&sort=lastModified&direction=-1&full=true"
  },
  {
    key: "github-latest",
    label: "GitHub",
    kind: "github",
    url: "https://api.github.com/search/repositories?q=ai+dataset+stars:%3E%3D10+archived:false&sort=updated&order=desc&per_page=100"
  },
  {
    key: "github-popular",
    label: "GitHub",
    kind: "github",
    url: "https://api.github.com/search/repositories?q=dataset+machine-learning+stars:%3E%3D50+archived:false&sort=stars&order=desc&per_page=100"
  },
  {
    key: "zenodo-ai",
    label: "Zenodo",
    kind: "zenodo",
    url: "https://zenodo.org/api/records?q=AI%20dataset&sort=mostrecent&size=25"
  }
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function textOrFallback(value, fallback) {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/\s+/g, " " ).trim();
  return text || fallback;
}

function compactDescription(value, fallback) {
  const text = textOrFallback(value, fallback);
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
}

function uniqueStrings(values, limit = 6) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const cleaned = value
      .replace(/^task_categories:/, "")
      .replace(/^task_ids:/, "")
      .replace(/^modality:/, "")
      .replace(/^languages:/, "")
      .replace(/[_-]+/g, " " )
      .trim();
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue;
    seen.add(cleaned.toLowerCase());
    result.push(cleaned);
    if (result.length >= limit) break;
  }

  return result;
}

function titleFromId(id) {
  const value = textOrFallback(id, "Untitled dataset");
  const name = value.split("/").pop() || value;
  return name
    .replace(/[-_]+/g, " " )
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSourceId(prefix, value) {
  return `${prefix}:${textOrFallback(value, "unknown")}`;
}

function normalizeHuggingFace(item) {
  const id = textOrFallback(item?.id || item?._id, "");
  if (!id) return null;

  const cardData = item.cardData && typeof item.cardData === "object" ? item.cardData : {};
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const taskTags = tags.filter((tag) =>
    /task_categories:|task_ids:|modality:|languages:/i.test(String(tag))
  );
  const updatedAt = safeDate(item.lastModified || item.createdAt);

  return {
    id: formatSourceId("hf", id),
    title: titleFromId(id),
    fullName: id,
    description: compactDescription(
      cardData.description || item.description,
      "Hugging Face Hub 上的 AI 数据集，建议打开数据卡查看字段、许可和使用方式。"
    ),
    source: "Hugging Face",
    sourceKey: "huggingface",
    url: `https://huggingface.co/datasets/${encodeURIComponent(id).replace(/%2F/g, "/")}`,
    updatedAt,
    license: textOrFallback(cardData.license || item.license, "未标注"),
    format: "Dataset",
    tags: uniqueStrings([...taskTags, ...tags]),
    metrics: {
      downloads: numberOrZero(item.downloads || item.downloadsAllTime),
      likes: numberOrZero(item.likes),
      stars: 0,
      forks: 0
    },
    quality: {
      hasDescription: Boolean(cardData.description || item.description),
      hasLicense: Boolean(cardData.license || item.license),
      tagCount: taskTags.length,
      isFork: false,
      isDirectDataset: true
    }
  };
}

function normalizeGitHub(item) {
  const fullName = textOrFallback(item?.full_name, "");
  if (!fullName) return null;

  const topics = Array.isArray(item.topics) ? item.topics : [];
  const tags = uniqueStrings([...topics, item.language].filter(Boolean));
  const datasetSignals = [item.name, item.description, ...topics].filter(Boolean).join(" " );
  const nameSignal = /\b(dataset|datasets|corpus|benchmark)\b/i.test(textOrFallback(item.name, ""));
  const topicSignal = topics.some((topic) => /\b(dataset|datasets|corpus|benchmark)\b/i.test(String(topic)));
  const descriptionSignal = /\b(collection of|curated list of|repository of|datasets? ready|dataset release|contains? .*datasets?|training data|benchmark data)\b/i.test(textOrFallback(item.description, ""));
  const toolSignal = /\b(platform|framework|tool|library|sdk|annotation|viewer|package|devops|service)\b/i.test(datasetSignals);
  const updatedAt = safeDate(item.pushed_at || item.updated_at || item.created_at);

  return {
    id: formatSourceId("github", fullName),
    title: textOrFallback(item.name, titleFromId(fullName)),
    fullName,
    description: compactDescription(
      item.description,
      "GitHub 上与 AI / 机器学习数据相关的开源项目。"
    ),
    source: "GitHub",
    sourceKey: "github",
    url: textOrFallback(item.html_url, `https://github.com/${fullName}`),
    updatedAt,
    license: textOrFallback(item.license?.spdx_id || item.license?.name, "未标注"),
    format: item.language ? `${item.language} repository` : "Open source",
    tags,
    metrics: {
      downloads: 0,
      likes: numberOrZero(item.stargazers_count),
      stars: numberOrZero(item.stargazers_count),
      forks: numberOrZero(item.forks_count)
    },
    quality: {
      hasDescription: Boolean(item.description),
      hasLicense: Boolean(item.license),
      tagCount: topics.length,
      isFork: Boolean(item.fork),
      isDirectDataset: nameSignal || descriptionSignal || (!toolSignal && topicSignal)
    }
  };
}

function normalizeKaggle(item) {
  const ref = textOrFallback(item?.ref || item?.datasetRef, "");
  if (!ref) return null;

  const tags = Array.isArray(item.tags)
    ? item.tags.map((tag) => (typeof tag === "string" ? tag : tag?.name)).filter(Boolean)
    : [];
  const updatedAt = safeDate(item.lastUpdated || item.lastUpdatedDate || item.createdDate);
  const url = textOrFallback(item.url, `https://www.kaggle.com/datasets/${ref}`);

  return {
    id: formatSourceId("kaggle", ref),
    title: textOrFallback(item.title, titleFromId(ref)),
    fullName: ref,
    description: compactDescription(
      item.subtitle || item.description,
      "Kaggle 社区中的 AI 数据集，打开页面查看文件结构和使用许可。"
    ),
    source: "Kaggle",
    sourceKey: "kaggle",
    url,
    updatedAt,
    license: textOrFallback(item.licenseName, "未标注"),
    format: "Dataset",
    tags: uniqueStrings(tags),
    metrics: {
      downloads: numberOrZero(item.downloadCount || item.downloads),
      likes: numberOrZero(item.voteCount || item.votes),
      stars: 0,
      forks: 0
    },
    quality: {
      hasDescription: Boolean(item.subtitle || item.description),
      hasLicense: Boolean(item.licenseName),
      tagCount: tags.length,
      isFork: false
    }
  };
}

function normalizeZenodo(item) {
  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const recordId = textOrFallback(item?.id == null ? "" : String(item.id), "");
  if (!recordId) return null;

  const keywords = Array.isArray(metadata.keywords) ? metadata.keywords : [];
  const resourceType = metadata.resource_type?.title || metadata.resource_type?.type || "Dataset";
  const searchableText = [metadata.title, metadata.description, ...keywords].filter(Boolean).join(" " );
  const aiSignal = /\b(artificial intelligence|machine learning|deep learning|neural network|large language model|\bllm\b|computer vision|natural language processing|robotics|benchmark|model training|geometric deep learning)\b/i.test(searchableText);
  const updatedAt = safeDate(item.modified || item.updated || metadata.publication_date);
  const landingPage = textOrFallback(item.links?.html, `https://zenodo.org/records/${recordId}`);

  return {
    id: formatSourceId("zenodo", recordId),
    title: textOrFallback(metadata.title, `Zenodo record ${recordId}`),
    fullName: `zenodo:${recordId}`,
    description: compactDescription(
      metadata.description,
      "Zenodo 上公开发布的 AI 数据记录，打开原始页面查看文件、版本与许可。"
    ),
    source: "Zenodo",
    sourceKey: "zenodo",
    url: landingPage,
    updatedAt,
    license: textOrFallback(metadata.license?.id || metadata.rights?.[0]?.title, "未标注"),
    format: resourceType,
    tags: uniqueStrings([...keywords, metadata.subjects?.map((subject) => subject?.term).filter(Boolean) || []].flat()),
    metrics: {
      downloads: numberOrZero(item.stats?.downloads || item.stats?.unique_downloads),
      likes: numberOrZero(item.stats?.unique_downloads),
      stars: 0,
      forks: 0
    },
    quality: {
      hasDescription: Boolean(metadata.description),
      hasLicense: Boolean(metadata.license || metadata.rights?.length),
      tagCount: keywords.length,
      isFork: false,
      isDirectDataset: /\b(dataset|data)\b/i.test(`${resourceType} ${searchableText}`),
      isAiRelevant: aiSignal
    }
  };
}

function ageInDays(value, now) {
  if (!value) return 365;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 365;
  return Math.max(0, (now.getTime() - timestamp) / DAY_MS);
}

function scoreDataset(item, now) {
  const age = ageInDays(item.updatedAt, now);
  const freshness = clamp(100 * Math.exp(-age / 55), 0, 100);
  const popularityRaw =
    Math.log10(1 + item.metrics.downloads) * 10 +
    Math.log10(1 + item.metrics.stars) * 8 +
    Math.log10(1 + item.metrics.likes) * 4 +
    Math.log10(1 + item.metrics.forks) * 3;
  const popularity = clamp(popularityRaw, 0, 100);
  const quality = clamp(
    24 +
      (item.quality.hasDescription ? 20 : 0) +
      (item.quality.hasLicense ? 16 : 0) +
      Math.min(item.quality.tagCount * 4, 20) +
      (item.quality.isDirectDataset ? 15 : -15) +
      (item.sourceKey === "huggingface" ? 5 : 0) -
      (item.quality.isFork ? 25 : 0),
    0,
    100
  );

  return {
    score: Math.round(0.42 * freshness + 0.4 * popularity + 0.18 * quality),
    freshness: Math.round(freshness),
    popularity: Math.round(popularity),
    quality: Math.round(quality)
  };
}

async function fetchJson(fetchImpl, source) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = {
    Accept: source.kind === "github" ? "application/vnd.github+json" : "application/json",
    "User-Agent": "ai-dataset-now/1.0"
  };

  try {
    const response = await fetchImpl(source.url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizePayload(source, payload) {
  if (source.kind === "huggingface") {
    return Array.isArray(payload) ? payload.map(normalizeHuggingFace).filter(Boolean) : [];
  }
  if (source.kind === "github") {
    return Array.isArray(payload?.items) ? payload.items.map(normalizeGitHub).filter(Boolean) : [];
  }
  if (source.kind === "zenodo") {
    return Array.isArray(payload?.hits?.hits) ? payload.hits.hits.map(normalizeZenodo).filter(Boolean) : [];
  }
  return Array.isArray(payload) ? payload.map(normalizeKaggle).filter(Boolean) : [];
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    const existing = map.get(item.id);
    if (!existing || (item.description.length > existing.description.length && item.tags.length >= existing.tags.length)) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
}

export async function collectDatasets({ fetchImpl = globalThis.fetch, now = new Date(), limit = DEFAULT_LIMIT } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch is not available in this runtime");

  const settled = await Promise.allSettled(SOURCES.map((source) => fetchJson(fetchImpl, source)));
  const rawItems = [];
  const sourceStatus = [];

  settled.forEach((result, index) => {
    const source = SOURCES[index];
    if (result.status === "fulfilled") {
      const items = normalizePayload(source, result.value);
      rawItems.push(...items);
      sourceStatus.push({ source: source.label, endpoint: source.key, status: "ok", count: items.length });
    } else {
      sourceStatus.push({
        source: source.label,
        endpoint: source.key,
        status: "error",
        count: 0,
        error: textOrFallback(result.reason?.message, "upstream unavailable")
      });
    }
  });

  const rankedCandidates = dedupe(rawItems)
    .filter((item) => !item.quality.isFork)
    .filter((item) => item.sourceKey !== "github" || item.quality.isDirectDataset)
    .filter((item) => item.sourceKey !== "zenodo" || item.quality.isAiRelevant)
    .map((item) => {
      const score = scoreDataset(item, now);
      return { ...item, ...score, signals: item.quality, quality: score.quality };
    })
    .sort((left, right) =>
      right.score - left.score ||
      new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime() ||
      left.title.localeCompare(right.title)
    )
    ;

  const requestedLimit = clamp(Number(limit) || DEFAULT_LIMIT, 1, DEFAULT_LIMIT);
  const sourceQuotas = { "Hugging Face": 24, GitHub: 18, Zenodo: 8 };
  const selected = [];
  const selectedIds = new Set();
  const selectedBySource = {};

  for (const item of rankedCandidates) {
    const quota = sourceQuotas[item.source] ?? requestedLimit;
    const used = selectedBySource[item.source] || 0;
    if (used >= quota || selected.length >= requestedLimit) continue;
    selected.push(item);
    selectedIds.add(item.id);
    selectedBySource[item.source] = used + 1;
  }

  if (selected.length < requestedLimit) {
    for (const item of rankedCandidates) {
      if (selected.length >= requestedLimit) break;
      if (selectedIds.has(item.id)) continue;
      selected.push(item);
      selectedIds.add(item.id);
    }
  }

  const uniqueItems = selected
    .sort((left, right) => right.score - left.score || new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime() || left.title.localeCompare(right.title))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  if (!uniqueItems.length) {
    throw new Error("No dataset sources returned usable records");
  }

  const sourceCounts = uniqueItems.reduce((counts, item) => {
    counts[item.source] = (counts[item.source] || 0) + 1;
    return counts;
  }, {});

  return {
    version: 1,
    generatedAt: now.toISOString(),
    itemCount: uniqueItems.length,
    ranking: {
      freshnessWeight: 0.42,
      popularityWeight: 0.4,
      qualityWeight: 0.18,
      note: "综合最近更新时间、社区使用信号、描述/许可/标签完整度"
    },
    sourceCounts,
    sourceStatus,
    items: uniqueItems
  };
}

export { SOURCES };
