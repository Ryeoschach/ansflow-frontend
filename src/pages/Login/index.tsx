import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App, theme, Tabs, Divider, Select, Space } from 'antd';
import { UserOutlined, LockOutlined, SunOutlined, MoonOutlined, GithubOutlined, WechatOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login, ldapLogin } from '../../api/auth';
import useAppStore from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { message } = App.useApp();
    const { setToken, isDark, setCurrentUser, setIsDark, language, setLanguage } = useAppStore();
    const { i18n } = useTranslation();
    const { token: antdToken } = theme.useToken();

    const [activeTab, setActiveTab] = useState('password');

    // 检测 URL 中的 token（微信/GitHub 回调）- 使用 location.search 确保 URL 变化时重新执行
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const accessToken = params.get('access_token');
        const username = params.get('username');
        const error = params.get('error');

        if (error) {
            message.error(t('auth.socialLoginFailed') + ': ' + error);
            // 清理 URL
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }

        if (accessToken) {
            message.success(`${t('auth.loginSuccess')} ${username || 'User'}`);
            setToken(accessToken);
            setCurrentUser(username || 'User');
            // 清理 URL
            window.history.replaceState({}, '', window.location.pathname);
            navigate('/v1/dashboard');
        }
    }, [location.search]);

    const loginMutation = useMutation({
        mutationFn: login,
        onSuccess: (data: any) => {
            const username = data.username || 'User';
            message.success(`${t('auth.loginSuccess')} ${username}`);
            setToken(data.access);
            setCurrentUser(username);
            navigate('/v1/dashboard');
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || t('auth.loginError');
            message.error(errorMsg);
        }
    });

    const ldapLoginMutation = useMutation({
        mutationFn: ({ username, password }: { username: string; password: string }) => ldapLogin(username, password),
        onSuccess: (data: any) => {
            const username = data.username || 'User';
            message.success(`${t('auth.loginSuccess')} ${username}`);
            setToken(data.access);
            setCurrentUser(username);
            navigate('/v1/dashboard');
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || t('auth.loginError');
            message.error(errorMsg);
        }
    });

    const handleGithubLogin = () => {
        // GitHub OAuth 跳转
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        if (!clientId) {
            message.warning(t('auth.githubNotConfigured'));
            return;
        }
        // 回调地址：GitHub 授权后重定向到后端，后端再重定向回前端登录页
        const backendCallback = encodeURIComponent(`${window.location.origin}/api/v1/auth/social/github/callback/?redirect_uri=${window.location.origin}/login`);
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${backendCallback}&scope=read:user`;
    };

    const handleWechatLogin = () => {
        // 微信网页应用扫码登录
        const appid = import.meta.env.VITE_WECHAT_APPID;
        if (!appid) {
            message.warning(t('auth.wechatNotConfigured'));
            return;
        }
        // 回调地址：微信授权后重定向到后端，后端再重定向回前端登录页
        const redirectUri = encodeURIComponent(`${window.location.origin}/api/v1/auth/social/wechat/callback/?redirect_uri=${window.location.origin}/login`);
        window.location.href = `https://open.weixin.qq.com/connect/qrconnect?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login`;
    };

    const onFinish = (values: any) => {
        loginMutation.mutate(values);
    };

    const onLdapFinish = (values: any) => {
        ldapLoginMutation.mutate(values);
    };

    const tabItems = [
        {
            key: 'password',
            label: t('auth.passwordLogin'),
            children: (
                <Form
                    name="login"
                    layout="vertical"
                    size="large"
                    onFinish={onFinish}
                    autoComplete="off"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: t('auth.username') + ' ' + t('common.required') }]}
                    >
                        <Input
                            prefix={<UserOutlined className="text-gray-400" />}
                            placeholder={t('auth.username')}
                            className="rounded-lg"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: t('auth.password') + ' ' + t('common.required') }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined className="text-gray-400" />}
                            placeholder={t('auth.password')}
                            className="rounded-lg"
                        />
                    </Form.Item>

                    <Form.Item className="mt-8">
                        <Button
                            type="primary"
                            htmlType="submit"
                            block
                            className="h-12 rounded-lg font-bold"
                            loading={loginMutation.isPending}
                        >
                            {t('auth.login')}
                        </Button>
                    </Form.Item>
                </Form>
            ),
        },
        {
            key: 'ldap',
            label: t('auth.ldapLogin'),
            children: (
                <Form
                    name="ldapLogin"
                    layout="vertical"
                    size="large"
                    onFinish={onLdapFinish}
                    autoComplete="off"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: t('auth.username') + ' ' + t('common.required') }]}
                    >
                        <Input
                            prefix={<UserOutlined className="text-gray-400" />}
                            placeholder={t('auth.ldapUsername')}
                            className="rounded-lg"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: t('auth.password') + ' ' + t('common.required') }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined className="text-gray-400" />}
                            placeholder={t('auth.password')}
                            className="rounded-lg"
                        />
                    </Form.Item>

                    <Form.Item className="mt-8">
                        <Button
                            type="primary"
                            htmlType="submit"
                            block
                            className="h-12 rounded-lg font-bold"
                            loading={ldapLoginMutation.isPending}
                        >
                            {t('auth.login')}
                        </Button>
                    </Form.Item>
                </Form>
            ),
        },
    ];

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
            style={{ background: isDark ? '#000' : '#f0f2f5' }}>

            <div className="absolute top-8 right-8 z-50">
                <Space>
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
                    <Button
                        type="text"
                        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                        onClick={() => setIsDark(!isDark)}
                        className="w-10 h-10 flex items-center justify-center rounded-full glass-effect border-none text-lg"
                        style={{ color: antdToken.colorText }}
                    />
                </Space>
            </div>

            {/* 动态背景装饰 */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-20 blur-[120px]"
                style={{ backgroundColor: antdToken.colorPrimary }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-20 blur-[120px]"
                style={{ backgroundColor: antdToken.colorPrimary }} />

            <Card className="w-full max-w-md shadow-2xl glass-effect border-none"
                styles={{ body: { padding: '40px 32px' } }}>
                <div className="text-center mb-6">
                    <Title level={2} className="mb-2">AnsFlow</Title>
                    <Text type="secondary">{t('auth.subtitle')}</Text>
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    centered
                />

                <Divider plain className="text-xs text-gray-400">{t('auth.or')}</Divider>

                <div className="flex justify-center gap-4">
                    <Button
                        icon={<GithubOutlined />}
                        onClick={handleGithubLogin}
                        size="large"
                        className="flex items-center justify-center"
                    >
                        {t('auth.github')}
                    </Button>
                    <Button
                        icon={<WechatOutlined />}
                        onClick={handleWechatLogin}
                        size="large"
                        className="flex items-center justify-center"
                    >
                        {t('auth.wechat')}
                    </Button>
                </div>

                <div className="text-center mt-6">
                    <Text type="secondary" className="text-xs">
                        {t('auth.footer')}
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default LoginPage;
