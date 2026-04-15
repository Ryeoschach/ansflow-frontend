import { useState, useEffect } from 'react';

/**
 * 响应式断点 hook
 * 返回 isMobile (屏幕宽度 < 768px)
 * 直接监听 window.innerWidth，不依赖 matchMedia
 */
export function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handler = () => {
      setIsMobile(window.innerWidth < 767);
    };

    window.addEventListener('resize', handler, { passive: true });
    // 初始化时也执行一次
    handler();

    return () => window.removeEventListener('resize', handler);
  }, []);

  return { isMobile, isDesktop: !isMobile };
}

export default useBreakpoint;
