# AnsFlow 前端

企业级 DevOps 流水线平台前端，基于 React 18 + TypeScript + Vite 构建。

**当前版本**：v1.6.0  
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
| 包管理 | pnpm | 高性能包管理器 |

---

## 项目结构

```
src/
├── api/                          # API 请求封装（按模块划分）
│   ├── approval.ts               # 审批相关 API
│   ├── artifact.ts               # 产物管理 API
│   ├── auth.ts                   # 认证（登录/刷新/登出）
│   ├── credential.ts              # 凭据管理 API
│   ├── hosts.ts                  # 主机/环境/平台/资源池 API
│   ├── k8s.ts                    # Kubernetes 集群管理 API
│   ├── pipeline.ts                # 流水线模板/执行/版本 API
│   ├── rbac.ts                   # 用户/角色/权限 API
│   ├── registry.ts               # Docker 镜像仓库 API
│   ├── artifactory.ts           # Artifactory 制品库 API
│   ├── system.ts                 # 系统设置/备份/监控 API
│   ├── tasks.ts                  # Ansible 任务 API
│   └── user.ts                   # 用户管理 API
├── components/                   # 公共组件
│   ├── ErrorBoundary/            # 全局异常边界组件
│   ├── Header/                    # 顶部导航栏
│   ├── Sidebar/                   # 侧边菜单栏
│   └── Skeletons/                 # 骨架屏加载状态
├── hooks/                        # 自定义 Hooks
│   ├── useBreakpoint.ts          # 响应式断点检测
│   └── useWebSocketLogs.ts       # WebSocket 日志订阅
├── i18n/                         # 国际化配置
│   ├── index.ts                  # i18next 初始化
│   └── locales/
│       ├── zh-CN.json            # 中文翻译
│       └── en-US.json           # 英文翻译
├── layouts/
│   └── MainLayout.tsx            # 主布局（侧边栏 + 顶部导航 + 内容区）
├── pages/                        # 页面级组件（按菜单模块组织）
│   ├── Dashboard/                 # 平台概览仪表盘
│   ├── TaskCenter/               # Ansible 任务中心
│   │   ├── index.tsx             # 任务列表
│   │   ├── Create.tsx            # 新建任务
│   │   └── ExecutionHistory/      # 执行历史详情
│   ├── Pipeline/                  # 流水线管理（核心模块）
│   │   ├── index.tsx             # 流水线列表
│   │   ├── Designer.tsx          # DAG 可视化编排器
│   │   ├── RunViewer.tsx         # 流水线运行查看器（实时日志）
│   │   ├── History.tsx           # 执行历史列表
│   │   ├── Schedule.tsx          # 定时调度配置
│   │   ├── CIEnvironments/        # CI 构建环境管理
│   │   │   └── index.tsx
│   │   ├── ImageRegistries/       # Docker 镜像仓库配置
│   │   │   └── index.tsx
│   │   ├── Artifacts/             # 产物管理
│   │   │   └── index.tsx
│   │   ├── Webhooks/              # Webhook 触发器配置
│   │   │   └── index.tsx
│   │   ├── VersionHistory/        # 版本历史与回滚
│   │   │   └── index.tsx
│   │   └── nodes/                 # 自定义流水线节点组件
│   │       ├── BaseNode.tsx      # 节点基础样式（含 skipped 状态）
│   │       ├── GitCloneNode.tsx   # Git 克隆节点
│   │       ├── DockerBuildNode.tsx # Docker 构建节点
│   │       ├── KanikoBuildNode.tsx # Kaniko 构建节点
│   │       ├── AnsibleNode.tsx    # Ansible 任务节点
│   │       └── HttpNode.tsx       # HTTP 回调节点
│   ├── K8sCenter/                # Kubernetes 多集群管理
│   │   ├── ClusterList.tsx       # 集群列表与接入
│   │   └── HelmCenter.tsx        # Helm 应用中心（部署/升级/回滚）
│   ├── System/                   # 系统管理与设置
│   │   ├── index.tsx             # 系统设置首页
│   │   ├── ApprovalCenter.tsx    # 审批中心（策略/工单）
│   │   ├── AuditLog.tsx          # 审计日志查看
│   │   ├── BackupManagement.tsx  # 系统备份与恢复
│   │   ├── ConfigCenter/          # 配置中心
│   │   │   ├── index.tsx         # 配置分类与项管理
│   │   │   └── ChangeLogs.tsx    # 配置变更历史
│   │   ├── CredentialVault.tsx   # 凭据保险库
│   │   ├── MenuManagement.tsx    # 菜单管理（支持多语言）
│   │   ├── Monitor.tsx           # 系统监控面板
│   │   ├── PermissionManagement.tsx # 权限码管理
│   │   └── RoleManagement.tsx   # 角色管理与权限分配
│   ├── Users/                    # 用户管理
│   │   └── index.tsx
│   ├── Hosts/                    # 主机管理
│   │   └── index.tsx
│   ├── Environments/             # 环境管理
│   │   └── index.tsx
│   ├── Platforms/               # 平台管理
│   │   └── index.tsx
│   ├── ResourcePool/            # 资源池管理
│   │   └── index.tsx
│   ├── Credentials/             # 凭据管理（旧版入口）
│   │   └── index.tsx
│   └── Login/                   # 登录页
│       └── index.tsx
├── store/                       # Zustand 状态管理
│   ├── useAppStore.ts           # 全局状态（认证 Token / 用户信息 / 权限 / 主题）
│   ├── useCredentialStore.ts    # 凭据状态
│   ├── useDesignerStore.ts      # 流水线设计器状态（DAG 数据）
│   ├── useK8sStore.ts           # K8s 集群状态
│   └── useLogStore.ts           # 日志流状态
├── types/                      # TypeScript 类型定义
│   ├── api.d.ts                 # API 响应类型
│   ├── pipeline.d.ts            # 流水线相关类型
│   └── ...
└── utils/                      # 工具函数
    ├── requests.ts              # Axios 实例（拦截器/错误处理）
    ├── antd.ts                  # Ant Design 全局配置（主题/语言）
    ├── storage.ts               # localStorage 封装
    └── format.ts                # 日期/数字格式化
```

