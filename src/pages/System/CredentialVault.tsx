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
import { getCredentials, createCredential, updateCredential, deleteCredential } from '../../api/credential';
import useCredentialStore from '../../store/useCredentialStore';
import useAppStore from '../../store/useAppStore';

const { Text, Title } = Typography;

/**
 * @name CredentialVault
 * @description 安全凭据保险库。负责中心化加密存储 SSH 密钥、API Token 及账号密码。
 */
const CredentialVault: React.FC = () => {
    const { token } = theme.useToken();
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    const { token: authToken, hasPermission } = useAppStore();
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
        mutationFn: (values: any) => editingRecord 
            ? updateCredential(editingRecord.id, values) 
            : createCredential(values),
        onSuccess: () => {
            message.success(editingRecord ? '凭据加密信息已更新' : '新凭据已安全入库');
            setIsModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['credentials'] });
        },
        onError: (e: any) => message.error(`写入失败: ${e.response?.data?.detail || e.message}`)
    });

    /** @description 凭据销毁指令 */
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCredential(id),
        onSuccess: () => {
            message.success('凭据已从加密磁盘彻底抹除');
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
            title: '高危：凭据彻底销毁',
            icon: <DeleteOutlined className="text-red-500" />,
            content: '⚠️ 此操作不可逆！依赖此凭据的项目将立即失去授权。',
            okText: '确认销毁',
            okType: 'danger',
            onOk: () => deleteMutation.mutate(record.id)
        });
    };

    const columns = [
        {
            title: '凭据标识',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => (
                <Space>
                    <SafetyCertificateOutlined style={{ color: token.colorPrimary }} />
                    <Text strong>{text}</Text>
                </Space>
            )
        },
        {
            title: '类型',
            key: 'type',
            render: (_: any, record: any) => {
                const typeValue = record.type || record.auth_type;
                const map: any = {
                    'ssh_key': { color: 'purple', icon: <KeyOutlined />, text: 'SSH 私钥' },
                    'login_pass': { color: 'blue', icon: <LockOutlined />, text: '账号密码' },
                    'token': { color: 'orange', icon: <InfoCircleOutlined />, text: 'API Token' },
                    'file': { color: 'cyan', icon: <FileTextOutlined />, text: '证书文件' },
                };
                const conf = map[typeValue] || { color: 'default', text: typeValue };
                return <Tag color={conf.color} icon={conf.icon} className="rounded-full px-3">{conf.text}</Tag>;
            }
        },
        {
            title: '关联账号',
            dataIndex: 'username',
            key: 'username',
            render: (val: string) => {
                if (!val) return <Text type="secondary">-</Text>;
                return maskSensitiveData ? <span className="opacity-30 tracking-widest text-[8px]">********</span> : <Text code>{val}</Text>;
            }
        },
        {
            title: '更新记录',
            dataIndex: 'update_time',
            key: 'update_time',
            render: (t: string) => <Text type="secondary" className="text-xs dark:text-slate-500">{t ? new Date(t).toLocaleString() : '-'}</Text>
        },
        {
            title: '操作',
            key: 'action',
            width: 160,
            fixed: 'right' as any,
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
                        编辑
                    </Button>
                    )}
                    {hasPermission('system:credential:delete') && (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} className="p-0 font-medium">销毁</Button>
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
                        <Title level={4} style={{ margin: 0 }}>安全凭据核心</Title>
                        <Text type="secondary" className="text-xs">基于加密信封的高安全级别身份资产管理</Text>
                    </div>
                </Space>

                <Space size="middle">
                    <Select 
                        className="w-40 custom-select-premium"
                        value={filterAuthType}
                        onChange={setFilterAuthType}
                        options={[
                            { label: '全部类型', value: 'all' },
                            { label: 'SSH 密钥', value: 'ssh_key' },
                            { label: '账号密码', value: 'login_pass' },
                            { label: 'API Token', value: 'token' },
                        ]}
                        popupClassName="rounded-xl shadow-xl border-slate-100 dark:border-slate-700"
                    />
                    <Button 
                        icon={maskSensitiveData ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => setMaskSensitiveData(!maskSensitiveData)}
                        className="h-10 rounded-xl px-5 border-slate-200 transition-all font-medium"
                    >
                        {maskSensitiveData ? '解开遮罩' : '应用遮罩'}
                    </Button>
                    {hasPermission('system:credential:add') && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} className="h-10 px-6 rounded-xl shadow-lg shadow-indigo-500/30">
                        新增凭据
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
                    scroll={{ x: 1000, y: 'calc(100vh - 380px)' }}
                />
            </Card>

            <Modal
                title={
                    <Space size="middle" className="pt-2">
                        <SafetyCertificateOutlined style={{ color: token.colorPrimary }} />
                        <Text strong style={{ fontSize: '16px' }}>{editingRecord ? "敏感凭据重配置" : "存入全新敏感凭据"}</Text>
                    </Space>
                }
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
                confirmLoading={mutation.isPending}
                width={550}
                centered
                className="custom-modal-premium"
                okText="安全入库"
            >
                <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} className="pt-6 px-1">
                    <Card size="small" style={{ background: token.colorBgLayout, borderColor: token.colorBorderSecondary }} className="rounded-xl mb-6 shadow-none">
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>凭据别名</Text>} name="name" rules={[{ required: true, message: '请输入标识名称' }]}>
                                <Input placeholder="如: PROD-KEY" className="rounded-lg h-10" />
                            </Form.Item>
                            <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>凭据类型</Text>} name="type" rules={[{ required: true }]}>
                                <Select options={[
                                    { label: 'SSH 私钥', value: 'ssh_key' },
                                    { label: '用户名密码', value: 'login_pass' },
                                    { label: 'API Token', value: 'token' },
                                    { label: '证书文件', value: 'file' },
                                ]} className="h-10 custom-select-premium" />
                            </Form.Item>
                        </div>
                    </Card>

                    <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>账号/Key ID</Text>} name="username">
                        <Input placeholder="Username / Client ID" className="rounded-lg h-10" />
                    </Form.Item>

                    <Form.Item 
                        label={
                            <Space>
                                <Text strong type="secondary" style={{ fontSize: '12px' }}>{editingRecord ? "更新密文" : "内容原文"}</Text>
                                <Tooltip title="基于业界标准算法加密">
                                    <InfoCircleOutlined className="text-slate-400" />
                                </Tooltip>
                            </Space>
                        } 
                        name="secret_value" 
                        rules={[{ required: !editingRecord, message: '录入凭据时必须填写原文' }]}
                        extra={<Text type="secondary" style={{ fontSize: '10px' }} className="opacity-60 font-mono">加密层将对输入内容执行分片存储</Text>}
                    >
                        <Input.TextArea rows={5} className="font-mono text-[11px] rounded-lg p-3" placeholder="Paste your secrets here..." />
                    </Form.Item>

                    <Form.Item label={<Text strong type="secondary" style={{ fontSize: '12px' }}>用途备注</Text>} name="description" className="mb-0">
                        <Input placeholder="记录适用范围..." className="rounded-lg h-10" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default CredentialVault;
