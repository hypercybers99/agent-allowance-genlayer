const fs = require('fs');
const path = require('path');

function main() {
  const livePath = path.join(__dirname, '../docs/evidence/live_evidence.json');
  if (!fs.existsSync(livePath)) {
    console.error("Missing docs/evidence/live_evidence.json");
    process.exit(1);
  }

  const live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
  const reqs = live.canonical_requests || {};

  console.log("==================================================================================================================================");
  console.log("CANONICAL REQUESTS R1-R13 EXECUTION AUDIT (live_evidence.json & receipts)");
  console.log("==================================================================================================================================");

  let decMatches = 0;
  let rsnMatches = 0;
  const rows = [];

  for (const [key, r] of Object.entries(reqs)) {
    // Normalise decision comparison
    const expDecNorm = r.expectedDecision.replace('APPROVE', 'APPROVED').replace('DENY', 'DENIED');
    const actDecNorm = r.actualDecision.replace('OWNER_APPROVED', 'APPROVED').replace('OWNER_REJECTED', 'DENIED');

    let decMatch = false;
    if (r.expectedDecision === "ASK_OWNER") {
      decMatch = (r.actualDecision === "ASK_OWNER" || r.actualDecision === "OWNER_APPROVED" || r.actualDecision === "OWNER_REJECTED");
    } else {
      decMatch = (expDecNorm === actDecNorm);
    }

    const rsnMatch = (r.expectedReason === r.actualReason);

    if (decMatch) decMatches++;
    if (rsnMatch) rsnMatches++;

    rows.push({
      req: key,
      spendId: r.spendId,
      file: r.evidenceFile,
      declaredAmt: r.declaredAmount,
      declaredCat: r.declaredCategory,
      expectedDec: r.expectedDecision,
      expectedRsn: r.expectedReason,
      actualDec: r.actualDecision,
      actualRsn: r.actualReason,
      decMatch: decMatch ? "YES" : "NO",
      rsnMatch: rsnMatch ? "YES" : "NO",
      latency: r.latency + "s",
      txHash: r.txHash,
    });
  }

  // Print markdown table
  console.log("| Req | Spend ID | Fixture Document | Declared | Expected Dec (Reason) | Actual Dec (Reason) | Decision Match | Reason Match | Latency | Tx Hash |");
  console.log("| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |");
  for (const row of rows) {
    console.log(`| **${row.req}** | ${row.spendId} | \`${row.file}\` | ${row.declaredAmt} ${row.declaredCat} | \`${row.expectedDec}\` (\`${row.expectedRsn}\`) | \`${row.actualDec}\` (\`${row.actualRsn}\`) | **${row.decMatch}** | **${row.rsnMatch}** | ${row.latency} | \`${row.txHash.slice(0, 10)}...\` |`);
  }

  console.log("\n--- SUMMARY STATS ---");
  console.log(`Total Requests:  ${Object.keys(reqs).length}`);
  console.log(`Decision Matches: ${decMatches}/${Object.keys(reqs).length} (${((decMatches/Object.keys(reqs).length)*100).toFixed(1)}%)`);
  console.log(`Reason Matches:   ${rsnMatches}/${Object.keys(reqs).length} (${((rsnMatches/Object.keys(reqs).length)*100).toFixed(1)}%)`);
  console.log("Reason Mismatch Details:");
  console.log("  - R6: Expected 'amount_unclear', Actual 'quote_not_found'. (See docs/EXPECTED_AMENDMENT.md)");
}

main();
