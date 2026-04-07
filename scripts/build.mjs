import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const ROOT = process.cwd();
const DIST_DIR = join(ROOT, "dist");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));

execFileSync("yarn", ["lint"], { cwd: ROOT, stdio: "inherit" });
execFileSync("yarn", ["test"], { cwd: ROOT, stdio: "inherit" });

mkdirSync(DIST_DIR, { recursive: true });

const manifest = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  generatedAt: new Date().toISOString(),
  scripts: pkg.scripts,
  runtime: "node",
  buildNote: "This project does not transpile source. Build generates metadata and verifies quality gates.",
};

writeFileSync(
  join(DIST_DIR, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log("Build complete: dist/manifest.json generated.");