---

## 功能模块详解

---

### 1. 登录与认证（Login / Auth）

**页面**：`/login`

**功能**：

- 用户名 + 密码登录
- GitHub OAuth 授权登录
- 微信网页应用扫码登录
- LDAP 账号密码登录（企业目录）
- 错误提示（用户名不存在 / 密码错误 / 账号被禁用）
- 登录后自动跳转首页

**认证流程**：

```
1. POST /api/v1/auth/login/ { username, password }
   → 后端返回 Access Token + Refresh Token（写入 HttpOnly Cookie）

2. GitHub/微信登录：
   - 前端跳转到后端 OAuth 回调
   - 后端验证后重定向回前端，携带 access_token
   - 后端同时将 refresh_token 写入 HttpOnly Cookie

3. 应用启动时，尝试 POST /api/v1/auth/refresh/ 自动续期

4. 成功后调用 GET /api/v1/account/me/ 获取用户信息 + 权限列表

5. 权限码存入 Zustand store，前端通过 hasPermission() 做按钮级快速判断
```

**前端存储**：

| 存储位置 | 内容 | 过期时间 |
|---------|------|---------|
| HttpOnly Cookie | Access Token | 60 分钟 |
| HttpOnly Cookie | Refresh Token | 7 天 |
| localStorage | 用户信息 + 权限列表 + 主题偏好 | 24 小时 |

---

### 2. 平台概览（Dashboard）

**页面**：`/v1/dashboard`

**功能**：

- 流水线统计（总数 / 执行次数 / 成功率）
- 最近执行记录列表
- 快捷入口（新建流水线 / 快速执行）
- 系统健康状态卡片

---

### 3. 流水线管理（Pipeline）- 核心模块

#### 3.1 流水线列表

**页面**：`/v1/pipeline`

**功能**：

- 流水线模板列表（支持搜索/筛选）
- 新建 / 编辑 / 删除 / 克隆流水线
- 立即执行流水线
- 查看执行历史

**权限码**：`pipeline:template:view/add/edit/delete/execute`

#### 3.2 DAG 可视化编排器

**页面**：`/v1/pipeline/designer/:id`

**功能**：

