# Pre-Registered Expectations vs Actual On-Chain Results

This document compares the pre-registered predictions (from `fixtures/EXPECTED.md`) against the actual on-chain results verified on GenLayer Studionet (Chain 61999) on `AllowanceVault` at address `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`.

## Canonical Runs Comparison Table (R1 - R13)

| ID | Payee | Declared | Evidence File | Predicted Dec (Reason) | Actual Dec (Reason) | Decision Match | Reason Match | Latency | Tx Hash |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **R1** | CloudCo | 120 CLOUD | `cloudco/inv-a-120.md` | `APPROVE` (`-`) | `APPROVED` (`-`) | **YES** | **YES** | 15.03s | `0x1ea17415...` |
| **R2** | CloudCo | 120 CLOUD | `cloudco/inv-a-120.html` | `APPROVE` (`-`) | `APPROVED` (`-`) | **YES** | **YES** | 18.60s | `0x2caae20d...` |
| **R3** | CloudCo | 100 CLOUD | `cloudco/inv-a-120.md` | `DENY` (`amount_mismatch`) | `DENIED` (`amount_mismatch`) | **YES** | **YES** | 15.07s | `0x666595e6...` |
| **R4** | CloudCo | 450 CLOUD | `cloudco/inv-b-450.md` | `DENY` (`over_cap`) | `DENIED` (`over_cap`) | **YES** | **YES** | 8.45s | `0x2e84f9c7...` |
| **R5** | CloudCo | 150 CLOUD | `cloudco/inv-d-injection.md` | `ASK_OWNER` (`tripwire`) | `OWNER_REJECTED`* (`tripwire`) | **YES** | **YES** | 8.49s | `0xeabafd32...` |
| **R6** | CloudCo | 120 CLOUD | `cloudco/inv-c-no-total.md` | `ASK_OWNER` (`amount_unclear`) | `OWNER_APPROVED`* (`quote_not_found`) | **YES** | **NO** | 15.09s | `0xa5c8bd18...` |
| **R7** | DataShop | 90 DATA | `datashop/inv-e-90.md` | `APPROVE` (`-`) | `APPROVED` (`-`) | **YES** | **YES** | 14.99s | `0x6544da67...` |
| **R8** | DataShop | 90 DATA | `datashop/inv-f-eur.md` | `DENY` (`currency_mismatch`) | `DENIED` (`currency_mismatch`) | **YES** | **YES** | 18.44s | `0x4c8b4ec6...` |
| **R9** | CloudCo | 80 CLOUD | `adsy/inv-g-80.md` | `DENY` (`evidence_not_bound`) | `DENIED` (`evidence_not_bound`) | **YES** | **YES** | 8.52s | `0x07233108...` |
| **R10** | AdSy | 80 MARKETING | `adsy/inv-g-80.md` | `DENY` (`payee_unknown`) | `DENIED` (`payee_unknown`) | **YES** | **YES** | 15.24s | `0x78e06d23...` |
| **R11** | CloudCo | 60 MARKETING | `cloudco/inv-h-marketing.md` | `DENY` (`category_not_allowed`) | `DENIED` (`category_not_allowed`) | **YES** | **YES** | 11.82s | `0x702d993b...` |
| **R12** | CloudCo | 60 CLOUD | `cloudco/inv-h-marketing.md` | `DENY` (`category_not_allowed`) | `DENIED` (`category_not_allowed`) | **YES** | **YES** | 18.41s | `0x7bdb2579...` |
| **R13** | CloudCo | 180 CLOUD | `cloudco/inv-a-120.md` | `DENY` (`over_budget`) | `DENIED` (`over_budget`) | **YES** | **YES** | 11.77s | `0x2c5183df...` |

### Match Summary & R6 Reason Discrepancy
- **Decision Match**: **13/13 (100.0%)** — All 13 canonical spend decisions match expected governance paths.
- **Reason Match**: **12/13 (92.3%)** — 12 of 13 reason codes match pre-registration exactly.
- **R6 Reason Discrepancy Analysis**:
  In `fixtures/EXPECTED.md`, R6 (`inv-c-no-total.md`) was predicted to yield `ASK_OWNER` with reason `amount_unclear`. On chain, the contract returned `ASK_OWNER` with reason `quote_not_found`. In `contracts/AllowanceVault.py`, verbatim quote and number validation occurs at Check 3 before ambiguity evaluation at Check 4. Because `inv-c-no-total.md` has amount 0, `number_in_quote(quote, 0)` returned `False`, causing `quote_ok` to be `False` and triggering `quote_not_found` at Check 3. The spend was safely held in `PENDING` for human review, achieving the intended safe governance outcome. Full root cause analysis and chain data are documented in [`docs/EXPECTED_AMENDMENT.md`](docs/EXPECTED_AMENDMENT.md).

