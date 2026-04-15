---
paths:
  - "src/api/**/*.ts"
---

# API 开发规则

## 请求模块组织

- 位置: `src/api/`
- 命名: kebab-case，按领域划分 (如 `pipeline.ts`, `k8s.ts`)
- 每个模块负责一个后端服务领域

## Axios 实例使用

- 使用 `src/utils/requests.ts` 中导出的 `request` 实例
- **不要**创建新的 axios 实例，统一使用全局配置

## 函数规范

```typescript
// 标准 API 函数格式
export const getXxxList = (params: XxxQuery) =>
  request.get<PaginatedResponse<Xxx>>('/xxx/', { params })

export const getXxxById = (id: string) =>
  request.get<Xxx>(`/xxx/${id}`)

export const createXxx = (data: CreateXxxDto) =>
  request.post<Xxx>('/xxx/', data)

export const updateXxx = (id: string, data: UpdateXxxDto) =>
  request.put<Xxx>(`/xxx/${id}`, data)

export const deleteXxx = (id: string) =>
  request.delete<void>(`/xxx/${id}`)
```

## 错误处理

- Axios 拦截器已处理全局错误（401 token 刷新、403 权限、通用错误提示）
- 模块内**不需要**重复处理这些全局逻辑
- 如有领域特定错误处理，在 API 模块内单独处理

## 类型定义

- 响应类型使用 `types/index.ts` 中定义的泛型类型
- 如 `PaginatedResponse<T>`, `K8sResource`, `Pipeline` 等
- DTO 类型在对应 API 模块旁定义或放在 `types/index.ts`
