import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Space, Button, theme, Select, Drawer, Descriptions, Badge, Modal, Input, App, Tooltip, Tabs, Timeline, Form, Switch, Popconfirm, List, Avatar, Alert, Divider } from 'antd';
const { Text } = Typography;
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, EyeOutlined, PlusOutlined, DeleteOutlined, EditOutlined, SafetyCertificateOutlined, UserOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
    getApprovalTickets, approveTicket, rejectTicket, 
    getApprovalTemplates,
    getApprovalPolicies, createApprovalPolicy, updateApprovalPolicy, deleteApprovalPolicy,
    ApprovalTicket, ApprovalPolicy, ResourceTemplate 
} from '../../api/approval';
import { getRoles } from '../../api/rbac';
import useAppStore from '../../store/useAppStore';

const STATUS_MAP = (t: (key: string) => string) => ({
    'pending': { color: 'colorWarning', text: t('approval.statusPending'), status: 'processing' },
    'approved': { color: 'colorSuccess', text: t('approval.statusApproved'), status: 'success' },
    'rejected': { color: 'colorError', text: t('approval.statusRejected'), status: 'error' },
    'canceled': { color: 'colorTextSecondary', text: t('approval.statusCanceled'), status: 'default' },
    'finished': { color: 'colorSuccess', text: t('approval.statusFinished'), status: 'success' },
    'failed': { color: 'colorError', text: t('approval.statusFailed'), status: 'error' },
} as const);

