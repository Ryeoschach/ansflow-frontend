# AnsFlow Frontend

企业级 DevOps 流水线平台前端，基于 React 18 + TypeScript + Vite 构建。

**当前版本：1.4.1**

demo: https://ansflow.cyfee.com:10443
admin/ansflow

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| UI 组件 | Ant Design 6 |
| 样式 | Tailwind CSS v4 |
| 状态管理 | Zustand |
| 数据请求 | Axios + TanStack Query |
| 路由 | React Router 6 |
| 流水线可视化 | ReactFlow |
| 包管理 | pnpm |
| 国际化 | react-i18next（中文/English）|
| 菜单多语言 | 支持 `title_en` 字段，管理员可配置菜单英文名 |

## 项目结构

```
src/
├── api/                    # API 请求封装（按模块划分）
│   ├── approval.ts         # 审批相关
│   ├── artifact.ts         # 产物管理
│   ├── auth.ts             # 认证
│   ├── credential.ts       # 凭据管理
│   ├── hosts.ts            # 主机管理
│   ├── k8s.ts              # Kubernetes
│   ├── pipeline.ts         # 流水线
│   ├── rbac.ts             # 权限管理
│   ├── registry.ts         # Docker 镜像仓库
│   ├── system.ts           # 系统设置
│   ├── tasks.ts            # Ansible 任务
│   └── user.ts             # 用户管理
├── components/             # 公共组件
│   ├── ErrorBoundary/       # 全局异常边界
│   ├── Header/              # 顶部导航
│   ├── Sidebar/            # 侧边菜单
│   └── Skeletons/          # 骨架屏
├── layouts/
│   └── MainLayout.tsx      # 主布局（侧边栏 + 顶部 + 内容区）
├── pages/                  # 页面级组件
│   ├── Dashboard/           # 平台概览
│   ├── TaskCenter/          # Ansible 任务中心
│   │   └── ExecutionHistory/ # 执行历史
│   ├── Pipeline/            # 流水线模块
│   │   ├── Designer.tsx     # DAG 可视化编排
│   │   ├── History.tsx      # 执行历史
│   │   ├── RunViewer.tsx    # 运行时查看器
│   │   ├── Schedule.tsx     # 定时调度
│   │   ├── CIEnvironments/  # CI 构建环境
│   │   ├── ImageRegistries/ # Docker 镜像仓库
│   │   ├── Artifacts/       # 产物管理
│   │   ├── Webhooks/        # Webhook 触发器
│   │   ├── VersionHistory/  # 版本历史
│   │   └── nodes/           # 自定义流水线节点
│   ├── K8sCenter/           # Kubernetes 管理
│   │   └── HelmCenter.tsx   # Helm 应用中心
│   ├── System/              # 系统管理
│   │   ├── ApprovalCenter.tsx   # 审批中心
│   │   ├── AuditLog.tsx         # 审计日志
│   │   ├── BackupManagement.tsx  # 系统备份与恢复
│   │   ├── ConfigCenter/         # 配置中心
│   │   │   └── index.tsx         # 配置分类/配置项管理
│   │   ├── CredentialVault.tsx  # 凭据保险库
│   │   ├── MenuManagement.tsx   # 菜单管理
│   │   ├── Monitor.tsx          # 系统监控
│   │   ├── PermissionManagement.tsx  # 权限管理
│   │   └── RoleManagement.tsx   # 角色管理
│   ├── Users/               # 用户管理
│   ├── Hosts/               # 主机管理
│   ├── Environments/        # 环境管理
│   ├── Platforms/           # 平台管理
│   ├── ResourcePool/        # 资源池
│   ├── Credentials/         # 凭据管理（旧）
│   └── Login/               # 登录页
├── store/                   # Zustand 状态
│   ├── useAppStore.ts       # 全局状态（认证/权限/主题）
│   ├── useCredentialStore.ts
│   ├── useDesignerStore.ts  # 流水线设计器状态
│   ├── useK8sStore.ts
│   └── useLogStore.ts       # 日志流状态
├── types/                   # TypeScript 类型定义
└── utils/                   # 工具函数
    ├── antd.ts              # Ant Design 全局配置
    └── requests.ts          # Axios 拦截器封装
```

## 功能模块

