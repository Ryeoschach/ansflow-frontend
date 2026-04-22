import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App, theme, Tabs, Divider, Modal } from 'antd';
import { UserOutlined, LockOutlined, SunOutlined, MoonOutlined, GithubOutlined, WechatOutlined, LinkedinOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login, ldapLogin } from '../../api/auth';
import useAppStore from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { message } = App.useApp();
    const { setToken, isDark, setCurrentUser, setIsDark } = useAppStore();
    const { token: antdToken } = theme.useToken();

    const [activeTab, setActiveTab] = useState('password');
    const [isLdapModalOpen, setIsLdapModalOpen] = useState(false);

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
        const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || 'your_github_client_id';
        const redirectUri = encodeURIComponent(import.meta.env.VITE_GITHUB_REDIRECT_URI || `${window.location.origin}/login`);
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user`;
    };

    const handleWechatLogin = () => {
        // 微信 OAuth 跳转 - 需要后端提供授权地址
        // 这里假设后端提供了获取微信授权链接的接口
        Modal.info({
            title: t('auth.wechatLoginTip'),
            content: (
                <div className="py-4">
                    <p>{t('auth.wechatLoginTipContent')}</p>
                </div>
            ),
        });
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
                <Button
                    type="text"
                    icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                    onClick={() => setIsDark(!isDark)}
                    className="w-10 h-10 flex items-center justify-center rounded-full glass-effect border-none text-lg"
                    style={{ color: antdToken.colorText }}
                />
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
