# Decentralized Marketplace Enhancements: High-Level Overview

This document tracks the five core infrastructural concerns identified during the Phase 1 review of the Clementine Project. These enhancements are critical to shift the architecture from a theoretical peer-to-peer ledger into a functional, resilient, and economically sound decentralized physical storage platform.

## Identified Concerns

1. **Data Availability & Resilience (Erasure Coding)**
   - **Problem:** Direct 1:1 chunk replication is inefficient, expensive, and fragile when facing unexpected node churn.
   - **Target Design:** `Phase3b_ErasureCoding.md`

2. **Cryptographic Validation (Proof of Spacetime / Retrievability)**
   - **Problem:** Static hash auditing allows malicious nodes to delete raw physical data and store only precomputed hashes to exploit ongoing audit block rewards. 
   - **Target Design:** `Phase4b_ProofOfSpacetime.md`

3. **Incentive Alignment (Staking & Slashing)**
   - **Problem:** Without upfront collateral, there is no deterrent preventing a malicious host from dropping a file contract or executing a Sybil attack.
   - **Target Design:** `Phase5b_StakingAndSlashing.md`

4. **Economic Viability (Bandwidth Egress Pricing)**
   - **Problem:** Storage operators incur extreme ISP peering bandwidth costs during data retrieval. Node algorithms currently lack the flexibility to price egress mapping, risking widespread network dropping of heavy users.
   - **Target Design:** `Phase2b_BandwidthPricing.md`

5. **Chain Scalability (Ledger Pruning / Micro-Ledgers)**
   - **Problem:** Sub-second continuous reward mechanisms rapidly bloat the single global ledger size, preventing new participants from syncing the network in a realistic timeframe.
   - **Target Design:** `Phase6_LedgerPruning.md`

This document serves as the tracking matrix. Upon approval of the underlying sub-designs, the tasks will be merged systematically into the overarching implementation sequence.
