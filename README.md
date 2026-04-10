# TRACR: Intelligent AML Framework

[![Project Status: Active](https://img.shields.io/badge/Project%20Status-Active-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)]()

![TRACR Dashboard Background](https://lh3.googleusercontent.com/aida-public/AB6AXuASRvJfKXx54L6J6UnQj1GeZBbPOdVu24iUkL9LVf9mhOolUpXR1foBzRiFvAq0WgoeRYtrs3Jgb3FENoj1KRYKjG_mBAeGz6H3OZm9BfcipO9Wq_kiTPLGHbibqB5Mxk8d0CXb3JShHTA5WtrYBZA0WeQyOmikZQPSXAZXT3OIdCM7fv_vy2bf-uR2jWO3_QoMJomU9d8E38QE867jerPZ9GJQa6rjDQtNmTrEUyPFtFvb3B04HVCSYnoL7Kwf9N1mC8DEH3gN-H5O)

## 📌 Overview

**TRACR** (Intelligent Anti-Money Laundering Framework) is a next-generation, high-performance financial crime detection platform. Driven by real-time heuristics, graph-theoretic cycle detection, and Explainable AI (XAI), TRACR targets sophisticated money laundering typologies—such as **Smurfing (Structuring)** and **Circular Trading (Layering)**—which often evade traditional rule-based AML systems. 

Nicknamed the "Sovereign Observer," TRACR utilizes a robust microservice architecture to process high-volume transaction telemetry and automatically draft **Suspicious Activity Reports (SARs)** using generative AI (Google's Gemini 1.5 Flash), significantly reducing investigator fatigue and false positives.

---

## 🏗️ System Architecture

TRACR is built with a decoupled, high-performance architecture divided into three primary layers, designed to handle sub-500ms end-to-end latency from ingestion to alert generation.

1. **Frontend (The Intelligence Layer)**
   - **Legacy UI (`/frontend`)**: React + Vite + Tailwind CSS v4. A real-time SPA utilizing WebSockets for instant anomaly feeds.
   - **Next-Gen Command Center (`/frontend-new`)**: Next.js 15, React 19, and Tailwind CSS v4. Features a dark-themed Investigation Command Center with WebGL-accelerated 3D components (using `react-three-fiber` and `react-force-graph`) mapped for multi-dimensional data visualization, interactive cases, and real-time feed capabilities.

2. **Backend (The Core Engine) (`/backend`)**
   - Node.js & Express.js REST API.
   - Embeds a `SocketGateway` for push-based real-time event distribution.
   - **Detection Engine:** Graph-theoretic DFS cycle detection & rolling-window behavioral velocity analysis running in memory.
   - **Scoring Engine:** Hybrid risk scoring system factoring in cycle length, time compression, FATF jurisdiction, and smurfing multipliers.
   - **Explainable AI (XAI) Module:** Integrates with Gemini 1.5 Flash for generating plain-English SAR narratives.

3. **Data & Synthetic Ingestion**
   - **Simulator:** A configurable Python-based ML heuristic synthetic stream generator (`seed_data.py`) modeling real-world transactional behaviors.
   - **Persistence:** MongoDB for normalized transaction persistence, historical baselines, and append-only audit logging.

---

## ✨ Key Features

- **Real-Time Anomaly Feed:** Live inference mapping and alerting via WebSocket `metrics:update` packets.
- **Topological Network Discovery:** WebGL-accelerated visual alerts exposing network-level threats, cycles, and layering typologies directly within the dashboard.
- **Explainable AI (XAI):** Human-interpretable justifications and automated **SAR Drafting** via Gemini 1.5 Flash for rapid regulatory filing.
- **Behavioral Profiling:** Rolling 90-day baseline computations accounting for transaction frequency, velocity spikes, and counterparty anomalies.
- **Premium Fintech Aesthetic:** High-density, dark-mode-first layouts utilizing glassmorphism and tailored tonal layering optimized for compliance analysts and threat hunting.

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js**: v20+
- **Python**: v3.10+
- **MongoDB**: Localport `27017` or Atlas Cloud URL
- **API Keys**: Google Gemini API key mapped for XAI features.

### 2. Configuration & Secrets

Clone the repository and set up the backend environment variables.

Create an `.env` file in the `backend` directory (e.g., `cp backend/.env.example backend/.env`) and securely configure your credentials:

```env
# MongoDB Connection String (Atlas or Local)
MONGO_URI=mongodb+srv://tracr_user:tracrdbpassword@<YOUR_CLUSTER_ID>.mongodb.net/intelligent_aml

# Authentication
JWT_SECRET=replace_with_strong_secure_secret_key

# AI Layer
GEMINI_API_KEY=replace_with_gemini_api_key
```

### 3. Installation

**Install Backend Dependencies:**
```bash
cd backend
npm install
```

**Install Next-Gen Frontend Dependencies:**
```bash
cd frontend-new
npm install
```

*(Note: To use the legacy Vite frontend, run `npm install` inside the `frontend` directory instead.)*

---

## 💻 Running TRACR Locally

Running the completely interconnected ecosystem requires spinning up the backend, frontend, and the synthetic transaction simulator concurrently.

### Step 1: Start the Backend Gateway
Initializes the ingestion pipeline, detection engine, and Socket.IO WebSocket server on port `3000`.

```bash
cd backend
npm start
```

### Step 2: Start the Next-Gen Investigation Dashboard
Bootstraps the Next.js 15 Intelligence Command Center. Eliminates CORS requirements with integrated API routings.

```bash
cd frontend-new
npm run dev
```
Navigate to `http://localhost:3000` (or the port specified by Next.js) to access the Investigation Command Center. *(To run the legacy frontend, `cd frontend` and `npm run dev` mapping to `http://localhost:5173`)*

### Step 3: Trigger Live Synthetic Threats (Simulation)
To monitor the dashboard actively detecting anomalies and graph cycles, execute the Python synthetic transaction pipeline. This script simulates TPS streams with injected Smurfing & Circular Trading typologies.

```bash
cd backend
# Execute the ML generator pipeline
python seed_data.py
```

---

## 🛠️ Technology Stack

**Frontend Next-Gen**
- Next.js 15 / React 19
- Tailwind CSS v4
- React Three Fiber / WebGL (Graphing & 3D Maps)
- Leaflet & D3 (Spatial Analysis)

**Backend Core**
- Express.js (Node.js)
- Socket.IO (Real-time Eventing)
- MongoDB & Mongoose
- JSON Web Tokens (HS256 RBAC Auth)
- Jest (Testing)

**AI & Analytics**
- Google Gemini 1.5 Flash (Automated SAR Generation)
- Python Analytics / Heuristics
