# Robustness Testing Plan and Pre-Registration

This document pre-registers the empirical robustness evaluation protocol for the Agent Allowance LLM invoice extraction prompt before execution on GenLayer Studionet.

## Protocol and Constraints
- **Target Contract**: `contracts/ProbeExtract.py` (a lightweight intelligent contract executing the model extraction and deterministic parser without state storage).
- **Test Invoices Evaluated**:
  1. `cloudco/inv-a-120.md` (Expected: Category CLOUD, Amount 120, Currency USD)
  2. `cloudco/inv-a-120.html` (Expected: Category CLOUD, Amount 120, Currency USD)
  3. `datashop/inv-e-90.md` (Expected: Category DATA, Amount 90, Currency USD)
  4. `datashop/inv-f-eur.md` (Expected: Category DATA, Amount 90, Currency EUR)
  5. `cloudco/inv-c-no-total.md` (Expected: Amount 0 / Unclear, Currency USD/UNCLEAR)
  6. `cloudco/inv-h-marketing.md` (Expected: Category MARKETING, Amount 60, Currency USD)
- **Runs Per Target**: Exactly 10 repeated on-chain calls per document (60 runs total).
- **Prompt Text Sha256**: Pre-registered in this document and verified against contract source before runs.

## Pass Criteria (Pre-Registered Rule)
1. **Parser Success Rate**: 10 out of 10 runs (100%) must parse strictly according to `parse_extraction` without syntax errors, duplicate keys, or malformed JSON.
2. **Extraction Accuracy**: At least 9 out of 10 runs (>= 90%) must yield the expected canonical extraction:
   - `inv-a-120.md`: amount = 120, currency = "USD", category = "CLOUD"
   - `inv-a-120.html`: amount = 120, currency = "USD", category = "CLOUD"
   - `inv-e-90.md`: amount = 90, currency = "USD", category = "DATA"
   - `inv-f-eur.md`: amount = 90, currency = "EUR", category = "DATA"
   - `inv-c-no-total.md`: amount = 0, quote_ok or amount_unclear
   - `inv-h-marketing.md`: amount = 60, category = "MARKETING"

## Iteration Rules
- Maximum of 2 prompt iterations permitted.
- If an iteration is required, the precise failure reason must be logged, a new rule file committed, and all affected documents re-evaluated across a fresh 10-run batch.

## Empirical Audit & Rerun Accounting (Iteration 1 under Rule 9)
In the initial robustness evaluation run (`scripts/run_robustness.js`), targets 1-4 and 6 ran smoothly with 10/10 parse and 10/10 hit rates.
During the evaluation of target 5 (`cloudco/inv-c-no-total.md`), run 9 encountered a transient RPC network / gateway error (HTTP 502 returning an HTML error page rather than JSON-RPC), causing an unhandled socket rejection in `run_robustness.js` before receipt capture.
Because run 9 threw an uncaught network exception in the batch script, a standalone script `scripts/rerun_inv_c.js` was executed to run a complete, uninterrupted 10-run batch on `cloudco/inv-c-no-total.md`.
- **Target Contract**: `0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997` (`ProbeExtract.py`)
- **Prompt SHA-256**: `990f3801f114c0a5a22839b2ae82c0f99a5e82b794129994c5e3d74da05f31eb` (identical across both initial batch and rerun; zero prompt modifications were made)
- **Initial Batch Run 9 Failure Reason**: Studionet RPC gateway HTTP 502 / socket reset error during consensus wait.
- **Standalone Rerun Batch (`inv_c_rerun.json`)**: 10/10 valid JSON parses, 10/10 expected hits (`amount == 0`), latencies 8.48s - 32.29s.
Under Part 1 Rule 9 of the build rules, an undisclosed rerun of a target counts as an iteration. Therefore, this rerun is formally classified as **Iteration 1 (Operational/RPC resilience rerun, zero prompt modifications)**.

---

## 1. Batch 1: Harvested Batch (`docs/evidence/robustness_harvested/`)
Following initial probe execution, `scripts/save_robustness_raw.js` harvested model extraction records by querying the probe's `get_result(key)` view on 2026-10-26.
- **Nature of Records**: These records represent stored contract state read backs.
- **Limitation**: While they confirm the stored model output and parser validity across all 6 targets (60 runs), they lack per-run transaction receipts, status_name, result_name, per-tx latencies, and transaction hashes (which recorded `on-chain execution (contract state query)`).
- **Archival**: These 60 files have been relocated to `docs/evidence/robustness_harvested/` for complete auditability.

---

## 2. Batch 2: Receipt-Backed Batch of Record (`docs/evidence/robustness/`)
To establish definitive evidence of record, a fresh 60-transaction batch was executed directly on `ProbeExtract` (`0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997`) with:
- **Zero Prompt Modifications**: Uses the exact pre-registered prompt text (SHA-256 `990f3801f114c0a5a22839b2ae82c0f99a5e82b794129994c5e3d74da05f31eb`).
- **Complete Receipt Triple**: Every single run records `status_name` (`ACCEPTED`/`FINALIZED`), `result_name` (`MAJORITY_AGREE`), and `leader_execution_result` (`SUCCESS`).
- **Full Traceability**: Individual JSON files (`docs/evidence/robustness/<slug>_run_<N>.json`) record the real transaction hash, receipt timestamp, execution latency, commit-pinned input URL, raw model output from `get_result`, parser validation, and expectation match.
- **Accounting**: Documented as an **Operational Evidence Rerun** (zero prompt modifications, identical contract code and address). All attempts and retries are captured.
