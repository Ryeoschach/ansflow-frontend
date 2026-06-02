import React, { useEffect, lazy } from 'react';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import axios from 'axios';
import MainLayout from './layouts/MainLayout';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import useAppStore from './store/useAppStore';
import { useTranslation } from 'react-i18next';
import { getMe } from './api/user';
import { getProjects } from './api/rbac';
import LoginPage from './pages/Login';
import AppErrorBoundary from './components/ErrorBoundary';

/**
 * Vision 2026 - 全量语义化主题模型 (18色体系)
 * 所有的预置主题现在都完整适配 Design Tokens 体系，确保全站视觉一致性。
 */
const THEMES: Record<string, any> = {
  forest: {
    primary: '#606C38', bgLayout: '#FDFCF0', bgContainer: '#FFFFFF', textPrimary: '#283618', textSecondary: 'rgba(40,54,24,0.65)', border: 'rgba(0,0,0,0.06)', statusSuccess: '#52c41a', statusWarning: '#faad14', statusError: '#ff4d4f',
    darkPrimary: '#ADC178', darkBgLayout: '#0E140A', darkBgContainer: '#1D2619', darkTextPrimary: '#F0F5E1', darkTextSecondary: 'rgba(240,245,225,0.45)', darkBorder: 'rgba(255,255,255,0.08)', darkStatusSuccess: '#73d13d', darkStatusWarning: '#ffc53d', darkStatusError: '#ff7875'
  },
  deepsea: {
    primary: '#1B4965', bgLayout: '#F8F9FA', bgContainer: '#FFFFFF', textPrimary: '#0D1B2A', textSecondary: 'rgba(13,27,42,0.65)', border: 'rgba(0,0,0,0.08)', statusSuccess: '#52c41a', statusWarning: '#F9BC4D', statusError: '#E88C3E',
    darkPrimary: '#5FA8D3', darkBgLayout: '#0B132B', darkBgContainer: '#1C2541', darkTextPrimary: '#E0E1DD', darkTextSecondary: 'rgba(224,225,221,0.45)', darkBorder: 'rgba(255,255,255,0.1)', darkStatusSuccess: '#73d13d', darkStatusWarning: '#F9BC4D', darkStatusError: '#E88C3E'
  },
  teal: {
    primary: '#599A8F', bgLayout: '#FDFBF7', bgContainer: '#FFFFFF', textPrimary: '#334752', textSecondary: 'rgba(51,71,82,0.65)', border: 'rgba(0,0,0,0.06)', statusSuccess: '#52c41a', statusWarning: '#E6C587', statusError: '#D9795E',
    darkPrimary: '#84A59D', darkBgLayout: '#1A1C22', darkBgContainer: '#2B2D42', darkTextPrimary: '#F2CC8F', darkTextSecondary: 'rgba(242,204,143,0.45)', darkBorder: 'rgba(255,255,255,0.1)', darkStatusSuccess: '#73d13d', darkStatusWarning: '#E6C587', darkStatusError: '#D9795E'
  },
  nordic: {
    primary: '#D65454', bgLayout: '#F9FBFC', bgContainer: '#FFFFFF', textPrimary: '#263651', textSecondary: 'rgba(38,54,81,0.65)', border: 'rgba(0,0,0,0.06)', statusSuccess: '#52c41a', statusWarning: '#FBCDD6', statusError: '#5D83A3',
    darkPrimary: '#E5989B', darkBgLayout: '#111827', darkBgContainer: '#1F2937', darkTextPrimary: '#FFB703', darkTextSecondary: 'rgba(255,183,3,0.45)', darkBorder: 'rgba(255,255,255,0.1)', darkStatusSuccess: '#73d13d', darkStatusWarning: '#FBCDD6', darkStatusError: '#5D83A3'
  },
  pastel: {
    primary: '#9E868D', bgLayout: '#F8F9F9', bgContainer: '#FFFFFF', textPrimary: '#5C4F51', textSecondary: 'rgba(92,79,81,0.65)', border: 'rgba(0,0,0,0.06)', statusSuccess: '#52c41a', statusWarning: '#FBCDD6', statusError: '#E7A6B5',
    darkPrimary: '#B5838D', darkBgLayout: '#1F1A1C', darkBgContainer: '#2D2327', darkTextPrimary: '#FFB703', darkTextSecondary: 'rgba(255,183,3,0.45)', darkBorder: 'rgba(255,255,255,0.1)', darkStatusSuccess: '#73d13d', darkStatusWarning: '#FBCDD6', darkStatusError: '#FFB703'
  },
  cyberpunk: {
    primary: '#B8860B', bgLayout: '#F5F5F7', bgContainer: '#FFFFFF', textPrimary: '#1A1A1A', textSecondary: 'rgba(26,26,26,0.65)', border: 'rgba(0,0,0,0.08)', statusSuccess: '#52c41a', statusWarning: '#faad14', statusError: '#ff4d4f',
    darkPrimary: '#D4AF37', darkBgLayout: '#050505', darkBgContainer: '#141414', darkTextPrimary: '#F5F5F5', darkTextSecondary: 'rgba(245,245,245,0.5)', darkBorder: 'rgba(212,175,55,0.15)', darkStatusSuccess: '#73d13d', darkStatusWarning: '#D4AF37', darkStatusError: '#ff7875'
  }
};