- **拖拽添加节点**：从左侧节点面板拖拽到画布
- **节点连线**：拖拽节点边缘连接线到目标节点
- **节点配置**：点击节点打开右侧配置面板
- **参数配置**：支持变量插值 `${variable}` 语法
- **版本保存**：每次保存自动创建版本快照

**支持节点类型**：

| 节点类型 | 说明 | 配置项 |
|---------|------|--------|
| `input` | 流水线触发入口 | 触发方式（手动/Webhook/定时） |
| `git_clone` | 代码拉取 | 仓库 URL / Git 分支 |
| `docker_build` | Docker 沙箱编译 | CI 环境 / 构建脚本 |
| `kaniko_build` | Kaniko 镜像构建 | 镜像仓库 / 镜像名 / Dockerfile 路径 |
| `ansible` | Ansible 任务 | 任务模板 / 主机分组 |
| `k8s_deploy` | K8s 部署 | 集群 / 命名空间 / Helm Chart |
| `http_webhook` | HTTP 回调 | 请求方法 / URL / 请求头 / Body |

**节点状态样式**：

| 状态 | 颜色 | 图标 |
|------|------|------|
| pending | 蓝色 | ClockCircleOutlined |
| running | 蓝色（加载动画） | LoadingOutlined |
| success | 绿色 | CheckCircleOutlined |
| failed | 红色 | CloseCircleOutlined |
| skipped | 灰色 | MinusCircleOutlined（删除线效果） |

#### 3.3 流水线运行查看器

**页面**：`/v1/pipeline/runs/:runId`

**功能**：

- **DAG 实时状态**：节点颜色/图标随执行状态变化
- **日志面板**：WebSocket 实时推送节点执行日志，支持 ANSI 彩色解析
- **节点详情抽屉**：点击节点查看详细配置和执行结果
- **失败重试**：
  - Header 区域显示「重试执行」下拉按钮（仅失败时显示）
  - 下拉菜单包含「从头重试」+ 可选起点节点列表
  - 选择起点节点后，前置节点自动标记为 `skipped`
- **停止流水线**：强制终止正在执行的流水线

**重试机制**：

```typescript
// API 层
export const retryPipelineRun = (runId: number, startNodeId: string) =>
  request.post(`/pipeline_runs/${runId}/retry/`, { start_node_id: startNodeId });

// 可选起点节点计算（BFS 反向遍历）
const getViableStartNodes = (nodes, edges, lastRunNodes) => {
  // 1. 找到所有失败节点
  // 2. 通过反向遍历找到所有可达前置节点
  // 3. 过滤出所有直接上游都已 success/skipped 的节点
};
```

#### 3.4 执行历史

**页面**：`/v1/pipeline/history`

**功能**：

- 按流水线筛选执行记录
- 查看每次运行的详细状态/耗时/触发人
- 支持重新执行（克隆参数）或重试

#### 3.5 定时调度

**页面**：`/v1/pipeline/schedule`

**功能**：

- 为流水线配置 Cron 表达式定时触发
- 启停定时任务
- 查看下次触发时间

#### 3.6 CI 环境管理

**页面**：`/v1/pipeline/ci-environments`

**功能**：

- 管理 Docker 构建环境镜像（如 `maven:3-eclipse-temurin-17`）
- 支持多类型（Java / Node.js / Python 等）

#### 3.8 Docker 镜像仓库

**页面**：`/v1/pipeline/artifacts`（Tab: Docker镜像）

**功能**：

- 管理 Docker Registry（Docker Hub / 私有 Harbor）
- 配置认证信息
- 支持创建/编辑/删除镜像仓库

#### 3.9 Artifactory 制品库

**页面**：`/v1/pipeline/artifacts`（Tab: 制品库）

**功能**：

- 管理 JFrog Artifactory 实例（测试连接）
- 管理 Artifactory 仓库（支持 Maven/npm/Helm/Docker/PyPI/Go 等类型）
- 实例与仓库两层管理

#### 3.10 产物记录

**页面**：`/v1/pipeline/artifacts`（Tab: 产物记录）

**功能**：

- 统一追踪来自 Docker 镜像仓库和 Artifactory 的构建产物
- 支持 Docker 镜像、JAR 包、Helm Chart、二进制文件等类型
- 产物版本历史追溯
- Kaniko 构建成功后自动创建产物记录
- 支持手动刷新

