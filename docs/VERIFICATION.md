# On-Chain Verification and Deployment Audit

This document records the exact hashes, addresses, latencies, and source code verification for all smart contracts deployed under the Agent Allowance system on GenLayer Studionet (Chain 61999).

## 1. Network Coordinates
- **Network**: GenLayer Studionet
- **Chain ID**: 61999
- **RPC URL**: `https://studio.genlayer.com/api`
- **Explorer Base**: `https://explorer-studio.genlayer.com/address`

## 2. Deployed Contracts & Transactions

### AllowanceVault (Core Intelligent Spending Account)
- **Contract Address**: `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`
- **Deploy Transaction Hash**: `0x53965fc7c6a0c0bbfec2f0eb3a76395dcfae6eeb246f4439c2794eb827051ae3`
- **Deploy Latency**: 6.28 seconds
- **Source SHA-256**: `ff656818cd98e7387794cce80dc0f0bb8da8b6a85e80a8deaa2e20087866b4ea`
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07](https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07)

> [!NOTE] Superseded Deployment Record
> Contract address `0x63D63C490AD9Cf9C35E196D8366e23748212C5c2` (deploy tx `0xba40c31c067912e8a5f425f69b4f068a4007c6f555262594517829777c327a9f`) was an earlier deployment attempt that encountered Studionet RPC quota exhaustion (500 req/hr rate limit) during account creation and initial funding. It was superseded by active vault `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`, on which the complete 13-spend canonical lifecycle, invariants, and resolutions were executed.

### SpendGate (Merchant Integration Consumer)
- **Contract Address**: `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528`
- **Deploy Transaction Hash**: `0x3ab3717dfb119cb45a4773ebfc48d9aa1787c9339e1f5c66b8d276b89ae6e10f`
- **Deploy Latency**: 7.67 seconds
- **Source SHA-256**: `4b68ff52dbbbd6a2f3be04fbc5218d227b689a9f931665a38a3ae4608c02c6fe`
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528](https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528)

### ProbeExtract (Empirical Robustness Harness)
- **Contract Address**: `0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997`
- **Deploy Transaction Hash**: `0xdb335abaca6e9c82b1d56a809ccb5aee66d378a49225a0b61b1ef34c6f238831`
- **Deploy Latency**: 5.37 seconds
- **Source SHA-256**: `34b23f6e846a9caeecf7dabb480f987224f28a8ab58f31230152f377c74e9f0c`

### Probe (Milestone 0 Runtime Environment Probe)
- **Contract Address**: `0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`
- **Deploy Transaction Hash**: `0x17f3674c6e12e0594442ca3cafb1e0f59e3a3de2e82d02662bc9e14cc9cbf4fe`
- **Deploy Latency**: 6.67 seconds
- **Source SHA-256**: `5d6ea5507b39f9013090f4c24b2e8dd984ea516534fa8d8314a8630f2dcce68b`

---

## 3. Source Code Byte-for-Byte Verification Method
To verify that the deployed on-chain contract code matches the local source code byte-for-byte:
1. Query the deployment transaction via RPC method `eth_getTransactionByHash`.
2. Extract the base64-encoded Python source payload from `result.data.contract_code`.
3. Decode the base64 payload into raw UTF-8 string bytes.
4. Calculate the SHA-256 hash of the decoded on-chain source string.
5. Compare against the local file's SHA-256 hash.

All contracts achieved exact, byte-for-byte parity without any extraneous envelope bytes.

---

## 4. On-Chain Ledger Conservation Invariant Audit
Following all 13 canonical requests and owner resolution operations, the contract state was audited via on-chain view reads:
- `balance_of(owner)`: 500
- `balance_of(agent)`: 1000
- `balance_of(payee1_cloudco)`: 360 (Spends R1: 120, R2: 120, R6: 120)
- `balance_of(payee2_datashop)`: 90 (Spend R7: 90)
- Total User Balances: 500 + 1000 + 360 + 90 = 1950
- `get_account(1).balance`: 50
- Total in Contract: 1950 + 50 = **2000**
- `get_stats().total_minted`: **2000**
- **Conservation Invariant Status**: **PASSED (100% exact balance conservation)**

---

## 5. Raw Transaction Receipts (`docs/evidence/receipts/`)
Every deployed contract, administrative action, 13 canonical requests, resolutions, and negative attempts are captured as individual raw receipt files in `docs/evidence/receipts/` (27 total files). Each file contains:
- `tx_hash`
- `status` (`ACCEPTED` / `FINALIZED`)
- `leader_status` (`SUCCESS` / `ERROR`)
- `consensus_status` (`MAJORITY_AGREE` / `MAJORITY_DISAGREE`)
- Full validator responses, votes, gas, and block timestamps.

## 6. SpendGate Verification Evidence (`docs/evidence/spendgate/`)
Full on-chain consumer integration verified against active SpendGate `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528`:
- `valid_r1.json`: `is_spend_valid_for` returns `true` for canonical Spend 1.
- `altered_account.json`: `is_spend_valid_for` returns `false` when account is altered.
- `altered_payee.json`: `is_spend_valid_for` returns `false` when payee is altered.
- `altered_amount.json`: `is_spend_valid_for` returns `false` when amount is altered.
- `altered_policy_hash.json`: `is_spend_valid_for` returns `false` when policy hash is altered.
- `serve_success.json`: `serve(1)` succeeds when called by the authorized payee `0x3a60a7F8e9323F67eE30B669931792671569B30d`.
- `serve_duplicate.json`: Refuses duplicate `serve(1)` with decoded `gl.vm.UserError("spend already served")`.
- `serve_denied.json`: Refuses `serve(3)` for a DENIED spend with decoded `gl.vm.UserError("spend not valid for these parameters")`.
- `serve_non_payee.json`: Refuses `serve(1)` from non-payee with decoded `gl.vm.UserError("sender must equal payee")`.

## 7. Negative & Edge Cases Evidence (`docs/evidence/negative/`)
All edge cases and protocol guards are verified on Studionet with decoded `gl.vm.UserError` payloads:
- `url_404.json`: Missing invoice under valid prefix (`404 Not Found`) -> `"HTTP status not 200: 404"`.
- `too_short.json`: Fixture under 100 characters (`inv-i-short.md`, 40 chars) -> `"page unreadable (too little text; it may need JavaScript)"`.
- `duplicate_obs.json`: Duplicate observation ID submission -> `"duplicate observation: 15"`.
- `not_agent.json`: Spend request attempted by unauthorized address -> `"not a registered agent"`.
- `closed_account.json`: Spend request against closed account -> `"account closed"`.
- `funding_budget_breach.json`: Funding amount exceeding policy total budget -> `"funding exceeds the budget rule"`.
- `bad_prefix.json`: 4 invalid prefix attempts (missing trailing slash, userinfo, query, non-https scheme).
- `resolve_non_pending.json`: Owner attempting to resolve an already-decided spend -> `"spend not pending"`.

## 8. Dedicated Latency Benchmark Evidence (`docs/evidence/latency_benchmark.json`)
Measured in a single dedicated session across 13 consecutive on-chain runs:
- **5 Pre-Fetch Gates**: min 8.69s, median 12.10s, max 15.60s.
- **3 Tripwires**: min 8.71s, median 12.13s, max 18.75s.
- **5 Judged Invoices**: min 15.42s, median 18.67s, max 22.00s.