### 流水线（Pipeline）
- **DAG 可视化编排**：拖拽节点、连线、参数配置
- **节点类型**：Ansible、GIT、Build（Kaniko）、HTTP、K8s 部署
- **定时调度**：支持 Cron 表达式配置
- **执行历史**：查看每次运行详情、步骤日志、状态
- **失败重试**：支持从指定节点重试，前置节点自动跳过
- **版本历史**：每次保存自动快照，支持回滚到历史版本
- **CI 环境**：管理构建代理节点
- **镜像仓库**：Docker Registry 管理
- **产物管理**：记录构建产物（Docker 镜像、JAR 包等）及版本历史
- **Webhook 触发器**：支持 GitHub/GitLab 等外部系统通过 Webhook 触发流水线执行

### 任务中心（TaskCenter）
- Ansible Playbook 可视化执行
- 主机分组与批量执行
- 实时日志输出（WebSocket）
- 执行历史与状态追踪

### Kubernetes 管理
- 多集群管理
- Helm 应用一键部署/升级/回滚
- K8s 资源查看（Deployment/Service/Ingress 等）

### 系统管理
- **用户/角色/权限**：基于 SmartRBAC 的细粒度权限模型
- **审批中心**：发布审批工作流
- **审计日志**：操作轨迹追踪
- **系统监控**：集群与节点状态
- **凭据保险库**：敏感凭据安全存储

## 权限控制

AnsFlow 采用 **SmartRBAC**（Resource-Based RBAC）权限模型，精确到每一个按钮和 API 查询。

### 前端实现模式

```tsx
import useAppStore from '@/store/useAppStore';

// 获取 hasPermission 函数
const { token, hasPermission } = useAppStore();

// Query 层防护（未授权用户不发送请求）
const { data } = useQuery({
  queryKey: ['pipelines'],
  queryFn: getPipelines,
  enabled: !!token && hasPermission('pipeline:template:view'),
});

// 按钮层防护（无权限按钮直接隐藏）
{hasPermission('pipeline:template:delete') && (
  <Button danger onClick={handleDelete}>删除</Button>
)}
```

### 权限码参考

| 资源 | 动作 | 权限码 |
|------|------|--------|
| 流水线模板 | 查看/新建/编辑/删除/执行 | `pipeline:template:view/add/edit/delete/execute` |
| 流水线运行 | 查看/停止/重试 | `pipeline:run:view/stop/retry` |
| CI 环境 | CRUD | `pipeline:ci_env:view/add/edit/delete` |
| 镜像仓库 | CRUD | `registry:docker:view/add/edit/delete` |
| 审批工单 | 查看/审批 | `system:approval_ticket:view/approve` |
| 审批策略 | 查看/新增 | `system:approval_policy:view/add` |
| 审计日志 | 查看 | `rbac:audit:view` |
| 凭据 | CRUD | `system:credential:view/add/edit/delete` |
| 系统监控 | 查看 | `system:monitor:view` |

## 开发

### 环境要求

- Node.js 18+
- pnpm 10+

### 启动开发服务器

```bash
pnpm install
pnpm dev
# 访问 http://localhost:3000
```

### 生产构建

```bash
pnpm build
pnpm preview
```

### 接口代理

开发环境下 Vite 自动将 `/api/v1` 代理到 `http://127.0.0.1:8000`，WebSocket `/ws` 代理到 `ws://127.0.0.1:8000`。生产环境请通过 Nginx 等反向代理配置。

## 架构设计要点

### 缓存策略
- TanStack Query `staleTime: 5min`，`gcTime: 10min`
- 关键元数据（集群列表、用户信息、命名空间）持久化到 `localStorage`，TTL 24 小时
- `QueryPersistenceManager` 组件监听 Query Cache 变化，自动同步到本地存储

### 认证流程
1. 应用启动时通过 `/api/v1/auth/refresh/` 尝试自动续期
2. 成功获取 Token 后调用 `/api/v1/auth/me/` 获取用户信息和权限列表
3. 权限码存入 Zustand，`hasPermission()` 在前端做按钮级快速判断

### 主题支持
-亮色/暗色一键切换，通过 CSS 变量 + Ant Design `theme algorithm` 实现
- 偏好持久化到 `localStorage`

### 错误处理
- Axios 拦截器统一处理 401/403 重定向
- `AppErrorBoundary` 组件包裹全应用，捕获未处理异常
- 每个页面也有独立的 `ErrorBoundary`

## License

Private - All Rights Reserved
