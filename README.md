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
- SRE 诊断中心提供观测数据源配置、服务映射、日志/指标查询预览、模板化诊断、多源上下文展示和证据索引查看。

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

“诊断模板”页签支持查看、创建、编辑、复制和启停模板。模板编辑表单可配置目标类型、上下文采集开关、多个日志源、多个指标源、日志关键词、AI Prompt 模板和结构化报告要求。

诊断详情会结构化展示 CI/CD 上下文、日志源上下文、指标源上下文、AI 结构化报告、Markdown 结论、采集摘要、证据索引和原始上下文 JSON。采集摘要同时展示 AI Prompt 上下文的字符预算、压缩前后大小和分类裁剪统计。流水线失败节点可一键进入 SRE 模板诊断，也可跳转到预填诊断弹窗。

## License

Private - All Rights Reserved
