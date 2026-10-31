const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const { createClient, chains, createAccount } = require('genlayer-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROBE_EXTRACT_ADDR = "0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997";
const PROMPT_SHA256 = "990f3801f114c0a5a22839b2ae82c0f99a5e82b794129994c5e3d74da05f31eb";
const FIXTURE_COMMIT = "17d05116617effeaa127249914f3b4e691ecad40";
const BASE_FIXTURES = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${FIXTURE_COMMIT}/`;

const TARGETS = [
  { file: "cloudco/inv-a-120.md", slug: "inv_a_120_md", expectedAmt: 120, expectedCat: "CLOUD", expectedCurr: "USD" },
  { file: "cloudco/inv-a-120.html", slug: "inv_a_120_html", expectedAmt: 120, expectedCat: "CLOUD", expectedCurr: "USD" },
  { file: "datashop/inv-e-90.md", slug: "inv_e_90_md", expectedAmt: 90, expectedCat: "DATA", expectedCurr: "USD" },
  { file: "datashop/inv-f-eur.md", slug: "inv_f_eur_md", expectedAmt: 90, expectedCat: "DATA", expectedCurr: "EUR" },
  { file: "cloudco/inv-c-no-total.md", slug: "inv_c_no_total_md", expectedAmt: 0, expectedCat: "CLOUD", expectedCurr: "USD" },
  { file: "cloudco/inv-h-marketing.md", slug: "inv_h_marketing_md", expectedAmt: 60, expectedCat: "MARKETING", expectedCurr: "USD" },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseExtraction(text) {
  if (!text || typeof text !== 'string') return { valid: false };
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try {
    const data = JSON.parse(cleaned);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return { valid: false };
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

async function writeWithRetry(client, fnName, args, addr, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const t0 = Date.now();
      const txHash = await client.writeContract({
        address: addr,
        functionName: fnName,
        args: args,
      });

      let rcpt = null;
      for (let pAttempt = 1; pAttempt <= 5; pAttempt++) {
        try {
          rcpt = await client.waitForTransactionReceipt({
            hash: txHash,
            retries: 120,
            interval: 3500,
          });
          break;
        } catch (pe) {
          if (pAttempt === 5) throw pe;
          console.log(`    [Receipt polling retry ${pAttempt}] ${pe.message}`);
          await sleep(5000);
        }
      }

      const lat = ((Date.now() - t0) / 1000).toFixed(2);
      return { txHash, rcpt, lat };
    } catch (err) {
      console.log(`    [Write Attempt ${attempt} Failed]: ${err.message}`);
      if (attempt === maxRetries) throw err;
      await sleep(10000);
    }
  }
}

async function readWithRetry(client, fnName, args, addr, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await client.readContract({
        address: addr,
        functionName: fnName,
        args: args,
      });
      return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(3000);
    }
  }
}

async function main() {
  console.log("=================================================");
  console.log("RECEIPT-BACKED EMPIRICAL ROBUSTNESS RUN (TASK 1)");
  console.log("=================================================");
  console.log("Target Contract Address: ", PROBE_EXTRACT_ADDR);
  console.log("Prompt SHA-256:          ", PROMPT_SHA256);
  console.log("Fixture Base URL:        ", BASE_FIXTURES);

  const account = createAccount();
  const client = createClient({
    chain: chains.studionet,
    account: account,
  });
  console.log("Throwaway Operator:      ", account.address);

  const outDir = path.join(__dirname, '../docs/evidence/robustness');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const resultsSummary = {};

  for (const t of TARGETS) {
    const inputUrl = `${BASE_FIXTURES}${t.file}`;
    console.log(`\n>>> Evaluating Target: ${t.file} (${t.slug}) <<<`);
    console.log(`    Input URL: ${inputUrl}`);
    console.log(`    Expected: Amount=${t.expectedAmt}, Cat=${t.expectedCat}, Curr=${t.expectedCurr}`);

    let attemptsCount = 0;
    let successCount = 0;
    let parseSuccessCount = 0;
    let expectedHitsCount = 0;

    for (let i = 1; i <= 10; i++) {
      attemptsCount++;
      const resKey = `rb_${t.slug}_${i}`;
      process.stdout.write(`  [Run ${i}/10] Key=${resKey} `);

      // Enforce at least 7.5s interval between calls
      await sleep(7500);

      try {
        const { txHash, rcpt, lat } = await writeWithRetry(
          client,
          'probe_extract',
          [inputUrl, resKey],
          PROBE_EXTRACT_ADDR
        );

        const status_name = rcpt.status_name;
        const result_name = rcpt.result_name;
        const leader_execution_result = rcpt.consensus_data?.leader_receipt?.[0]?.execution_result;
        const timestamp = rcpt.rawTx?.created_timestamp
          ? new Date(rcpt.rawTx.created_timestamp * 1000).toISOString()
          : (rcpt.retrievedAt || new Date().toISOString());

        // Read stored result immediately
        await sleep(2500);
        const rawModelOutput = await readWithRetry(
          client,
          'get_result',
          [resKey],
          PROBE_EXTRACT_ADDR
        );

        const parsed = parseExtraction(rawModelOutput);
        const isParseValid = parsed.valid;
        if (isParseValid) parseSuccessCount++;

        let isMatch = false;
        if (isParseValid) {
          if (t.file === "cloudco/inv-c-no-total.md") {
            isMatch = (parsed.amount === 0);
          } else {
            isMatch = (parsed.amount === t.expectedAmt && parsed.category === t.expectedCat);
          }
        }
        if (isMatch) expectedHitsCount++;
        successCount++;

        const runRecord = {
          target: t.file,
          slug: t.slug,
          runIndex: i,
          resultKey: resKey,
          contractAddress: PROBE_EXTRACT_ADDR,
          promptSha256: PROMPT_SHA256,
          inputUrl: inputUrl,
          txHash: txHash,
          receiptTriple: {
            status_name: status_name,
            result_name: result_name,
            leader_execution_result: leader_execution_result,
          },
          status_name: status_name,
          result_name: result_name,
          leader_execution_result: leader_execution_result,
          latency: parseFloat(lat),
          timestamp: timestamp,
          rawModelOutput: rawModelOutput,
          parsed_valid: isParseValid,
          parsedFields: parsed,
          expectedFields: {
            amount: t.expectedAmt,
            category: t.expectedCat,
            currency: t.expectedCurr,
          },
          match: isMatch,
          pass: isParseValid && isMatch,
        };

        const runFilePath = path.join(outDir, `${t.slug}_run_${i}.json`);
        fs.writeFileSync(runFilePath, JSON.stringify(runRecord, null, 2));

        console.log(`-> ${lat}s | status=${status_name} leader=${leader_execution_result} | parse=${isParseValid} match=${isMatch} | tx=${txHash}`);
      } catch (err) {
        console.log(`-> FAILED: ${err.message}`);
        const failRecord = {
          target: t.file,
          slug: t.slug,
          runIndex: i,
          resultKey: resKey,
          contractAddress: PROBE_EXTRACT_ADDR,
          promptSha256: PROMPT_SHA256,
          inputUrl: inputUrl,
          error: err.message,
          match: false,
          pass: false,
          timestamp: new Date().toISOString(),
        };
        const failFilePath = path.join(outDir, `${t.slug}_run_${i}_attempt_failed.json`);
        fs.writeFileSync(failFilePath, JSON.stringify(failRecord, null, 2));
      }
    }

    resultsSummary[t.file] = {
      slug: t.slug,
      attempts: attemptsCount,
      successes: successCount,
      parseSuccess: parseSuccessCount,
      expectedHits: expectedHitsCount,
      passRate: `${expectedHitsCount}/10`,
      passed: (parseSuccessCount === 10 && expectedHitsCount >= 9),
    };
  }

  // Summary file
  const summaryPath = path.join(outDir, `receipt_backed_summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(resultsSummary, null, 2));

  console.log("\n=================================================");
  console.log("RECEIPT-BACKED BATCH SUMMARY");
  console.log("=================================================");
  console.table(resultsSummary);
}

main().catch(err => {
  console.error("FATAL ERROR in robustness run:", err);
  process.exit(1);
});
