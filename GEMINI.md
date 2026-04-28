# GEMINI.md - AnsFlow 前端开发准则

本文件规定了 Gemini CLI 在 AnsFlow 前端项目中的核心开发指令。这些准则具有最高优先级，优于默认设置。
对话使用中文

## 1. 项目概况
AnsFlow 是一个企业级 DevOps 平台前端。
- **框架：** React 18 + TypeScript + Vite 5
- **UI 库：** Ant Design 6 (antd)
- **状态管理：** Zustand v5 (全局/UI 状态) + TanStack Query v5 (服务端状态)
- **样式：** Tailwind CSS v4 + @ant-design/cssinjs
- **核心能力：** SmartRBAC 权限集成、流水线画布 (ReactFlow)、代码编辑 (CodeMirror)、多语言 (i18next)。

## 2. 核心开发规范

### 2.1 组件 (Components) 规范
- **文件命名：** 使用 PascalCase（如 `PipelineDesigner.tsx`）。
- **Hooks 命名：** 使用 camelCase（如 `useBreakpoint.ts`）。
- **组件类型：** 优先使用函数组件 (FC) 和 TS 类型定义 Props。
- **UI 统一：** 必须优先使用 Ant Design 6 组件。复杂布局使用 Tailwind CSS v4。
- **响应式：** 使用 `useBreakpoint` hook 或 Tailwind 响应式类处理移动端适配。

### 2.2 状态管理与数据获取
- **全局状态：** 存储在 `src/store/` 下，使用 Zustand 创建 store。
- **数据获取：** 严禁在 `useEffect` 中直接 fetch 数据。必须使用 `@tanstack/react-query` 的 `useQuery` 或 `useMutation`。
- **API 模块：** 接口定义在 `src/api/` 下，按领域划分子模块（如 `pipeline.ts`），返回 Promise。
- **错误处理：** 请求层统一在 `src/utils/requests.ts` 拦截处理，UI 层通过 React Query 的 `onError` 或 `message.error` 展示。

### 2.3 权限与路由
- **SmartRBAC 集成：** 使用 `src/store/useAppStore.ts` 中的 `hasPermission` 函数。
- **按钮级权限：** 在渲染操作按钮前，必须通过 `hasPermission('module:resource:action')` 校验。
- **路由定义：** 统一在 `App.tsx` 配置。路径遵循 `/v1/<module>/<page>` 规范。
- **懒加载：** 页面级组件必须使用 `React.lazy()` 配合 `Suspense` 加载。

### 2.4 国际化 (i18n)
- **文本提取：** 所有 UI 文本（Label, Placeholder, Notification）严禁硬编码。必须通过 `t('key')` 从 `locales` 中获取。
- **配置：** 语言定义文件位于 `src/locales/`，支持 `zh-CN` 和 `en-US`。

## 3. 工程化与安全

### 3.1 安全准则
- **敏感数据：** 严禁在代码或前端 Log 中打印密码、密钥或 Token。
- **Token 存储：** Token 必须由 `useAppStore` 管理，持久化在 `localStorage` 中且必须设置安全前缀 `ansflow-`。
- **XSS 防护：** 渲染原始 HTML 必须使用 `dangerouslySetInnerHTML` 并确保数据已通过后端清洗。

### 3.2 Git 工作流
- **分支命名：** 功能 `feat/<module>/<desc>`, 修复 `fix/<module>/<desc>`。
- **提交规范：** 使用 Conventional Commits（如 `feat(ui): ...`, `fix(pipeline): ...`）。
- **提交确认：** 始终先提出中文 commit message 草案，在用户确认后执行。

## 4. 执行流程
1. **研究 (Research)：** 查看 `src/api/` 对应的接口定义和 `src/types/` 下的类型声明。
2. **策略 (Strategy)：** 按照“API 模块 -> 状态/Store -> UI 组件 -> 路由/权限”的顺序规划变更。
3. **执行 (Execution)：** 使用 `replace` 进行代码修改，保持 AntD 6 的设计语言一致性。
4. **验证 (Validation)：** 运行 `pnpm lint` 检查代码质量，并在不同屏幕尺寸下验证响应式效果。
5. **构建 (Build)：** 运行 `pnpm build` 确保 TS 类型检查和 Vite 打包无误。

---
