# AnsFlow Frontend

English | [中文说明](./README_ZH.md)

Enterprise-level DevOps pipeline platform frontend, built with React 18 + TypeScript + Vite. Integrated with **AI Assistant**, **SRE Alert Center**, and **AIGC Orchestration**.

**Current Version**: v2.0.0  
**Core Capabilities**: Intelligent Q&A / Auto Diagnosis / Alert Self-healing / Intent Orchestration

---

## Tech Stack

| Category | Technology | Description |
|------|------|------|
| Framework | React 18 + TypeScript | Core Framework |
| UI Components | Ant Design 6 | Enterprise UI Library |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| State Mgmt | Zustand v5 | Global & Persistent State |
| Data Fetching | TanStack Query v5 | Server State Sync |
| Pipeline | ReactFlow | DAG Flowchart Interaction |
| AI Interaction | Fetch ReadableStream | Streaming Chat Responses |
| Content Rendering | ReactMarkdown | Rendering AI Diagnosis & Code Blocks |

---

## Intelligent Ops Modules

### 1. AI Intelligent Assistant (AIChatbot)
- **Global Entry**: Bottom-right floating button with **Multi-state Badges** (Analyzing/Success/Timeout) and brand breathing light.
- **Knowledge Loop**: "Save to Knowledge" button integrated in AI responses and diagnosis reports for experience accumulation.
- **Categorized History**: Supports **Tab-based Filtering** (Chat/Diagnosis) and real-time title search.
- **Typing Animation**: Interactive three-dot jumping animation for a more dynamic AI thinking process.
- **Semantic Cache**: Millisecond-level response for previously saved knowledge using vector similarity.
- **Theme Optimization**: Enhanced contrast for Light mode and seamless theme switching.

### 2. SRE Intelligent Alert Center
- **Route**: `/v1/sre/alerts`
- **Task Pulse**: Real-time visualization of task execution health and throughput trends.
- **Full Tracking**: Integrated **Progress Bars** and live status updates during self-healing pipeline execution.
- **Strong Sync**: Backend signal-driven status synchronization between pipelines and alert records.
- **Trigger Awareness**: Accurate visual feedback for "Auto-Triggered" vs "Manual" remediation sources.
- **AI Analysis**: Real-time AI diagnosis reports with one-click export to RAG knowledge base.

### 3. System Management
- **Periodic Tasks**: UI for managing and scheduling Celery Beat tasks with Crontab support.

### 3. AIGC Pipeline Orchestration
- **Intent-driven**: AI input box integrated into the Pipeline Designer top bar.
- **Auto-modeling**: Generate full DAG structures from natural language descriptions.
- **Diagnosis Memory**: Automatically loads historical AI analysis in node trace views.

### 4. Configuration & Compliance Dashboards
- **Custom AI Prompt Editor**: Visual interface to edit prompts for 7 core LLM scenarios, with a dynamic variable guide (color-coded indicators for required inputs) and frontend safety checks to prevent missing placeholders.
- **Notification Config Panel**: Graphically toggle channels, define bot Webhooks, select alert thresholds (e.g. error only), and check event whitelist tags. Supports configuring the new `webhook_token` parameter to secure SRE Webhook receivers via Bearer HTTP headers or URL parameters (allowing any requests if empty).
- **MLPS 2.0 Audits Panel**: Compliance score dashboard for host infrastructure with one-click security scanning and patch execution.

### 5. WebSocket Streaming
- **Real-time Streaming Chat**: AI chatbot Floating Panel chatbot upgraded to WebSocket connections to support word-by-word typewriter-style streaming responses.

### 6. Project Multi-Tenancy & Asset Sharing
- **Workspace Isolation**: Global Project Selector dropdown in Header with React Query auto-invalidation. Operations on Hosts, Credentials, Pipelines, Tasks, Clusters, and Policies list tables feature a 🔗 Share action button that opens a `ShareAssetModal`, letting users grant `read`, `use`, or `full` permissions to other workspace projects.
- **Asset Share Center**: Dedicated workspace view `/v1/system/asset-shares` to manage shared-in and shared-out assets, perform filtering, audit operations, and revoke access keys.

---

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Start development server
pnpm dev
```

### Build

```bash
# Build for production
pnpm build
```

---

## Localization

Supported Languages:
- Chinese (Simplified)
- English (US)

## License

Private - All Rights Reserved