const ApprovalCenter: React.FC = () => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    const { token: authToken, hasPermission } = useAppStore();

    const [activeTab, setActiveTab] = useState('tickets');
    
    // 工单状态
    const [queryParams, setQueryParams] = useState<any>({ page: 1, page_size: 15, status: 'pending', resource_type: '', submitter__username: '' });
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentTicket, setCurrentTicket] = useState<ApprovalTicket | null>(null);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectRemark, setRejectRemark] = useState('');

    // 策略状态
    const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<ApprovalPolicy | null>(null);
    const [policyForm] = Form.useForm();

    const { data: qData, isLoading, refetch } = useQuery({
        queryKey: ['approvalTickets', queryParams],
        queryFn: () => getApprovalTickets(queryParams),
        enabled: !!authToken && hasPermission('system:approval_ticket:view'),
    });

    const { data: templatesData } = useQuery({
        queryKey: ['approvalTemplates'],
        queryFn: () => getApprovalTemplates(),
        enabled: !!authToken && activeTab !== 'tickets',
    });

    const { data: policiesData, refetch: refetchPolicies } = useQuery({
        queryKey: ['approvalPolicies'],
        queryFn: () => getApprovalPolicies({ page_size: 100 }),
        enabled: !!authToken && activeTab === 'policies',
    });

    const { data: rolesData } = useQuery({
        queryKey: ['roles'],
        queryFn: () => getRoles({ page_size: 100 }),
        enabled: !!authToken && isPolicyModalOpen,
    });

    const tickets = (qData as any)?.data || [];
    const total = (qData as any)?.total || 0;

    const approveMutation = useMutation({
        mutationFn: (id: number) => approveTicket(id),
        onSuccess: () => {
            message.success(t('approval.approvedMessage'));
            setDetailVisible(false);
            refetch();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.detail || t('approval.approveError'));
        }
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, remark }: { id: number, remark: string }) => rejectTicket(id, remark),
        onSuccess: () => {
            message.success(t('approval.rejectedMessage'));
            setRejectModalVisible(false);
            setRejectRemark('');
            setDetailVisible(false);
            refetch();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.detail || t('approval.rejectError'));
        }
    });

    const policyMutation = useMutation({
        mutationFn: (values: any) => editingPolicy 
            ? updateApprovalPolicy(editingPolicy.id, values) 
            : createApprovalPolicy(values),
        onSuccess: () => {
            message.success(t('common.success'));
            setIsPolicyModalOpen(false);
            refetchPolicies();
        },
        onError: (err: any) => message.error(err?.response?.data?.detail || err?.message || t('common.error'))
    });

    const deletePolicyMutation = useMutation({
        mutationFn: deleteApprovalPolicy,
        onSuccess: () => {
            message.success(t('common.success'));
            refetchPolicies();
        }
    });

    const handleApprove = (id: number) => {
        modal.confirm({
            title: t('approval.confirmTitle'),
            content: t('approval.confirmContent'),
            onOk: () => approveMutation.mutate(id),
            okText: t('approval.confirmOkText'),
            okType: 'primary'
        });
    };

    const columns = [
        {
            title: t('approval.columnIdResource'),
            dataIndex: 'id',
            key: 'id',
            render: (id: number, record: ApprovalTicket) => (
                <Space direction="vertical" size={2}>
                    <Typography.Text strong>#APP-{id}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        {record.resource_type} {record.target_id ? `(ID:${record.target_id})` : ''}
                    </Typography.Text>
                </Space>
            )
        },
        {
            title: t('approval.columnIntent'),
            key: 'intent',
            render: (_: any, record: ApprovalTicket) => (
                <div>
                    <div>
                        <Tag color={record.method === 'DELETE' ? 'error' : (record.method === 'POST' ? 'success' : 'processing')}>
                            {record.method}
                        </Tag>
                        <span style={{ fontWeight: 500 }}>{record.title}</span>
                    </div>
                    <Tooltip title={record.url_path}>
                        <div style={{ marginTop: '4px', fontSize: '11px', color: token.colorTextTertiary, width: '230px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {record.url_path}
                        </div>
                    </Tooltip>
                </div>
            )
        },
        {
            title: t('approval.columnSubmitter'),
            dataIndex: 'submitter_name',
            key: 'submitter',
            render: (name: string) => (
                <Space>
                    <Avatar size="small" icon={<UserOutlined />} />
                    {name}
                </Space>
            )
        },
        {
            title: t('approval.columnStatus'),
            key: 'status',
            render: (_: any, record: ApprovalTicket) => {
                const map = STATUS_MAP(t)[record.status as keyof ReturnType<typeof STATUS_MAP>] || STATUS_MAP(t)['pending'];
                return (
                    <div>
                        <Badge status={map.status as any} text={<Typography.Text strong style={{ color: (token as any)[map.color] }}>{record.status_display || map.text}</Typography.Text>} />
                        {record.approver_name && (
                            <div style={{ fontSize: '11px', color: token.colorTextQuaternary, marginTop: 4 }}>
                                {t('approval.approverLabel')}: {currentTicket.approver_name}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: t('approval.columnTime'),
            dataIndex: 'create_time',
            key: 'time',
            render: (time: string) => <span style={{ color: token.colorTextSecondary }}>{dayjs(time).format('MM-DD HH:mm:ss')}</span>
        },
        {
            title: t('approval.columnAction'),
            key: 'action',
            render: (_: any, record: ApprovalTicket) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                            setCurrentTicket(record);
                            setDetailVisible(true);
                        }}
                    >
                        {t('approval.reviewPayload')}
                    </Button>
                </Space>
            ),
        },
    ];

    const policyColumns = [
        { title: t('approval.policyName'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
        { title: t('approval.resourceType'), dataIndex: 'resource_type', key: 'resource_type', render: (v: string) => <Tag color="blue">{v}</Tag> },
        { title: t('approval.environment'), dataIndex: 'environment', key: 'environment', render: (v: string) => v ? <Tag color="purple">{v}</Tag> : <Tag color="default">{t('common.all') || '全部'}</Tag> },
        { 
            title: t('approval.approverRoles'), 
            dataIndex: 'approver_roles_detail', 
            key: 'roles',
            render: (roles: any[]) => (
                <Space size={[0, 4]} wrap>
                    {roles?.map(r => <Tag icon={<SafetyCertificateOutlined />} key={r.id}>{r.name}</Tag>)}
                    {(!roles || roles.length === 0) && <Text type="secondary" style={{ fontSize: '12px' }}>{t('approval.anyAdmin')}</Text>}
                </Space>
            )
        },
        { title: t('common.status'), dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? t('common.active') : t('common.inactive')} /> },
        {
            title: t('common.action'),
            key: 'action',
            width: 120,
            render: (_: any, record: ApprovalPolicy) => (
                <Space>
                    {hasPermission('system:approval_policy:edit') && (
                    <Button type="text" icon={<EditOutlined />} onClick={() => {
                        setEditingPolicy(record);
                        policyForm.setFieldsValue({
                            ...record,
                            approver_roles: record.approver_roles || []
                        });
                        setIsPolicyModalOpen(true);
                    }} />
                    )}
                    {hasPermission('system:approval_policy:delete') && (
                    <Popconfirm title={t('common.confirmDelete')} onConfirm={() => deletePolicyMutation.mutate(record.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>{t('approval.title')}</Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                        {t('approval.subtitle')}
                    </Typography.Text>
                </div>
            </div>

            <Card className="shadow-sm rounded-xl mb-4 overflow-hidden">
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'tickets',
                            label: t('approval.tickets'),
                            children: (
                                <>
                                    <Space style={{ marginBottom: 16 }}>
                                        <Select
                                            value={queryParams.status}
                                            style={{ width: 140 }}
                                            onChange={(e) => setQueryParams({ ...queryParams, status: e, page: 1 })}
                                            options={[
                                                { value: '', label: t('approval.selectAllStatus') },
                                                { value: 'pending', label: t('approval.selectPending') },
                                                { value: 'finished', label: t('approval.selectFinished') },
                                                { value: 'failed', label: t('approval.selectFailed') },
                                                { value: 'rejected', label: t('approval.selectRejected') }
                                            ]}
                                        />
                                        <Input.Search
                                            placeholder={t('approval.searchPlaceholder')}
                                            allowClear
                                            onSearch={(e) => setQueryParams({ ...queryParams, resource_type: e, page: 1 })}
                                            style={{ width: 280 }}
                                        />
                                        <Button icon={<SyncOutlined />} onClick={() => refetch()}>{t('approval.refresh')}</Button>
                                    </Space>

                                    <Table
                                        columns={columns}
                                        dataSource={tickets}
                                        rowKey="id"
                                        loading={isLoading}
                                        scroll={{ x: 'max-content' }}
                                        pagination={{
                                            current: queryParams.page,
                                            pageSize: queryParams.page_size,
                                            total: total,
                                            onChange: (page, size) => setQueryParams({ ...queryParams, page, page_size: size }),
                                            showTotal: total => t('approval.paginationTotal', { total })
                                        }}
                                    />
                                </>
                            )
                        },
                        {
                            key: 'templates',
                            label: t('approval.interceptTemplates'),
                            children: (
                                <div className="p-4">
                                    <Alert 
                                        message={t('approval.interceptTipTitle')} 
                                        description={t('approval.interceptTipDesc')} 
                                        type="info" 
                                        showIcon 
                                        style={{ marginBottom: 24 }} 
                                    />
                                    <List
                                        grid={{ gutter: 16, column: 2 }}
                                        dataSource={templatesData || []}
                                        renderItem={(item: ResourceTemplate) => (
                                            <List.Item>
                                                <Card size="small" hoverable>
                                                    <Card.Meta 
                                                        avatar={<Avatar icon={<SyncOutlined />} style={{ backgroundColor: token.colorPrimary }} />}
                                                        title={item.name}
                                                        description={`${t('approval.resourceIdentifier')}: ${item.code}`}
                                                    />
                                                </Card>
                                            </List.Item>
                                        )}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'policies',
                            label: t('approval.policies'),
                            children: (
                                <>
                                    <div className="mb-4 flex justify-between">
                                        <Text type="secondary">{t('approval.policyTip')}</Text>
                                        {hasPermission('system:approval_policy:add') && (
                                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                                setEditingPolicy(null);
                                                policyForm.resetFields();
                                                setIsPolicyModalOpen(true);
                                            }}>{t('approval.addPolicy')}</Button>
                                        )}
                                    </div>
                                    <Table
                                        columns={policyColumns}
                                        dataSource={(policiesData as any)?.data || []}
                                        rowKey="id"
                                        pagination={false}
                                    />
                                </>
                            )
                        }
                    ]}
                />
            </Card>

            {/* 驳回 Modal */}
            <Modal
                title={t('approval.rejectModalTitle')}
                open={rejectModalVisible}
                onOk={() => currentTicket && rejectMutation.mutate({ id: currentTicket.id, remark: rejectRemark })}
                onCancel={() => setRejectModalVisible(false)}
                okText={t('approval.rejectModalOkText')}
                okButtonProps={{ danger: true, loading: rejectMutation.isPending }}
            >
                <div className="mb-2">{t('approval.rejectModalContent', { name: currentTicket?.submitter_name })}</div>
                <Input.TextArea
                    rows={4}
                    value={rejectRemark}
                    onChange={e => setRejectRemark(e.target.value)}
                    placeholder={t('approval.rejectModalPlaceholder')}
                />
            </Modal>

            {/* 策略编辑 Modal */}
            <Modal
                title={editingPolicy ? t('approval.editPolicy') : t('approval.addPolicy')}
                open={isPolicyModalOpen}
                onCancel={() => setIsPolicyModalOpen(false)}
                onOk={() => policyForm.submit()}
                confirmLoading={policyMutation.isPending}
            >
                <Form form={policyForm} layout="vertical" onFinish={policyMutation.mutate}>
                    <Form.Item name="name" label={t('approval.policyName')} rules={[{ required: true }]}>
                        <Input placeholder={t('approval.placeholderPolicyName')} />
                    </Form.Item>
                    <Form.Item name="resource_type" label={t('approval.resourceType')} rules={[{ required: true }]}>
                        <Select 
                            placeholder={t('approval.selectResource')}
                            options={templatesData?.map(t => ({ label: t.name, value: t.code }))}
                        />
                    </Form.Item>
                    <Form.Item name="environment" label={t('approval.environment')}>
                        <Input placeholder={t('approval.placeholderEnvironment')} />
                    </Form.Item>
                    <Form.Item name="approver_roles" label={t('approval.approverRoles')} extra={t('approval.anyAdminTip')}>
                        <Select 
                            mode="multiple"
                            placeholder={t('common.selectRoles') || '请选择角色'}
                            options={(rolesData as any)?.data?.map((r: any) => ({ label: r.name, value: r.id }))}
                        />
                    </Form.Item>
                    <Form.Item name="is_active" label={t('common.status')} valuePropName="checked" initialValue={true}>
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 载荷查看 Drawer */}
            <Drawer
                title={t('approval.drawerTitle')}
                placement="right"
                width={800}
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
                extra={
                    currentTicket?.status === 'pending' && hasPermission('system:approval_ticket:approve') && (
                        <Space>
                            <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectModalVisible(true)}>{t('approval.reject')}</Button>
                            <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending} onClick={() => handleApprove(currentTicket!.id)}>{t('approval.confirmOkText')}</Button>
                        </Space>
                    )
                }
            >
                {currentTicket && (
                    <div className="space-y-6">
                        <Descriptions column={2} bordered size="small" labelStyle={{ background: token.colorFillQuaternary, width: '130px' }}>
                            <Descriptions.Item label={t('approval.descItemId')}>{currentTicket.id}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.columnSubmitter')}>{currentTicket.submitter_name}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemMethod')}>{currentTicket.method}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemUrl')}>{currentTicket.url_path}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.resourceIdentifier')}>{currentTicket.resource_type}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.columnStatus')}>
                                <Badge status={STATUS_MAP(t)[currentTicket.status as keyof ReturnType<typeof STATUS_MAP>]?.status as any} text={currentTicket.status_display || STATUS_MAP(t)[currentTicket.status as keyof ReturnType<typeof STATUS_MAP>]?.text} />
                            </Descriptions.Item>
                        </Descriptions>

                        <Divider orientation="left" orientationMargin="0">{t('approval.flowTimeline')}</Divider>
                        <Timeline
                            mode="left"
                            items={[
                                {
                                    label: dayjs(currentTicket.create_time).format('YYYY-MM-DD HH:mm'),
                                    children: (
                                        <div>
                                            <Text strong>{t('approval.ticketCreated')}</Text>
                                            <div className="text-xs text-gray-400">{t('common.operator') || '操作人'}: {currentTicket.submitter_name}</div>
                                        </div>
                                    ),
                                    color: 'blue'
                                },
                                {
                                    label: currentTicket.audit_time ? dayjs(currentTicket.audit_time).format('YYYY-MM-DD HH:mm') : '',
                                    children: (
                                        <div>
                                            <Text strong>{currentTicket.status === 'pending' ? t('approval.waitingApproval') : t('approval.approvalFinished', { status: currentTicket.status_display || currentTicket.status })}</Text>
                                            {currentTicket.approver_name && <div className="text-xs text-gray-400">{t('approval.approverLabel')}: {currentTicket.approver_name}</div>}
                                            {currentTicket.remark && <div className="mt-2 p-2 bg-gray-50 rounded italic text-gray-500">"{currentTicket.remark}"</div>}
                                        </div>
                                    ),
                                    color: currentTicket.status === 'pending' ? 'gray' : (['rejected', 'failed'].includes(currentTicket.status) ? 'red' : 'green'),
                                    icon: currentTicket.status === 'pending' ? <ClockCircleOutlined /> : null
                                }
                            ]}
                        />

                        <div>
                            <Typography.Title level={5}><SendOutlined /> {t('approval.payloadTitle')}</Typography.Title>
                            <div style={{
                                background: token.colorFillTertiary,
                                color: token.colorText,
                                padding: '16px', borderRadius: '8px',
                                overflow: 'auto', maxHeight: '500px',
                                fontSize: '13px', fontFamily: 'monospace',
                                border: `1px solid ${token.colorBorderSecondary}`
                            }}>
                                <pre style={{ margin: 0 }}>
                                    {JSON.stringify(currentTicket.payload, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default ApprovalCenter;