*\*Notes on R5 and R6 Two-Step Workflow*:
- **R5**: Entered `PENDING` (`ASK_OWNER`) on-chain due to the injection tripwire, and was subsequently resolved by the owner via `resolve_spend(5, false)` resulting in final status `OWNER_REJECTED`.
- **R6**: Entered `PENDING` (`ASK_OWNER`) on-chain due to quote check failure on unstated total, and was subsequently resolved by the owner via `resolve_spend(6, true)` resulting in final status `OWNER_APPROVED`.

## Latency & Pipeline Analysis

The 13 canonical requests exercise three distinct operational execution paths through the `AllowanceVault` pipeline:

1. **Pre-Fetch Storage Gates (Skips both Web Fetch and Model Prompt)**:
   - Requests:
     - **R4** (`over_cap`): 8.45s — Declared amount 450 exceeds policy cap 300.
     - **R9** (`evidence_not_bound`): 8.52s — Evidence URL host/path does not match registered prefix for CloudCo.
     - **R10** (`payee_unknown`): 15.24s — Payee AdSy is not registered in the policy payees list.
     - **R11** (`category_not_allowed`): 11.82s — Declared category MARKETING is not in policy allowed categories.
     - **R13** (`over_budget`): 11.77s — Declared amount 180 would exceed remaining policy budget.
   - Mechanism: Validates declared metadata strictly against stored account configuration. Returns `DENY` before calling `gl.nondet.web.get` or `gl.nondet.exec_prompt`.
   - Measured Latency Range: 8.45s to 15.24s (Average: 11.16s). The variation reflects Studionet block packaging and validator consensus round intervals rather than I/O workload.

2. **Tripwire Gates (Executes Web Fetch & Strip, Skips Model Prompt)**:
   - Requests:
     - **R5** (`tripwire`): 8.49s — Fetches raw document over HTTPS, cleans text, detects prompt injection phrase (`ignore previous instructions`), and immediately returns `ASK_OWNER`.
   - Mechanism: Only `gl.nondet.web.get` and local Python string normalization are executed. The expensive LLM prompt (`gl.nondet.exec_prompt`) is completely bypassed.
   - Measured Latency: 8.49s.

3. **Judged Invoices (Full Pipeline: Web Fetch + Strip + Model Prompt + Quote Parity)**:
   - Requests:
     - **R1** (120 CLOUD Markdown): 15.03s
     - **R2** (120 CLOUD HTML): 18.60s
     - **R3** (100 CLOUD vs 120 declared): 15.07s
     - **R6** (120 CLOUD no total): 15.09s
     - **R7** (90 DATA): 14.99s
     - **R8** (90 DATA EUR): 18.44s
     - **R12** (60 CLOUD vs MARKETING actual): 18.41s
   - Mechanism: Executes HTTPS fetch, HTML tag stripping, LLM extraction via prompt, token quote verification, amount-in-quote validation, and deterministic policy rule checking.
   - Measured Latency Range: 14.99s to 18.60s (Average: 16.52s).

### Dedicated Single-Session Latency Benchmark (Task F)

To isolate variance and provide an unclouded comparison across the three operational pipelines, a dedicated single-session benchmark was executed on Studionet across 13 transactions (5 pre-fetch gates, 3 tripwires, 5 LLM-judged invoices) recorded in `docs/evidence/latency_benchmark.json`:

| Pipeline Group | Count | Min (s) | Median (s) | Max (s) | Raw Values (s) | Execution Profile |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Pre-Fetch Gates** | 5 | **8.69s** | **12.10s** | **15.60s** | `[8.69, 8.71, 12.10, 12.32, 15.60]` | Zero external network calls; instant deterministic check against account state. |
| **Tripwires** | 3 | **8.71s** | **12.13s** | **18.75s** | `[8.71, 12.13, 18.75]` | Executes `gl.nondet.web.get` + regex strip; bypasses `gl.nondet.exec_prompt`. |
| **Judged Invoices** | 5 | **15.42s** | **18.67s** | **22.00s** | `[15.42, 18.26, 18.67, 18.78, 22.00]` | Full pipeline: `gl.nondet.web.get` + LLM extraction prompt + validator agreement. |

#### Latency Analysis and Network Variance
- **Model Latency Impact**: The median latency for LLM-judged invoices (**18.67s**) is ~6.5 seconds higher than Pre-Fetch Gates (**12.10s**) and Tripwires (**12.13s**). This additional ~6.5s directly reflects the execution of the non-deterministic LLM prompt by the leader and its subsequent validation and consensus agreement by the validator nodes.
- **Network & Consensus Block Variance**: The minimum latency for judged invoices (**15.42s**) slightly overlaps with the maximum latency of pre-fetch gates (**15.60s**) and tripwires (**18.75s**). On Studionet, validator consensus polling and block proposal cadence operate on ~3 to 4 second block ticks. A transaction submitted right at the beginning of a block window takes one additional tick (~3-4s), meaning consensus block packaging jitter introduces an inherent variance of ~3-7 seconds that partially overlaps with the model execution overhead. However, the median values cleanly distinguish gate operations (~12.1s) from model-evaluated invoices (~18.7s).