const UserManagement = lazy(() => import('./pages/Users'));
const RoleManagement = lazy(() => import('./pages/System/RoleManagement'));
const MenuManagement = lazy(() => import('./pages/System/MenuManagement'));
const PermissionManagement = lazy(() => import('./pages/System/PermissionManagement'));
const HostManagement = lazy(() => import("./pages/Hosts"));
const HostBaseline = lazy(() => import("./pages/Hosts/HostBaseline"));
const ComplianceManagement = lazy(() => import("./pages/Hosts/ComplianceManagement"));
const PlatformManagement = lazy(() => import("./pages/Platforms"));
const Environment = lazy(() => import("./pages/Environments"));
const ResourcePoolManagement = lazy(() => import("./pages/ResourcePool"));
const TaskCenter = lazy(() => import("./pages/TaskCenter"));
const ExecutionHistory = lazy(() => import("./pages/TaskCenter/ExecutionHistory"));
const ScheduleCenter = lazy(() => import("./pages/TaskCenter/ScheduleCenter"));
const AuditLog = lazy(() => import("./pages/System/AuditLog"));
const ApprovalCenter = lazy(() => import("./pages/System/ApprovalCenter"));
const CredentialVault = lazy(() => import('./pages/System/CredentialVault'));
const ConfigCenter = lazy(() => import('./pages/ConfigCenter'));
const ImageRegistries = lazy(() => import('./pages/Pipeline/ImageRegistries'));
const Artifacts = lazy(() => import('./pages/Pipeline/Artifacts'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const K8sCenter = lazy(() => import("./pages/K8sCenter"));
const GitOpsCenter = lazy(() => import("./pages/K8sCenter/GitOpsCenter"));
const HelmCenter = lazy(() => import("./pages/K8sCenter/HelmCenter"));
const PipelineList = lazy(() => import("./pages/Pipeline"));
const PipelineDesigner = lazy(() => import("./pages/Pipeline/Designer"));
const PipelineRunViewer = lazy(() => import("./pages/Pipeline/RunViewer"));
const CIEnvironments = lazy(() => import("./pages/Pipeline/CIEnvironments"));
const PipelineWebhooks = lazy(() => import("./pages/Pipeline/Webhooks"));
const MonitorCenter = lazy(() => import("./pages/System/Monitor"));
const BackupManagement = lazy(() => import("./pages/System/BackupManagement"));
const PeriodicTask = lazy(() => import("./pages/System/PeriodicTask"));
const AISettings = lazy(() => import("./pages/System/AISettings"));
const AlertCenter = lazy(() => import("./pages/SRE/AlertCenter"));
const DiagnosisCenter = lazy(() => import("./pages/SRE/DiagnosisCenter"));
const TaskPulse = lazy(() => import("./pages/SRE/TaskPulse"));
const SreReport = lazy(() => import("./pages/SRE/Report"));
const SystemReports = lazy(() => import("./pages/System/Reports"));
const Profile = lazy(() => import("./pages/Profile"));
const ProjectManagement = lazy(() => import("./pages/System/ProjectManagement"));
const AssetShareCenter = lazy(() => import("./pages/System/AssetShareCenter"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

const CACHE_TTL = 1000 * 60 * 60 * 24;

const getValidCache = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (!timestamp || (Date.now() - timestamp > CACHE_TTL)) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch (e) {
    localStorage.removeItem(key);
    return null;
  }
};

try {
  const clusters = getValidCache('cache:clusters');
  const userInfo = getValidCache('cache:auth_user');
  const namespacesWithMeta = getValidCache('cache:namespaces');
  const helmListWithMeta = getValidCache('cache:helm_list');

  if (clusters) queryClient.setQueryData(['k8sClusters'], clusters);
  if (userInfo) queryClient.setQueryData(['auth_user'], userInfo);
  
  if (namespacesWithMeta) {
    queryClient.setQueryData(['k8sNamespaces', Number(namespacesWithMeta.clusterId)], namespacesWithMeta.list);
  }
  
  if (helmListWithMeta) {
    queryClient.setQueryData(['k8sHelm', Number(helmListWithMeta.clusterId), helmListWithMeta.namespace], helmListWithMeta.list);
  }
} catch (e) {
  console.warn("[AnsFlow Sync Cache] Initial cache backfill failed:", e);
}

// 单例锁
let globalInitPromise: Promise<any> | null = null;
let isAuthRunning = false;

import { setGlobalAntd } from './utils/antd';
const AntdInitializer: React.FC = () => {
  const { message, notification, modal } = AntdApp.useApp();
  useEffect(() => {
    setGlobalAntd(message, notification, modal);
  }, [message, notification, modal]);
  return null;
};

const QueryPersistenceManager = () => {
  const queryClient = useQueryClient();
  const { token } = useAppStore();

  useEffect(() => {
    if (!token) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event: any) => {
      if (event.type === 'updated' && event.action.type === 'success') {
        const queryKey = event.query.queryKey;
        const data = event.action.data;
        const cachePayload = (val: any) => JSON.stringify({ data: val, timestamp: Date.now() });

        if (queryKey[0] === 'k8sClusters') {
          localStorage.setItem('cache:clusters', cachePayload(data));
        }
        if (queryKey[0] === 'auth_user') {
          localStorage.setItem('cache:auth_user', cachePayload(data));
        }
        if (queryKey[0] === 'k8sNamespaces') {
          localStorage.setItem('cache:namespaces', cachePayload({
            clusterId: Number(queryKey[1]),
            list: data
          }));
        }
        if (queryKey[0] === 'k8sHelm') {
          localStorage.setItem('cache:helm_list', cachePayload({
             clusterId: Number(queryKey[1]),
             namespace: queryKey[2],
             list: data
          }));
        }
      }
    });

    return () => unsubscribe();
  }, [token, queryClient]);

  return null;
};

function App() {
  const { isDark, themeKey, designTokens, token, setToken, setPermissions, setCurrentUser, setAvatar, language } = useAppStore();
  
  const currentTokens = React.useMemo(() => {
    if (themeKey === 'custom') {
      return designTokens.colors;
    }
    // 预置主题现在也是全量 Token 模型，直接返回即可（THEMES 结构已补全）
    return THEMES[themeKey] || THEMES.forest;
  }, [themeKey, designTokens]);

  // 全局注入 CSS 变量
  useEffect(() => {
    const root = document.documentElement;
    const colors = currentTokens;
    
    const setVar = (name: string, val: string) => root.style.setProperty(`--ans-${name}`, val);
    
    // 基础颜色
    setVar('primary', isDark ? colors.darkPrimary : colors.primary);
    setVar('bg-layout', isDark ? colors.darkBgLayout : colors.bgLayout);
    setVar('bg-container', isDark ? colors.darkBgContainer : colors.bgContainer);
    setVar('text-primary', isDark ? colors.darkTextPrimary : colors.textPrimary);
    setVar('text-secondary', isDark ? colors.darkTextSecondary : colors.textSecondary);
    setVar('border', isDark ? colors.darkBorder : colors.border);
    
    // 状态色
    setVar('success', isDark ? colors.darkStatusSuccess : colors.statusSuccess);
    setVar('warning', isDark ? colors.darkStatusWarning : colors.statusWarning);
    setVar('error', isDark ? colors.darkStatusError : colors.statusError);

    // 间距与圆角
    setVar('radius-sm', `${designTokens.borderRadius.sm}px`);
    setVar('radius-md', `${designTokens.borderRadius.md}px`);
    setVar('radius-lg', `${designTokens.borderRadius.lg}px`);
    
    if (isDark) {
      root.classList.add('dark');
      document.body.style.backgroundColor = colors.darkBgLayout;
    } else {
      root.classList.remove('dark');
      document.body.style.backgroundColor = colors.bgLayout;
    }
  }, [isDark, currentTokens, designTokens]);

  const antdTheme = React.useMemo(() => ({
    cssVar: { prefix: 'ant' },
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: isDark ? currentTokens.darkPrimary : currentTokens.primary,
      colorInfo: isDark ? currentTokens.darkPrimary : currentTokens.primary,
      colorSuccess: isDark ? currentTokens.darkStatusSuccess : currentTokens.statusSuccess,
      colorWarning: isDark ? currentTokens.darkStatusWarning : currentTokens.statusWarning,
      colorError: isDark ? currentTokens.darkStatusError : currentTokens.statusError,
      colorTextBase: isDark ? currentTokens.darkTextPrimary : currentTokens.textPrimary,
      colorBgLayout: isDark ? currentTokens.darkBgLayout : currentTokens.bgLayout,
      colorBgContainer: isDark ? currentTokens.darkBgContainer : currentTokens.bgContainer,
      borderRadius: designTokens.borderRadius.lg,
      fontFamily: 'Inter, system-ui, sans-serif',
      wireframe: false,
    },
    components: {
      Layout: {
        headerBg: isDark ? currentTokens.darkBgLayout : currentTokens.primary,
        headerColor: '#FFFFFF',
        bodyBg: isDark ? currentTokens.darkBgLayout : currentTokens.bgLayout,
        // 核心修正：亮色模式下侧边栏不再强制深色，改用浅色背景
        siderBg: isDark ? currentTokens.darkBgLayout : currentTokens.bgContainer,
      },
      Menu: {
        // 1. 亮色主题配置 (当 theme="light" 时生效)
        itemBg: 'transparent',
        subMenuItemBg: 'rgba(0,0,0,0.03)',
        itemSelectedBg: `color-mix(in srgb, ${currentTokens.primary}, transparent 92%)`,
        itemSelectedColor: currentTokens.primary,
        
        // 2. 深色主题配置 (核心修复：当 theme="dark" 时生效)
        darkItemBg: 'transparent',
        darkSubMenuItemBg: 'rgba(0,0,0,0.2)',
        darkItemSelectedBg: isDark ? currentTokens.darkPrimary : currentTokens.primary,
        darkItemSelectedColor: '#FFFFFF',
        darkItemColor: 'rgba(255, 255, 255, 0.65)',
        darkItemHoverColor: '#FFFFFF',

        popupBg: isDark ? currentTokens.darkBgContainer : currentTokens.bgContainer,
        itemBorderRadius: designTokens.borderRadius.md,
      },
      Table: {
        headerBg: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        borderColor: isDark ? currentTokens.darkBorder : 'rgba(0,0,0,0.06)',
      },
      Card: {
        boxShadowTertiary: isDark ? '0 12px 32px -4px rgba(0,0,0,0.5)' : '0 8px 24px -4px rgba(40,54,24,0.06)',
        borderRadiusLG: designTokens.borderRadius.lg,
        borderColor: isDark ? currentTokens.darkBorder : 'rgba(0,0,0,0.04)',
      },
      Button: {
        borderRadius: designTokens.borderRadius.md,
        fontWeight: 500,
        controlOutline: 'none',
      }
    },
  }), [isDark, currentTokens, designTokens]);

  const { isInitializing, setIsInitializing } = useAppStore();
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();

  useEffect(() => {
    const syncLang = (l: string) => useAppStore.getState().setLanguage(l);
    i18n.on('languageChanged', syncLang);
    return () => i18n.off('languageChanged', syncLang);
  }, [i18n]);

  const antdLocale = language === 'en-US' ? enUS : zhCN;

  useEffect(() => {
    const initAuth = async () => {
      if (isAuthRunning) return;
      isAuthRunning = true;
      try {
        if (window.location.pathname === '/login') {
          setIsInitializing(false);
          return;
        }
        if (token) {
          setIsInitializing(false);
          return;
        }
        const urlParams = new URLSearchParams(window.location.search);
        const oauthToken = urlParams.get('access_token');
        if (oauthToken) {
          setIsInitializing(false);
          return;
        }
        if (!globalInitPromise) {
          globalInitPromise = (async () => {
            try {
              const res = await axios.post('/api/v1/auth/refresh/', {}, {
                withCredentials: true,
                validateStatus: (s) => s < 500
              });
              if (res.status === 200) {
                return res.data.data.access;
              }
              return null;
            } catch {
              return null;
            }
          })();
        }
        const newToken = await globalInitPromise;
        if (newToken) {
          const currentToken = useAppStore.getState().token;
          if (!currentToken) setToken(newToken);
        } else {
          const currentToken = useAppStore.getState().token;
          if (!currentToken) navigate('/login');
        }
        setIsInitializing(false);
        globalInitPromise = null;
      } finally {
        isAuthRunning = false;
      }
    };
    initAuth();
  }, [token, setToken, setIsInitializing, navigate]);

  useEffect(() => {
    if (token) {
      getMe().then((res: any) => {
        const storeToken = useAppStore.getState().token;
        if (storeToken === token) {
          setPermissions(res.permissions || []);
          setCurrentUser(res.username);
          setAvatar(res.avatar || null);
        }
      }).catch((err: any) => {
        if (err?.response?.status === 401) {
          setToken(null);
          setPermissions([]);
        }
      });

      // 获取当前用户的项目列表
      getProjects({ page_size: 1000 }).then((res: any) => {
        const storeToken = useAppStore.getState().token;
        if (storeToken === token) {
          const projectsList = res.data || [];
          useAppStore.getState().setProjects(projectsList);
          
          const currentProject = useAppStore.getState().currentProject;
          if (projectsList.length > 0) {
            const exists = currentProject && projectsList.some((p: any) => p.id === currentProject.id);
            if (!exists) {
              const defaultProj = projectsList.find((p: any) => p.code === 'default') || projectsList[0];
              useAppStore.getState().setCurrentProject(defaultProj);
            } else {
              const updatedProj = projectsList.find((p: any) => p.id === currentProject.id);
              useAppStore.getState().setCurrentProject(updatedProj);
            }
          } else {
            useAppStore.getState().setCurrentProject(null);
          }
        }
      }).catch((err: any) => {
        console.error("Failed to load projects:", err);
      });
    } else {
      useAppStore.getState().setProjects([]);
      useAppStore.getState().setCurrentProject(null);
    }
  }, [token, setPermissions, setCurrentUser, setToken]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={antdLocale}
        theme={antdTheme}
      >
        <AntdApp>
          <AntdInitializer />
          <AppErrorBoundary isGlobal={true} title={t('errorBoundary.globalTitle')}>
            <QueryPersistenceManager />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<MainLayout isLoading={isInitializing} />}>
                <Route index element={<Navigate to="/v1/dashboard" replace />} />
                <Route path="v1/dashboard" element={<Dashboard />} />
                <Route path="v1/profile" element={<Profile />} />
                <Route path="v1/tasks" element={<TaskCenter />} />
                <Route path="v1/task/ansible" element={<TaskCenter />} />
                <Route path="v1/task/executions" element={<ExecutionHistory />} />
                <Route path="v1/task/schedules" element={<ScheduleCenter />} />
                <Route path="v1/k8s/helm" element={<HelmCenter />} />
                <Route path="v1/k8s/management" element={<K8sCenter />} />
                <Route path="v1/k8s/gitops" element={<GitOpsCenter />} />
                <Route path="v1/ci-envs" element={<CIEnvironments />} />
                <Route path="v1/system/users" element={<UserManagement />} />
                <Route path="v1/system/roles" element={<RoleManagement />} />
                <Route path="v1/system/menus" element={<MenuManagement />} />
                <Route path="v1/system/hosts" element={<HostManagement />} />
                <Route path="v1/system/host-baselines" element={<HostBaseline />} />
                <Route path="v1/system/compliance" element={<ComplianceManagement />} />
                <Route path="v1/system/config" element={<ConfigCenter />} />
                <Route path="v1/pipeline/list" element={<PipelineList />} />
                <Route path="v1/pipeline/artifacts" element={<Artifacts />} />
                <Route path="v1/pipeline/registries" element={<ImageRegistries />} />
                <Route path="v1/pipeline/webhooks" element={<PipelineWebhooks />} />
                <Route path="v1/pipeline/designer" element={<PipelineDesigner />} />
                <Route path="v1/pipeline/runs/:runId" element={<PipelineRunViewer />} />
                <Route path="v1/system/envs" element={<Environment />} />
                <Route path="v1/system/platforms" element={<PlatformManagement />} />
                <Route path="v1/system/resourcepool" element={<ResourcePoolManagement />} />
                <Route path="v1/system/credentials" element={<CredentialVault />} />
                <Route path="v1/system/permissions" element={<PermissionManagement />} />
                <Route path="v1/system/monitor" element={<MonitorCenter />} />
                <Route path="v1/system/audit-logs" element={<AuditLog />} />
                <Route path="v1/system/approvals" element={<ApprovalCenter />} />
                <Route path="v1/sre/alerts" element={<AlertCenter />} />
                <Route path="v1/sre/diagnosis" element={<DiagnosisCenter />} />
                <Route path="v1/sre/pulse" element={<TaskPulse />} />
                <Route path="v1/sre/report" element={<SreReport />} />
                <Route path="v1/system/reports" element={<SystemReports />} />
                <Route path="v1/system/backups" element={<BackupManagement />} />
                <Route path="v1/system/periodic-tasks" element={<PeriodicTask />} />
                <Route path="v1/ai-rag/config" element={<AISettings />} />
                <Route path="v1/system/vault" element={<CredentialVault />} />
                <Route path="v1/system/projects" element={<ProjectManagement />} />
                <Route path="v1/system/asset-shares" element={<AssetShareCenter />} />
                <Route path="*" element={<div>{t('common.underDevelopment')}</div>} />
              </Route>
            </Routes>
          </AppErrorBoundary>
        </AntdApp>
      </ConfigProvider>
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}

export default App;
