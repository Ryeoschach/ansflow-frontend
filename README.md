# AnsFlow Frontend

<p align="left">
  <a href="https://ansflow.cyfee.com"><img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18"></a>
  <a href="https://ansflow.cyfee.com"><img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://ansflow.cyfee.com"><img src="https://img.shields.io/badge/Vite-Ready-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"></a>
  <a href="./README_EN.md"><img src="https://img.shields.io/badge/Lang-English-red?style=for-the-badge" alt="English"></a>
</p>

中文说明 | [English](./README_EN.md)

AnsFlow Frontend 是 AnsFlow 运维平台的 React 前端应用，提供流水线、主机、凭据、Kubernetes/GitOps、SRE 告警、AI 助手、审批、报表和系统设置等工作台界面。

- 产品展示与完整文档：[https://ansflow.cyfee.com](https://ansflow.cyfee.com)
- SRE 诊断中心提供观测数据源配置、服务映射、日志/指标查询预览和时间点诊断结果查看。

### GitHub 仓库
- 门户网站：[Ryeoschach/ansflow-web](https://github.com/Ryeoschach/ansflow-web)
- 前端仓库：[Ryeoschach/ansflow-frontend](https://github.com/Ryeoschach/ansflow-frontend)
- 后端仓库：[Ryeoschach/ansflow-backend](https://github.com/Ryeoschach/ansflow-backend)

### Gitee 镜像仓库
- 门户网站：[cyfee/ansflow-web](https://gitee.com/cyfee/ansflow-web)
- 前端仓库：[cyfee/ansflow-frontend](https://gitee.com/cyfee/ansflow-frontend)
- 后端仓库：[cyfee/ansflow-backend](https://gitee.com/cyfee/ansflow-backend)

## 技术栈

- React 18、TypeScript、Vite
- Ant Design、Tailwind CSS
- TanStack Query、Zustand
- ReactFlow、xterm.js、Monaco Editor

## 开发命令

```bash
pnpm install
pnpm dev
pnpm build
```

连接后端服务前，请根据部署环境配置 API 与 WebSocket 地址。详细部署与使用说明统一维护在 AnsFlow Web 文档门户中。

## SRE 诊断中心

入口：`/v1/sre/diagnosis`

在“服务映射”页签中可以使用“日志预览”和“指标预览”验证数据源、标签选择器、字段映射和响应映射是否正确。

## License

Private - All Rights Reserved
