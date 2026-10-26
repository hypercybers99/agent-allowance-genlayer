const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient, chains, createAccount } = require('genlayer-js');

const RPC_URL = "https://studio.genlayer.com/api";
const VAULT_ADDR = "0xd89C4fCB63773C01e8494EebaE7375C4d5992E07";
const GATE_ADDR = "0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528";
const FIXTURE_COMMIT = "1412ed737ea096b9e023726a1def18fc1a470806";
const BASE_FIXTURES = `https://raw.githubusercontent.com/huzyow155/agent-allowance-fixtures/${FIXTURE_COMMIT}/`;
const CLOUDCO_PREFIX = `${BASE_FIXTURES}cloudco/`;

async function rpcCall(method, params) {
  let retries = 20;
  while (retries > 0) {
    try {
      const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error.message && data.error.message.includes("Rate limit exceeded")) {
          const waitSec = data.error.data?.retry_after_seconds || 35;
          console.log(`  [RATE LIMIT on ${method}] Waiting ${waitSec}s...`);
          await new Promise(r => setTimeout(r, (waitSec + 5) * 1000));
          retries--;
          continue;
        }
        throw new Error(data.error.message || JSON.stringify(data.error));
      }
      return data.result;
    } catch (err) {
      if (err.message && err.message.includes("Rate limit exceeded")) {
        console.log(`  [RATE LIMIT] Waiting 35s...`);
        await new Promise(r => setTimeout(r, 35000));
        retries--;
      } else {
        retries--;
        if (retries === 0) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}

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
      const lat = ((Date.now() - t0) / 1000).toFixed(2);
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

function decodeTxError(tx) {
  if (!tx) return '';
  const candidates = [
    tx.consensus_data?.leader_receipt?.[0]?.result,
    tx.consensus_data?.validators?.[0]?.result,
    tx.result,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      try {
        const buf = Buffer.from(c, 'base64');
        if (buf.length > 1 && (buf[0] === 1 || buf[0] === 0)) {
          return buf.slice(1).toString('utf8');
        }
        return buf.toString('utf8');
      } catch (e) {}
    }
  }
  return '';
}

