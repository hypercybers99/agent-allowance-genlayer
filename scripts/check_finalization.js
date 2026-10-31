const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');

const RPC_URL = 'https://studio.genlayer.com/api';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function collectReceiptHashes() {
  const hashes = new Set();
  const baseDir = path.join(__dirname, '../docs/evidence');

  function addHash(h) {
    if (typeof h === 'string' && /^0x[a-fA-F0-9]{64}$/.test(h)) {
      hashes.add(h.toLowerCase());
    }
  }

  // 1. Receipts folder
  const receiptsDir = path.join(baseDir, 'receipts');
  if (fs.existsSync(receiptsDir)) {
    for (const f of fs.readdirSync(receiptsDir)) {
      if (f.endsWith('.json')) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(receiptsDir, f), 'utf8'));
          addHash(d.txHash || d.transactionHash || d.rawTx?.hash);
        } catch (e) {}
      }
    }
  }

  // 2. Robustness runs
  const robDir = path.join(baseDir, 'robustness');
  if (fs.existsSync(robDir)) {
    for (const f of fs.readdirSync(robDir)) {
      if (f.includes('_run_') && f.endsWith('.json')) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(robDir, f), 'utf8'));
          addHash(d.txHash);
        } catch (e) {}
      }
    }
  }

  // 3. Spendgate & Negative
  for (const sub of ['spendgate', 'negative']) {
    const sDir = path.join(baseDir, sub);
    if (fs.existsSync(sDir)) {
      for (const f of fs.readdirSync(sDir)) {
        if (f.endsWith('.json')) {
          try {
            const d = JSON.parse(fs.readFileSync(path.join(sDir, f), 'utf8'));
            addHash(d.txHash);
          } catch (e) {}
        }
      }
    }
  }

  // 4. Latency benchmark
  const latFile = path.join(baseDir, 'latency_benchmark.json');
  if (fs.existsSync(latFile)) {
    try {
      const d = JSON.parse(fs.readFileSync(latFile, 'utf8'));
      for (const g of d.gates || []) addHash(g.txHash);
      for (const t of d.tripwires || []) addHash(t.txHash);
      for (const j of d.judged || []) addHash(j.txHash);
    } catch (e) {}
  }

  // 5. Live evidence
  const liveFile = path.join(baseDir, 'live_evidence.json');
  if (fs.existsSync(liveFile)) {
    try {
      const d = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
      for (const r of Object.values(d.canonical_requests || {})) addHash(r.txHash);
      if (d.contracts?.AllowanceVault?.deployTxHash) addHash(d.contracts.AllowanceVault.deployTxHash);
      if (d.contracts?.SpendGate?.deployTxHash) addHash(d.contracts.SpendGate.deployTxHash);
    } catch (e) {}
  }

  return Array.from(hashes);
}

async function queryTx(txHash, attempt = 1) {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash],
      }),
    });
    const data = await res.json();
    return data.result || null;
  } catch (err) {
    if (attempt <= 3) {
      await sleep(3000);
      return queryTx(txHash, attempt + 1);
    }
    return null;
  }
}

async function main() {
  console.log("=================================================================================");
  console.log("CHECK ON-CHAIN TRANSACTION FINALIZATION (scripts/check_finalization.js)");
  console.log("=================================================================================");

  const allHashes = collectReceiptHashes();
  console.log(`Discovered ${allHashes.length} verified saved receipt transaction hashes.\n`);

  const results = [];
  const statusCounts = {};

  for (let i = 0; i < allHashes.length; i++) {
    const txHash = allHashes[i];
    process.stdout.write(`  [${(i + 1).toString().padStart(3, ' ')}/${allHashes.length}] ${txHash.slice(0, 18)}... `);

    // Rate-limit buffer (spaced by 1100ms)
    await sleep(1100);

    const tx = await queryTx(txHash);

    let status = "NOT_FOUND_IN_RPC";
    let status_name = "NOT_FOUND_IN_RPC";
    let result_name = "UNKNOWN";
    let leader_execution_result = "UNKNOWN";

    if (tx) {
      status = tx.status || "UNKNOWN";
      status_name = tx.status || "UNKNOWN";
      result_name = tx.result_name || "UNKNOWN";
      leader_execution_result = tx.consensus_data?.leader_receipt?.[0]?.execution_result || "UNKNOWN";
      console.log(`status_name=${status_name.padEnd(9)} result=${result_name.padEnd(14)} leader=${leader_execution_result}`);
    } else {
      console.log(`NOT_FOUND_IN_RPC (unindexed / historical)`);
    }

    statusCounts[status_name] = (statusCounts[status_name] || 0) + 1;

    results.push({
      txHash: txHash,
      status: status,
      status_name: status_name,
      result_name: result_name,
      leader_execution_result: leader_execution_result,
      retrievedAt: new Date().toISOString(),
    });
  }

  const utcNow = new Date().toISOString();
  const fileTimestamp = utcNow.replace(/[:.]/g, '-');
  const finalizationDir = path.join(__dirname, '../docs/evidence/finalization');
  if (!fs.existsSync(finalizationDir)) {
    fs.mkdirSync(finalizationDir, { recursive: true });
  }

  const outFile = path.join(finalizationDir, `${fileTimestamp}.json`);
  const reportPayload = {
    auditTimestampUtc: utcNow,
    totalReceiptHashesChecked: allHashes.length,
    statusCounts: statusCounts,
    transactions: results,
  };

  fs.writeFileSync(outFile, JSON.stringify(reportPayload, null, 2));

  console.log("\n=================================================================================");
  console.log("FINALIZATION STATUS COUNTS");
  console.log("=================================================================================");
  for (const [st, count] of Object.entries(statusCounts)) {
    console.log(`  ${st.padEnd(25)}: ${count} transactions`);
  }
  console.log(`\nSaved audit snapshot to: ${outFile}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
