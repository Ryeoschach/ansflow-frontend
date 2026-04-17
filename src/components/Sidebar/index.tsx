import React, { useMemo } from 'react';
import { Layout, Menu, Spin, Drawer } from 'antd';
import { useBreakpoint } from '@/utils/useBreakpoint';
import useAppStore from '../../store/useAppStore';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyMenus } from '../../api/rbac';
import { getK8sClusters, getHelmLocalCharts } from '../../api/k8s';
import IconMapper from '../IconMapper';
import { ApiOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';


const { Sider } = Layout;

/**
 * 菜单项数据接口
 */
interface MenuItemData {
    id: number;
    title: string;
    title_en?: string;
    key: string;
    path: string;
    icon?: string;
    children?: MenuItemData[];
}

/**
 * 侧边栏组件 - 响应式版本
 * - Desktop (>= 768px): Sider 固定侧边栏
 * - Mobile (< 768px): Drawer 抽屉，通过 Header 触发
 */
const Sidebar: React.FC = () => {
    const { t } = useTranslation();
    const { collapsed, isDark, token, mobileSidebarOpen, setMobileSidebarOpen, language } = useAppStore();
    const { isMobile } = useBreakpoint();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [openKeys, setOpenKeys] = React.useState<string[]>([]);

    /**
     * 菜单悬停预加载逻辑
     */
    const handleMenuHover = (path: string) => {
        // K8s 集群管理
        if (path === '/v1/k8s/management') {
            queryClient.prefetchQuery({
                queryKey: ['k8s_clusters'],
                queryFn: () => getK8sClusters(),
                staleTime: 1000 * 60 * 5,
            });
        }
        // Helm 应用中心 (预加载 Local Charts 为首页渲染做准备)
        if (path === '/v1/k8s/helm') {
            queryClient.prefetchQuery({
                queryKey: ['helm_local_charts'],
                queryFn: () => getHelmLocalCharts(),
                staleTime: 1000 * 60 * 5,
            });
        }
    };

    // 1. 从后端获取动态菜单树
    const { data: menuData, isLoading } = useQuery<MenuItemData[], Error>({
        queryKey: ['my_menus', token],
        queryFn: async () => {
            const res = await getMyMenus();
            return res as any;
        },
        staleTime: 1000 * 60 * 5,
        enabled: !!token,
    });

    // 2. 递归获取菜单项并处理 Accordion 逻辑所需的数据
    const { items, rootSubmenuKeys } = useMemo(() => {
        if (!menuData || !Array.isArray(menuData)) return { items: [], rootSubmenuKeys: [] };

        const rootKeys: string[] = [];
        const renderItems = (items: MenuItemData[], level = 0): any[] => {
            return items.map(item => {
                let finalKey = (item.path || item.key || '').trim();
                if (finalKey && !finalKey.startsWith('/')) {
                    finalKey = '/' + finalKey;
                }

                if (level === 0 && item.children && item.children.length > 0) {
                    rootKeys.push(finalKey);
                }

                const menuLabel = (language === 'en-US' && item.title_en) ? item.title_en : item.title;
                return {
                    key: finalKey,
                    label: menuLabel,
                    onMouseEnter: () => handleMenuHover(finalKey),
                    icon: item.icon ? <IconMapper iconName={item.icon} /> : null,
                    children: item.children && item.children.length > 0
                        ? renderItems(item.children, level + 1)
                        : undefined,
                };
            });
        };

        return {
            items: renderItems(menuData),
            rootSubmenuKeys: rootKeys
        };
    }, [menuData, language]);

    // 3. 初始进入/路由变化时，自动展开当前路径所在的父菜单
    React.useEffect(() => {
        if (location.pathname) {
            // 找到包含当前路径的 root 菜单
            const parentKey = rootSubmenuKeys.find(key => location.pathname.startsWith(key));
            if (parentKey) {
                setOpenKeys([parentKey]);
            }
        }
    }, [location.pathname, rootSubmenuKeys]);

    // 4. 手风琴逻辑：点击新的二级菜单时，关闭其他已打开的
    const onOpenChange = (keys: string[]) => {
        const latestOpenKey = keys.find((key) => openKeys.indexOf(key) === -1);
        if (latestOpenKey && rootSubmenuKeys.indexOf(latestOpenKey) === -1) {
            setOpenKeys(keys);
        } else {
            setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
        }
    };

    // 菜单点击后关闭 Drawer（仅移动端）
    const handleMenuClick = ({ key }: { key: string }) => {
        if (!key || key === '#' || key === '') return;
        if (isMobile) {
            setMobileSidebarOpen(false);
        }
        navigate(key);
    };

    // 渲染 Logo 区域
    const logoArea = (
        <div className={`h-16 flex items-center justify-center m-4 ${isDark ? 'bg-[#262626]' : 'bg-[#f5f5f5]'
            } rounded-lg shrink-0`}>
            <Link to="/v1/dashboard">
                <span className="text-xl font-bold text-amber-500 border-2 rounded-md px-3 py-2 cursor-pointer hover:opacity-80 transition-all duration-300">
                    {collapsed ? 'A' : 'AnsFlow'}
                </span>
            </Link>
        </div>
    );

    // 渲染菜单
    const menuComponent = (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Logo 区域 */}
            {logoArea}

            {/* 菜单区域：独立滚动 */}
            <div className="flex-1 overflow-y-auto px-2 pb-20 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Spin />
                    </div>
                ) : (
                    <Menu
                        mode="inline"
                        theme={isDark ? 'dark' : 'light'}
                        selectedKeys={[location.pathname]}
                        openKeys={openKeys}
                        onOpenChange={onOpenChange}
                        items={items}
                        className="border-none"
                        onClick={handleMenuClick}
                    />
                )}
            </div>

            {/* 底部链接 */}
            <div className="shrink-0 px-3 py-3 border-t cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={() => window.open('/api/docs/', '_blank')}>
                <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    <ApiOutlined />
                    {!collapsed && <span>{t('menu.apiDocs')}</span>}
                </div>
            </div>

            <div className="h-4 shrink-0" />
        </div>
    );

    // ========== 移动端：渲染 Drawer ==========
    if (isMobile) {
        return (
            <>
                {/* 移动端 Sider 只是一个隐藏的容器，样式不变 */}
                <Sider
                    trigger={null}
                    collapsible
                    collapsed={collapsed}
                    className="hidden" // 移动端不渲染 Sider
                    theme={isDark ? 'dark' : 'light'}
                    width={240}
                />
                {/* Drawer 版本的侧边栏 */}
                <Drawer
                    title={null}
                    placement="left"
                    closable={false}
                    open={mobileSidebarOpen}
                    onClose={() => setMobileSidebarOpen(false)}
                    width={260}
                    styles={{
                        body: { padding: 0, overflow: 'hidden' },
                        wrapper: { overflow: 'hidden' },
                    }}
                    className="responsive-sidebar-drawer"
                >
                    <div className="h-full overflow-hidden">
                        {menuComponent}
                    </div>
                </Drawer>
            </>
        );
    }

    // ========== 桌面端：渲染原始 Sider ==========
    return (
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            className={`h-screen sticky top-0 left-0 border-r ${isDark ? 'border-[#303030]' : 'border-[#f0f0f0]'
                }`}
            theme={isDark ? 'dark' : 'light'}
            width={240}
        >
            {menuComponent}
        </Sider>
    );
};

export default Sidebar;
