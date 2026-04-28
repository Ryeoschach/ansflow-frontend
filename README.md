# AnsFlow 前端

企业级 DevOps 流水线平台前端，基于 React 18 + TypeScript + Vite 构建。

**当前版本**：v1.7.0  
**在线 Demo**：https://ansflow.cyfee.com:10443  
**默认账号**：admin / ansflow

---

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 + TypeScript | 核心框架 |
| 构建 | Vite 5 | 快速开发与生产构建 |
| UI 组件 | Ant Design 6 | 企业级 UI 组件库 |
| 样式 | Tailwind CSS v4 + @ant-design/cssinjs | 原子化 CSS + 组件库样式集成 |
| 状态管理 | Zustand v5 | 轻量级状态管理，支持 localStorage 持久化 |
| 数据请求 | Axios + TanStack Query v5 | HTTP 请求封装 + 服务端状态缓存 |
| 路由 | React Router v6 | SPA 路由，支持嵌套路由 |
| 流水线可视化 | ReactFlow | DAG 流程图编辑与展示 |
| WebSocket | react-use-websocket | 实时日志推送 |
| 图表 | ECharts + echarts-for-react | 数据可视化 |
| 国际化 | i18next + react-i18next | 中文 / English 双语支持 |
| 监控体系 | Celery Stats API | 分布式任务引擎健康状态追踪 |
| 包管理 | pnpm | 高性能包管理器 |

---

## 项目结构

```
src/
├── api/                          # API 请求封装（按模块划分）
│   ├── ...
│   ├── system.ts                 # 系统设置/备份/监控 API (新增 Celery Stats)
│   └── ...
├── components/                   # 公共组件
│   ├── ErrorBoundary/            # 全局异常边界组件 (健壮性增强)
│   └── ...
├── pages/                        # 页面级组件
│   ├── ...
│   ├── System/                   # 系统管理
│   │   ├── Monitor.tsx           # 系统监控面板 (全面重构：Worker/Beat/Queue)
│   │   ├── ConfigCenter/          # 配置中心 (全面国际化支持)
│   │   └── ...
│   └── ...
```

---

## 功能模块详解（新增与增强）

### 8.6 系统监控 (System Monitor) - v1.7.0 重大更新

**页面**：`/v1/system/monitor`

**功能**：

- **统一监控面板**：将数据库、Redis、K8s 等组件统一为表格化展示，提升信息密度。
- **Celery 分布式任务监控**：
  - **Worker 详情**：实时展示所有活动 Worker 的并发度、正在执行任务数、预留任务数及系统资源占用。
  - **Beat 调度器状态**：追踪任务调度器的在线状态及最后一次运行（Last Run）时间戳。
  - **队列积压监控**：实时查看各消息队列的堆积长度。
- **自动刷新**：支持每 30 秒自动同步集群健康数据。

---

### 8.7 配置中心 (Config Center) - 体验优化

**功能增强**：

- **全量国际化**：所有统计项（分类总数/配置项总数）、通知选项（notify_on）及变更原因（Reason）均已支持中英文切换。
- **稳定性增强**：针对 `notify_on` 等复杂配置项的解析逻辑进行了健壮性加固，防止非数组数据导致的渲染崩溃。

---

### 11. 系统健壮性 (Robustness)

- **异常边界拦截**：升级了 `AppErrorBoundary`，能够精确捕获并上报运行时 `TypeError` 或组件引用异常。
- **防御性编程**：在全项目范围内的 `.includes()` 及数组操作逻辑中增加了 `Array.isArray()` 的防御性检查，有效避免由于后端 API 数据结构不符导致的页面白屏。

---

## 权限控制详解

(此处保留原有 SmartRBAC 内容...)

---

## 开发指南

(此处保留原有 pnpm 开发指南...)

---

## License

Private - All Rights Reserved
