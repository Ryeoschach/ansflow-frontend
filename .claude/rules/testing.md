# 测试规则

## 测试策略

- **单元测试**: 工具函数、复杂业务逻辑
- **组件测试**: 关键 UI 组件交互
- **集成测试**: API 模块与后端交互（Mock）

## 测试框架

- Vitest (与 Vite 配套)
- Testing Library (组件测试)
- MSW (API Mock)

## 测试文件组织

```
src/
├── utils/
│   ├── format.test.ts      # 工具函数测试
│   └── format.ts
├── components/
│   ├── Button/
│   │   ├── Button.test.tsx
│   │   └── Button.tsx
```

## 编写规范

- 测试文件与源代码同目录，以 `.test.ts` / `.test.tsx` 结尾
- 测试描述清晰: `describe('XxxComponent', () => { it('should do Y when Z', ...) })`
- 避免测试实现细节，关注输入输出
- Mock 外部依赖（API 调用、WebSocket 等）

## 覆盖率

- 目标: 核心业务逻辑 80%+
- 工具函数: 100%
- UI 组件: 快照测试或关键交互测试
