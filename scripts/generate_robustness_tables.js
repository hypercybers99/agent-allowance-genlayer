const fs = require('fs');
const path = require('path');

const TARGETS = [
  { file: "cloudco/inv-a-120.md", slug: "inv_a_120_md", expectedAmt: 120, expectedCat: "CLOUD", expectedCurr: "USD" },
  { file: "cloudco/inv-a-120.html", slug: "inv_a_120_html", expectedAmt: 120, expectedCat: "CLOUD", expectedCurr: "USD" },
  { file: "datashop/inv-e-90.md", slug: "inv_e_90_md", expectedAmt: 90, expectedCat: "DATA", expectedCurr: "USD" },
  { file: "datashop/inv-f-eur.md", slug: "inv_f_eur_md", expectedAmt: 90, expectedCat: "DATA", expectedCurr: "EUR" },
  { file: "cloudco/inv-c-no-total.md", slug: "inv_c_no_total_md", expectedAmt: 0, expectedCat: "CLOUD", expectedCurr: "USD" },
  { file: "cloudco/inv-h-marketing.md", slug: "inv_h_marketing_md", expectedAmt: 60, expectedCat: "MARKETING", expectedCurr: "USD" },
];

function analyzeDir(dirPath, isReceiptBacked) {
  const stats = {};
  if (!fs.existsSync(dirPath)) return stats;

  for (const t of TARGETS) {
    let attempts = 0;
    let successes = 0;
    let parseSuccess = 0;
    let expectedHits = 0;
    const runFiles = [];

    for (let i = 1; i <= 10; i++) {
      const runFile = path.join(dirPath, `${t.slug}_run_${i}.json`);
      const attemptFile = path.join(dirPath, `${t.slug}_run_${i}_attempt_failed.json`);

      if (fs.existsSync(attemptFile)) {
        attempts++;
      }

      if (fs.existsSync(runFile)) {
        attempts++;
        try {
          const data = JSON.parse(fs.readFileSync(runFile, 'utf8'));
          runFiles.push(data);
          successes++;

          const pValid = data.parsed_valid !== undefined ? data.parsed_valid : data.isParseValid;
          if (pValid) parseSuccess++;

          const isHit = data.match !== undefined ? data.match : data.isExpectedHit;
          if (isHit) expectedHits++;
        } catch (e) {
          // ignore error
        }
      }
    }

    stats[t.file] = {
      slug: t.slug,
      attempts,
      successes,
      parseSuccess,
      expectedHits,
      passRate: `${expectedHits}/${attempts || 10}`,
      passed: parseSuccess === 10 && expectedHits >= 9,
      isReceiptBacked,
      runs: runFiles,
    };
  }

  return stats;
}

function main() {
  console.log("=======================================================================================================================");
  console.log("ROBUSTNESS EVALUATION COMPARISON: HARVESTED BATCH (UNRECEIPTED) VS RECEIPT-BACKED BATCH (ON-CHAIN RECORD)");
  console.log("=======================================================================================================================");

  const harvestedDir = path.join(__dirname, '../docs/evidence/robustness_harvested');
  const receiptDir = path.join(__dirname, '../docs/evidence/robustness');

  const harvestedStats = analyzeDir(harvestedDir, false);
  const receiptStats = analyzeDir(receiptDir, true);

  console.log("\n### BATCH 1: HARVESTED BATCH (UNRECEIPTED VIEW READS)");
  console.log("| Target Document | Slug | Attempts | Successes | Parse Success (10/10) | Expected Hits (>=9/10) | Pass Rate | Status |");
  console.log("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |");
  for (const [file, st] of Object.entries(harvestedStats)) {
    console.log(`| \`${file}\` | \`${st.slug}\` | ${st.attempts} | ${st.successes} | ${st.parseSuccess}/10 | ${st.expectedHits}/10 | ${st.passRate} | ${st.passed ? "**PASS** (unreceipted)" : "**FAIL**"} |`);
  }

  console.log("\n### BATCH 2: RECEIPT-BACKED BATCH (ON-CHAIN EVIDENCE OF RECORD)");
  console.log("| Target Document | Slug | Attempts | Successes | Parse Success (10/10) | Expected Hits (>=9/10) | Pass Rate | Status |");
  console.log("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |");
  for (const [file, st] of Object.entries(receiptStats)) {
    console.log(`| \`${file}\` | \`${st.slug}\` | ${st.attempts} | ${st.successes} | ${st.parseSuccess}/10 | ${st.expectedHits}/10 | ${st.passRate} | ${st.passed ? "**PASS** (receipt-backed)" : (st.attempts < 10 ? "*IN PROGRESS*" : "**FAIL**")} |`);
  }

  // Summary counts
  let hTotalRuns = 0;
  let hTotalHits = 0;
  for (const st of Object.values(harvestedStats)) {
    hTotalRuns += st.successes;
    hTotalHits += st.expectedHits;
  }

  let rTotalRuns = 0;
  let rTotalHits = 0;
  for (const st of Object.values(receiptStats)) {
    rTotalRuns += st.successes;
    rTotalHits += st.expectedHits;
  }

  console.log(`\nHarvested Batch Totals:     ${hTotalHits}/${hTotalRuns} (${hTotalRuns === 60 ? "60/60 Completed" : hTotalRuns + " runs"})`);
  console.log(`Receipt-Backed Batch Totals: ${rTotalHits}/${rTotalRuns} (${rTotalRuns === 60 ? "60/60 Completed" : rTotalRuns + " completed so far"})`);
}

main();
