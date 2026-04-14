import React from 'react';
import { Layout, Button, theme, Space, Avatar, Dropdown, Switch } from 'antd';
import useAppStore from '../../store/useAppStore';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    UserOutlined,
    LogoutOutlined,
    SunOutlined,
    MoonOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Header: AntHeader } = Layout;

/**
 * 顶部导航栏组件
 */
const Header: React.FC = () => {
    const { collapsed, toggleCollapsed } = useAppStore();
    const { isDark, setIsDark, setToken, setCurrentUser, currentUser } = useAppStore();
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
            className="p-0 flex items-center justify-between glass-effect sticky top-0 z-50 shadow-sm"
            style={{ color: colorText }}
        >
            <div className="flex items-center">
                <Button
                    type="text"
                    icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={toggleCollapsed}
                    className="w-12 h-12 text-lg ml-2"
                />
                <h2 className="m-0 text-lg font-semibold ml-2">运维自动化平台</h2>
            </div>

            <div className="px-6 flex items-center gap-2">
                <div className="flex items-center gap-2"
                    style={{
                        color: colorText,
                    }}
                >
                    <span>主题切换</span>
                    <Switch
                        // defaultChecked
                        checked={isDark}
                        checkedChildren={<MoonOutlined />}
                        unCheckedChildren={<SunOutlined />}
                        onChange={(checked) => setIsDark(checked)} />
                </div>
                <Space size={16}>
                    <Dropdown menu={userMenuItems}>
                        <Space className="cursor-pointer hover:bg-fill-hover px-2 rounded-lg transition-colors">
                            <Avatar icon={<UserOutlined />} className="bg-amber-500" />
                            <span className="font-medium" style={{ color: colorText }}>{currentUser}</span>
                        </Space>
                    </Dropdown>
                </Space>
            </div>
        </AntHeader>
    );
};

export default Header;
