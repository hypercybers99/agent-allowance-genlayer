import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getDocFiles() {
  const files = [];
  const readme = path.join(rootDir, 'README.md');
  if (fs.existsSync(readme)) files.push(readme);

  const docsDir = path.join(rootDir, 'docs');
  if (fs.existsSync(docsDir)) {
    const list = fs.readdirSync(docsDir);
    for (const f of list) {
      if (f.endsWith('.md')) {
        files.push(path.join(docsDir, f));
      }
    }
  }
  return files;
}

function extractPaths(content) {
  const cleaned = [];

  // 1. Matches docs/..., scripts/..., contracts/...
  const regex = /\b(docs|scripts|contracts)\/[a-zA-Z0-9_./-]+(?:\.[a-zA-Z0-9]+)?/g;
  const matches = content.match(regex) || [];
  for (let m of matches) {
    m = m.replace(/[.,:;)"'`>]+$/, '');
    cleaned.push(m);
  }

  // 2. Matches markdown links [label](path)
  const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(content)) !== null) {
    let p = linkMatch[1];
    if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('#')) {
      continue;
    }
    p = p.replace(/[?#].*$/, '').replace(/[.,:;)"'`>]+$/, '');
    if (p.startsWith('/') || p.startsWith('./') || p.startsWith('../') || p.startsWith('docs/') || p.startsWith('scripts/') || p.startsWith('contracts/')) {
      cleaned.push(p);
    }
  }

  return [...new Set(cleaned)];
}

function main() {
  console.log("=================================================");
  console.log("CHECK DOCUMENTATION FILE PATHS (scripts/check_doc_paths.mjs)");
  console.log("=================================================");

  const files = getDocFiles();
  console.log(`Scanned ${files.length} markdown documentation files.\n`);

  let totalReferences = 0;
  let missingCount = 0;
  const missingByDoc = {};

  for (const docFile of files) {
    const relDoc = path.relative(rootDir, docFile).replace(/\\/g, '/');
    const content = fs.readFileSync(docFile, 'utf8');
    const paths = extractPaths(content);

    for (const refPath of paths) {
      // Ignore placeholder patterns with asterisks or angle brackets
      if (refPath.includes('*') || refPath.includes('<') || refPath.includes('>')) {
        continue;
      }
      totalReferences++;
      const fullFromRoot = path.join(rootDir, refPath);
      const fullFromDoc = path.join(path.dirname(docFile), refPath);

      if (!fs.existsSync(fullFromRoot) && !fs.existsSync(fullFromDoc)) {
        missingCount++;
        if (!missingByDoc[relDoc]) missingByDoc[relDoc] = [];
        missingByDoc[relDoc].push(refPath);
      }
    }
  }

  console.log(`Total Path References Checked: ${totalReferences}`);
  if (missingCount > 0) {
    console.log(`FAILED: Found ${missingCount} missing referenced paths:\n`);
    for (const [doc, list] of Object.entries(missingByDoc)) {
      console.log(`In ${doc}:`);
      for (const p of list) {
        console.log(`  - MISSING: ${p}`);
      }
    }
    process.exit(1);
  } else {
    console.log(`PASSED: All referenced documentation paths exist on disk!`);
    process.exit(0);
  }
}

main();
