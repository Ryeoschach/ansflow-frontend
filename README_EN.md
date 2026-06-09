# AnsFlow Frontend

<p align="left">
  <a href="https://ansflow.cyfee.com"><img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18"></a>
  <a href="https://ansflow.cyfee.com"><img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://ansflow.cyfee.com"><img src="https://img.shields.io/badge/Vite-Ready-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="./README.md"><img src="https://img.shields.io/badge/Lang-中文说明-red?style=for-the-badge" alt="中文说明"></a>
</p>

English | [中文说明](./README.md)

AnsFlow Frontend is the React application for the AnsFlow operations platform. It provides the workspace UI for pipelines, hosts, credentials, Kubernetes/GitOps, SRE alerts, AI assistants, approvals, reports, and system settings.

- Product site and full documentation: [https://ansflow.cyfee.com](https://ansflow.cyfee.com)
- SRE Diagnosis Center provides observability datasource configuration, service mapping, log/metric query preview, template-based diagnosis, multi-source context views, and evidence index views.

### GitHub Repositories
- Portal Web: [Ryeoschach/ansflow-web](https://github.com/Ryeoschach/ansflow-web)
- Frontend: [Ryeoschach/ansflow-frontend](https://github.com/Ryeoschach/ansflow-frontend)
- Backend: [Ryeoschach/ansflow-backend](https://github.com/Ryeoschach/ansflow-backend)

### Gitee Mirrors
- Portal Web: [cyfee/ansflow-web](https://gitee.com/cyfee/ansflow-web)
- Frontend: [cyfee/ansflow-frontend](https://gitee.com/cyfee/ansflow-frontend)
- Backend: [cyfee/ansflow-backend](https://gitee.com/cyfee/ansflow-backend)

## Stack

- React 18, TypeScript, Vite
- Ant Design, Tailwind CSS
- TanStack Query, Zustand
- ReactFlow, xterm.js, Monaco Editor

## Development

```bash
pnpm install
pnpm dev
pnpm build
```

Configure API and WebSocket endpoints through the project environment files before connecting to a backend service. Detailed deployment and usage instructions are maintained in the AnsFlow Web documentation portal.

## SRE Diagnosis Center

Route: `/v1/sre/diagnosis`

Use "Preview Logs" and "Preview Metrics" in the Service Mapping tab to verify datasources, label selectors, field mappings, and response mappings before running a diagnosis.

The Diagnosis Templates tab supports listing, creating, editing, copying, enabling, and disabling templates. The template form configures target type, context collection switches, multiple log sources, multiple metric sources, log keywords, AI prompt template, and structured report requirements.

Diagnosis details show CI/CD context, log source context, metric source context, structured AI report, Markdown conclusion, collection summary, evidence index, and raw context JSON. The collection summary also shows the AI prompt context budget, before/after character counts, and trimming statistics by category. Failed pipeline nodes can start SRE template diagnosis directly or navigate to a prefilled diagnosis modal.

## License

Private - All Rights Reserved