#### 3.11 Webhook 触发器

**页面**：`/v1/pipeline/webhooks`

**功能**：

- 创建 Webhook 触发器（自动生成密钥）
- 配置触发的流水线 / 事件类型 / 分支过滤
- 查看触发地址和签名密钥
- 支持 GitHub 和自定义 Webhook

**使用步骤**：

```
1. 创建 Webhook，获得触发地址 + 密钥
2. 在 GitHub/GitLab 仓库设置 Webhook，填入地址和密钥
3. GitHub 自动使用 X-Hub-Signature-256 签名推送事件
4. AnsFlow 验证签名后触发对应流水线
```

#### 3.12 版本历史

**页面**：`/v1/pipeline/versions/:id`

**功能**：

- 查看流水线所有历史版本（按时间倒序）
- 预览版本详情（graph_data 快照）
- 一键回滚到任意历史版本

---

### 4. 任务中心（Task Center）

**页面**：`/v1/tasks`

**功能**：

- **Ansible 任务管理**：新建 / 编辑 / 删除 Playbook 任务
- **执行任务**：选择主机分组，传入变量，执行 Playbook
- **实时日志**：WebSocket 推送执行日志到前端
- **执行历史**：完整的执行记录（状态 / 耗时 / 摘要）

**任务类型**：

| 类型 | 说明 |
|------|------|
| `cmd` | 即席命令（直接在目标主机执行 shell 命令） |
| `playbook` | Playbook 剧本（上传 YAML 文件或引用已有模板） |

---

### 5. Kubernetes 多集群管理

**页面**：`/v1/k8s`

#### 5.1 集群列表

**功能**：

- 接入多个 K8s 集群（上传 KubeConfig）
- 查看集群基本信息（版本 / 节点数 / Pod 数）
- 健康检查（实时检测连接状态，5 秒超时不阻塞 UI）

#### 5.2 Helm 应用中心

**页面**：`/v1/k8s/helm`

**功能**：

- 一键部署 Helm Chart（选择集群 / 命名空间 / Chart）
- 升级已有 Release（指定新版本或 values）
- 回滚到历史版本
- 查看 Release 状态 / 资源列表

---

### 6. 镜像仓库管理

**页面**：`/v1/registries`

**功能**：

- 管理 Docker Registry（Docker Hub / 阿里云 / 私有仓库）
- 配置仓库认证（用户名 + 密码）
- 查看仓库下的镜像列表

---

### 7. 审批中心

**页面**：`/v1/system/approvals`

**功能**：

- **审批策略**：配置多级审批规则、条件分支、审批人
- **审批工单**：查看 / 审批 / 拒绝 / 强制签发
- **载荷快照**：自动记录触发审批的完整请求体
- **通知推送**：飞书 / 钉钉 Webhook 通知

**审批状态**：`pending` → `approved` / `rejected` / `overridden`

---

### 8. 系统管理

#### 8.1 用户管理

**页面**：`/v1/users`

**功能**：

- 用户 CRUD
- 设置用户角色
- 启用/禁用账号

**权限码**：`rbac:user:view/add/edit/delete`

#### 8.2 角色管理

**页面**：`/v1/system/roles`

**功能**：

- 角色 CRUD
- 分配权限（勾选权限码）
- 设置数据范围策略

**权限码**：`rbac:role:view/add/edit/delete`

#### 8.3 权限管理

**页面**：`/v1/system/permissions`

**功能**：

- 查看所有权限码
- 按模块筛选权限

#### 8.4 菜单管理

**页面**：`/v1/system/menus`

**功能**：

- 可视化菜单树配置
- 支持 `title_en` 字段配置英文菜单名
- 拖拽调整菜单顺序

#### 8.5 审计日志

**页面**：`/v1/system/audit-logs`

**功能**：

- 查看所有操作日志（用户 / 时间 / IP / 操作内容）
- 支持按用户 / 操作类型 / 时间范围筛选
- 查看变更前后数据快照

**权限码**：`rbac:audit:view`

#### 8.6 系统监控

**页面**：`/v1/system/monitor`

**功能**：

- 系统健康状态（Celery / Redis / Database / K8s 集群）
- 各检查项独立超时，不阻塞页面

**权限码**：`system:monitor:view`

