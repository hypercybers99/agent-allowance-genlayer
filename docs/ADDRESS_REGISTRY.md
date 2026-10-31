# Contract Address & Deployment Registry

This registry records the contract addresses, deployment transaction hashes, source code SHA-256 hashes, and operational statuses for all intelligent contracts deployed on GenLayer Studionet (Chain ID 61999, Preview).

---

## 1. Active Contracts of Record

### AllowanceVault (Core Intelligent Spending Account)
- **Contract Address**: `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`
- **Deploy Transaction Hash**: `0x53965fc7c6a0c0bbfec2f0eb3a76395dcfae6eeb246f4439c2794eb827051ae3`
- **Deployment Status**: Active on chain
- **Source Code File**: [`contracts/AllowanceVault.py`](contracts/AllowanceVault.py)
- **Source SHA-256**: `ff656818cd98e7387794cce80dc0f0bb8da8b6a85e80a8deaa2e20087866b4ea` (Byte-for-byte on-chain parity verified)
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07](https://explorer-studio.genlayer.com/address/0xd89C4fCB63773C01e8494EebaE7375C4d5992E07)
- **Description**: Primary intelligent contract holding account configurations, spending policies, URL prefix bindings, verbatim quote checks, and accounting ledger.

### SpendGate (Downstream Merchant Service Gate)
- **Contract Address**: `0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528`
- **Deploy Transaction Hash**: `0x3ab3717dfb119cb45a4773ebfc48d9aa1787c9339e1f5c66b8d276b89ae6e10f`
- **Deployment Status**: Active on chain
- **Source Code File**: [`contracts/SpendGate.py`](contracts/SpendGate.py)
- **Source SHA-256**: `619f9fd95e40678b6aca68bf90b2de9c579b965a1f62ed707b3d73a3d9162101` (Byte-for-byte on-chain parity verified)
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528](https://explorer-studio.genlayer.com/address/0xAe5aD4f836f199B56307b5E018eF3be8b8dd0528)
- **Description**: Merchant consumer contract performing cross-contract view checks against `AllowanceVault` and recording service fulfillment (`serve`).

### ProbeExtract (Empirical Robustness Harness)
- **Contract Address**: `0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997`
- **Deploy Transaction Hash**: `0xdb335abaca6e9c82b1d56a809ccb5aee66d378a49225a0b61b1ef34c6f238831`
- **Deployment Status**: Active on chain
- **Source Code File**: [`contracts/ProbeExtract.py`](contracts/ProbeExtract.py)
- **Source SHA-256**: `34b23f6e846a9caeecf7dabb480f987224f28a8ab58f31230152f377c74e9f0c` (Byte-for-byte on-chain parity verified)
- **Prompt SHA-256**: `990f3801f114c0a5a22839b2ae82c0f99a5e82b794129994c5e3d74da05f31eb`
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997](https://explorer-studio.genlayer.com/address/0x9EBE36E328c1A4b8609c8dcB300eF4DF90db8997)
- **Description**: Dedicated contract used for empirical robustness runs across test invoice fixtures without persistent accounting state.

### Probe (Milestone 0 Runtime Environment Probe)
- **Contract Address**: `0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3`
- **Deploy Transaction Hash**: `0x17f3674c6e12e0594442ca3cafb1e0f59e3a3de2e82d02662bc9e14cc9cbf4fe`
- **Deployment Status**: Verified on chain (Milestone 0)
- **Source Code File**: [`contracts/Probe.py`](contracts/Probe.py)
- **Source SHA-256**: `5d6ea5507b39f9013090f4c24b2e8dd984ea516534fa8d8314a8630f2dcce68b`
- **Explorer URL**: [https://explorer-studio.genlayer.com/address/0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3](https://explorer-studio.genlayer.com/address/0x0DB3Eb197eb49D93dA6B53B8DCb9fD789B42E2B3)
- **Description**: Runtime environment probe contract validating views, writes, nondet fetch, string normalization, and regexes.

---

## 2. Superseded Deployments

### AllowanceVault (Initial Incomplete Deployment)
- **Contract Address**: `0x63D63C490AD9Cf9C35E196D8366e23748212C5c2`
- **Deploy Transaction Hash**: `0xba40c31c067912e8a5f425f69b4f068a4007c6f555262594517829777c327a9f`
- **Receipt Evidence File**: [`docs/evidence/receipts/superseded_vault_0x63d6.json`](docs/evidence/receipts/superseded_vault_0x63d6.json)
- **Deployment Status**: Superseded / Aborted
- **Reason for Supersession**:
  This contract was successfully deployed during the initial run sequence. However, immediately after deployment, subsequent account creation and funding transactions failed due to Studionet RPC rate limiting / quota exhaustion (500 requests per hour). Because state setup was interrupted, the deployment was cleanly superseded by active vault `0xd89C4fCB63773C01e8494EebaE7375C4d5992E07`, on which the entire canonical test sequence (R1-R13), resolutions, invariants, SpendGate interactions, and negative edge cases were executed.
