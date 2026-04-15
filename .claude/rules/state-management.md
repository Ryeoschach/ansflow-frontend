---
paths:
  - "src/store/**/*.ts"
---

# 状态管理规则

## Zustand Store 组织

- 位置: `src/store/`
- 命名: `use<Xxx>Store.ts` (如 `useAppStore.ts`, `useDesignerStore.ts`)
- 每个 store 负责一个领域的状态

## Store 结构规范

```typescript
// 标准 Store 格式
interface XxxState {
  // 状态字段
  data: XxxData | null
  loading: boolean
}

interface XxxActions {
  // actions
  fetchData: () => Promise<void>
  updateData: (data: XxxData) => void
}

type XxxStore = XxxState & XxxActions

export const useXxxStore = create<XxxStore>((set, get) => ({
  // 初始状态
  data: null,
  loading: false,

  // actions 实现
  fetchData: async () => {
    set({ loading: true })
    try {
      const data = await fetchXxx()
      set({ data, loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))
```

## 持久化中间件

- 使用 `persist` 中间件时，自定义 localStorage key 前缀为 `ansflow-`
- 例: `persist(store, { name: 'ansflow-app-storage', ... })`

## TanStack Query 配合

- 复杂服务端数据使用 TanStack Query 管理
- Zustand store 用于 UI 状态（侧边栏折叠、主题、弹窗开关等）
- 两者职责分离: Query 管数据缓存，Store 管 UI 状态

## 不要做的事

- **不要**在 store 内处理 API 请求的全局错误（401/403），由 axios 拦截器处理
- **不要**使用 `useState` 管理全局 UI 状态，统一使用 Zustand
- **不要**在 store 内直接操作 DOM