#### 8.7 配置中心

**页面**：`/v1/system/config`

**功能**：

- **分类管理**：Redis / 数据库 / 消息队列 / 日志 / 通知 等
- **配置项 CRUD**：支持 string/int/float/bool/json 类型
- **敏感值加密**：敏感配置自动加密显示
- **热更新**：修改后自动生效，无需重启
- **变更历史**：查看每次变更（人 / 时间 / 值）

**配置分类**：

| 分类 | 说明 |
|------|------|
| `redis` | Redis 连接配置 |
| `database` | 数据库连接配置 |
| `mq` | 消息队列配置 |
| `logging` | 日志级别配置 |
| `notification` | 飞书/钉钉通知配置 |
| `cache` | 缓存策略配置 |

#### 8.8 凭据保险库

**页面**：`/v1/system/credentials`

**功能**：

- 加密存储敏感凭据（API Key / 密码 / Token / 证书）
- 按类型（api_key/password/token/certificate）分类
- 关联环境（开发/测试/生产）

**权限码**：`system:credential:view/add/edit/delete`

#### 8.9 系统备份与恢复

**页面**：`/v1/system/backup`

**功能**：

- **手动备份**：一键生成系统数据备份（gzip 压缩 JSON）
- **下载备份**：下载备份文件到本地
- **恢复数据**：上传备份文件还原系统数据
- **备份记录**：查看历史备份（时间 / 大小 / 包含内容）

---

### 9. 主机管理

**页面**：`/v1/hosts`

**功能**：

- **主机管理**：添加 / 编辑 / 删除主机（IP / SSH 端口 / 操作系统）
- **环境管理**：按环境分组（开发 / 测试 / 预发布 / 生产）
- **平台管理**：管理主机平台类型（通过 SSH Key 或密码认证）
- **资源池**：主机分组，用于 Ansible 任务执行目标选择
- **SSH 凭据**：加密存储 SSH 私钥 / 密码

---

### 10. 国际化（i18n）

**支持语言**：中文（默认）/ English

**配置位置**：`src/i18n/locales/`

**翻译 key 示例**：

| key | 中文 | English |
|-----|------|---------|
| `menu.pipeline` | 流水线 | Pipeline |
| `pipeline.execute` | 执行 | Execute |
| `runViewer.skipped` | 已跳过 | Skipped |
| `runViewer.retryFromNode` | 从 {node} 开始重试 | Retry from {node} |

**菜单多语言**：管理员可在菜单管理中配置 `title_en` 字段，前端根据语言设置动态切换。

---

## 权限控制详解

### SmartRBAC 权限模型

AnsFlow 采用 **Resource-Based RBAC**，精确到每个按钮和 API 接口。

### 前端实现模式

```tsx
import useAppStore from '@/store/useAppStore';

const { token, hasPermission } = useAppStore();

// Query 层：未授权用户不发送请求
const { data } = useQuery({
  queryKey: ['pipelines'],
  queryFn: getPipelines,
  enabled: !!token && hasPermission('pipeline:template:view'),
});

// 按钮层：无权限按钮直接隐藏
{hasPermission('pipeline:template:delete') && (
  <Button danger onClick={handleDelete}>删除</Button>
)}
```

### 权限码参考

