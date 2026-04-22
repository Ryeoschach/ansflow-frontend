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
    const { collapsed, toggleCollapsed, isDark, setIsDark, setToken, setCurrentUser, currentUser, language, setLanguage } = useAppStore();
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
                label: '个人中心',
                onClick: () => navigate('/v1/profile'),
            },
            {
                type: 'divider' as const,
            },
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                onClick: () => {
                    setToken(null);
                    setCurrentUser(null);
                    useAppStore.getState().setPermissions([]); // 清除权限
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
                            <Avatar icon={<UserOutlined />} className="bg-amber-500 flex-shrink-0" />
                            <span className="font-medium hidden sm:inline whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]" style={{ color: colorText }}>{currentUser}</span>
                        </Space>
                    </Dropdown>
                </Space>
            </div>
        </AntHeader>
    );
};

export default Header;
