import { ConfigProvider, App as AntdApp, theme } from 'antd';
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import MainLayout from './layouts/MainLayout';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import useAppStore from './store/useAppStore';
import { useTranslation } from 'react-i18next';
import UserManagement from './pages/Users';
import React, { useEffect, lazy } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import LoginPage from './pages/Login';
import axios from 'axios';
import RoleManagement from './pages/System/RoleManagement';
import MenuManagement from './pages/System/MenuManagement';
import PermissionManagement from './pages/System/PermissionManagement';
import { getMe } from './api/user';
import HostManagement from "./pages/Hosts";
import PlatformManagement from "./pages/Platforms";
import Environment from "./pages/Environments";
import ResourcePoolManagement from "./pages/ResourcePool";
import TaskCenter from "./pages/TaskCenter";
import ExecutionHistory from "./pages/TaskCenter/ExecutionHistory";
import AuditLog from "./pages/System/AuditLog";
import ApprovalCenter from "./pages/System/ApprovalCenter";
import CredentialVault from './pages/System/CredentialVault';
import AppErrorBoundary from './components/ErrorBoundary';


const Dashboard = lazy(() => import('./pages/Dashboard'));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 增加缓存机制：数据在 5 分钟内不触发网络请求
      staleTime: 1000 * 60 * 5,
      // 数据在内存中保留 10 分钟
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

const CACHE_TTL = 1000 * 60 * 60 * 24; // 设置不常变更数据的本地缓存失效时间24小时

/**
 * 通用缓存校验与读取逻辑
 */
const getValidCache = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    // 如果没有时间戳或已过期，则清除
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

/**
 * 同步回填核心元数据
 * 在 App 渲染前执行，确保业务组件挂载时缓存已 Ready
 * 调用getValidCache 来判断数据是否是有效期以内
 */
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
  console.warn("[AnsFlow Sync Cache] 初始化回填失败:", e);
}

/**
 * 应用根组件，配置主题和路由
 */

// 单例锁，确保即便是 React StrictMode 两次渲染也只跑一个
let globalInitPromise: Promise<any> | null = null;

import { setGlobalAntd } from './utils/antd';
const AntdInitializer: React.FC = () => {
  const { message, notification, modal } = AntdApp.useApp();
  useEffect(() => {
    setGlobalAntd(message, notification, modal);
  }, [message, notification, modal]);
  return null;
};
const K8sCenter = lazy(() => import("./pages/K8sCenter"));
const HelmCenter = lazy(() => import("./pages/K8sCenter/HelmCenter"));
const PipelineList = lazy(() => import("./pages/Pipeline"));
const PipelineDesigner = lazy(() => import("./pages/Pipeline/Designer"));
const PipelineRunViewer = lazy(() => import("./pages/Pipeline/RunViewer"));
const CIEnvironments = lazy(() => import("./pages/Pipeline/CIEnvironments"));
const ArtifactRepository = lazy(() => import("./pages/Pipeline/ArtifactRepository"));
const PipelineWebhooks = lazy(() => import("./pages/Pipeline/Webhooks"));
const MonitorCenter = lazy(() => import("./pages/System/Monitor"));
const ConfigCenter = lazy(() => import("./pages/ConfigCenter"));
const BackupManagement = lazy(() => import("./pages/System/BackupManagement"));
const Profile = lazy(() => import("./pages/Profile"));

// const PageLoader = () => (
//     <div className={`h-full w-full flex flex-col items-center justify-center`}>
//       <div className="flex flex-col items-center gap-4">
//         <div className="text-3xl font-bold text-indigo-500 border-2 border-indigo-500/30 rounded-xl px-6 py-2 opacity-90 animate-pulse bg-indigo-500/5">
//           AnsFlow
//         </div>
//         <div className="text-gray-400 text-xs mt-2 uppercase tracking-[0.2em] font-medium animate-pulse">Loading Module...</div>
//       </div>
//     </div>
// );

// 定义全屏初始化 UI 组件,改为使用骨架屏
// const FullPageInitializingUI = ({ isDark }: { isDark: boolean }) => (
//     <div className={`h-screen w-screen flex flex-col items-center justify-center ${isDark ? 'bg-[#141414]' : 'bg-[#f0f2f5]'}`}>
//       <div className="flex flex-col items-center gap-4">
//          <div className="text-3xl font-bold text-indigo-500 border-2 border-indigo-500/30 rounded-xl px-6 py-2 opacity-90 animate-pulse bg-indigo-500/5">
//              AnsFlow
//          </div>
//          <div className="text-gray-400 text-xs mt-2 uppercase tracking-[0.2em] font-medium animate-pulse">Initializing System Framework</div>
//       </div>
//     </div>
// );

/**
 * 管理核心元数据的逻辑。
 * 在系统启动时尝试回填缓存，并在数据更新时自动同步进本地存储。
 * 同时设置了TTL为24小时，过时会删除本地存储重新更新
 */
