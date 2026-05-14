# AnsFlow 前端 - 项目指令

> 本文件为 AnsFlow 前端项目提供持久上下文，覆盖所有在此目录中工作的开发者。

---

## 项目概述

AnsFlow 是一个企业级 DevOps 平台，前端采用 React 18 + TypeScript + Vite 构建。集成了 **AI 智能助手**、**SRE 告警中心**与 **AIGC 意图编排**能力。

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 + TypeScript | 核心开发框架 |
| UI 库 | Ant Design 6 | 企业级 UI 组件库 |
| 样式 | Tailwind CSS v4 | 原子化样式 |
| 状态管理 | Zustand v5 (UI) | 全局与持久化状态 |
| 数据获取 | TanStack Query v5 | 服务端状态同步 |
| 流水线交互 | ReactFlow | DAG 画布交互 |
| AI 交互 | Fetch Stream | 流式响应处理 |
| 内容渲染 | ReactMarkdown | AI 诊断与代码渲染 |

### 目录结构

```
src/
├── api/          # API 请求模块 (增加 ai.ts, sre.ts)
├── components/   # 共享组件 (增加 AIChatbot, NodeTrace)
├── layouts/      # 布局组件
├── pages/        # 页面组件 (增加 sre/AlertCenter, ai/History)
├── store/        # Zustand 状态库 (useAppStore, useAIStore)
├── types/        # 增加 AI 与 SRE 相关类型定义
└── utils/        # 增加流式解析与 Markdown 配置
```

---

## 开发规范

### AI 交互规范

- **流式处理**: AI 聊天必须支持 `ReadableStream` 流式输出，并配合 `ai-typing` 动效。
- **状态反馈**: 全局 AI 入口需显示实时状态角标（分析中/完成/超时）。
- **知识闭环**: 重要的诊断结果底部必须集成“存入知识库”操作。
- **Markdown**: AI 返回的内容统一使用 `ReactMarkdown` 渲染，并开启代码高亮。

### SRE 运维规范

- **状态同步**: 告警自愈流水线必须显示实时进度条，状态由后端 Signal 驱动。
- **触发源标识**: 明确区分“自动触发”与“手动处理”，并提供对应的视觉反馈。

### 状态管理

- **持久化**: 关键 UI 偏好（如 AI 助手缩放、侧边栏状态）存储在 `localStorage`，前缀 `ansflow-`。
- **Query Key**: AI 历史记录建议使用 `['ai', 'history', category]` 作为键。

### 路径与路由

- AI 历史页: `/v1/ai/history`
- SRE 告警中心: `/v1/sre/alerts`
- 任务脉冲监控: `/v1/sre/pulse`
- 周期任务管理: `/v1/system/periodic-tasks`
- 流水线设计器: `/v1/pipelines/designer/:id`

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 执行生产环境构建 |
| `pnpm lint` | 代码质量检查 |

---

## 相关文档

- 详细开发准则: `@GEMINI.md`
- 项目 README: `@README.md`
- 依赖信息: `@package.json`
