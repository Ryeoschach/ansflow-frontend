# 性能优化规则

## 通用原则

- 不要过早优化，先保证功能正确
- 使用 React DevTools Profiler 定位性能瓶颈
- 优化前先测量，避免主观臆断

## React 优化

### 避免不必要渲染

- 列表渲染使用 `key` (避免 index 作为 key)
- 组件使用 `React.memo()` 包裹（当 props 频繁变化时）
- 回调函数使用 `useCallback`，依赖数组要准确
- 派生状态使用 `useMemo`

### 懒加载

- 路由页面组件使用 `React.lazy()` 懒加载
- 大型组件库按需引入 (如 icon 按需导入)

## 网络优化

- 使用 TanStack Query 的缓存机制避免重复请求
- 合理设置 `staleTime` 和 `gcTime`
- 列表请求使用分页，避免一次加载大量数据

## Bundle 优化

- 第三方库按需引入 (如 lodash 用 `lodash-es` + tree-shaking)
- 使用动态 import 分割代码
- Vite 生产构建使用 `build.minify: 'terser'`

## 图片与资源

- 使用 WebP 格式图片
- 大图片使用懒加载
- SVG 图标优先于图片图标
