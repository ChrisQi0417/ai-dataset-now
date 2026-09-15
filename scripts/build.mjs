import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectRoot, "src");
const outputDirectory = path.join(projectRoot, "dist");
const requiredFiles = ["index.html", "styles.css", "app.js", "_headers", "data/datasets.json"];

for (const file of requiredFiles) {
  const filePath = path.join(sourceDirectory, file);
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Missing required source file: ${path.relative(projectRoot, filePath)}`);
  }
}

await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.cp(sourceDirectory, outputDirectory, { recursive: true });

const buildInfo = {
  name: "ai-dataset-now",
  builtAt: new Date().toISOString(),
  branch: process.env.CF_PAGES_BRANCH || "local",
  commit: process.env.CF_PAGES_COMMIT_SHA || "local",
  deploymentUrl: process.env.CF_PAGES_URL || null
};

await fs.writeFile(
  path.join(outputDirectory, "build-info.json"),
  `${JSON.stringify(buildInfo, null, 2)}\n`,
  "utf8"
);

console.log(`Built ${path.relative(projectRoot, outputDirectory)} for Cloudflare Pages.`);
console.log(JSON.stringify(buildInfo, null, 2));

