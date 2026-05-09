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
  // 主题配色 Key
  themeKey: 'forest' | 'deepsea' | 'teal' | 'nordic' | 'pastel';
  setThemeKey: (key: 'forest' | 'deepsea' | 'teal' | 'nordic' | 'pastel') => void;
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
  avatar: string | null;
  setAvatar: (avatar: string | null) => void;
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
  // AI 诊断触发
  aiDiagnosisConfig: { target_type: 'pipeline' | 'task'; target_id: number | string; target_name?: string; history_id?: number } | null;
  setAiDiagnosis: (config: { target_type: 'pipeline' | 'task'; target_id: number | string; target_name?: string; history_id?: number } | null) => void;
}

interface PersistedState {
  isDark: boolean;
  themeKey: string;
  collapsed: boolean;
  currentUser: string | null;
  permissions: string[];
  pipelineActiveTab: string;
  language: string;
  avatar: string | null;
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
    themeKey: 'forest',
    setThemeKey: (themeKey) => set({ themeKey }),
    language: 'zh-CN',
    setLanguage: (language) => set({ language }),
    pipelineActiveTab: 'templates',
    setPipelineActiveTab: (pipelineActiveTab) => set({ pipelineActiveTab }),
    token: null,
    setToken: (token) => set({ token }),
    currentUser: null,
    setCurrentUser: (currentUser) => set({ currentUser }),
    avatar: null,
    setAvatar: (avatar) => set({ avatar }),
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
    setMobileSidebarOpen: (val: boolean) => set({ mobileSidebarOpen: val }),
    toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
    aiDiagnosisConfig: null,
    setAiDiagnosis: (aiDiagnosisConfig) => set({ aiDiagnosisConfig }),
    }), {
    name: 'ansflow-app-storage',
    partialize: (state): PersistedState => ({
      isDark: state.isDark,
      themeKey: state.themeKey,
      collapsed: state.collapsed,
      currentUser: state.currentUser,
      permissions: state.permissions,
      pipelineActiveTab: state.pipelineActiveTab,
      language: state.language,
      avatar: state.avatar,
    }),
  })
);
export default useAppStore
