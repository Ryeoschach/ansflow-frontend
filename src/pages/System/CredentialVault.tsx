import React, { useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, App, Typography, Card, Tooltip, theme } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  LockOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCredentials, createCredential, updateCredential, deleteCredential } from '../../api/credential';
import useCredentialStore from '../../store/useCredentialStore';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';

const { Text, Title } = Typography;

/**
 * @name CredentialVault
 * @description 安全凭据保险库。负责中心化加密存储 SSH 密钥、API Token 及账号密码。
 */
const CredentialVault: React.FC = () => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    const { token: authToken, hasPermission } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();

    // Zustand 状态：持久化 UI 偏好
    const { maskSensitiveData, setMaskSensitiveData, filterAuthType, setFilterAuthType } = useCredentialStore();

    // 局部 UI 状态
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);

    /** @description 获取凭据列表 */
    const { data: credData, isLoading } = useQuery({
        queryKey: ['credentials', filterAuthType],
        queryFn: () => getCredentials({ type: filterAuthType === 'all' ? undefined : filterAuthType }),
        enabled: !!authToken && hasPermission('system:credential:view'),
    });

    /** @description 凭据持久化指令 */
    const mutation = useMutation({
        mutationFn: (values: any) => {
            const payload = { ...values };
            // 根据 auth_type 将前端单一的 secret_value 分发到后端的正确字段
            if (payload.secret_value) {
                if (payload.auth_type === 'password' || payload.auth_type === 'login_pass') {
                    payload.password = payload.secret_value;
                } else {
                    payload.private_key = payload.secret_value;
                }
            }
            delete payload.secret_value;
            
            return editingRecord 
                ? updateCredential(editingRecord.id, payload) 
                : createCredential(payload);
        },
        onSuccess: () => {
            message.success(editingRecord ? t('credentialVault.updateSuccess') : t('credentialVault.createSuccess'));
            setIsModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        },
        onError: (e: any) => message.error(t('credentialVault.deleteError', { error: e.response?.data?.detail || e.message }))
    });

    /** @description 凭据销毁指令 */
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCredential(id),
        onSuccess: () => {
            message.success(t('credentialVault.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        }
    });

    const handleOpenModal = (record?: any) => {
        setEditingRecord(record || null);
        if (record) {
            form.setFieldsValue({
                ...record,
                secret_value: '' // 编辑时强制清空明文输入框
            });
        } else {
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const handleDelete = (record: any) => {
        modal.confirm({
            title: t('credentialVault.deleteConfirmTitle'),
            icon: <DeleteOutlined className="text-red-500" />,
            content: t('credentialVault.deleteConfirmContent'),
            okText: t('credentialVault.deleteConfirmOkText'),
            okType: 'danger',
            onOk: () => deleteMutation.mutate(record.id)
        });
    };

    const columns = [
        {
            title: t('credentialVault.columnName'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (text: string) => (
                <Space>
                    <SafetyCertificateOutlined style={{ color: token.colorPrimary }} />
                    <Text strong>{text}</Text>
                </Space>
            )
        },
        {
            title: t('credentialVault.columnType'),
            key: 'type',
            render: (_: any, record: any) => {
                const typeValue = record.auth_type || record.type;
                const map: any = {
                    'key': { color: 'purple', icon: <KeyOutlined />, text: t('credentialVault.typeSshKey') },
                    'ssh_key': { color: 'purple', icon: <KeyOutlined />, text: t('credentialVault.typeSshKey') },
                    'password': { color: 'blue', icon: <LockOutlined />, text: t('credentialVault.typePassword') },
                    'login_pass': { color: 'blue', icon: <LockOutlined />, text: t('credentialVault.typePassword') },
                    'token': { color: 'orange', icon: <InfoCircleOutlined />, text: t('credentialVault.typeToken') },
                    'file': { color: 'cyan', icon: <FileTextOutlined />, text: t('credentialVault.typeFile') },
                };
                const conf = map[typeValue] || { color: 'default', icon: <KeyOutlined />, text: typeValue };
                return <Tag color={conf.color} icon={conf.icon} className="rounded-full px-3">{conf.text}</Tag>;
            }
        },
        {
            title: t('credentialVault.columnUsername'),
            dataIndex: 'username',
            key: 'username',
            ellipsis: true,
            render: (val: string) => {
                if (!val) return <Text type="secondary">-</Text>;
                return maskSensitiveData ? <span className="opacity-30 tracking-widest text-[8px]">********</span> : <Text code>{val}</Text>;
            }
        },
        {
            title: t('credentialVault.columnUpdateTime'),
            dataIndex: 'update_time',
            key: 'update_time',
            render: (timeStr: string) => <Text type="secondary" className="text-xs dark:text-slate-500">{timeStr ? new Date(timeStr).toLocaleString() : '-'}</Text>
        },
        {
            title: t('credentialVault.columnAction'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle" className="pr-4">
                    {hasPermission('system:credential:edit') && (
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined style={{ color: token.colorPrimary }} />}
                        onClick={() => handleOpenModal(record)}
                        className="p-0 font-medium"
                        style={{ color: token.colorPrimary }}
                    >
                        {t('credentialVault.edit')}
                    </Button>
                    )}
                    {hasPermission('system:credential:delete') && (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} className="p-0 font-medium">{t('credentialVault.destroy')}</Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{ background: token.colorBgLayout }} className="p-7 min-h-screen flex flex-col antialiased">
            <div className="flex items-center justify-between mb-8 px-1">
                <Space size="large">
                    <div
                      style={{ background: token.colorPrimary }}
                      className="p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-500/20 items-center justify-center flex"
                    >
                        <LockOutlined className="text-2xl" />
                    </div>
                    <div>
                        <Title level={4} style={{ margin: 0 }}>{t('credentialVault.title')}</Title>
                        <Text type="secondary" className="text-xs">{t('credentialVault.subtitle')}</Text>
                    </div>
                </Space>

                <Space size="middle">
                    <Select
                        className="w-40 custom-select-premium"
                        value={filterAuthType}
                        onChange={setFilterAuthType}
                        options={[
                            { label: t('credentialVault.filterAll'), value: 'all' },
                            { label: t('credentialVault.filterSshKey'), value: 'ssh_key' },
                            { label: t('credentialVault.filterPassword'), value: 'login_pass' },
                            { label: t('credentialVault.filterToken'), value: 'token' },
                        ]}
                        popupClassName="rounded-xl shadow-xl border-slate-100 dark:border-slate-700"
                    />
                    <Button
                        icon={maskSensitiveData ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => setMaskSensitiveData(!maskSensitiveData)}
                        className="h-10 rounded-xl px-5 border-slate-200 transition-all font-medium"
                    >
                        {maskSensitiveData ? t('credentialVault.unmask') : t('credentialVault.applyMask')}
                    </Button>
                    {hasPermission('system:credential:add') && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="h-10 px-6 rounded-xl shadow-lg shadow-indigo-500/30">
                        {t('credentialVault.addCredential')}
                    </Button>
                    )}
                </Space>
            </div>

            <Card bordered={false} className="shadow-sm rounded-2xl border-none flex-1 overflow-hidden" bodyStyle={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Table 
                    columns={columns} 
                    dataSource={credData?.data || []}
                    rowKey="id" 
                    loading={isLoading}
                    pagination={{ showSizeChanger: true, className: "px-6 py-4" }}
                    className="custom-table-modern"
                    scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
                   
                />
            </Card>

            <Modal
                title={
                    <Space size="middle" className="pt-2">
                        <SafetyCertificateOutlined style={{ color: token.colorPrimary }} />
                        <Text strong style={{ fontSize: '16px' }}>{editingRecord ? t('credentialVault.modalTitleEdit') : t('credentialVault.modalTitleCreate')}</Text>
                    </Space>
                }
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
                confirmLoading={mutation.isPending}
                width={isMobile ? '95vw' : 550}
                bodyStyle={{ overflowX: 'auto' }}
                centered
                className="custom-modal-premium"
                okText={t('credentialVault.okText')}
            >
                <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} className="pt-6 px-1">
                    <Card size="small" style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary }} className="rounded-xl mb-6 shadow-none">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>{t('credentialVault.fieldAlias')}</Text>} name="name" rules={[{ required: true, message: t('credentialVault.fieldAliasRequired') }]}>
                                <Input placeholder={t('credentialVault.fieldAliasPlaceholder')} className="rounded-lg h-10" />
                            </Form.Item>
                            <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>{t('credentialVault.fieldType')}</Text>} name="auth_type" rules={[{ required: true }]}>
                                <Select options={[
                                    { label: t('credentialVault.typeSshKey'), value: 'key' },
                                    { label: t('credentialVault.typePassword'), value: 'password' },
                                    { label: t('credentialVault.typeToken'), value: 'token' },
                                    { label: t('credentialVault.typeFile'), value: 'file' },
                                ]} className="h-10 custom-select-premium" />
                            </Form.Item>
                        </div>
                    </Card>

                    <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>{t('credentialVault.fieldUsername')}</Text>} name="username">
                        <Input placeholder={t('credentialVault.fieldUsernamePlaceholder')} className="rounded-lg h-10" />
                    </Form.Item>

                    <Form.Item
                        label={
                            <Space>
                                <Text strong type="secondary" style={{ fontSize: '12px' }}>{editingRecord ? t('credentialVault.fieldSecretEdit') : t('credentialVault.fieldSecret')}</Text>
                                <Tooltip title={t('credentialVault.fieldSecretTip')}>
                                    <InfoCircleOutlined className="text-slate-400" />
                                </Tooltip>
                            </Space>
                        }
                        name="secret_value"
                        rules={[{ required: !editingRecord, message: t('credentialVault.fieldSecretRequired') }]}
                        extra={<Text type="secondary" style={{ fontSize: '10px' }} className="opacity-60 font-mono">{t('credentialVault.fieldSecretExtra')}</Text>}
                    >
                        <Input.TextArea rows={5} className="font-mono text-[11px] rounded-lg p-3" placeholder="Paste your secrets here..." />
                    </Form.Item>

                    <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>{t('credentialVault.fieldRemark')}</Text>} name="remark" className="mb-0">
                        <Input placeholder={t('credentialVault.fieldRemarkPlaceholder')} className="rounded-lg h-10" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default CredentialVault;
