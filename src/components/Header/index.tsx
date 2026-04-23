import React from 'react';
import { Layout, Button, theme, Space, Avatar, Dropdown, Switch, Select } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined, SunOutlined, MoonOutlined, MenuOutlined } from '@ant-design/icons';
import useAppStore from '../../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { useBreakpoint } from '@/utils/useBreakpoint';
import { useTranslation } from 'react-i18next';

const { Header: AntHeader } = Layout;

/**
 * 顶部导航栏组件 - 响应式版本
 */
const Header: React.FC = () => {
    const { collapsed, toggleCollapsed, isDark, setIsDark, setToken, setCurrentUser, currentUser, language, setLanguage, avatar, setAvatar } = useAppStore();
    const { toggleMobileSidebar } = useAppStore();
    const { isMobile } = useBreakpoint();
    const { i18n, t } = useTranslation();

    const {
        token: { colorText },
    } = theme.useToken();

    const navigate = useNavigate();

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
