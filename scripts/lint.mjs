import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { execFileSync } from "child_process";

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([".git", ".yarn", "dist"]);
const TARGET_EXTENSIONS = new Set([".js", ".mjs"]);

function walk(directory, results = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) {
        walk(fullPath, results);
      }
      continue;
    }

    if ([...TARGET_EXTENSIONS].some((extension) => fullPath.endsWith(extension))) {
      results.push(fullPath);
    }
  }

  return results;
}

const files = walk(ROOT).sort();
const styleErrors = [];

for (const file of files) {
  const contents = readFileSync(file, "utf-8");
  const lines = contents.split("\n");

  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) {
      styleErrors.push(`${relative(ROOT, file)}:${index + 1} trailing whitespace`);
    }
    if (/\t/.test(line)) {
      styleErrors.push(`${relative(ROOT, file)}:${index + 1} tab character found`);
    }
  });

  if (!contents.endsWith("\n")) {
    styleErrors.push(`${relative(ROOT, file)} missing final newline`);
  }

  execFileSync("node", ["--check", file], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

if (styleErrors.length > 0) {
  console.error("Lint errors:");
  for (const error of styleErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Lint passed for ${files.length} files.`);
