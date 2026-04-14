import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LogState {
    // 是否开启日志自动探底滚动
    autoScroll: boolean;
    setAutoScroll: (val: boolean) => void;
    // 日志字体大小偏好 (11-14px)
    logFontSize: number;
    setLogFontSize: (size: number) => void;
}

/**
 * @name useLogStore
 * @description 流水线运行日志查看偏好存储，提升长日志阅读体验。
 */
const useLogStore = create<LogState>()(
    persist(
        (set) => ({
            autoScroll: true,
            setAutoScroll: (autoScroll) => set({ autoScroll }),
            logFontSize: 12,
            setLogFontSize: (logFontSize) => set({ logFontSize }),
        }),
        { name: 'ansflow-run-log-prefs' }
    )
);

export default useLogStore;
