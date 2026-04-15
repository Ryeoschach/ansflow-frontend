import React, { useState } from "react";
import {
    Button,
    Card,
    Table,
    Form,
    Modal,
    Input,
    Select,
    Tag,
    Popconfirm,
    Space,
    Typography,
    App,
    Tooltip,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCredentials, createCredential, updateCredential, deleteCredential, verifyCredential } from "../../api/hosts.ts";
import useAppStore from "../../store/useAppStore.ts";
import { DeleteOutlined, EditOutlined, PlusOutlined, LockOutlined, UserOutlined, CheckCircleOutlined } from "@ant-design/icons";
import {TableSkeleton} from "../../components/Skeletons";
import { useBreakpoint } from '@/utils/useBreakpoint';

const { Text } = Typography;

const CredentialManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { hasPermission } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [testForm] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [editingCredential, setEditingCredential] = useState<any>(null);
    const [testingId, setTestingId] = useState<number | null>(null);

    // 1. 获取凭据列表
    const { data: credData, isLoading } = useQuery({
        queryKey: ['ssh-credentials'],
        queryFn: () => getCredentials({ page: 1, size: 100 }),
    });

    // 2. 创建凭据
    const createMutation = useMutation({
        mutationFn: createCredential,
        onSuccess: () => {
            message.success("凭据创建成功");
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ssh-credentials'] });
        },
    });

    // 3. 更新凭据
    const updateMutation = useMutation({
        mutationFn: (vars: { id: number, data: any }) => updateCredential(vars.id, vars.data),
        onSuccess: () => {
            message.success("凭据更新成功");
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ssh-credentials'] });
        },
    });

    // 4. 删除凭据
    const deleteMutation = useMutation({
        mutationFn: deleteCredential,
        onSuccess: () => {
            message.success("凭据已删除");
            queryClient.invalidateQueries({ queryKey: ['ssh-credentials'] });
        },
    });

    // 5. 验证凭据
    const verifyMutation = useMutation({
        mutationFn: (vars: { id: number, data: any }) => verifyCredential(vars.id, vars.data),
        onSuccess: (res: any) => {
            if (res.status === 'success') {
                message.success(res.message);
                setIsTestModalOpen(false);
            } else {
                message.error(res.message);
            }
        },
        onError: (err: any) => {
            message.error("请求失败: " + (err.response?.data?.error || err.message));
        }
    });

    const handleEdit = (record: any) => {
        setEditingCredential(record);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingCredential(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const handleTest = (record: any) => {
        setTestingId(record.id);
        testForm.resetFields();
        setIsTestModalOpen(true);
    };

    const columns = [
        {
            title: '凭据名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: '用户名',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: '认证方式',
            dataIndex: 'auth_type',
            key: 'auth_type',
            render: (val: string) => (
                val === 'password' ? <Tag color="blue">账号密码</Tag> : <Tag color="purple">SSH 密钥</Tag>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="测试连通性">
                        <Button
                            type="text"
                            icon={<CheckCircleOutlined />}
                            onClick={() => handleTest(record)}
                        />
                    </Tooltip>
                    {(hasPermission('*') || hasPermission('resource:ssh_credentials:update')) && (
                        <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    )}
                    {(hasPermission('*') || hasPermission('resource:ssh_credentials:delete')) && (
                        <Popconfirm
                            title="确定要删除该凭据吗？"
                            onConfirm={() => deleteMutation.mutate(record.id)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card title="SSH 登录凭据管理" extra={
            (hasPermission('*') || hasPermission('resource:ssh_credentials:add')) && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增凭据</Button>
            )
        }>
            {isLoading ? (
                <TableSkeleton /> // 加载时显示骨架
            ) : (
            <Table
                dataSource={credData?.data}
                columns={columns}
                rowKey="id"
                loading={isLoading}
                scroll={{ x: 1200 }}
                pagination={{ pageSize: 10 }}
            />
                )}

            <Modal
                title="验证凭据连通性"
                open={isTestModalOpen}
                forceRender
                onCancel={() => setIsTestModalOpen(false)}
                onOk={() => testForm.submit()}
                confirmLoading={verifyMutation.isPending}
                destroyOnHidden
            >
                <Form
                    form={testForm}
                    layout="vertical"
                    className="mt-4"
                    initialValues={{ host: 'localhost', port: 22 }}
                    onFinish={(values) => {
                        if (testingId) {
                            verifyMutation.mutate({ id: testingId, data: values });
                        }
                    }}
                >
                    <Form.Item label="测试目标主机 IP" name="host" rules={[{ required: true, message: '请输入目标主机 IP' }]}>
                        <Input placeholder="例如: 127.0.0.1" />
                    </Form.Item>
                    <Form.Item label="端口" name="port">
                        <Input placeholder="22" />
                    </Form.Item>
                    <Text type="secondary">我们将尝试使用当前凭据通过 SSH 连接到该主机以验证其有效性。</Text>
                </Form>
            </Modal>

            <Modal
                title={editingCredential ? "编辑凭据" : "新增凭据"}
                open={isModalOpen}
                forceRender
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={isMobile ? '95vw' : 600}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    onFinish={(values) => {
                        if (editingCredential) {
                            updateMutation.mutate({ id: editingCredential.id, data: values });
                        } else {
                            createMutation.mutate(values);
                        }
                    }}
                    initialValues={{ auth_type: 'password', username: 'root' }}
                >
                    <Form.Item label="凭据名称" name="name" rules={[{ required: true, message: '请输入凭据名称' }]}>
                        <Input placeholder="例: Aliyun-Root-Password" />
                    </Form.Item>

                    <div className="flex flex-col md:flex-row gap-4">
                        <Form.Item label="用户名" name="username" className="flex-1" rules={[{ required: true, message: '请输入用户名' }]}>
                            <Input prefix={<UserOutlined />} />
                        </Form.Item>
                        <Form.Item label="认证方式" name="auth_type" className="flex-1" rules={[{ required: true }]}>
                            <Select options={[
                                { label: '账号密码', value: 'password' },
                                { label: 'SSH 密钥', value: 'key' },
                            ]} />
                        </Form.Item>
                    </div>

                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.auth_type !== curr.auth_type}>
                        {({ getFieldValue }) => (
                            getFieldValue('auth_type') === 'password' ? (
                                <Form.Item label="密码" name="password" rules={[{ required: !editingCredential, message: '请输入密码' }]}>
                                    <Input.Password prefix={<LockOutlined />} placeholder="请输入 SSH 登录密码" />
                                </Form.Item>
                            ) : (
                                <>
                                    <Form.Item label="私钥内容" name="private_key" rules={[{ required: !editingCredential, message: '请输入私钥内容' }]}>
                                        <Input.TextArea
                                            rows={8}
                                            placeholder="-----BEGIN RSA PRIVATE KEY-----"
                                            className="font-mono text-xs"
                                        />
                                    </Form.Item>
                                    <Form.Item label="私钥密码 (Passphrase)" name="passphrase">
                                        <Input.Password placeholder="如果没有则不填" />
                                    </Form.Item>
                                </>
                            )
                        )}
                    </Form.Item>
                    <Form.Item label="备注" name="remark">
                        <Input.TextArea />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default CredentialManagement;
