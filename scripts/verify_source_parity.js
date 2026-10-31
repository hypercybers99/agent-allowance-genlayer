const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const RPC_URL = 'https://studio.genlayer.com/api';

const CONTRACTS = [
  {
    name: 'AllowanceVault',
    address: '0xd89C4fCB63773C01e8494EebaE7375C4d5992E07',
    localFile: path.join(__dirname, '../contracts/AllowanceVault.py'),
    deployTxHash: '0x53965fc7c6a0c0bbfec2f0eb3a76395dcfae6eeb246f4439c2794eb827051ae3',
  },
  {
    name: 'SpendGate',
    address: '0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528',
    localFile: path.join(__dirname, '../contracts/SpendGate.py'),
    deployTxHash: '0x3ab3717dfb119cb45a4773ebfc48d9aa1787c9339e1f5c66b8d276b89ae6e10f',
  },
  {
    name: 'ProbeExtract',
    address: '0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997',
    localFile: path.join(__dirname, '../contracts/ProbeExtract.py'),
    deployTxHash: '0xdb335abaca6e9c82b1d56a809ccb5aee66d378a49225a0b61b1ef34c6f238831',
  },
];

async function fetchContractCode(address) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'gen_getContractCode',
      params: [address],
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`RPC Error for ${address}: ${JSON.stringify(data.error)}`);
  }
  return data;
}

async function fetchTx(txHash) {
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
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log("==================================================================================================");
  console.log("ON-CHAIN SOURCE VERIFICATION & BYTE-FOR-BYTE PARITY AUDIT");
  console.log("==================================================================================================");

  const outDir = path.join(__dirname, '../docs/evidence/source');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const results = [];

  for (const c of CONTRACTS) {
    console.log(`\n--- Verifying ${c.name} (${c.address}) ---`);
    const rpcPayload = await fetchContractCode(c.address);
    const txData = await fetchTx(c.deployTxHash);

    // Save raw payload
    const payloadFile = path.join(outDir, `${c.name}_payload.json`);
    const combinedPayload = {
      contractName: c.name,
      address: c.address,
      deployTxHash: c.deployTxHash,
      retrievedAt: new Date().toISOString(),
      rpcMethod: 'gen_getContractCode',
      rawCodeBase64: rpcPayload.result,
      txData: txData,
    };
    fs.writeFileSync(payloadFile, JSON.stringify(combinedPayload, null, 2));

    // Decode base64
    const onchainSource = Buffer.from(rpcPayload.result, 'base64').toString('utf8');
    const onchainFile = path.join(outDir, `${c.name}_onchain.py`);
    fs.writeFileSync(onchainFile, onchainSource);

    // Compute hashes
    const onchainSha = crypto.createHash('sha256').update(onchainSource, 'utf8').digest('hex');
    const localSource = fs.readFileSync(c.localFile, 'utf8');
    const localSha = crypto.createHash('sha256').update(localSource, 'utf8').digest('hex');

    // Run diff
    let rawDiff = "";
    try {
      rawDiff = execSync(`git diff --no-index -- "${c.localFile}" "${onchainFile}"`, { encoding: 'utf8' });
    } catch (diffErr) {
      // git diff returns exit code 1 if there is a diff
      rawDiff = diffErr.stdout || diffErr.message;
    }

    const isMatch = (onchainSha === localSha) && (rawDiff.trim() === "");

    console.log(`  On-Chain Source SHA-256: ${onchainSha}`);
    console.log(`  Local Source SHA-256:     ${localSha}`);
    console.log(`  Raw Diff Output:          ${rawDiff.trim() === "" ? "[EMPTY - BYTE-FOR-BYTE IDENTICAL]" : rawDiff}`);
    console.log(`  Byte-For-Byte Parity:     ${isMatch ? "VERIFIED BYTE-FOR-BYTE" : "MISMATCH"}`);

    results.push({
      contract: c.name,
      address: c.address,
      onchainSha,
      localSha,
      emptyDiff: rawDiff.trim() === "",
      parity: isMatch ? "byte-for-byte" : "mismatch",
    });
  }

  console.log("\n==================================================================================================");
  console.log("SOURCE PARITY SUMMARY TABLE");
  console.log("==================================================================================================");
  console.log("| Contract | Address | On-Chain SHA-256 | Local SHA-256 | Raw Diff | Verification Status |");
  console.log("| :--- | :--- | :--- | :--- | :---: | :--- |");
  for (const r of results) {
    console.log(`| **${r.contract}** | \`${r.address}\` | \`${r.onchainSha}\` | \`${r.localSha}\` | ${r.emptyDiff ? "Empty" : "Non-empty"} | **${r.parity}** |`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
