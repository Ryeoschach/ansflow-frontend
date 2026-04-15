# AnsFlow 前端 - 项目指令

> 本文件为 AnsFlow 前端项目提供持久上下文，覆盖所有在此目录中工作的开发者。

---

## 项目概述

AnsFlow 是一个企业级 DevOps 平台，前端采用 React 18 + TypeScript + Vite 构建。

### 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 + pnpm |
| UI 库 | Ant Design 6 |
| 样式 | Tailwind CSS v4 + @ant-design/cssinjs |
| 状态管理 | Zustand v5 (UI) + TanStack Query v5 (服务端) |
| 路由 | React Router v6 |
| HTTP | Axios |

### 目录结构

```
src/
├── api/          # API 请求模块（按领域划分）
├── components/   # 共享组件
├── layouts/      # 布局组件
├── pages/        # 页面组件
├── store/        # Zustand 状态库
├── types/        # TypeScript 类型定义
└── utils/        # 工具函数
```

### 路径别名

- `@/` → `src/`

---

## 开发规范

### 组件开发

- **组件文件**: PascalCase (如 `PipelineDesigner.tsx`)
- **工具/hooks**: camelCase (如 `useBreakpoint.ts`)
- **API 模块**: kebab-case (如 `pipeline.ts`, `k8s.ts`)

### 状态管理

- **UI 状态**: 使用 Zustand store，存储在 `src/store/`
- **服务端状态**: 使用 TanStack Query，配置 `staleTime: 5min`
- **持久化**: Zustand 的 `persist` 中间件使用 localStorage，key 前缀为 `ansflow-`

### API 层

- Axios 实例位于 `src/utils/requests.ts`
- 基础 URL: `/api/v1`（开发环境代理到 `127.0.0.1:8000`）
- 请求拦截器自动添加 `Authorization: Bearer <token>`
- 响应拦截器处理 token 刷新（401）和权限错误（403）

### 权限模型

- SmartRBAC: 前端使用 `hasPermission()` 检查权限后再调用 API
- 权限码格式: `<module>:<resource>:<action>` (如 `pipeline:template:view`)
- 权限检查在 `src/store/useAppStore.ts` 中

### 路由

- 路由定义在 `App.tsx`，使用 `React.lazy()` 懒加载
- 路径格式: `/v1/<module>/<page>`
- 布局使用 `MainLayout`，子路由通过 `<Outlet />` 渲染

### 样式

- 使用 Tailwind CSS v4，配合 `@layer` 指令
- 暗色模式: `.dark` class 在 `<html>` 元素上 + Ant Design dark 算法
- 响应式: 移动端断点 < 768px，使用 `useBreakpoint` hook

### 错误处理

- 全局错误边界: `AppErrorBoundary` 包裹应用和各个页面模块
- 加载状态: 使用 `src/components/Skeletons/` 下的骨架屏组件

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm lint` | ESLint 检查 |

---

## 架构决策记录

- **Token 刷新**: 使用请求队列防止多个 401 同时触发刷新
- **查询缓存**: 关键元数据（集群、用户、命名空间）持久化到 localStorage，TTL 24h
- **路由懒加载**: 页面组件按需加载，减少首屏时间

---

## 相关文档

- 详细规范见 `.claude/rules/` 目录
- 项目 README: `@README.md`
- 依赖信息: `@package.json`
