---
paths:
  - "src/pages/**/*.tsx"
  - "src/components/**/*.tsx"
---

# 组件开发规则

## 文件命名

- **页面组件**: PascalCase 放在 `src/pages/<Module>/` 下
- **共享组件**: PascalCase 放在 `src/components/<Category>/` 下
- **子组件**: 与父组件同文件夹，按功能拆分成单独文件

## 组件结构

```typescript
// 标准函数组件格式
import { useState, useCallback } from 'react'
import { Button, Card } from 'antd'
import type { XxxProps } from '@/types'

// 组件定义
const XxxComponent = ({ title, onSubmit }: XxxProps) => {
  // hooks
  const [loading, setLoading] = useState(false)

  // callbacks
  const handleSubmit = useCallback(async () => {
    setLoading(true)
    try {
      await onSubmit()
    } finally {
      setLoading(false)
    }
  }, [onSubmit])

  return (
    <Card title={title}>
      {/* JSX */}
    </Card>
  )
}

export default XxxComponent
```

## Ant Design 使用

- 从 `antd` 直接导入组件
- 全局配置在 `src/utils/antd.ts`
- 消息提示使用 `message` (轻量) 或 `notification` (重要通知)

## 样式规范

- 优先使用 Tailwind CSS 工具类
- 复杂样式使用 Ant Design 的 `style` prop 或 CSS-in-JS
- 避免内联复杂样式，抽取成工具类

## 懒加载

- 页面组件使用 `React.lazy()` + `Suspense`
- 加载状态使用 `src/components/Skeletons/` 下的骨架屏

## 错误边界

- 页面级别错误由 `AppErrorBoundary` 捕获
- 敏感操作使用 try-catch 局部错误处理
