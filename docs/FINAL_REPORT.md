# Final Evidence & Verification Report: Agent Allowance (Studionet)

STATUS: READY

## 1. Active Deployed Contracts (Unchanged on Studionet - Chain 61999)
- **AllowanceVault**: `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`
  - Deploy Transaction: `0x53965fc7c6a0c0bbfec2f0eb3a76395dcfae6eeb246f4439c2794eb827051ae3`
  - Source SHA-256: `ff656818cd98e7387794cce80dc0f0bb8da8b6a85e80a8deaa2e20087866b4ea`
  - Explorer: https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07
- **SpendGate**: `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528`
  - Deploy Transaction: `0x3ab3717dfb119cb45a4773ebfc48d9aa1787c9339e1f5c66b8d276b89ae6e10f`
  - Source SHA-256: `619f9fd95e40678b6aca68bf90b2de9c579b965a1f62ed707b3d73a3d9162101`
  - Explorer: https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528
- **ProbeExtract**: `0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997`
  - Deploy Transaction: `0xdb335abaca6e9c82b1d56a809ccb5aee66d378a49225a0b61b1ef34c6f238831`
  - Source SHA-256: `34b23f6e846a9caeecf7dabb480f987224f28a8ab58f31230152f377c74e9f0c`
  - Prompt SHA-256: `990f3801f114c0a5a22839b2ae82c0f99a5e82b794129994c5e3d74da05f31eb`
  - Explorer: https://explorer-studio.genlayer.com/address/0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997
- **Probe (Milestone 0)**: `0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`
  - Deploy Transaction: `0x17f3674c6e12e0594442ca3cafb1e0f59e3a3de2e82d02662bc9e14cc9cbf4fe`
  - Source SHA-256: `5d6ea5507b39f9013090f4c24b2e8dd984ea516534fa8d8314a8630f2dcce68b`
  - Explorer: https://explorer-studio.genlayer.com/address/0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3
- **Contracts Unchanged**: YES (Zero redeployments or contract source modifications).

---

## 2. Robustness Evidence: Harvested Batch vs Receipt-Backed Batch

