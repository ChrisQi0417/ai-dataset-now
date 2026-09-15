import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectDatasets } from "../src/lib/dataset-engine.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "src", "data", "datasets.json");

try {
  const snapshot = await collectDatasets({ limit: 50 });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`Wrote ${snapshot.itemCount} ranked datasets to ${path.relative(projectRoot, outputPath)}.`);
  console.log(JSON.stringify({ generatedAt: snapshot.generatedAt, sourceCounts: snapshot.sourceCounts }, null, 2));
} catch (error) {
  console.error(`Dataset refresh failed: ${error.message}`);
  process.exitCode = 1;
}

