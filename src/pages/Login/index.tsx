import React from 'react';
import { Form, Input, Button, Card, Typography, App, theme } from 'antd';
import { UserOutlined, LockOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { login } from '../../api/auth';
import useAppStore from '../../store/useAppStore';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { message } = App.useApp();
    const { setToken, isDark, setCurrentUser, setIsDark } = useAppStore();
    const { token: antdToken } = theme.useToken();

    const loginMutation = useMutation({
        mutationFn: login,
        onSuccess: (data: any) => {
            const username = data.username || '用户';
            message.success(`登录成功！欢迎回来 ${username}`);
            setToken(data.access); // 存储 Token
            setCurrentUser(username); // 存储用户信息
            navigate('/v1/dashboard'); // 登录成功后跳转
        },
        onError: (error: any) => {
            const errorMsg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || '用户名或密码错误';
            message.error(errorMsg);
        }   
    });

    const onFinish = (values: any) => {
        loginMutation.mutate(values);
    };

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
                <div className="text-center mb-10">
                    <Title level={2} className="mb-2">AnsFlow</Title>
                    <Text type="secondary">基于 Django & React 的自动化运维平台</Text>
                </div>

                <Form
                    name="login"
                    layout="vertical"
                    size="large"
                    onFinish={onFinish}
                    autoComplete="off"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: '请输入用户名' }]}
                    >
                        <Input
                            prefix={<UserOutlined className="text-gray-400" />}
                            placeholder="用户名"
                            className="rounded-lg"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined className="text-gray-400" />}
                            placeholder="密码"
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
                            登录
                        </Button>
                    </Form.Item>
                </Form>

                <div className="text-center mt-6">
                    <Text type="secondary" className="text-xs">
                        ©2024 AnsFlow Intelligent System. All Rights Reserved.
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default LoginPage;