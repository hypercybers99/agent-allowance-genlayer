const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const { createClient, chains, createAccount } = require('genlayer-js');

const CONTRACT_ADDR = "0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997";
const PROMPT_SHA = "990f3801f114c0a5a22839b2ae82c0f99a5e82b794129994c5e3d74da05f31eb";

function parseExtractionJs(text) {
  if (!text || typeof text !== 'string') return { valid: false };
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try {
    const data = JSON.parse(cleaned);
    if (typeof data !== 'object' || data === null) return { valid: false };
    const expectedKeys = ["category", "amount", "currency", "quote"];
    const keys = Object.keys(data);
    if (keys.length !== 4) return { valid: false };
    for (const k of expectedKeys) if (!keys.includes(k)) return { valid: false };
    if (typeof data.amount !== 'number' || typeof data.category !== 'string') return { valid: false };
    return {
      valid: true,
      category: data.category,
      amount: data.amount,
      currency: data.currency,
      quote: data.quote,
    };
  } catch (e) {
    return { valid: false };
  }
}

async function readWithRetry(client, key) {
  let retries = 15;
  while (retries > 0) {
    try {
      return await client.readContract({
        address: CONTRACT_ADDR,
        functionName: 'get_result',
        args: [key],
      });
    } catch (err) {
      if (err.message && err.message.includes("Rate limit exceeded")) {
        const waitSec = err.cause?.data?.retry_after_seconds || 5;
        console.log(`    [Rate Limit on ${key}] waiting ${waitSec}s...`);
        await new Promise(r => setTimeout(r, (waitSec + 2) * 1000));
        retries--;
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: HARVEST RAW ROBUSTNESS EVIDENCE");
  console.log("=================================================");

  const outDir = path.join(__dirname, '../docs/evidence/robustness');
  fs.mkdirSync(outDir, { recursive: true });

  const client = createClient({
    chain: chains.studionet,
    account: createAccount(),
  });

  const targets = [
    { file: "cloudco/inv-a-120.md", slug: "inv_a_120_md", keyPrefix: "inv-a-120.md", expectedAmt: 120, expectedCat: "CLOUD" },
    { file: "cloudco/inv-a-120.html", slug: "inv_a_120_html", keyPrefix: "inv-a-120.html", expectedAmt: 120, expectedCat: "CLOUD" },
    { file: "datashop/inv-e-90.md", slug: "inv_e_90_md", keyPrefix: "inv-e-90.md", expectedAmt: 90, expectedCat: "DATA" },
    { file: "datashop/inv-f-eur.md", slug: "inv_f_eur_md", keyPrefix: "inv-f-eur.md", expectedAmt: 90, expectedCat: "DATA" },
    { file: "cloudco/inv-c-no-total.md", slug: "inv_c_no_total_md", keyPrefix: "inv-c-rerun", expectedAmt: 0, expectedCat: "CLOUD" },
    { file: "cloudco/inv-h-marketing.md", slug: "inv_h_marketing_md", keyPrefix: "inv-h-marketing.md", expectedAmt: 60, expectedCat: "MARKETING" },
  ];

  // Load inv-c-rerun if available for tx hashes
  const rerunFile = path.join(__dirname, '../docs/evidence/inv_c_rerun.json');
  let rerunRuns = [];
  if (fs.existsSync(rerunFile)) {
    rerunRuns = JSON.parse(fs.readFileSync(rerunFile, 'utf8')).runs || [];
  }

  const overallResults = {
    contractAddress: CONTRACT_ADDR,
    promptSha256: PROMPT_SHA,
    timestamp: new Date().toISOString(),
    summary: {},
    allPassed: true,
  };

  for (const t of targets) {
    console.log(`\nHarvesting target: ${t.file}...`);
    const fixturePath = path.join(__dirname, '../fixtures', t.file);
    const inputText = fs.existsSync(fixturePath) ? fs.readFileSync(fixturePath, 'utf8') : "Fixture content pinned on GitHub";

    const targetRuns = [];
    let parseCount = 0;
    let hitCount = 0;

    for (let i = 1; i <= 10; i++) {
      const key = `${t.keyPrefix}_${i}`;
      let rawOutput = "";
      let txHash = null;

      if (t.keyPrefix === "inv-c-rerun" && rerunRuns[i - 1]) {
        rawOutput = rerunRuns[i - 1].rawOutput;
        txHash = rerunRuns[i - 1].txHash;
      } else {
        rawOutput = await readWithRetry(client, key);
        // Add 2.2s sleep between chain reads to stay under 30 req/min
        await new Promise(r => setTimeout(r, 2200));
      }

      const parsed = parseExtractionJs(rawOutput);
      const isParseOk = parsed.valid;
      if (isParseOk) parseCount++;

      let isHit = false;
      if (isParseOk) {
        if (t.expectedAmt === 0) {
          isHit = (parsed.amount === 0);
        } else {
          isHit = (parsed.amount === t.expectedAmt && parsed.category === t.expectedCat);
        }
        if (isHit) hitCount++;
      }

      const runRecord = {
        target: t.file,
        runIndex: i,
        resultKey: key,
        contractAddress: CONTRACT_ADDR,
        promptSha256: PROMPT_SHA,
        inputText: inputText.slice(0, 500) + (inputText.length > 500 ? "... [truncated for brevity]" : ""),
        rawModelOutput: rawOutput,
        parsedObject: parsed,
        isParseValid: isParseOk,
        isExpectedHit: isHit,
        pass: isParseOk && isHit,
        txHash: txHash || "on-chain execution (contract state query)",
        verifiedAt: new Date().toISOString(),
      };

      // Save individual run file
      const singleRunPath = path.join(outDir, `${t.slug}_run_${i}.json`);
      fs.writeFileSync(singleRunPath, JSON.stringify(runRecord, null, 2));

      targetRuns.push(runRecord);
      process.stdout.write(`  Run ${i}/10: parse=${isParseOk}, hit=${isHit}\n`);
    }

    // Save target summary file with all 10 raw model outputs preserved
    const targetSummaryPath = path.join(outDir, `${t.slug}.json`);
    fs.writeFileSync(targetSummaryPath, JSON.stringify({
      target: t.file,
      slug: t.slug,
      promptSha256: PROMPT_SHA,
      contractAddress: CONTRACT_ADDR,
      parseSuccesses: `${parseCount}/10`,
      expectedHits: `${hitCount}/10`,
      passed: parseCount === 10 && hitCount >= 9,
      runs: targetRuns,
    }, null, 2));

    overallResults.summary[t.file] = {
      parseSuccesses: `${parseCount}/10`,
      expectedHits: `${hitCount}/10`,
      pass: parseCount === 10 && hitCount >= 9,
    };
    if (parseCount < 10 || hitCount < 9) {
      overallResults.allPassed = false;
    }
  }

  // Update robustness_results.json
  const robResultsPath = path.join(__dirname, '../docs/evidence/robustness_results.json');
  fs.writeFileSync(robResultsPath, JSON.stringify(overallResults, null, 2));
  console.log("\nSaved overall results to docs/evidence/robustness_results.json");
  console.log("Saved 60 raw run files and 6 target summaries under docs/evidence/robustness/");
}

main().catch(err => {
  console.error("FATAL in save_robustness_raw:", err);
  process.exit(1);
});
