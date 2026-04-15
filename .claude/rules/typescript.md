---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# TypeScript 规则

## 类型定义位置

- **共享类型**: `src/types/index.ts`
- **领域类型**: 在对应 API 模块旁或 `types/index.ts` 中定义
- **组件 props**: 在组件文件内定义或抽取到 `types/` 目录

## 常用类型模式

```typescript
// 分页响应
interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// API 查询参数
interface XxxQuery {
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

// DTO
interface CreateXxxDto {
  name: string
  description?: string
}

// 实体
interface Xxx {
  id: string
  name: string
  created_at: string
  updated_at: string
}
```

## 类型断言

- API 响应数据使用 `as any` 断言为具体类型（后端返回结构已知）
- 避免过多 `as unknown` 转换，优先明确类型

## 泛型使用

- 通用工具函数使用泛型提高复用性
- API 函数使用泛型指定响应数据类型

## 命名

- 接口使用 PascalCase，不加 `I` 前缀
- 类型别名使用 PascalCase
- 枚举使用 PascalCase，成员使用大写下划线风格