| 模块 | 资源 | 动作 | 权限码 |
|------|------|------|--------|
| 流水线 | 流水线模板 | 查看/新建/编辑/删除/执行 | `pipeline:template:view/add/edit/delete/execute` |
| 流水线 | 流水线运行 | 查看/停止/重试 | `pipeline:run:view/stop/retry` |
| 流水线 | 流水线版本 | 查看/回滚 | `pipeline:version:view/rollback` |
| 流水线 | Webhook | CRUD/触发 | `pipeline:webhook:view/add/edit/delete/trigger` |
| 流水线 | CI 环境 | CRUD | `pipeline:ci_env:view/add/edit/delete` |
| 任务中心 | Ansible 任务 | CRUD | `task:ansible_task:view/add/edit/delete` |
| K8s | K8s 集群 | CRUD | `k8s:cluster:view/add/edit/delete` |
| K8s | Helm 应用 | 部署/升级/回滚 | `k8s:helm:deploy/upgrade/rollback` |
| 镜像仓库 | 镜像仓库 | CRUD | `registry:docker:view/add/edit/delete` |
| 审批 | 审批策略 | CRUD | `system:approval_policy:view/add/edit/delete` |
| 审批 | 审批工单 | 查看/审批/强制签发 | `system:approval_ticket:view/approve` |
| 系统 | 审计日志 | 查看 | `rbac:audit:view` |
| 系统 | 凭据 | CRUD | `system:credential:view/add/edit/delete` |
| 系统 | 系统监控 | 查看 | `system:monitor:view` |
| 系统 | 菜单管理 | 查看/编辑 | `system:menu:view/edit` |
| 配置 | 配置项 | 查看/编辑 | `config:config_item:view/edit` |
| RBAC | 用户 | CRUD | `rbac:user:view/add/edit/delete` |
| RBAC | 角色 | CRUD | `rbac:role:view/add/edit/delete` |
| 主机 | 主机 | CRUD | `host:host:view/add/edit/delete` |
| 主机 | 环境 | CRUD | `host:env:view/add/edit/delete` |
| 主机 | 资源池 | CRUD | `host:resource_pool:view/add/edit/delete` |
| 主机 | SSH 凭据 | CRUD | `host:ssh_credential:view/add/edit/delete` |

---

## 开发指南

### 环境要求

- Node.js 18+
- pnpm 10+

### 启动开发服务器

```bash
# 安装依赖
pnpm install

# 启动开发服务器（Vite 代理 /api 和 /ws 到后端）
pnpm dev
# 访问 http://localhost:3000
```

### 生产构建

```bash
pnpm build    # TypeScript 编译 + Vite 打包
pnpm preview  # 本地预览生产构建
```

### 接口代理

**开发环境**（`vite.config.ts`）：

- `/api/v1/*` → `http://127.0.0.1:8000/api/v1/*`
- `/ws/*` → `ws://127.0.0.1:8000/ws/*`

**生产环境**：通过 Nginx 反向代理配置。

---

## 架构设计要点

### 缓存策略

- TanStack Query：`staleTime: 5min`，`gcTime: 10min`
- 关键元数据（集群列表 / 用户信息 / 命名空间）持久化到 `localStorage`，TTL 24 小时
- `QueryPersistenceManager` 组件监听 Query Cache 变化，自动同步到本地存储

### 认证流程

```
1. 应用启动 → POST /api/v1/auth/refresh/ 尝试自动续期
2. 成功 → GET /api/v1/auth/me/ 获取用户信息和权限列表
3. 权限码存入 Zustand store
4. hasPermission() 在前端做按钮级快速判断（UX 层面）
5. 后端 SmartRBACPermission 强制校验（安全层面）
```

### 主题支持

- **亮色 / 暗色**一键切换
- 实现方式：CSS 变量 + Ant Design `theme algorithm`
- 偏好持久化到 `localStorage`

### 错误处理

- **Axios 拦截器**：统一处理 401 重定向 / 403 权限错误
- **AppErrorBoundary**：全局未处理异常捕获
- **页面级 ErrorBoundary**：每个页面独立异常隔离

### WebSocket 日志订阅

```typescript
const { sendMessage, lastMessage } = useWebSocket(
  `ws://localhost:8000/ws/pipeline/${runId}/logs`
);

useEffect(() => {
  if (lastMessage) {
    const data = JSON.parse(lastMessage.data);
    if (data.type === 'log') {
      appendLog(data.content);
    } else if (data.type === 'status') {
      updatePipelineStatus(data);
    }
  }
}, [lastMessage]);
```

---

## 常见问题

### Q: 前端请求报 401 或 403？

**A**: 可能是 Token 过期或无权限。检查：
1. 登录是否有效（重新登录）
2. 是否有对应权限（联系管理员分配角色）

### Q: 流水线节点状态一直是 running 但没有日志？

**A**: 可能是 Celery Worker 未启动或节点任务卡住。检查：
1. Celery Worker 是否运行：`ps aux | grep celery`
2. Worker 日志是否有错误

### Q: WebSocket 日志不推送？

**A**: 检查：
1. Django Channels 是否正常（检查 ASGI 配置）
2. 浏览器控制台是否有 WebSocket 连接错误

---

## License

Private - All Rights Reserved
