# Requirement Analysis Document (RAD)
## Intelligent AML Framework Using Behavioral and Network Analysis

---

**Document Version:** 1.0  
**Prepared For:** National Hackathon Submission  
**Classification:** Confidential — Internal Use Only  
**Date:** April 6, 2026  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [System Architecture](#5-system-architecture)
6. [Tech Stack Justification](#6-tech-stack-justification)

---

## 1. Project Overview

### 1.1 Executive Summary

Money laundering is the process of concealing the origins of illegally obtained funds by passing them through a complex sequence of banking transfers, shell companies, or commercial transactions. According to the United Nations Office on Drugs and Crime (UNODC), an estimated **2–5% of global GDP** — approximately $800 billion to $2 trillion — is laundered annually. Despite decades of regulatory enforcement, financial institutions continue to rely on brittle, rule-based Anti-Money Laundering (AML) systems that generate overwhelming volumes of false positives while missing sophisticated, evolving criminal schemes.

The **Intelligent AML Framework** is a next-generation financial crime detection platform that replaces static threshold rules with a multi-layered intelligence engine combining:

- **Behavioral Analytics** — profiling entities over time to detect deviations from established norms
- **Graph Network Analysis** — mapping transaction flows as directed graphs to expose hidden circular structures, layering chains, and coordinated smurfing rings
- **Explainable AI (XAI)** — generating human-readable Suspicious Activity Reports (SARs) that investigators can act on with confidence

This system is designed for deployment by banks, fintech platforms, and financial regulators seeking to modernize their compliance infrastructure without sacrificing interpretability or investigator trust.

### 1.2 Scope

The framework covers:
- Real-time ingestion and processing of synthetic financial transaction streams
- Detection of three primary money laundering typologies: Smurfing, Layering, and Circular Trading
- Interactive visualization of transaction networks
- Automated SAR generation using Large Language Models (LLMs)
- A case management dashboard for compliance officers

---

## 2. Problem Statement

### 2.1 The Failure of Rule-Based AML Systems

Current industry-standard AML systems operate on a set of manually authored, static rules. A typical rule might read: *"Flag any cash transaction exceeding $10,000"* or *"Alert if more than 5 transactions occur within 24 hours."* While these rules satisfy regulatory checkboxes, they suffer from fundamental structural weaknesses:

**2.1.1 High False Positive Rates**  
Industry studies report that **95–99% of AML alerts are false positives**. Compliance teams spend the majority of their time investigating legitimate transactions, leading to investigator fatigue, desensitization to real alerts, and enormous operational costs. A single Tier-1 bank may process over 10,000 alerts per day, of which fewer than 100 are genuinely suspicious.

**2.1.2 Static Thresholds Are Easily Evaded**  
Sophisticated criminal networks are well aware of regulatory thresholds. Smurfing — the deliberate structuring of transactions just below reporting limits — is a direct response to static rules. A rule that flags transactions above $10,000 is trivially defeated by splitting a $50,000 transfer into six $8,000 deposits across different branches or accounts.

**2.1.3 No Relational Context**  
Rule-based systems evaluate transactions in isolation. They have no mechanism to understand that Account A sending money to Account B, which then sends to Account C, which then returns funds to Account A, constitutes a circular laundering loop. The relational, graph-level context is entirely invisible to these systems.

**2.1.4 Inability to Detect Behavioral Drift**  
A customer who has historically made 2–3 transactions per month and suddenly begins making 40 transactions per week is exhibiting a significant behavioral anomaly. Rule-based systems, lacking any temporal behavioral model, cannot detect this drift unless it crosses a hard-coded threshold.

**2.1.5 Poor Explainability**  
When a rule-based system does flag a transaction, the explanation is trivial: "Transaction exceeded $10,000." This provides investigators with no contextual intelligence. Conversely, when a sophisticated ML model flags a transaction, it often produces a black-box score with no human-readable justification, creating a different but equally serious problem.

### 2.2 The Need for Behavioral and Network Analysis

The solution requires a paradigm shift across three dimensions:

| Dimension | Rule-Based Approach | Intelligent AML Approach |
|---|---|---|
| Detection Logic | Static thresholds | Dynamic behavioral profiles + graph topology |
| Context | Per-transaction isolation | Multi-hop relational network context |
| Adaptability | Manual rule updates | Continuous learning from new patterns |
| Explainability | Trivial rule citation | XAI-generated narrative reports |
| False Positive Rate | 95–99% | Target: below 30% |

Behavioral analysis builds a longitudinal profile of each entity (account, individual, business) and flags deviations from that entity's own historical norm — not a population-wide threshold. Network analysis treats the entire transaction ecosystem as a directed graph, enabling detection of topological patterns like cycles, fan-in/fan-out structures, and coordinated cluster activity that are invisible to row-level analysis.

---

## 3. Functional Requirements

### 3.1 Data Ingestion Module

**FR-DI-01: Synthetic Transaction Stream Generation**  
The system shall generate a continuous, real-time stream of synthetic financial transactions simulating a realistic banking environment. Each transaction record shall contain:
- `transaction_id` (UUID)
- `sender_account_id`
- `receiver_account_id`
- `amount` (float, in USD)
- `timestamp` (ISO 8601)
- `transaction_type` (WIRE, ACH, CASH, CRYPTO)
- `geolocation` (sender and receiver country codes)
- `channel` (MOBILE, BRANCH, ATM, ONLINE)

**FR-DI-02: Stream Ingestion Pipeline**  
The system shall ingest transaction data via a message queue (Apache Kafka or equivalent) capable of handling burst loads. The ingestion layer shall support both batch backfill and real-time streaming modes.

**FR-DI-03: Data Normalization**  
All ingested transactions shall be normalized into a canonical schema before entering the analysis engine. Malformed or incomplete records shall be routed to a dead-letter queue with error metadata logged.

**FR-DI-04: Entity Resolution**  
The system shall maintain an entity registry linking accounts to individuals or organizations, supporting many-to-one relationships (one person, multiple accounts) for accurate network construction.

---

### 3.2 Detection Engine

#### 3.2.1 Circular Loop Detection

**FR-DE-01: Graph Construction**  
The system shall model all accounts as nodes and all transactions as directed, weighted edges in a graph database. Edge weight shall represent transaction amount; edge direction shall represent fund flow.

**FR-DE-02: Cycle Detection Algorithm**  
The system shall implement a modified Depth-First Search (DFS) with cycle detection to identify closed transaction loops of length 2 through N (configurable, default N=6). A cycle is defined as a path where funds originating from Account A return to Account A through one or more intermediary accounts within a configurable time window (default: 72 hours).

**FR-DE-03: Cycle Risk Scoring**  
Detected cycles shall be scored based on:
- Cycle length (shorter cycles = higher suspicion)
- Total value circulated
- Time compression (faster cycles = higher suspicion)
- Involvement of high-risk jurisdictions

#### 3.2.2 Smurfing Pattern Detection

**FR-DE-04: Structuring Detection**  
The system shall detect structuring behavior by identifying accounts that make multiple transactions within a rolling time window where:
- Individual transaction amounts fall below the reporting threshold (configurable, default: $10,000)
- The aggregate sum of transactions within the window exceeds the threshold
- Transactions are distributed across multiple destination accounts or branches

**FR-DE-05: Coordinated Smurfing Ring Detection**  
The system shall identify groups of accounts exhibiting synchronized low-value deposit behavior targeting a single aggregator account, using community detection algorithms (Louvain or Label Propagation) on the transaction graph.

**FR-DE-06: Temporal Pattern Analysis**  
The system shall analyze transaction timing distributions. Transactions clustered in abnormally short time windows (e.g., 10 deposits in 15 minutes) shall receive elevated suspicion scores.

#### 3.2.3 Behavioral Anomaly Detection

**FR-DE-07: Baseline Profile Construction**  
For each account entity, the system shall construct a behavioral baseline over a rolling 90-day window, capturing:
- Average transaction frequency (daily/weekly)
- Average transaction amount (mean and standard deviation)
- Typical counterparty set
- Typical transaction types and channels
- Geographic activity patterns

**FR-DE-08: Anomaly Scoring**  
The system shall compute an anomaly score for each incoming transaction using an Isolation Forest or Autoencoder model trained on the entity's behavioral baseline. Transactions deviating beyond a configurable Z-score threshold shall be flagged.

**FR-DE-09: Velocity Spike Detection**  
The system shall flag accounts whose transaction velocity (transactions per hour) exceeds 3 standard deviations above their historical mean within any rolling 24-hour window.

**FR-DE-10: New Counterparty Exposure**  
The system shall flag transactions where an account sends funds to a counterparty with whom it has had zero prior interaction, and the transaction amount exceeds the account's 90th percentile historical transaction size.

---

### 3.3 Visualization Module

**FR-VIZ-01: Interactive Transaction Network Graph**  
The system shall render an interactive, force-directed network graph where:
- Nodes represent accounts/entities, sized by transaction volume
- Edges represent transactions, colored by risk level (green → yellow → red)
- Suspicious subgraphs (detected cycles, smurfing clusters) are visually highlighted

**FR-VIZ-02: Graph Filtering and Drill-Down**  
Investigators shall be able to:
- Filter the graph by time range, transaction type, amount range, and risk score
- Click any node to expand its full transaction history and connected subgraph
- Collapse or expand cluster groups

**FR-VIZ-03: Timeline View**  
The system shall provide a chronological timeline view of transactions for any selected entity or cluster, enabling investigators to trace the temporal sequence of fund flows.

**FR-VIZ-04: Geospatial Overlay**  
The system shall overlay transaction flows on a world map, highlighting cross-border transfers and flagging transactions involving FATF high-risk jurisdictions.

---

### 3.4 AI Reporting Module (SAR Generation)

**FR-AI-01: Automated SAR Draft Generation**  
Upon confirmation of a suspicious case by an investigator, the system shall automatically generate a draft Suspicious Activity Report using an LLM (Google Gemini or equivalent). The SAR shall include:
- Subject entity details
- Summary of suspicious activity pattern detected
- Timeline of key transactions
- Risk indicators and their explanations
- Recommended regulatory filing category

**FR-AI-02: Explainable AI (XAI) Justifications**  
Every AI-generated alert shall include a plain-English explanation of why the transaction or pattern was flagged, referencing specific data points (e.g., "This account made 12 transactions totaling $89,400 in 4 hours, compared to its 90-day average of 3 transactions per week totaling $4,200").

**FR-AI-03: SHAP/LIME Feature Attribution**  
For ML model-generated alerts, the system shall display a feature importance breakdown (using SHAP values) showing which behavioral features contributed most to the anomaly score.

**FR-AI-04: SAR Export**  
Generated SARs shall be exportable in PDF and FinCEN XML format for direct regulatory submission.

---

### 3.5 Admin and Case Management Module

**FR-ADM-01: Case Lifecycle Management**  
The system shall support a full case lifecycle: `OPEN → UNDER_REVIEW → ESCALATED → CLOSED (SAR Filed / Dismissed)`. Each state transition shall be logged with investigator ID and timestamp.

**FR-ADM-02: Risk Scoring Dashboard**  
The admin dashboard shall display:
- Real-time alert feed with risk scores
- Entity risk heatmap
- Alert volume trends over time
- False positive rate tracking

**FR-ADM-03: Alert Configuration**  
Authorized administrators shall be able to configure detection thresholds, time windows, and risk score weights through a UI without requiring code changes or system restarts.

**FR-ADM-04: Role-Based Access Control (RBAC)**  
The system shall enforce the following roles:
- `ANALYST` — view alerts, add case notes
- `INVESTIGATOR` — manage cases, generate SARs
- `SUPERVISOR` — escalate cases, configure thresholds
- `ADMIN` — full system access, user management

**FR-ADM-05: Audit Trail**  
All user actions (alert views, case updates, threshold changes) shall be immutably logged for regulatory audit purposes.

---

## 4. Non-Functional Requirements

### 4.1 Performance and Latency

**NFR-PERF-01: Real-Time Processing Latency**  
The end-to-end latency from transaction ingestion to alert generation shall not exceed **500 milliseconds** at the 99th percentile under normal load conditions.

**NFR-PERF-02: Graph Query Performance**  
Cycle detection queries on subgraphs of up to 1,000 nodes shall complete within **2 seconds**.

**NFR-PERF-03: Dashboard Load Time**  
The visualization dashboard shall render initial graph views within **3 seconds** for datasets up to 100,000 nodes.

### 4.2 Scalability

**NFR-SCALE-01: Transaction Throughput**  
The ingestion and processing pipeline shall be horizontally scalable to handle a sustained throughput of **1 million transactions per second (TPS)** through Kafka partition scaling and stateless microservice replication.

**NFR-SCALE-02: Graph Database Scalability**  
The graph database shall support graphs with up to **1 billion nodes and 10 billion edges** through sharding and distributed query execution.

**NFR-SCALE-03: Stateless API Layer**  
All backend API services shall be stateless to enable auto-scaling via container orchestration (Kubernetes).

### 4.3 Security

**NFR-SEC-01: Data Encryption**  
All data shall be encrypted at rest (AES-256) and in transit (TLS 1.3). Encryption keys shall be managed via a dedicated secrets management service.

**NFR-SEC-02: Authentication**  
All user sessions shall be authenticated via JWT tokens with a maximum expiry of 8 hours. Multi-factor authentication (MFA) shall be enforced for all INVESTIGATOR and above roles.

**NFR-SEC-03: Role-Based Access Control**  
API endpoints shall enforce RBAC at the middleware layer. Unauthorized access attempts shall be logged and trigger security alerts after 3 consecutive failures.

**NFR-SEC-04: PII Data Handling**  
Personally Identifiable Information (PII) shall be tokenized before storage. Raw PII shall only be accessible to authorized roles through a dedicated de-tokenization service with full audit logging.

**NFR-SEC-05: Penetration Testing**  
The system shall undergo OWASP Top 10 vulnerability assessment prior to production deployment.

### 4.4 Accuracy and Model Quality

**NFR-ACC-01: False Positive Rate**  
The detection engine shall target a false positive rate below **30%**, measured against a labeled validation dataset, representing a 3x improvement over industry-standard rule-based systems.

**NFR-ACC-02: Recall (Sensitivity)**  
The system shall achieve a minimum recall of **85%** on known money laundering typologies in the validation dataset, ensuring that genuine suspicious activity is not missed.

**NFR-ACC-03: Model Drift Monitoring**  
The system shall monitor model performance metrics (precision, recall, F1) on a weekly basis and trigger retraining workflows when performance degrades beyond a configurable threshold.

### 4.5 Availability and Reliability

**NFR-AVAIL-01: System Uptime**  
The system shall maintain **99.9% uptime** (less than 8.7 hours downtime per year), with zero-downtime deployments via rolling updates.

**NFR-AVAIL-02: Data Durability**  
Transaction data and case records shall be replicated across a minimum of 3 availability zones with a Recovery Point Objective (RPO) of less than 1 minute.

---

## 5. System Architecture

### 5.1 High-Level Architecture Overview

The system is organized into five sequential layers, each with a distinct responsibility:

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
│  Synthetic Transaction Generator → Apache Kafka (Stream Bus)    │
│  Real-time events + historical batch data ingestion             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYSIS ENGINE LAYER                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Graph Engine   │  │ Behavioral Engine │  │ Rule Engine   │  │
│  │  (Neo4j)        │  │ (Python/sklearn)  │  │ (Fallback)    │  │
│  │  Cycle Detection│  │ Isolation Forest  │  │ Threshold     │  │
│  │  Community Det. │  │ Autoencoder       │  │ Rules         │  │
│  └─────────────────┘  └──────────────────┘  └───────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       AI LAYER                                  │
│  Risk Scoring Aggregator → SHAP Explainability Engine           │
│  LLM (Google Gemini) → SAR Draft Generation                     │
│  Alert Prioritization → Case Routing                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER                                  │
│  Node.js / Express REST API + WebSocket (real-time alerts)      │
│  RBAC Middleware → JWT Auth → Rate Limiting                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  VISUALIZATION DASHBOARD                        │
│  React.js Frontend                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Network Graph│  │ Alert Feed   │  │ Case Management UI   │  │
│  │ (D3.js /     │  │ Real-time    │  │ SAR Generation       │  │
│  │  Cytoscape)  │  │ WebSocket    │  │ Audit Trail          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow Description

1. **Ingestion:** The synthetic transaction generator produces events that are published to a Kafka topic. A consumer service reads from this topic, normalizes records, and writes them to both MongoDB (document store for transaction history) and Neo4j (graph database for relationship modeling).

2. **Analysis:** On each new transaction write, the Analysis Engine is triggered. The Graph Engine runs cycle detection and community detection queries in Neo4j. The Behavioral Engine retrieves the sender's historical profile from MongoDB and computes an anomaly score. Results from both engines are merged into a unified risk signal.

3. **AI Layer:** The Risk Scoring Aggregator combines graph-level and behavioral signals into a composite risk score. If the score exceeds the alert threshold, the SHAP engine generates feature attributions and the Gemini LLM is invoked to produce a plain-English alert narrative.

4. **API Layer:** Alerts are pushed to connected dashboard clients via WebSocket. REST endpoints serve case management operations, configuration changes, and SAR export requests.

5. **Dashboard:** Investigators receive real-time alerts, explore the transaction network graph, manage cases, and export SARs — all from a single React.js interface.

### 5.3 Data Storage Strategy

| Data Type | Storage | Rationale |
|---|---|---|
| Transaction records | MongoDB | Flexible schema, high write throughput |
| Entity relationships | Neo4j | Native graph traversal, Cypher query language |
| Behavioral profiles | MongoDB | Document model fits profile structure |
| Alert and case data | MongoDB | Relational-lite, audit trail support |
| Stream buffer | Apache Kafka | Durable, replayable event log |
| Session/cache | Redis | Sub-millisecond latency for auth tokens |

---

## 6. Tech Stack Justification

### 6.1 Why MERN Stack?

**MongoDB**  
Financial transaction data is inherently semi-structured and schema-evolving. MongoDB's document model accommodates varying transaction metadata (crypto vs. wire vs. cash) without costly schema migrations. Its aggregation pipeline supports the complex time-series queries needed for behavioral profiling, and its horizontal sharding supports the scale requirements defined in NFR-SCALE-01.

**Express.js + Node.js**  
Node.js's non-blocking, event-driven I/O model is purpose-built for high-concurrency, real-time applications. An AML system receiving thousands of transaction events per second and pushing alerts to dozens of concurrent investigator sessions is precisely this use case. The unified JavaScript runtime across frontend and backend reduces context-switching overhead and accelerates development velocity — critical in a hackathon context.

**React.js**  
React's component model and virtual DOM make it ideal for the complex, data-dense dashboard this system requires. The ecosystem provides mature libraries for every visualization need: D3.js and Cytoscape.js for network graphs, Recharts for time-series dashboards, and React Query for efficient real-time data synchronization via WebSocket.

### 6.2 Why Neo4j for Graph Analysis?

Money laundering is fundamentally a graph problem. Detecting circular fund flows, identifying smurfing rings, and tracing layering chains all require multi-hop graph traversals that are computationally prohibitive in relational databases. Neo4j's native graph storage and the Cypher query language make a 6-hop cycle detection query a single, readable statement. Its Graph Data Science (GDS) library provides production-ready implementations of Louvain community detection, PageRank, and shortest-path algorithms — directly applicable to AML detection without custom implementation.

### 6.3 Why Apache Kafka?

AML detection must be real-time. Kafka provides a durable, distributed, replayable event log that decouples transaction producers from the analysis engine. This means the detection pipeline can be scaled independently of the ingestion layer, alerts can be replayed for model retraining, and the system can recover from downstream failures without data loss — satisfying NFR-AVAIL-02.

### 6.4 Why Google Gemini (LLM) for SAR Generation?

Generating a Suspicious Activity Report requires synthesizing structured data (transaction records, graph topology, risk scores) into a coherent, regulatory-compliant narrative. This is precisely the task at which large language models excel. Gemini's long-context window allows the full transaction history and graph summary to be passed as context, producing SARs that are specific, accurate, and immediately actionable. Critically, this eliminates hours of manual report writing per case, directly addressing the investigator fatigue problem identified in Section 2.1.1.

### 6.5 Why Explainable AI (XAI) with SHAP?

Regulatory frameworks (EU AI Act, FinCEN guidance) increasingly require that automated financial decisions be explainable. A black-box risk score is insufficient for a compliance officer to justify filing a SAR or for a regulator to audit the system's decisions. SHAP (SHapley Additive exPlanations) provides mathematically grounded, per-prediction feature attributions that translate directly into the plain-English justifications required by FR-AI-02 and FR-AI-03. This is not a nice-to-have — it is a regulatory necessity.

### 6.6 Tech Stack Summary

| Component | Technology | Role |
|---|---|---|
| Frontend | React.js + D3.js / Cytoscape.js | Dashboard and network visualization |
| Backend API | Node.js + Express.js | REST API and WebSocket server |
| Primary Database | MongoDB | Transaction and case storage |
| Graph Database | Neo4j | Relationship modeling and cycle detection |
| Stream Processing | Apache Kafka | Real-time transaction ingestion |
| ML/Behavioral Engine | Python + scikit-learn + PyTorch | Anomaly detection models |
| Explainability | SHAP / LIME | Feature attribution for alerts |
| AI Reporting | Google Gemini API | SAR narrative generation |
| Caching | Redis | Session management and hot data |
| Containerization | Docker + Kubernetes | Deployment and auto-scaling |
| Authentication | JWT + bcrypt | Secure session management |

---

*End of Requirement Analysis Document*

*This document is intended for hackathon evaluation purposes. All transaction data referenced in this system is synthetic and does not represent real financial activity.*