### Batch 1: Harvested Batch (`docs/evidence/robustness_harvested/`, unreceipted view reads)
| Target Document | Slug | Attempts | Successes | Parse Success (10/10) | Expected Hits (>=9/10) | Pass Rate | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `cloudco/inv-a-120.md` | `inv_a_120_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (unreceipted) |
| `cloudco/inv-a-120.html` | `inv_a_120_html` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (unreceipted) |
| `datashop/inv-e-90.md` | `inv_e_90_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (unreceipted) |
| `datashop/inv-f-eur.md` | `inv_f_eur_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (unreceipted) |
| `cloudco/inv-c-no-total.md` | `inv_c_no_total_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (unreceipted) |
| `cloudco/inv-h-marketing.md` | `inv_h_marketing_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (unreceipted) |

### Batch 2: Receipt-Backed Batch (`docs/evidence/robustness/`, on-chain record)
| Target Document | Slug | Attempts | Successes | Parse Success (10/10) | Expected Hits (>=9/10) | Pass Rate | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `cloudco/inv-a-120.md` | `inv_a_120_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (receipt-backed) |
| `cloudco/inv-a-120.html` | `inv_a_120_html` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (receipt-backed) |
| `datashop/inv-e-90.md` | `inv_e_90_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (receipt-backed) |
| `datashop/inv-f-eur.md` | `inv_f_eur_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (receipt-backed) |
| `cloudco/inv-c-no-total.md` | `inv_c_no_total_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (receipt-backed) |
| `cloudco/inv-h-marketing.md` | `inv_h_marketing_md` | 10 | 10 | 10/10 | 10/10 | 10/10 | PASS (receipt-backed) |

### Robustness Misses & Deviations
- **Parse Failures**: 0 / 60 (100% strict JSON validity without markdown fences or comments).
- **Target Extraction Misses**: 0 / 60 (100% target accuracy).
- **Transient Gateway Retries**: 2 transient HTTP 502 HTML responses from RPC during writes (`rb_inv_a_120_html_8` and `rb_inv_c_no_total_md_6`), safely retried and recovered with verified on-chain receipts without data loss or gaps.

---

## 3. Canonical Requests R1 - R13 Comparison (Decision Match vs Reason Match)

| Req | Spend ID | Fixture Document | Declared | Expected Dec (Reason) | Actual Dec (Reason) | Decision Match | Reason Match | Latency | Tx Hash |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **R1** | 1 | `cloudco/inv-a-120.md` | 120 CLOUD | `APPROVE` (`-`) | `APPROVED` (`-`) | **YES** | **YES** | 15.03s | `0x1ea17415381fab11e200d96c40e9939bf65f34ec4d6ce6cac581a9801345c2d2` |
| **R2** | 2 | `cloudco/inv-a-120.html` | 120 CLOUD | `APPROVE` (`-`) | `APPROVED` (`-`) | **YES** | **YES** | 18.60s | `0x2caae20d092dfad2739bd5631579f78ab4247df6908290a9a43b97c1e8528a31` |
| **R3** | 3 | `cloudco/inv-a-120.md` | 100 CLOUD | `DENY` (`amount_mismatch`) | `DENIED` (`amount_mismatch`) | **YES** | **YES** | 15.07s | `0x666595e677637aa354a308e5dcdfd1c7aa6f438dd59a5708cb1aae3723a43e65` |
| **R4** | 4 | `cloudco/inv-b-450.md` | 450 CLOUD | `DENY` (`over_cap`) | `DENIED` (`over_cap`) | **YES** | **YES** | 8.45s | `0x2e84f9c76ed7639147677976208401274ab2248b892c831fea91266a32873d65` |
| **R5** | 5 | `cloudco/inv-d-injection.md` | 150 CLOUD | `ASK_OWNER` (`tripwire`) | `OWNER_REJECTED`* (`tripwire`) | **YES** | **YES** | 8.49s | `0xeabafd32e7c1e24602658539219a4bc3a9d14279236bcf70d591985737fe649f` |
| **R6** | 6 | `cloudco/inv-c-no-total.md` | 120 CLOUD | `ASK_OWNER` (`amount_unclear`) | `OWNER_APPROVED`* (`quote_not_found`) | **YES** | **NO** | 15.09s | `0xa5c8bd187b8c36e374bf16ee78bc358ae1634a7b1e6420ea85b16b9ca09c6dce` |
| **R7** | 7 | `datashop/inv-e-90.md` | 90 DATA | `APPROVE` (`-`) | `APPROVED` (`-`) | **YES** | **YES** | 14.99s | `0x6544da67a067a31fbdf27d7726d56fd817d4ae279eedcced619c37fe9208d45f` |
| **R8** | 8 | `datashop/inv-f-eur.md` | 90 DATA | `DENY` (`currency_mismatch`) | `DENIED` (`currency_mismatch`) | **YES** | **YES** | 18.44s | `0x4c8b4ec688d40310dabf26ba2637aeb8e9df07b38b688303a16014e5f5f61471` |
| **R9** | 9 | `adsy/inv-g-80.md` | 80 CLOUD | `DENY` (`evidence_not_bound`) | `DENIED` (`evidence_not_bound`) | **YES** | **YES** | 8.52s | `0x07233108b7ec47a07211ded5bec447606420517026bfcb3df139c69a3300bee2` |
| **R10** | 10 | `adsy/inv-g-80.md` | 80 MARKETING | `DENY` (`payee_unknown`) | `DENIED` (`payee_unknown`) | **YES** | **YES** | 15.24s | `0x78e06d23817164c13f06d03295c37378e29d01c1116846fb6e1103648201087d` |
| **R11** | 11 | `cloudco/inv-h-marketing.md` | 60 MARKETING | `DENY` (`category_not_allowed`) | `DENIED` (`category_not_allowed`) | **YES** | **YES** | 11.82s | `0x702d993bf8c1e0615967fbd3712ec4cb985479e6973a0058ece604e08f659846` |
| **R12** | 12 | `cloudco/inv-h-marketing.md` | 60 CLOUD | `DENY` (`category_not_allowed`) | `DENIED` (`category_not_allowed`) | **YES** | **YES** | 18.41s | `0x7bdb2579b9b1f985c2124e9d120d7c6fa176c1e2caba7d54b2a1243a03168574` |
| **R13** | 13 | `cloudco/inv-a-120.md` | 180 CLOUD | `DENY` (`over_budget`) | `DENIED` (`over_budget`) | **YES** | **YES** | 11.77s | `0x2c5183df2a882c24672ed121338096ab7ba0140cab2ab06e9d038a60de1bf66f` |

### R6 Reason Discrepancy & Raw Data Explanation
- **Decision Parity**: 13/13 (100.0%)
- **Reason Parity**: 12/13 (92.3%)
- **Spend 6 On-Chain Data** (`AllowanceVault.get_spend("6")`):
  `{"id":"6","account_id":"1","declared_amount":"120","observed_amount":"0","quote":"No final sum is assessed on this proforma notice.","reason":"quote_not_found","decision":"OWNER_APPROVED"}`
- **Reason Mechanism**:
  In `contracts/AllowanceVault.py`, verbatim quote and number validation occurs at Check 3 before ambiguity evaluation at Check 4. `number_in_quote(quote, 0)` requires `amount > 0` and returns `False` when amount is 0. Consequently, `quote_ok` evaluated to `False`, immediately returning `("ASK_OWNER", "quote_not_found")` at Check 3. The spend was safely held in `PENDING` status for owner review. Documented in `docs/EXPECTED_AMENDMENT.md`.

---

## 4. Contract Source Verification & Byte-For-Byte Parity

| Contract | Address | On-Chain Source SHA-256 | Local Source SHA-256 | Raw Diff | Verification Status |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **AllowanceVault** | `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07` | `ff656818cd98e7387794cce80dc0f0bb8da8b6a85e80a8deaa2e20087866b4ea` | `ff656818cd98e7387794cce80dc0f0bb8da8b6a85e80a8deaa2e20087866b4ea` | Empty | **byte-for-byte** |
| **SpendGate** | `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528` | `619f9fd95e40678b6aca68bf90b2de9c579b965a1f62ed707b3d73a3d9162101` | `619f9fd95e40678b6aca68bf90b2de9c579b965a1f62ed707b3d73a3d9162101` | Empty | **byte-for-byte** |
| **ProbeExtract** | `0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997` | `34b23f6e846a9caeecf7dabb480f987224f28a8ab58f31230152f377c74e9f0c` | `34b23f6e846a9caeecf7dabb480f987224f28a8ab58f31230152f377c74e9f0c` | Empty | **byte-for-byte** |

### Documentation Path Checker (`scripts/check_doc_paths.mjs`)
```
=================================================
CHECK DOCUMENTATION FILE PATHS (scripts/check_doc_paths.mjs)
=================================================
Scanned 13 markdown documentation files.

