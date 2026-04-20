import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // 侧边栏是否收缩
  collapsed: boolean;
  // 切换侧边栏状态
  setCollapsed: (collapsed: boolean) => void;
  // 切换侧边栏开关
  toggleCollapsed: () => void;
  // 切换主题
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
  // 语言
  language: string;
  setLanguage: (lang: string) => void;
  // UI 偏好
  pipelineActiveTab: string;
  setPipelineActiveTab: (tab: string) => void;
  // token
  token: string | null;
  setToken: (token: string | null) => void;
  currentUser: string | null;
  setCurrentUser: (currentUser: string | null) => void;
  permissions: string[];
  setPermissions: (permissions: string[]) => void;
  // 检查是否有权限
  hasPermission: (permission: string) => boolean;
  isInitializing: boolean;
  setIsInitializing: (val: boolean) => void;
  // 移动端侧边栏抽屉是否打开
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (val: boolean) => void;
  toggleMobileSidebar: () => void;
}

interface PersistedState {
  isDark: boolean;
  collapsed: boolean;
  currentUser: string | null;
  permissions: string[];
  pipelineActiveTab: string;
  language: string;
}

/**
 * 全局应用状态管理
 */
const useAppStore = create<AppState>()(
  persist((set, get) => ({
    collapsed: true,
    setCollapsed: (collapsed) => set({ collapsed }),
    toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
    isDark: false,
    setIsDark: (isDark) => set({ isDark }),
    language: 'zh-CN',
    setLanguage: (language) => set({ language }),
    pipelineActiveTab: 'templates',
    setPipelineActiveTab: (pipelineActiveTab) => set({ pipelineActiveTab }),
    token: null,
    setToken: (token) => set({ token }),
    currentUser: null,
    setCurrentUser: (currentUser) => set({ currentUser }),
    permissions: [],
    setPermissions: (permissions) => set({ permissions }),
    hasPermission: (permission) => {
      const state = get();
      if (state.permissions.includes('*')) return true;
      return state.permissions.includes(permission);
    },
    isInitializing: true,
    setIsInitializing: (val) => set({ isInitializing: val }),
    mobileSidebarOpen: false,
    setMobileSidebarOpen: (val) => set({ mobileSidebarOpen: val }),
    toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  }), {
    name: 'ansflow-app-storage',
    partialize: (state): PersistedState => ({
      isDark: state.isDark,
      collapsed: state.collapsed,
      currentUser: state.currentUser,
      permissions: state.permissions,
      pipelineActiveTab: state.pipelineActiveTab,
      language: state.language,
    }),
  })
);
export default useAppStore
