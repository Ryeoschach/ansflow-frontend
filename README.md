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
- **Global Entry**: Bottom-right floating button with **Brand Color Breathing Light** indicator.
- **Streaming Chat**: Implements typewriter effect for real-time AI responses.
- **Auto-minimize**: Closes when clicking outside the dialog to keep the UI clean.
- **Theme Sync**: Deeply integrated with AntD 6 Token system, supporting seamless Dark/Light mode switching.

### 2. SRE Intelligent Alert Center
- **Route**: `/v1/sre/alerts`
- **AI Analysis**: Real-time AI diagnosis reports including root cause and remediation steps.
- **Self-healing Loop**: AI automatically matches self-healing pipelines, allowing one-click triggers in the detail view.
- **Auto-sync**: Periodic polling via TanStack Query ensures alert status is always up-to-date.

### 3. AIGC Pipeline Orchestration
- **Intent-driven**: AI search bar integrated into the Pipeline Designer toolbar.
- **Auto-modeling**: Generate nodes and edges automatically by describing needs in plain text (e.g., "Build Docker image then deploy to K8s").
- **Bidirectional Sync**: AI-generated DAGs remain fully editable by users for human-in-the-loop control.

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
