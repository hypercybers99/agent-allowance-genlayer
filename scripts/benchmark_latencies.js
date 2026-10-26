const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const { createClient, chains, createAccount } = require('genlayer-js');

const VAULT_ADDR = "0xd89C4fCB63773C01e8494EebaE7375C4d5992E07";
const FIXTURE_COMMIT = "1412ed737ea096b9e023726a1def18fc1a470806";
const BASE_FIXTURES = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${FIXTURE_COMMIT}/`;
const CLOUDCO_PREFIX = `${BASE_FIXTURES}cloudco/`;

async function writeWithRetry(client, fnName, args, targetAddr) {
  let retries = 20;
  while (retries > 0) {
    try {
      const t0 = Date.now();
      const txHash = await client.writeContract({
        address: targetAddr,
        functionName: fnName,
        args: args,
      });
      const rcpt = await client.waitForTransactionReceipt({ hash: txHash, retries: 120, interval: 3000 });
      const lat = parseFloat(((Date.now() - t0) / 1000).toFixed(2));
      return { txHash, rcpt, lat };
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Rate limit exceeded")) {
        const waitSec = err.cause?.data?.retry_after_seconds || 35;
        console.log(`  [RATE LIMIT on ${fnName}] Waiting ${waitSec}s...`);
        await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
        retries--;
      } else {
        throw err;
      }
    }
  }
}

async function readWithRetry(client, fnName, args, targetAddr) {
  let retries = 20;
  while (retries > 0) {
    try {
      return await client.readContract({
        address: targetAddr,
        functionName: fnName,
        args: args,
      });
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Rate limit exceeded")) {
        const waitSec = err.cause?.data?.retry_after_seconds || 35;
        console.log(`  [RATE LIMIT on ${fnName}] Waiting ${waitSec}s...`);
        await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
        retries--;
      } else {
        throw err;
      }
    }
  }
}

function computeStats(arr) {
  if (!arr || arr.length === 0) return { min: 0, median: 0, max: 0, count: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  return { min, median, max, count: sorted.length, values: sorted };
}

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: DEDICATED LATENCY BENCHMARK (TASK F)");
  console.log("=================================================");

  const ownerAcc = createAccount();
  const agentAcc = createAccount();
  const payeeAcc = createAccount();

  const ownerClient = createClient({ chain: chains.studionet, account: ownerAcc });
  const agentClient = createClient({ chain: chains.studionet, account: agentAcc });

  console.log("Claiming demo credits for Owner...");
  await writeWithRetry(ownerClient, 'claim_demo_credits', [], VAULT_ADDR);

  // Setup Account A for Gates: Cap 200, Budget 200
  const polGates = {
    categories: ["CLOUD"],
    currency: "USD",
    max_spends: 10,
    payees: [{ payee: payeeAcc.address.toLowerCase(), prefix: CLOUDCO_PREFIX }],
    per_spend_cap: 200,
    total_budget: 200,
  };
  console.log("Creating Account for Gates benchmark (Cap 200, Budget 200)...");
  await writeWithRetry(ownerClient, 'create_account', ["Bench Gates Account", JSON.stringify(polGates)], VAULT_ADDR);
  const stats1 = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR));
  const aidGates = String(parseInt(stats1.next_account) - 1);
  await writeWithRetry(ownerClient, 'fund_account', [aidGates, 200], VAULT_ADDR);
  await writeWithRetry(ownerClient, 'add_agent', [aidGates, agentAcc.address], VAULT_ADDR);

  // Seed one valid spend of 120 so spent becomes 120
  console.log("Seeding initial spend (120 USD) so spent=120 on Account...");
  await writeWithRetry(agentClient, 'request_spend', [aidGates, payeeAcc.address, 120, "CLOUD", `${CLOUDCO_PREFIX}inv-a-120.md`], VAULT_ADDR);

  const benchmarkData = {
    timestamp: new Date().toISOString(),
    sessionType: "single_dedicated_session",
    gates: [],
    tripwires: [],
    judged: [],
  };

  // =========================================================================
  // GROUP 1: 5 Pre-Fetch Gate Denials
  // =========================================================================
  console.log("\n--- Benchmarking 5 Pre-Fetch Gate Denials ---");
  const gateTests = [
    { name: "over_cap", amount: 250, cat: "CLOUD", payee: payeeAcc.address, url: `${CLOUDCO_PREFIX}inv-a-120.md`, expectedReason: "over_cap" },
    { name: "over_budget", amount: 100, cat: "CLOUD", payee: payeeAcc.address, url: `${CLOUDCO_PREFIX}inv-a-120.md`, expectedReason: "over_budget" },
    { name: "payee_unknown", amount: 50, cat: "CLOUD", payee: "0x1111111111111111111111111111111111111111", url: `${CLOUDCO_PREFIX}inv-a-120.md`, expectedReason: "payee_unknown" },
    { name: "evidence_not_bound", amount: 50, cat: "CLOUD", payee: payeeAcc.address, url: `https://raw.githubusercontent.com/unregistered/other/inv.md`, expectedReason: "evidence_not_bound" },
    { name: "category_not_allowed", amount: 50, cat: "MARKETING", payee: payeeAcc.address, url: `${CLOUDCO_PREFIX}inv-a-120.md`, expectedReason: "category_not_allowed" },
  ];

  for (let i = 0; i < gateTests.length; i++) {
    const gt = gateTests[i];
    process.stdout.write(`  [Gate ${i + 1}/5] ${gt.name.padEnd(22)} `);
    const res = await writeWithRetry(agentClient, 'request_spend', [aidGates, gt.payee, gt.amount, gt.cat, gt.url], VAULT_ADDR);
    const sid = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR)).next_spend;
    const spend = JSON.parse(await readWithRetry(ownerClient, 'get_spend', [String(parseInt(sid) - 1)], VAULT_ADDR));
    console.log(`-> ${res.lat}s (decision: ${spend.decision}, reason: ${spend.reason})`);
    benchmarkData.gates.push({
      caseName: gt.name,
      latency: res.lat,
      txHash: res.txHash,
      decision: spend.decision,
      reason: spend.reason,
    });
  }

  // =========================================================================
  // GROUP 2: 3 Tripwires (page fetched, model call skipped)
  // =========================================================================
  console.log("\n--- Benchmarking 3 Tripwires (Page fetched, model skipped) ---");
  const tripwireUrl = `${CLOUDCO_PREFIX}inv-d-injection.md`;
  for (let i = 1; i <= 3; i++) {
    process.stdout.write(`  [Tripwire ${i}/3] inv-d-injection.md `);
    const res = await writeWithRetry(agentClient, 'request_spend', [aidGates, payeeAcc.address, 50, "CLOUD", tripwireUrl], VAULT_ADDR);
    const sid = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR)).next_spend;
    const spend = JSON.parse(await readWithRetry(ownerClient, 'get_spend', [String(parseInt(sid) - 1)], VAULT_ADDR));
    console.log(`-> ${res.lat}s (decision: ${spend.decision}, reason: ${spend.reason})`);
    benchmarkData.tripwires.push({
      runIndex: i,
      latency: res.lat,
      txHash: res.txHash,
      decision: spend.decision,
      reason: spend.reason,
    });
  }

  // =========================================================================
  // GROUP 3: 5 Judged Requests (page fetched, model called)
  // Setup Account B with ample budget for judged spends
  // =========================================================================
  console.log("\n--- Setting up Account for 5 Judged Requests ---");
  const payee2 = createAccount();
  const polJudged = {
    categories: ["CLOUD", "DATA"],
    currency: "USD",
    max_spends: 20,
    payees: [
      { payee: payeeAcc.address.toLowerCase(), prefix: CLOUDCO_PREFIX },
      { payee: payee2.address.toLowerCase(), prefix: `${BASE_FIXTURES}datashop/` },
    ],
    per_spend_cap: 500,
    total_budget: 2500,
  };
  await writeWithRetry(ownerClient, 'create_account', ["Bench Judged Account", JSON.stringify(polJudged)], VAULT_ADDR);
  const stats2 = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR));
  const aidJudged = String(parseInt(stats2.next_account) - 1);
  await writeWithRetry(ownerClient, 'fund_account', [aidJudged, 1500], VAULT_ADDR);
  await writeWithRetry(ownerClient, 'add_agent', [aidJudged, agentAcc.address], VAULT_ADDR);

  console.log("\n--- Benchmarking 5 Judged Requests (Web fetch + model called) ---");
  const judgedInvoices = [
    { name: "inv-a-120.md (Markdown)", file: "cloudco/inv-a-120.md", amt: 120, cat: "CLOUD", payee: payeeAcc.address },
    { name: "inv-a-120.html (HTML)", file: "cloudco/inv-a-120.html", amt: 120, cat: "CLOUD", payee: payeeAcc.address },
    { name: "inv-b-450.md (Amount mismatch)", file: "cloudco/inv-b-450.md", amt: 250, cat: "CLOUD", payee: payeeAcc.address },
    { name: "inv-c-no-total.md (No total)", file: "cloudco/inv-c-no-total.md", amt: 120, cat: "CLOUD", payee: payeeAcc.address },
    { name: "inv-e-90.md (DataShop)", file: "datashop/inv-e-90.md", amt: 90, cat: "DATA", payee: payee2.address },
  ];

  for (let i = 0; i < judgedInvoices.length; i++) {
    const ji = judgedInvoices[i];
    process.stdout.write(`  [Judged ${i + 1}/5] ${ji.name.padEnd(30)} `);
    const url = `${BASE_FIXTURES}${ji.file}`;
    const res = await writeWithRetry(agentClient, 'request_spend', [aidJudged, ji.payee, ji.amt, ji.cat, url], VAULT_ADDR);
    const sid = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR)).next_spend;
    const spend = JSON.parse(await readWithRetry(ownerClient, 'get_spend', [String(parseInt(sid) - 1)], VAULT_ADDR));
    console.log(`-> ${res.lat}s (decision: ${spend.decision}, reason: ${spend.reason})`);
    benchmarkData.judged.push({
      caseName: ji.name,
      file: ji.file,
      latency: res.lat,
      txHash: res.txHash,
      decision: spend.decision,
      reason: spend.reason,
    });
  }

  // Summary statistics
  const gateLats = benchmarkData.gates.map(g => g.latency);
  const tripLats = benchmarkData.tripwires.map(t => t.latency);
  const judgedLats = benchmarkData.judged.map(j => j.latency);

  benchmarkData.stats = {
    gates: computeStats(gateLats),
    tripwires: computeStats(tripLats),
    judged: computeStats(judgedLats),
  };

  console.log("\n=================================================");
  console.log("LATENCY BENCHMARK SUMMARY (SAME SESSION)");
  console.log("=================================================");
  console.log(`Pre-Fetch Gates (5 runs):  min=${benchmarkData.stats.gates.min}s, median=${benchmarkData.stats.gates.median}s, max=${benchmarkData.stats.gates.max}s (values: [${benchmarkData.stats.gates.values.join(', ')}])`);
  console.log(`Tripwires (3 runs):         min=${benchmarkData.stats.tripwires.min}s, median=${benchmarkData.stats.tripwires.median}s, max=${benchmarkData.stats.tripwires.max}s (values: [${benchmarkData.stats.tripwires.values.join(', ')}])`);
  console.log(`Judged Invoices (5 runs):   min=${benchmarkData.stats.judged.min}s, median=${benchmarkData.stats.judged.median}s, max=${benchmarkData.stats.judged.max}s (values: [${benchmarkData.stats.judged.values.join(', ')}])`);

  const outPath = path.join(__dirname, '../docs/evidence/latency_benchmark.json');
  fs.writeFileSync(outPath, JSON.stringify(benchmarkData, null, 2));
  console.log("\nSaved benchmark data to docs/evidence/latency_benchmark.json");
}

main().catch(err => {
  console.error("FATAL in benchmark_latencies:", err);
  process.exit(1);
});