const QueryPersistenceManager = () => {
  const queryClient = useQueryClient();
  const { token } = useAppStore();

  useEffect(() => {
    // 只有在已登录状态下才启动实时同步
    if (!token) return;

    // 监听成功事件，自动镜像特定 API 到本地
    const unsubscribe = queryClient.getQueryCache().subscribe((event: any) => {
      if (event.type === 'updated' && event.action.type === 'success') {
        const queryKey = event.query.queryKey;
        const data = event.action.data;
        const cachePayload = (val: any) => JSON.stringify({ data: val, timestamp: Date.now() });

        // 同步集群列表
        if (queryKey[0] === 'k8sClusters') {
          localStorage.setItem('cache:clusters', cachePayload(data));
        }
        // 同步账户信息
        if (queryKey[0] === 'auth_user') {
          localStorage.setItem('cache:auth_user', cachePayload(data));
        }
        // 同步命名空间列表
        if (queryKey[0] === 'k8sNamespaces') {
          localStorage.setItem('cache:namespaces', cachePayload({
            clusterId: Number(queryKey[1]),
            list: data
          }));
        }
        // 同步 Helm 列表
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
  const { isDark, token, setToken, setPermissions, setCurrentUser, setAvatar, language } = useAppStore();
  const { isInitializing, setIsInitializing } = useAppStore();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  // 同步 i18n 语言到 store（启动时和语言切换时）
  useEffect(() => {
    const syncLang = (l: string) => useAppStore.getState().setLanguage(l);
    i18n.on('languageChanged', syncLang);
    return () => i18n.off('languageChanged', syncLang);
  }, [i18n]);

  // Ant Design locale mapping
  const antdLocale = language === 'en-US' ? enUS : zhCN;

  useEffect(() => {
    const initAuth = async () => {
      // 如果内存已有 Token，直接退出
      if (token) {
        setIsInitializing(false);
        return;
      }
      // 如果正在登录页，直接退出
      if (window.location.pathname === '/login') {
        setIsInitializing(false);
        return;
      }
      // 使用全局 Promise 锁，防止并发
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
        setToken(newToken);
      } else {
        navigate('/login');
      }
      setIsInitializing(false);
      globalInitPromise = null; // 跑完清空
    };
    initAuth();
  }, [token, setToken, setIsInitializing, navigate]);

  // 登录成功后获取用户信息及权限
  useEffect(() => {
    if (token) {
      getMe().then((res: any) => {
        setPermissions(res.permissions || []);
        // 只有当 res.username 和 store 中的不同时才更新
        // 这样可以避免覆盖社交登录设置的正确用户名
        const currentUser = useAppStore.getState().currentUser;
        if (!currentUser || currentUser === 'User') {
          setCurrentUser(res.username);
        }
        setAvatar(res.avatar || null);
      }).catch(() => {
        setToken(null);
        setPermissions([]); // 清除权限
      });
    }
  }, [token, setPermissions, setCurrentUser, setToken]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#141414';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f0f2f5';
    }
  }, [isDark]);

  // if (isInitializing) {
  //   return <div className="h-screen w-screen flex items-center justify-center">加载中...</div>;
  // }

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={antdLocale}
        theme={{
          cssVar: {},
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: isDark ? '#818cf8' : '#6366f1',
            controlOutline: isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(99, 102, 241, 0.15)',
            borderRadius: 10,
            fontFamily: 'Inter, system-ui, sans-serif',
          },
          components: {
            Layout: {
              headerBg: isDark ? '#141414' : '#fff',
              siderBg: isDark ? '#141414' : '#fff',
            },
            Menu: {
              darkItemBg: '#141414',
              darkSubMenuItemBg: '#141414',
              itemBorderRadius: 8,
            },
          },
        }}
      >
        <AntdApp>
          <AntdInitializer />
          {/*全局组件异常页面*/}
          <AppErrorBoundary isGlobal={true} title="AnsFlow 全局运行时异常">
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
                <Route path="v1/k8s/helm" element={<HelmCenter />} />
                <Route path="v1/k8s/management" element={<K8sCenter />} />
                <Route path="v1/ci-envs" element={<CIEnvironments />} />
                <Route path="v1/system/users" element={<UserManagement />} />
                <Route path="v1/system/roles" element={<RoleManagement />} />
                <Route path="v1/system/menus" element={<MenuManagement />} />
                <Route path="v1/system/hosts" element={<HostManagement />} />
                <Route path="v1/pipeline/list" element={<PipelineList />} />
                <Route path="v1/pipeline/artifacts" element={<ArtifactRepository />} />
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
                <Route path="v1/system/config" element={<ConfigCenter />} />
                <Route path="v1/system/backup" element={<BackupManagement />} />
                <Route path="v1/system/vault" element={<CredentialVault />} />
                {/*404*/}
                <Route path="*" element={<div>^^如果uri不是你手动输入的或者你确定输入的uri是正确的，那就是该页面功能正在开发中^^</div>} />
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
