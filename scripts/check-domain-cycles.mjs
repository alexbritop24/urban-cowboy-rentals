import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve("src/domain");
const files = [];

const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath);
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(absolutePath);
  }
};

walk(root);
const graph = new Map();

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const dependencies = [];
  const importPattern = /(?:import|export)[\s\S]*?from\s+["'](\.{1,2}\/[^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    const base = path.resolve(path.dirname(file), match[1]);
    const candidate = [base + ".ts", base + ".tsx", path.join(base, "index.ts")]
      .find((value) => existsSync(value));
    if (candidate) dependencies.push(candidate);
  }

  graph.set(file, dependencies);
}

const visited = new Set();
const active = new Set();
const cycles = [];

const visit = (file, trail) => {
  if (active.has(file)) {
    cycles.push([...trail, file].map((entry) => path.relative(root, entry)));
    return;
  }
  if (visited.has(file)) return;

  visited.add(file);
  active.add(file);
  for (const dependency of graph.get(file) ?? []) {
    visit(dependency, [...trail, file]);
  }
  active.delete(file);
};

for (const file of files) visit(file, []);

if (cycles.length > 0) {
  console.error(JSON.stringify({ cycles }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ domainFiles: files.length, circularDependencies: 0 }));
}
