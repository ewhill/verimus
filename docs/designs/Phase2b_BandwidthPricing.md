# Phase 2b: Bandwidth Egress Pricing

## The Problem
In decentralized storage, peering operators must offset hardware costs. Currently, Phase 2 proposes nodes publish their `getCostPerGB()` rates. While storing bytes at rest has a predictable, static electricity and disk-wear cost, *sending* bytes (egress) over the public Internet introduces highly volatile ISP bandwidth fees. If heavy retrieval workloads trigger uncompensated burst pipelines, storage node operators will autonomously disconnect from the network to preserve capital.

## Proposed Solution: Decoupled Rest/Retrieval Markets
Introduce a dual pricing schema where nodes establish two explicit parameters:
1. `CostPerGB_Rest`: A baseline staking fee holding the data at rest over time.
2. `CostPerGB_Egress`: A dedicated toll charged specifically for streaming the data back to the user or auditors.

During Phase 3 negotiation, requesting users allocate total contract funds predicting typical retrieval ratios, bounding an overarching SLA. Nodes refuse outbound pipelines extending beyond their funded egress bounds without additional `TRANSACTION` micropayments.

### Pros
- Accurately aligns the marketplace with real-world infrastructure economic models (e.g., AWS S3 outbound rates).
- Encourages operators to deploy nodes on high-throughput ISPs rather than isolated hard disks.

### Cons
- Increases the complexity of marketplace logic and escrow allocation tracking.
- Clients may experience "surprise" denial of service if they underestimate retrieval payloads and fail to post adequate bandwidth deposits.

## Alternative Solution: Centralized Bandwidth Relays
Delegate egress serving to a specialized set of high-availability "Gateway" nodes that subsidize bandwidth globally, while the majority of nodes strictly hold resting data.

### Pros
- Simplifies routing and guarantees fast downloads for the end user.
- Keeps typical node configurations lean without worrying about volatile pricing schemas.

### Cons
- Introduces centralization and single points of failure (Gateway operators).
- Distorts the `SYSTEM` tokenomic distribution by funneling excessive tokens narrowly to these relays.
