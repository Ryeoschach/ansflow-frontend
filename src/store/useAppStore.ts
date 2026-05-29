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
  themeKey: 'forest' | 'deepsea' | 'teal' | 'nordic' | 'pastel' | 'cyberpunk' | 'custom';
  setThemeKey: (key: 'forest' | 'deepsea' | 'teal' | 'nordic' | 'pastel' | 'cyberpunk' | 'custom') => void;
  
  // 语义化设计变量 (Design Tokens)
  designTokens: {
    colors: {
      primary: string;
      bgLayout: string;
      bgContainer: string;
      textPrimary: string;
      textSecondary: string;
      border: string;
      statusSuccess: string;
      statusWarning: string;
      statusError: string;
      // Dark Mode Tokens
      darkPrimary: string;
      darkBgLayout: string;
      darkBgContainer: string;
      darkTextPrimary: string;
      darkTextSecondary: string;
      darkBorder: string;
      darkStatusSuccess: string;
      darkStatusWarning: string;
      darkStatusError: string;
    };
    spacing: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
    };
    borderRadius: {
      sm: number;
      md: number;
      lg: number;
    };
  };
  setDesignTokens: (tokens: Partial<AppState['designTokens']>) => void;

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
  aiDiagnosisConfig: { target_type: 'pipeline' | 'task' | 'alert'; target_id: number | string; target_name?: string; history_id?: number } | null;
  setAiDiagnosis: (config: { target_type: 'pipeline' | 'task' | 'alert'; target_id: number | string; target_name?: string; history_id?: number } | null) => void;

  // 项目/工作区物理隔离
  projects: any[];
  setProjects: (projects: any[]) => void;
  currentProject: any | null;
  setCurrentProject: (project: any | null) => void;
}

interface PersistedState {
  isDark: boolean;
  themeKey: string;
  designTokens: AppState['designTokens'];
  collapsed: boolean;
  currentUser: string | null;
  permissions: string[];
  pipelineActiveTab: string;
  language: string;
  avatar: string | null;
  currentProject: any | null;
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
    
    designTokens: {
      colors: {
        primary: '#606C38',
        bgLayout: '#FDFCF0',
        bgContainer: '#FFFFFF',
        textPrimary: '#283618',
        textSecondary: 'rgba(40,54,24,0.65)',
        border: 'rgba(0,0,0,0.06)',
        statusSuccess: '#52c41a',
        statusWarning: '#faad14',
        statusError: '#ff4d4f',
        darkPrimary: '#ADC178',
        darkBgLayout: '#0E140A',
        darkBgContainer: '#1D2619',
        darkTextPrimary: '#F0F5E1',
        darkTextSecondary: 'rgba(240,245,225,0.45)',
        darkBorder: 'rgba(255,255,255,0.08)',
        darkStatusSuccess: '#73d13d',
        darkStatusWarning: '#ffc53d',
        darkStatusError: '#ff7875',
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
      },
      borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
      },
    },
    setDesignTokens: (tokens) => set((state) => ({ 
      designTokens: { ...state.designTokens, ...tokens } 
    })),

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

    projects: [],
    setProjects: (projects) => set({ projects }),
    currentProject: null,
    setCurrentProject: (currentProject) => set({ currentProject }),
    }), {
    name: 'ansflow-app-storage',
    version: 3, // 升级版本号以强制清理旧的缓存
    partialize: (state): PersistedState => ({
      isDark: state.isDark,
      themeKey: state.themeKey,
      designTokens: state.designTokens,
      collapsed: state.collapsed,
      currentUser: state.currentUser,
      permissions: state.permissions,
      pipelineActiveTab: state.pipelineActiveTab,
      language: state.language,
      avatar: state.avatar,
      currentProject: state.currentProject,
    }),
  })
);
export default useAppStore