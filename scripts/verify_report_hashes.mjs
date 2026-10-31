import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function main() {
  console.log("=================================================================================");
  console.log("VERIFY FINAL REPORT HASHES & ADDRESSES (scripts/verify_report_hashes.mjs)");
  console.log("=================================================================================");

  const reportFile = path.join(rootDir, 'docs/FINAL_REPORT.md');
  if (!fs.existsSync(reportFile)) {
    console.error(`ERROR: ${reportFile} does not exist yet.`);
    process.exit(1);
  }

  const content = fs.readFileSync(reportFile, 'utf8');

  // Extract addresses: 0x followed by 40 hex chars
  const addressMatches = content.match(/0x[a-fA-F0-9]{40}\b/g) || [];
  // Extract 64-hex hashes (with or without 0x)
  const hashWith0x = content.match(/0x[a-fA-F0-9]{64}\b/g) || [];
  const bare64Hex = content.match(/\b[a-fA-F0-9]{64}\b/g) || [];

  const allTokens = [...new Set([...addressMatches, ...hashWith0x, ...bare64Hex])];
  console.log(`Discovered ${allTokens.length} unique addresses/hashes in docs/FINAL_REPORT.md.\n`);

  let verifiedCount = 0;
  let unknownCount = 0;
  const unknownList = [];

  for (const token of allTokens) {
    let found = false;

    // 1. Search in git commit history
    try {
      const gitLogCheck = execSync(`git log --all --grep="${token}" -n 1 --oneline`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      if (gitLogCheck.trim().length > 0) {
        found = true;
      }
    } catch (e) {}

    // 2. Search in git rev-parse / commit hashes
    if (!found) {
      try {
        const revCheck = execSync(`git rev-parse --verify "${token}^{commit}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        if (revCheck.trim().length > 0) {
          found = true;
        }
      } catch (e) {}
    }

    // 3. Search in repository files (including untracked files, excluding FINAL_REPORT.md itself)
    if (!found) {
      try {
        const grepOutput = execSync(`git grep --untracked -F -l "${token}" -- ":!docs/FINAL_REPORT.md"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        if (grepOutput.trim().length > 0) {
          found = true;
        }
      } catch (e) {}
    }

    if (found) {
      verifiedCount++;
    } else {
      unknownCount++;
      unknownList.push(token);
    }
  }

  console.log(`Total Tokens Checked: ${allTokens.length}`);
  console.log(`Verified in Repo/Git: ${verifiedCount}`);

  if (unknownCount > 0) {
    console.log(`\nFAILED: Found ${unknownCount} unknown tokens not present in repository files or git history:`);
    for (const u of unknownList) {
      console.log(`  - UNKNOWN: ${u}`);
    }
    process.exit(1);
  } else {
    console.log(`\nPASSED: All ${allTokens.length} addresses and hashes in docs/FINAL_REPORT.md exist in repo or git history!`);
    process.exit(0);
  }
}

main();
