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
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const CredentialManagement: React.FC = () => {
    const { t } = useTranslation();
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
    const [authType, setAuthType] = useState<'password' | 'key'>('password');

    const { data: credData, isLoading } = useQuery({
        queryKey: ['ssh-credentials'],
        queryFn: () => getCredentials({ page: 1, size: 100 }),
    });

    const createMutation = useMutation({
        mutationFn: createCredential,
        onSuccess: () => {
            message.success(t('credential.createSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ssh-credentials'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (vars: { id: number, data: any }) => updateCredential(vars.id, vars.data),
        onSuccess: () => {
            message.success(t('credential.updateSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ssh-credentials'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCredential,
        onSuccess: () => {
            message.success(t('credential.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['ssh-credentials'] });
        },
    });

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
            message.error(t('credential.verifyFailed') + ": " + (err.response?.data?.error || err.message));
        }
    });

    const handleEdit = (record: any) => {
        setEditingCredential(record);
        setAuthType(record.auth_type || 'password');
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingCredential(null);
        form.resetFields();
        setAuthType('password');
        setIsModalOpen(true);
    };

    const handleTest = (record: any) => {
        setTestingId(record.id);
        testForm.resetFields();
        setIsTestModalOpen(true);
    };

    const columns = [
        {
            title: t('credential.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: t('credential.username'),
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: t('credential.authType'),
            dataIndex: 'auth_type',
            key: 'auth_type',
            render: (val: string) => (
                val === 'password' ? <Tag color="blue">{t('credential.password')}</Tag> : <Tag color="purple">{t('credential.sshKey')}</Tag>
            ),
        },
        {
            title: t('dashboard.createTime'),
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: t('pipeline.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title={t('credential.testConnectivity')}>
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
                            title={t('credential.confirmDeleteCredential')}
                            onConfirm={() => deleteMutation.mutate(record.id)}
                            okText={t('credential.confirmDelete')}
                            cancelText={t('credential.cancel')}
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card title={t('credential.title')} extra={
            (hasPermission('*') || hasPermission('resource:ssh_credentials:add')) && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('credential.createCredential')}</Button>
            )
        }>
            {isLoading ? (
                <TableSkeleton />
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
                title={t('credential.verifyCredential')}
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
                    <Form.Item label={t('credential.testHostIp')} name="host" rules={[{ required: true, message: t('credential.testHostIpPlaceholder') }]}>
                        <Input placeholder={t('credential.testHostIpPlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('credential.port')} name="port">
                        <Input placeholder="22" />
                    </Form.Item>
                    <Text type="secondary">{t('credential.testDescription')}</Text>
                </Form>
            </Modal>

            <Modal
                title={editingCredential ? t('credential.editCredential') : t('credential.createCredential')}
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
                        const data = { ...values, description: values.remark };
                        if (editingCredential) {
                            updateMutation.mutate({ id: editingCredential.id, data });
                        } else {
                            createMutation.mutate(data);
                        }
                    }}
                    initialValues={{ auth_type: 'password', username: 'root' }}
                >
                    <Form.Item label={t('credential.name')} name="name" rules={[{ required: true, message: t('credential.nameRequired') }]}>
                        <Input placeholder={t('credential.namePlaceholder')} />
                    </Form.Item>

                    <div className="flex flex-col md:flex-row gap-4">
                        <Form.Item label={t('credential.username')} name="username" className="flex-1" rules={[{ required: true, message: t('credential.usernameRequired') }]}>
                            <Input prefix={<UserOutlined />} />
                        </Form.Item>
                        <Form.Item label={t('credential.authType')} name="auth_type" className="flex-1" rules={[{ required: true }]}>
                            <Select
                                options={[
                                    { label: t('credential.password'), value: 'password' },
                                    { label: t('credential.sshKey'), value: 'key' },
                                ]}
                                onChange={(val) => setAuthType(val)}
                            />
                        </Form.Item>
                    </div>

                    {authType === 'password' ? (
                        <Form.Item label={t('credential.password')} name="password" rules={[{ required: !editingCredential, message: t('credential.passwordRequired') }]}>
                            <Input.Password prefix={<LockOutlined />} placeholder={t('credential.passwordPlaceholder')} />
                        </Form.Item>
                    ) : (
                        <>
                            <Form.Item label={t('credential.privateKey')} name="private_key" rules={[{ required: !editingCredential, message: t('credential.privateKeyRequired') }]}>
                                <Input.TextArea
                                    rows={8}
                                    placeholder={t('credential.privateKeyPlaceholder')}
                                    className="font-mono text-xs"
                                />
                            </Form.Item>
                            <Form.Item label={t('credential.passphrase')} name="passphrase">
                                <Input.Password placeholder={t('credential.passphrasePlaceholder')} />
                            </Form.Item>
                        </>
                    )}
                    <Form.Item label={t('credential.remark')} name="remark">
                        <Input.TextArea />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default CredentialManagement;