Total Path References Checked: 36
PASSED: All referenced documentation paths exist on disk!
```

### Address Registry (`docs/ADDRESS_REGISTRY.md`)
- Active Vault: `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`
- SpendGate: `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528`
- ProbeExtract: `0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997`
- Probe (M0): `0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`
- Superseded Vault: `0x63D63C490AD9Cf9C35E196D8366e23748212C5c2` (deploy tx `0xba40c31c067912e8a5f425f69b4f068a4007c6f555262594517829777c327a9f`, saved in `docs/evidence/receipts/superseded_vault_0x63d6.json`).

### On-Chain Finalization Summary (`scripts/check_finalization.js`)
```
=================================================================================
FINALIZATION STATUS COUNTS
=================================================================================
  FINALIZED                : 111 transactions
  NOT_FOUND_IN_RPC         : 2 transactions (unindexed historical deploys)
```

---

## 5. Verification Suite & CI Quality Assurance

### Test & Hygiene Suite (`npm run check`)
```
Ran 18 tests in 18.530s (OK)
- Layer 1 Fuzz: 5,000 cases verified with 100% oracle parity.
- Layer 2 Fuzz: 5,000 state transitions verified with 100% invariant conservation.
- ASCII Check: 5 contracts PASSED (100% pure ASCII).
- Banned Words Scan: 0 violations detected across codebase and docs.
- Secrets Scan: 0 secrets detected.
- 21-Branch Decision Parity: 21 distinct branch cases verified with 100% parity.
```

### Hash Verification (`scripts/verify_report_hashes.mjs`)
All hexadecimal strings and addresses in this report exist in tracked repository files or commit history.

---

## 6. Deviations & Unmeasured Scope
- **Calendar-Based Reset Windows**: Not measured (limits are per-spend, total budget, and max spend count as specified).
- **R6 Reason Pre-registration Divergence**: Expected `amount_unclear`, actual `quote_not_found`. Resolved by owner as intended; safety boundary preserved.
- **Historical Deploy Transactions**: Deploy transactions for `AllowanceVault` (`0x5396...`) and `SpendGate` (`0x3ab3...`) are no longer indexed in RPC history due to node history rotation, but contract code is permanently verified on-chain via `gen_getContractCode`.
