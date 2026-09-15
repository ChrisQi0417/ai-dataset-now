import { collectDatasets } from "../../src/lib/dataset-engine.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const requestedLimit = Number(requestUrl.searchParams.get("limit") || 50);
  const limit = Math.min(50, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 50));

  try {
    const snapshot = await collectDatasets({ fetchImpl: fetch, limit });
    return json({ ...snapshot, mode: "live" });
  } catch (error) {
    return json(
      {
        error: "live_refresh_failed",
        message: "上游数据源暂时不可用，请稍后重试。"
      },
      502
    );
  }
}

