const fs = require('fs');
const path = require('path');

function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: REPORT FACTS EXTRACTOR");
  console.log("=================================================");

  const depPath = path.join(__dirname, 'deploy/deployments.json');
  const robDir = path.join(__dirname, '../docs/evidence/robustness');
  const robResultsPath = path.join(__dirname, '../docs/evidence/robustness_results.json');
  const livePath = path.join(__dirname, '../docs/evidence/live_evidence.json');
  const probePath = path.join(__dirname, 'deploy/probe_results.json');
  const receiptsDir = path.join(__dirname, '../docs/evidence/receipts');
  const spendGateDir = path.join(__dirname, '../docs/evidence/spendgate');
  const negativeDir = path.join(__dirname, '../docs/evidence/negative');
  const benchPath = path.join(__dirname, '../docs/evidence/latency_benchmark.json');

  if (fs.existsSync(probePath)) {
    const probe = JSON.parse(fs.readFileSync(probePath, 'utf8'));
    console.log("\n[PROBE RUNTIME FACTS]");
    console.log("  Probe Address:        ", probe.contractAddress);
    console.log("  Probe Deploy Tx:      ", probe.deployTxHash);
    console.log("  Probe Deploy Latency: ", probe.deployLatency + "s");
    console.log("  Probe Source SHA-256: ", probe.codeSha256);
    console.log("  Views Tested:         ", Object.keys(probe.views).join(', '));
    console.log("  Writes Verified:      ", probe.transactions.length);
  }

  if (fs.existsSync(robDir)) {
    console.log("\n[ROBUSTNESS EMPIRICAL FACTS - DIRECT FROM RAW FILES]");
    const targetFiles = [
      "inv_a_120_md.json",
      "inv_a_120_html.json",
      "inv_e_90_md.json",
      "inv_f_eur_md.json",
      "inv_c_no_total_md.json",
      "inv_h_marketing_md.json",
    ];

    let totalRuns = 0;
    let totalPasses = 0;

    for (const tf of targetFiles) {
      const p = path.join(robDir, tf);
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const runs = data.runs || [];
        totalRuns += runs.length;
        const passedRuns = runs.filter(r => r.pass).length;
        totalPasses += passedRuns;
        console.log(`  Target: ${data.target.padEnd(28)} Parse: ${data.parseSuccesses.padEnd(7)} Hits: ${data.expectedHits.padEnd(7)} Pass: ${data.passed}`);
      }
    }
    console.log(`  Total Robustness Runs Analyzed: ${totalRuns} (${totalPasses}/${totalRuns} passing)`);
  } else if (fs.existsSync(robResultsPath)) {
    const rob = JSON.parse(fs.readFileSync(robResultsPath, 'utf8'));
    console.log("\n[ROBUSTNESS EMPIRICAL FACTS]");
    console.log("  Contract Address:     ", rob.contractAddress);
    console.log("  Prompt SHA-256:       ", rob.promptSha256);
    console.log("  All Targets Passed:   ", rob.allPassed);
    for (const [target, s] of Object.entries(rob.summary)) {
      console.log(`  Target: ${target.padEnd(28)} Parse: ${s.parseSuccesses.padEnd(7)} Hits: ${s.expectedHits.padEnd(7)} Pass: ${s.pass}`);
    }
  }

  if (fs.existsSync(receiptsDir)) {
    const rFiles = fs.readdirSync(receiptsDir).filter(f => f.endsWith('.json'));
    console.log(`\n[ON-CHAIN RAW RECEIPTS FACTS]`);
    console.log(`  Total Raw Receipt Files on Disk: ${rFiles.length}`);
  }

  if (fs.existsSync(spendGateDir)) {
    const sgFiles = fs.readdirSync(spendGateDir).filter(f => f.endsWith('.json'));
    console.log(`\n[SPENDGATE EVIDENCE FACTS]`);
    console.log(`  Total SpendGate Evidence Files: ${sgFiles.length}`);
    for (const f of sgFiles) {
      const d = JSON.parse(fs.readFileSync(path.join(spendGateDir, f), 'utf8'));
      console.log(`  - ${f.padEnd(24)} ${d.description || ""}`);
    }
  }

  if (fs.existsSync(negativeDir)) {
    const negFiles = fs.readdirSync(negativeDir).filter(f => f.endsWith('.json'));
    console.log(`\n[NEGATIVE & EDGE CASES FACTS]`);
    console.log(`  Total Negative Case Evidence Files: ${negFiles.length}`);
    for (const f of negFiles) {
      const d = JSON.parse(fs.readFileSync(path.join(negativeDir, f), 'utf8'));
      if (Array.isArray(d)) {
        console.log(`  - ${f.padEnd(26)} Bad prefix variants tested: ${d.length}`);
      } else {
        console.log(`  - ${f.padEnd(26)} Expected: '${d.expectedError || ""}' -> Decoded: '${d.decodedError || ""}'`);
      }
    }
  }

  if (fs.existsSync(benchPath)) {
    const b = JSON.parse(fs.readFileSync(benchPath, 'utf8'));
    console.log(`\n[LATENCY BENCHMARK FACTS]`);
    if (b.stats) {
      console.log(`  Pre-Fetch Gates (5 runs):  min=${b.stats.gates.min}s, median=${b.stats.gates.median}s, max=${b.stats.gates.max}s`);
      console.log(`  Tripwires (3 runs):         min=${b.stats.tripwires.min}s, median=${b.stats.tripwires.median}s, max=${b.stats.tripwires.max}s`);
      console.log(`  Judged Invoices (5 runs):   min=${b.stats.judged.min}s, median=${b.stats.judged.median}s, max=${b.stats.judged.max}s`);
    }
  }

  if (fs.existsSync(livePath)) {
    const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
    console.log("\n[ON-CHAIN LIVE EVIDENCE FACTS]");
    console.log("  Network:              ", live.network, `(Chain ID: ${live.chainId})`);
    if (live.contracts.AllowanceVault) {
      console.log("  Vault Address:        ", live.contracts.AllowanceVault.address);
      console.log("  Vault Deploy Tx:      ", live.contracts.AllowanceVault.deployTxHash);
      console.log("  Vault Deploy Latency: ", live.contracts.AllowanceVault.deployLatency + "s");
      console.log("  Vault Source SHA-256: ", live.contracts.AllowanceVault.sourceSha256);
    }
    if (live.contracts.SpendGate) {
      console.log("  SpendGate Address:    ", live.contracts.SpendGate.address);
      console.log("  SpendGate Deploy Tx:  ", live.contracts.SpendGate.deployTxHash);
      console.log("  SpendGate Latency:    ", live.contracts.SpendGate.deployLatency + "s");
    }
    const reqs = live.canonical_requests || live.requests || {};
    console.log("  Canonical Requests Executed: ", Object.keys(reqs).length);
    for (const [reqId, r] of Object.entries(reqs)) {
      console.log(`    ${reqId.padEnd(4)} Decision: ${r.actualDecision.padEnd(14)} Reason: ${r.actualReason.padEnd(22)} Latency: ${r.latency}s`);
    }
    if (live.invariants) {
      console.log("  Invariant Total Minted:     ", live.invariants.totalMinted);
      console.log("  Invariant Total In Contract:", live.invariants.totalInContract);
      console.log("  Conservation Check Passed:  ", live.invariants.conservationInvariantPassed);
    }
  }
}

main();
