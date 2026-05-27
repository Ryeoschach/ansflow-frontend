import React from 'react';
import { Layout, Button, theme, Space, Avatar, Dropdown, Switch, Select, Badge, Popover, List } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined, SunOutlined, MoonOutlined, MenuOutlined, ProjectOutlined, BellOutlined, DownloadOutlined, CheckOutlined } from '@ant-design/icons';
import useAppStore from '../../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '@/utils/useBreakpoint';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import useWebSocket from 'react-use-websocket';
import dayjs from 'dayjs';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead, UserNotification } from '../../api/system';
import { notification } from '../../utils/antd';

const { Header: AntHeader } = Layout;

/**
 * 顶部导航栏组件 - 响应式版本
 */
const Header: React.FC = () => {
    const { collapsed, toggleCollapsed, isDark, setIsDark, setToken, setCurrentUser, currentUser, language, setLanguage, avatar, setAvatar, projects, currentProject, setCurrentProject, token } = useAppStore();
    const { toggleMobileSidebar } = useAppStore();
    const { isMobile } = useBreakpoint();
    const { i18n, t } = useTranslation();
    const queryClient = useQueryClient();

    const {
        token: { colorText },
    } = theme.useToken();

    const navigate = useNavigate();

    // --- 消息通知中心 ---
    const { data: notifications = [], refetch } = useQuery<UserNotification[]>({
        queryKey: ['userNotifications'],
        queryFn: getUserNotifications,
        enabled: !!token,
    });

    const wsUrl = token ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/notifications/` : null;

    const { sendJsonMessage } = useWebSocket(wsUrl, {
        onOpen: () => {
            sendJsonMessage({ type: 'auth', token });
        },
        onMessage: (event) => {
            try {
                const messageData = JSON.parse(event.data);
                if (messageData.type === 'notification') {
                    const newNotif = messageData.data;
                    
                    // 弹出全局通知
                    notification.info({
                        message: newNotif.title,
                        description: (
                            <div>
                                <div>{newNotif.content}</div>
                                {newNotif.extra_data?.download_url && (
                                    <Button 
                                        type="link" 
                                        size="small" 
                                        icon={<DownloadOutlined />}
                                        onClick={() => {
                                            window.open(newNotif.extra_data.download_url, '_blank');
                                        }}
                                        className="p-0 mt-1"
                                    >
                                        {t('header.downloadReport')}
                                    </Button>
                                )}
                            </div>
                        ),
                        placement: 'topRight',
                        duration: 5,
                    });

                    // 动态更新通知列表
                    queryClient.setQueryData<UserNotification[]>(['userNotifications'], (prev) => {
                        if (!prev) return [newNotif];
                        if (prev.some(n => n.id === newNotif.id)) return prev;
                        return [newNotif, ...prev];
                    });
                }
            } catch (err) {
                console.error('Failed to parse WS notification message:', err);
            }
        },
        shouldReconnect: () => !!token,
        reconnectAttempts: 10,
        reconnectInterval: 3000,
    });

    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: (_, id) => {
            queryClient.setQueryData<UserNotification[]>(['userNotifications'], (prev) => {
                if (!prev) return [];
                return prev.map(n => n.id === id ? { ...n, is_read: true } : n);
            });
        }
    });

    const markAllReadMutation = useMutation({
        mutationFn: markAllNotificationsRead,
        onSuccess: () => {
            queryClient.setQueryData<UserNotification[]>(['userNotifications'], (prev) => {
                if (!prev) return [];
                return prev.map(n => ({ ...n, is_read: true }));
            });
        }
    });

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const notificationContent = (
        <div className="w-80 sm:w-96 flex flex-col max-h-[480px]">
            <div className="flex justify-between items-center px-4 py-2 border-b border-black/5 dark:border-white/5">
                <span className="font-bold text-sm">{t('header.notifications')}</span>
                {unreadCount > 0 && (
                    <Button 
                        type="link" 
                        size="small" 
                        icon={<CheckOutlined />}
                        onClick={() => markAllReadMutation.mutate()}
                        className="text-xs p-0"
                    >
                        {t('header.markAllRead')}
                    </Button>
                )}
            </div>
            <div className="overflow-y-auto flex-1 max-h-[360px]">
                <List
                    dataSource={notifications}
                    locale={{ emptyText: <div className="py-8 text-neutral-400 text-center">{t('header.noNotifications')}</div> }}
                    renderItem={(item: UserNotification) => (
                        <List.Item 
                            key={item.id}
                            className={`px-4 py-3 cursor-pointer transition-colors duration-200 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 ${!item.is_read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                            onClick={() => {
                                if (!item.is_read) {
                                    markReadMutation.mutate(item.id);
                                }
                            }}
                        >
                            <List.Item.Meta
                                title={
                                    <div className="flex justify-between items-start gap-2">
                                        <span className={`text-xs font-semibold ${!item.is_read ? 'text-primary' : 'text-neutral-500'}`}>
                                            {item.title}
                                        </span>
                                        <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                                            {dayjs(item.create_time).format('MM-DD HH:mm')}
                                        </span>
                                    </div>
                                }
                                description={
                                    <div className="mt-1 flex flex-col gap-2">
                                        <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed block break-words">
                                            {item.content}
                                        </span>
                                        {item.extra_data?.download_url && (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <Button 
                                                    type="primary" 
                                                    size="small" 
                                                    icon={<DownloadOutlined />}
                                                    onClick={() => {
                                                        window.open(item.extra_data.download_url, '_blank');
                                                        if (!item.is_read) {
                                                            markReadMutation.mutate(item.id);
                                                        }
                                                    }}
                                                    className="ans-btn text-[11px] h-7 px-3 rounded-full mt-1"
                                                >
                                                    {t('header.downloadReport')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            </div>
        </div>
    );

    const userMenuItems = {
        items: [
            {
                key: 'profile',
                icon: <UserOutlined />,
                label: t('header.profile'),
                onClick: () => navigate('/v1/profile'),
            },
            {
                type: 'divider' as const,
            },
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: t('header.logout'),
                onClick: async () => {
                    // 清除本地状态
                    setToken(null);
                    setCurrentUser(null);
                    setAvatar(null);
                    useAppStore.getState().setPermissions([]);
                    // 调用后端 logout 接口清除 cookie
                    try {
                        await fetch('/api/v1/auth/logout/', {
                            method: 'POST',
                            credentials: 'include',
                        });
                    } catch (e) {
                        console.log('[Logout] API error:', e);
                    }
                    // 强制清除 cookie（虽然 HttpOnly 无法被 JS 删除，但可以尝试）
                    document.cookie = 'refresh_token=; path=/; max-age=0; SameSite=Lax';
                    navigate('/login');
                },
            },
        ],
    };

    return (
        <AntHeader
            className="p-0 flex items-center justify-between glass-effect sticky top-0 z-50 shadow-sm overflow-hidden"
            style={{ color: colorText }}
        >
            <div className="flex items-center flex-shrink-0 min-w-0">
                {/* 移动端：hamburger 按钮；桌面端：原有的折叠按钮 */}
                {isMobile ? (
                    <Button
                        type="text"
                        icon={<MenuOutlined />}
                        onClick={toggleMobileSidebar}
                        className="w-12 h-12 text-lg ml-2"
                    />
                ) : (
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        onClick={toggleCollapsed}
                        className="w-12 h-12 text-lg ml-2"
                    />
                )}
                <h2 className="m-0 text-lg font-semibold ml-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px] sm:max-w-none">{t('header.platformTitle')}</h2>

                {/* 项目/工作区切换器 */}
                {projects && projects.length > 0 && (
                    <div className="ml-4 flex items-center bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 hover:border-primary transition-all flex-shrink-0">
                        <ProjectOutlined className="mr-1 text-primary text-sm flex-shrink-0" />
                        <Select
                            variant="borderless"
                            value={currentProject?.id}
                            onChange={(val) => {
                                const selected = projects.find((p: any) => p.id === val);
                                setCurrentProject(selected || null);
                                // 切换项目后，清空并刷新所有 React Query 缓存
                                queryClient.invalidateQueries();
                            }}
                            className="font-medium text-xs h-6 leading-6"
                            style={{ width: 130 }}
                            placeholder="选择项目"
                            options={projects.map((p: any) => ({
                                value: p.id,
                                label: p.name,
                            }))}
                            dropdownStyle={{ minWidth: 160 }}
                        />
                    </div>
                )}
            </div>

            <div className="px-2 sm:px-6 flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <div className="flex items-center gap-1"
                    style={{ color: colorText }}
                >
                    <Switch
                        checked={isDark}
                        checkedChildren={<MoonOutlined />}
                        unCheckedChildren={<SunOutlined />}
                        onChange={(checked) => setIsDark(checked)} />
                </div>

                <Select
                    value={language}
                    onChange={(l) => {
                        i18n.changeLanguage(l);
                        setLanguage(l);
                    }}
                    size="small"
                    options={[
                        { value: 'zh-CN', label: '中文' },
                        { value: 'en-US', label: 'English' },
                    ]}
                    style={{ width: 80 }}
                />

                {/* 通知中心 */}
                {token && (
                    <Popover 
                        content={notificationContent} 
                        trigger="click" 
                        placement="bottomRight"
                        overlayClassName="ans-popover"
                    >
                        <div className="cursor-pointer hover:bg-fill-hover p-2 rounded-lg transition-colors flex items-center justify-center">
                            <Badge count={unreadCount} overflowCount={99} size="small">
                                <BellOutlined style={{ fontSize: '18px', color: colorText }} />
                            </Badge>
                        </div>
                    </Popover>
                )}

                <Space size={8}>
                    <Dropdown menu={userMenuItems}>
                        <Space className="cursor-pointer hover:bg-fill-hover px-2 rounded-lg transition-colors min-w-0">
                            <Avatar icon={<UserOutlined />} src={avatar} className="bg-amber-500 flex-shrink-0" />
                            <span className="font-medium hidden sm:inline whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]" style={{ color: colorText }}>{currentUser}</span>
                        </Space>
                    </Dropdown>
                </Space>
            </div>
        </AntHeader>
    );
};

export default Header;