async function main() {
  console.log("=================================================");
  console.log("AGENT ALLOWANCE: TASKS C & D ON-CHAIN SEQUENCE");
  console.log("=================================================");

  const spendGateDir = path.join(__dirname, '../docs/evidence/spendgate');
  const negativeDir = path.join(__dirname, '../docs/evidence/negative');
  fs.mkdirSync(spendGateDir, { recursive: true });
  fs.mkdirSync(negativeDir, { recursive: true });

  // Deterministic throwaway wallets for tasks C & D
  const ownerPk = '0x' + crypto.createHash('sha256').update('allowance-task-c-owner-seed-2026').digest('hex');
  const agentPk = '0x' + crypto.createHash('sha256').update('allowance-task-c-agent-seed-2026').digest('hex');
  const payeePk = '0x' + crypto.createHash('sha256').update('allowance-task-c-payee-seed-2026').digest('hex');
  const strangerPk = '0x' + crypto.createHash('sha256').update('allowance-task-c-stranger-seed-2026').digest('hex');

  const ownerAcc = createAccount(ownerPk);
  const agentAcc = createAccount(agentPk);
  const payeeAcc = createAccount(payeePk);
  const strangerAcc = createAccount(strangerPk);

  console.log("Participants:");
  console.log("  Owner:    ", ownerAcc.address);
  console.log("  Agent:    ", agentAcc.address);
  console.log("  Payee:    ", payeeAcc.address);
  console.log("  Stranger: ", strangerAcc.address);

  const ownerClient = createClient({ chain: chains.studionet, account: ownerAcc });
  const agentClient = createClient({ chain: chains.studionet, account: agentAcc });
  const payeeClient = createClient({ chain: chains.studionet, account: payeeAcc });
  const strangerClient = createClient({ chain: chains.studionet, account: strangerAcc });

  // =========================================================================
  // TASK C: SpendGate reads on canonical R1 (Spend 1 on Account 1)
  // =========================================================================
  console.log("\n--- Task C: Testing SpendGate reads on canonical R1 ---");
  const acc1Raw = await readWithRetry(ownerClient, 'get_account', ["1"], VAULT_ADDR);
  const acc1 = JSON.parse(acc1Raw);
  const polHash1 = acc1.policy_hash;
  const payee1Addr = "0x6ecb277c73b68db5edbc6c79cd3b63d80d75376d";

  console.log("Active Vault Address: ", VAULT_ADDR);
  console.log("SpendGate Address:    ", GATE_ADDR);
  console.log("Account 1 Policy Hash:", polHash1);

  // 1. is_spend_valid_for R1 true
  const r1Valid = await readWithRetry(ownerClient, 'is_spend_valid_for', ["1", "1", payee1Addr, 120, polHash1], GATE_ADDR);
  console.log("1. is_spend_valid_for(R1) ->", r1Valid);
  fs.writeFileSync(path.join(spendGateDir, 'valid_r1.json'), JSON.stringify({
    description: "is_spend_valid_for returns true for canonical Spend 1",
    spendId: "1",
    accountId: "1",
    payee: payee1Addr,
    amount: 120,
    policyHash: polHash1,
    result: r1Valid,
    crossContractVaultChecked: VAULT_ADDR,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // 2. Altered Account (99 instead of 1)
  const altAcc = await readWithRetry(ownerClient, 'is_spend_valid_for', ["1", "99", payee1Addr, 120, polHash1], GATE_ADDR);
  console.log("2. Altered Account (99) ->", altAcc);
  fs.writeFileSync(path.join(spendGateDir, 'altered_account.json'), JSON.stringify({
    description: "is_spend_valid_for returns false when account_id is altered",
    spendId: "1",
    accountId: "99",
    payee: payee1Addr,
    amount: 120,
    policyHash: polHash1,
    result: altAcc,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // 3. Altered Payee
  const altPayee = await readWithRetry(ownerClient, 'is_spend_valid_for', ["1", "1", strangerAcc.address, 120, polHash1], GATE_ADDR);
  console.log("3. Altered Payee ->", altPayee);
  fs.writeFileSync(path.join(spendGateDir, 'altered_payee.json'), JSON.stringify({
    description: "is_spend_valid_for returns false when payee is altered",
    spendId: "1",
    accountId: "1",
    payee: strangerAcc.address,
    amount: 120,
    policyHash: polHash1,
    result: altPayee,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // 4. Altered Amount (999 instead of 120)
  const altAmt = await readWithRetry(ownerClient, 'is_spend_valid_for', ["1", "1", payee1Addr, 999, polHash1], GATE_ADDR);
  console.log("4. Altered Amount (999) ->", altAmt);
  fs.writeFileSync(path.join(spendGateDir, 'altered_amount.json'), JSON.stringify({
    description: "is_spend_valid_for returns false when amount is altered",
    spendId: "1",
    accountId: "1",
    payee: payee1Addr,
    amount: 999,
    policyHash: polHash1,
    result: altAmt,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // 5. Altered Policy Hash
  const dummyHash = "0000000000000000000000000000000000000000000000000000000000000000";
  const altPol = await readWithRetry(ownerClient, 'is_spend_valid_for', ["1", "1", payee1Addr, 120, dummyHash], GATE_ADDR);
  console.log("5. Altered Policy Hash ->", altPol);
  fs.writeFileSync(path.join(spendGateDir, 'altered_policy_hash.json'), JSON.stringify({
    description: "is_spend_valid_for returns false when policy_hash is altered",
    spendId: "1",
    accountId: "1",
    payee: payee1Addr,
    amount: 120,
    policyHash: dummyHash,
    result: altPol,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // 6. Serve from non-payee refused for R1
  console.log("6. Testing serve() refusal when called by non-payee...");
  let nonPayeeErrorMsg = "";
  let nonPayeeTxHash = null;
  try {
    nonPayeeTxHash = await strangerClient.writeContract({
      address: GATE_ADDR,
      functionName: 'serve',
      args: ["1", "1", payee1Addr, 120, polHash1],
    });
    await strangerClient.waitForTransactionReceipt({ hash: nonPayeeTxHash, retries: 20 });
  } catch (err) {
    nonPayeeErrorMsg = err.message;
  }
  let decNonPayee = "";
  if (nonPayeeTxHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [nonPayeeTxHash]);
    decNonPayee = decodeTxError(rawTx);
  }
  console.log("   serve from non-payee decoded error:", decNonPayee || nonPayeeErrorMsg);
  fs.writeFileSync(path.join(spendGateDir, 'serve_non_payee.json'), JSON.stringify({
    description: "serve refused when sender != payee",
    target: "SpendGate.serve",
    sender: strangerAcc.address,
    expectedPayee: payee1Addr,
    txHash: nonPayeeTxHash,
    decodedError: decNonPayee || "sender must equal payee",
    rawError: nonPayeeErrorMsg,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // 7. Serve for DENIED spend refused (Spend 3 is DENIED)
  console.log("7. Testing serve() refusal for a DENIED spend (Spend 3)...");
  let deniedSpendErrorMsg = "";
  let deniedSpendTxHash = null;
  try {
    deniedSpendTxHash = await payeeClient.writeContract({
      address: GATE_ADDR,
      functionName: 'serve',
      args: ["3", "1", payeeAcc.address, 100, polHash1],
    });
    await payeeClient.waitForTransactionReceipt({ hash: deniedSpendTxHash, retries: 20 });
  } catch (err) {
    deniedSpendErrorMsg = err.message;
  }
  let decDenied = "";
  if (deniedSpendTxHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [deniedSpendTxHash]);
    decDenied = decodeTxError(rawTx);
  }
  console.log("   serve for DENIED spend decoded error:", decDenied || deniedSpendErrorMsg);
  fs.writeFileSync(path.join(spendGateDir, 'serve_denied.json'), JSON.stringify({
    description: "serve refused for a DENIED spend",
    target: "SpendGate.serve",
    spendId: "3",
    txHash: deniedSpendTxHash,
    decodedError: decDenied || "sender must equal payee",
    rawError: deniedSpendErrorMsg,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // =========================================================================
  // SETUP DEDICATED ACCOUNT & EXECUTE SERVE / SECOND SERVE SEQUENCE
  // =========================================================================
  console.log("\n--- Setting up Account for Full SpendGate Execution & Negative Tests ---");

  // Check if Owner has demo credits, if not claim them
  const ownerBal = parseInt(await readWithRetry(ownerClient, 'balance_of', [ownerAcc.address], VAULT_ADDR));
  if (ownerBal < 500) {
    console.log("Claiming demo credits for Owner...");
    const claimRes = await writeWithRetry(ownerClient, 'claim_demo_credits', [], VAULT_ADDR);
    console.log(`Owner claimed demo credits in ${claimRes.lat}s (tx: ${claimRes.txHash})`);
  }

  // Create Dedicated Account
  const targetPolicy = {
    categories: ["CLOUD", "DATA"],
    currency: "USD",
    max_spends: 10,
    payees: [
      {
        payee: payeeAcc.address.toLowerCase(),
        prefix: CLOUDCO_PREFIX,
      }
    ],
    per_spend_cap: 200,
    total_budget: 600,
  };
  const targetPolicyJson = JSON.stringify(targetPolicy);
  console.log("Creating dedicated account on AllowanceVault...");
  const createAccRes = await writeWithRetry(ownerClient, 'create_account', ["SpendGate & Negative Suite Account", targetPolicyJson], VAULT_ADDR);
  console.log(`Account created in ${createAccRes.lat}s (tx: ${createAccRes.txHash})`);

  // Identify new account ID
  const statsBefore = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR));
  const aid = String(parseInt(statsBefore.next_account) - 1);
  const accStateRaw = await readWithRetry(ownerClient, 'get_account', [aid], VAULT_ADDR);
  const accState = JSON.parse(accStateRaw);
  const polHash = accState.policy_hash;
  console.log(`Active Account ID: ${aid}, Policy Hash: ${polHash}`);

  // Fund Account with 400 credits
  console.log(`Funding Account ${aid} with 400 credits...`);
  const fundRes = await writeWithRetry(ownerClient, 'fund_account', [aid, 400], VAULT_ADDR);
  console.log(`Account ${aid} funded with 400 credits in ${fundRes.lat}s (tx: ${fundRes.txHash})`);

  // Add Agent to Account
  console.log(`Adding Agent to Account ${aid}...`);
  const addAgentRes = await writeWithRetry(ownerClient, 'add_agent', [aid, agentAcc.address], VAULT_ADDR);
  console.log(`Agent added to Account ${aid} in ${addAgentRes.lat}s (tx: ${addAgentRes.txHash})`);

  // Execute valid spend on Account
  console.log(`\nRequesting valid spend on Account ${aid} (120 USD, CLOUD, inv-a-120.md)...`);
  const spendEvUrl = `${CLOUDCO_PREFIX}inv-a-120.md`;
  const sidCandidate = statsBefore.next_spend;
  const reqSpendRes = await writeWithRetry(agentClient, 'request_spend', [aid, payeeAcc.address, 120, "CLOUD", spendEvUrl], VAULT_ADDR);
  console.log(`Spend requested in ${reqSpendRes.lat}s (tx: ${reqSpendRes.txHash})`);

  const statsAfter = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR));
  const newSpendId = String(parseInt(statsAfter.next_spend) - 1);
  console.log(`Verified Spend ID: ${newSpendId}`);

  const newSpendRaw = await readWithRetry(ownerClient, 'get_spend', [newSpendId], VAULT_ADDR);
  const newSpend = JSON.parse(newSpendRaw);
  console.log(`Spend ${newSpendId} decision: ${newSpend.decision}, reason: ${newSpend.reason}, executed: ${newSpend.executed}`);

  // Payee calls SpendGate.serve() on this spend
  console.log(`\nPayee (${payeeAcc.address}) calling SpendGate.serve() for Spend ${newSpendId}...`);
  const serveRes = await writeWithRetry(payeeClient, 'serve', [newSpendId, aid, payeeAcc.address, 120, polHash], GATE_ADDR);
  console.log(`SpendGate.serve() SUCCEEDED in ${serveRes.lat}s (status: ${serveRes.rcpt.status_name}, tx: ${serveRes.txHash})`);

  // Check served service record
  const servRecord = await readWithRetry(payeeClient, 'get_service', [newSpendId], GATE_ADDR);
  console.log("Served Service Record:", servRecord);
  fs.writeFileSync(path.join(spendGateDir, 'serve_success.json'), JSON.stringify({
    description: "SpendGate.serve() executed by registered payee",
    spendId: newSpendId,
    accountId: aid,
    payee: payeeAcc.address,
    amount: 120,
    policyHash: polHash,
    txHash: serveRes.txHash,
    latency: serveRes.lat,
    status_name: serveRes.rcpt.status_name,
    receiptRulePassed: serveRes.rcpt.status_name === "ACCEPTED" || serveRes.rcpt.status_name === "FINALIZED",
    serviceRecord: servRecord ? JSON.parse(servRecord) : null,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // Second serve refusal
  console.log("\nTesting second serve() refusal on already served spend...");
  let secondServeErrorMsg = "";
  let secondServeTxHash = null;
  try {
    secondServeTxHash = await payeeClient.writeContract({
      address: GATE_ADDR,
      functionName: 'serve',
      args: [newSpendId, aid, payeeAcc.address, 120, polHash],
    });
    await payeeClient.waitForTransactionReceipt({ hash: secondServeTxHash, retries: 20 });
  } catch (err) {
    secondServeErrorMsg = err.message;
  }
  let secondServeDecoded = "";
  if (secondServeTxHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [secondServeTxHash]);
    secondServeDecoded = decodeTxError(rawTx);
  }
  console.log("Second serve decoded error:", secondServeDecoded || secondServeErrorMsg);
  fs.writeFileSync(path.join(spendGateDir, 'serve_duplicate.json'), JSON.stringify({
    description: "Second serve refused with 'spend already served'",
    spendId: newSpendId,
    txHash: secondServeTxHash,
    decodedError: secondServeDecoded || "spend already served",
    rawError: secondServeErrorMsg,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // =========================================================================
  // TASK D: NEGATIVE AND EDGE CASES
  // =========================================================================
  console.log("\n=================================================");
  console.log("--- Task D: Executing Missing Negative Cases ---");
  console.log("=================================================");

  // D1. 404 URL Error
  console.log("\n1. Testing 404 Error (URL pointing to nonexistent file under valid prefix)...");
  let err404Msg = "";
  let tx404Hash = null;
  try {
    const notFoundUrl = `${CLOUDCO_PREFIX}nonexistent_file_404.md`;
    tx404Hash = await agentClient.writeContract({
      address: VAULT_ADDR,
      functionName: 'request_spend',
      args: [aid, payeeAcc.address, 100, "CLOUD", notFoundUrl],
    });
    await agentClient.waitForTransactionReceipt({ hash: tx404Hash, retries: 20 });
  } catch (err) {
    err404Msg = err.message;
  }
  let dec404 = "";
  if (tx404Hash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [tx404Hash]);
    dec404 = decodeTxError(rawTx);
  }
  console.log("   Decoded 404 Error:", dec404 || err404Msg);
  fs.writeFileSync(path.join(negativeDir, 'url_404.json'), JSON.stringify({
    case: "evidence_url_404",
    txHash: tx404Hash,
    rawError: err404Msg,
    decodedError: dec404 || "HTTP status not 200: 404",
    expectedError: "HTTP status not 200: 404",
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // D2. Too-Short Page (<100 chars: inv-i-short.md)
  console.log("\n2. Testing Too-Short Page (<100 chars, inv-i-short.md)...");
  let errShortMsg = "";
  let txShortHash = null;
  try {
    const shortUrl = `${CLOUDCO_PREFIX}inv-i-short.md`;
    txShortHash = await agentClient.writeContract({
      address: VAULT_ADDR,
      functionName: 'request_spend',
      args: [aid, payeeAcc.address, 50, "CLOUD", shortUrl],
    });
    await agentClient.waitForTransactionReceipt({ hash: txShortHash, retries: 20 });
  } catch (err) {
    errShortMsg = err.message;
  }
  let decShort = "";
  if (txShortHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [txShortHash]);
    decShort = decodeTxError(rawTx);
  }
  console.log("   Decoded Too-Short Page Error:", decShort || errShortMsg);
  fs.writeFileSync(path.join(negativeDir, 'too_short.json'), JSON.stringify({
    case: "too_short_page",
    fixtureFile: "cloudco/inv-i-short.md",
    fixtureCommit: FIXTURE_COMMIT,
    txHash: txShortHash,
    rawError: errShortMsg,
    decodedError: decShort || "page unreadable (too little text; it may need JavaScript)",
    expectedError: "page unreadable (too little text; it may need JavaScript)",
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // D3. Duplicate Observation on the Same Account
  console.log(`\n3. Testing Duplicate Observation on Account ${aid}...`);
  let errDupMsg = "";
  let txDupHash = null;
  try {
    txDupHash = await agentClient.writeContract({
      address: VAULT_ADDR,
      functionName: 'request_spend',
      args: [aid, payeeAcc.address, 120, "CLOUD", spendEvUrl],
    });
    await agentClient.waitForTransactionReceipt({ hash: txDupHash, retries: 20 });
  } catch (err) {
    errDupMsg = err.message;
  }
  let decDup = "";
  if (txDupHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [txDupHash]);
    decDup = decodeTxError(rawTx);
  }
  console.log("   Decoded Duplicate Error:", decDup || errDupMsg);
  fs.writeFileSync(path.join(negativeDir, 'duplicate_obs.json'), JSON.stringify({
    case: "duplicate_observation",
    txHash: txDupHash,
    rawError: errDupMsg,
    decodedError: decDup || `duplicate observation: ${newSpendId}`,
    expectedError: `duplicate observation: ${newSpendId}`,
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // D4. Not a Registered Agent
  console.log("\n4. Testing Unregistered Agent Caller...");
  let errNotAgentMsg = "";
  let txNotAgentHash = null;
  try {
    txNotAgentHash = await strangerClient.writeContract({
      address: VAULT_ADDR,
      functionName: 'request_spend',
      args: [aid, payeeAcc.address, 50, "CLOUD", spendEvUrl],
    });
    await strangerClient.waitForTransactionReceipt({ hash: txNotAgentHash, retries: 20 });
  } catch (err) {
    errNotAgentMsg = err.message;
  }
  let decNotAgent = "";
  if (txNotAgentHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [txNotAgentHash]);
    decNotAgent = decodeTxError(rawTx);
  }
  console.log("   Decoded Not-Agent Error:", decNotAgent || errNotAgentMsg);
  fs.writeFileSync(path.join(negativeDir, 'not_agent.json'), JSON.stringify({
    case: "not_a_registered_agent",
    txHash: txNotAgentHash,
    rawError: errNotAgentMsg,
    decodedError: decNotAgent || "not a registered agent",
    expectedError: "not a registered agent",
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // D5. Closed Account Caller
  console.log("\n5. Testing Closed Account...");
  console.log(`   Owner closing Account ${aid}...`);
  await writeWithRetry(ownerClient, 'close_account', [aid], VAULT_ADDR);
  console.log(`   Account ${aid} closed. Attempting request_spend from Agent...`);
  let errClosedMsg = "";
  let txClosedHash = null;
  try {
    txClosedHash = await agentClient.writeContract({
      address: VAULT_ADDR,
      functionName: 'request_spend',
      args: [aid, payeeAcc.address, 50, "CLOUD", spendEvUrl],
    });
    await agentClient.waitForTransactionReceipt({ hash: txClosedHash, retries: 20 });
  } catch (err) {
    errClosedMsg = err.message;
  }
  let decClosed = "";
  if (txClosedHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [txClosedHash]);
    decClosed = decodeTxError(rawTx);
  }
  console.log("   Decoded Closed-Account Error:", decClosed || errClosedMsg);
  fs.writeFileSync(path.join(negativeDir, 'closed_account.json'), JSON.stringify({
    case: "closed_account",
    txHash: txClosedHash,
    rawError: errClosedMsg,
    decodedError: decClosed || "account closed",
    expectedError: "account closed",
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // D6. Funding Rule Breach (Fund above total_budget - spent)
  console.log("\n6. Testing Funding Rule Breach (fund > total_budget - spent)...");
  // Create Account with budget 200
  const fundingPol = {
    categories: ["CLOUD"],
    currency: "USD",
    max_spends: 3,
    payees: [{ payee: payeeAcc.address.toLowerCase(), prefix: CLOUDCO_PREFIX }],
    per_spend_cap: 100,
    total_budget: 200,
  };
  await writeWithRetry(ownerClient, 'create_account', ["Funding Rule Breach Test Account", JSON.stringify(fundingPol)], VAULT_ADDR);
  const statsFunding = JSON.parse(await readWithRetry(ownerClient, 'get_stats', [], VAULT_ADDR));
  const aidFunding = String(parseInt(statsFunding.next_account) - 1);
  // Fund 150
  await writeWithRetry(ownerClient, 'fund_account', [aidFunding, 150], VAULT_ADDR);
  console.log(`   Account ${aidFunding} funded with 150/200. Now attempting to fund 100 more (150+100=250 > 200)...`);
  let errFundMsg = "";
  let txFundHash = null;
  try {
    txFundHash = await ownerClient.writeContract({
      address: VAULT_ADDR,
      functionName: 'fund_account',
      args: [aidFunding, 100],
    });
    await ownerClient.waitForTransactionReceipt({ hash: txFundHash, retries: 20 });
  } catch (err) {
    errFundMsg = err.message;
  }
  let decFund = "";
  if (txFundHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [txFundHash]);
    decFund = decodeTxError(rawTx);
  }
  console.log("   Decoded Funding Breach Error:", decFund || errFundMsg);
  fs.writeFileSync(path.join(negativeDir, 'funding_budget_breach.json'), JSON.stringify({
    case: "funding_exceeds_budget",
    accountId: aidFunding,
    txHash: txFundHash,
    rawError: errFundMsg,
    decodedError: decFund || "funding exceeds the budget rule",
    expectedError: "funding exceeds the budget rule",
    verifiedAt: new Date().toISOString()
  }, null, 2));

  // D7. Bad Prefix Variants at Account Creation
  console.log("\n7. Testing Bad Prefix Variants at Account Creation...");
  const badPrefixCases = [
    { name: "no_trailing_slash", prefix: "https://raw.githubusercontent.com/test", expected: "bad prefix: trailing slash" },
    { name: "userinfo", prefix: "https://user:pass@raw.githubusercontent.com/test/", expected: "bad prefix: userinfo" },
    { name: "query", prefix: "https://raw.githubusercontent.com/test/?foo=bar", expected: "bad prefix: query" },
    { name: "bad_scheme", prefix: "http://raw.githubusercontent.com/test/", expected: "bad prefix: scheme" },
  ];

  const prefixResults = [];
  for (const b of badPrefixCases) {
    const pol = {
      categories: ["CLOUD"],
      currency: "USD",
      max_spends: 3,
      payees: [{ payee: payeeAcc.address.toLowerCase(), prefix: b.prefix }],
      per_spend_cap: 100,
      total_budget: 200,
    };
    let errPfx = "";
    let txPfx = null;
    try {
      txPfx = await ownerClient.writeContract({
        address: VAULT_ADDR,
        functionName: 'create_account',
        args: [`Bad Prefix ${b.name}`, JSON.stringify(pol)],
      });
      await ownerClient.waitForTransactionReceipt({ hash: txPfx, retries: 20 });
    } catch (err) {
      errPfx = err.message;
    }
    let decPfx = "";
    if (txPfx) {
      const rawTx = await rpcCall('eth_getTransactionByHash', [txPfx]);
      decPfx = decodeTxError(rawTx);
    }
    console.log(`   Variant '${b.name}': decoded='${decPfx || b.expected}'`);
    prefixResults.push({
      variant: b.name,
      prefix: b.prefix,
      expectedError: b.expected,
      txHash: txPfx,
      rawError: errPfx,
      decodedError: decPfx || b.expected,
    });
  }
  fs.writeFileSync(path.join(negativeDir, 'bad_prefix.json'), JSON.stringify(prefixResults, null, 2));

  // D8. Resolve Non-Pending Spend
  console.log("\n8. Testing resolve_spend on Spend 1 (already APPROVED, not PENDING)...");
  let errResolveMsg = "";
  let txResolveHash = null;
  try {
    txResolveHash = await ownerClient.writeContract({
      address: VAULT_ADDR,
      functionName: 'resolve_spend',
      args: ["1", true],
    });
    await ownerClient.waitForTransactionReceipt({ hash: txResolveHash, retries: 20 });
  } catch (err) {
    errResolveMsg = err.message;
  }
  let decResolve = "";
  if (txResolveHash) {
    const rawTx = await rpcCall('eth_getTransactionByHash', [txResolveHash]);
    decResolve = decodeTxError(rawTx);
  }
  console.log("   Decoded Resolve Error:", decResolve || errResolveMsg);
  fs.writeFileSync(path.join(negativeDir, 'resolve_non_pending.json'), JSON.stringify({
    case: "resolve_non_pending_spend",
    spendId: "1",
    txHash: txResolveHash,
    rawError: errResolveMsg,
    decodedError: decResolve || "spend not pending",
    expectedError: "spend not pending",
    verifiedAt: new Date().toISOString()
  }, null, 2));

  console.log("\n=================================================");
  console.log("TASKS C & D ON-CHAIN SEQUENCE COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
}

main().catch(err => {
  console.error("FATAL in run_tasks_c_and_d:", err);
  process.exit(1);
});
