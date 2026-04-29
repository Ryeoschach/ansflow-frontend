import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Space, Button, theme, Select, Drawer, Descriptions, Badge, Modal, Input, App, Tooltip, Tabs, Timeline, Form, Switch, Checkbox, Popconfirm, List, Divider } from 'antd';
const { Text } = Typography;
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, EyeOutlined, PlusOutlined, DeleteOutlined, EditOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
    getApprovalTickets, approveTicket, rejectTicket, 
    getApprovalTemplates, createApprovalTemplate, updateApprovalTemplate, deleteApprovalTemplate,
    getApprovalPolicies, createApprovalPolicy, updateApprovalPolicy, deleteApprovalPolicy,
    ApprovalTicket, ApprovalTemplate, ApprovalPolicy 
} from '../../api/approval';
import { getRoles } from '../../api/rbac';
import { getUsers } from '../../api/user';
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
    const { currentUser, token: authToken, hasPermission } = useAppStore();

    const [activeTab, setActiveTab] = useState('tickets');
    
    // 工单状态
    const [queryParams, setQueryParams] = useState<any>({ page: 1, page_size: 15, status: 'pending', resource_type: '', submitter__username: '' });
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentTicket, setCurrentTicket] = useState<ApprovalTicket | null>(null);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectRemark, setRejectRemark] = useState('');

    // 模板状态
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ApprovalTemplate | null>(null);
    const [templateForm] = Form.useForm();

    // 策略状态
    const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<ApprovalPolicy | null>(null);
    const [policyForm] = Form.useForm();

    const { data: qData, isLoading, refetch } = useQuery({
        queryKey: ['approvalTickets', queryParams],
        queryFn: () => getApprovalTickets(queryParams),
        enabled: !!authToken && hasPermission('system:approval_ticket:view'),
    });

    const { data: templatesData, refetch: refetchTemplates } = useQuery({
        queryKey: ['approvalTemplates'],
        queryFn: () => getApprovalTemplates({ page_size: 100 }),
        enabled: !!authToken && activeTab === 'templates',
    });

    const { data: policiesData, refetch: refetchPolicies } = useQuery({
        queryKey: ['approvalPolicies'],
        queryFn: () => getApprovalPolicies({ page_size: 100 }),
        enabled: !!authToken && activeTab === 'policies',
    });

    const { data: rolesData } = useQuery({
        queryKey: ['roles'],
        queryFn: () => getRoles({ page_size: 100 }),
        enabled: !!authToken && isTemplateModalOpen,
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: () => getUsers({ page_size: 100 }),
        enabled: !!authToken && isTemplateModalOpen,
    });

    const tickets = (qData as any)?.data || [];
    const total = (qData as any)?.total || 0;

    const approveMutation = useMutation({
        mutationFn: (id: number) => approveTicket(id),
        onSuccess: () => {
            message.success(t('approval.approvedMessage'));
            setDetailVisible(false);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['auditLogs'] }); // 如果有联动影响审计
        },
        onError: (err: any) => {
            message.error(err.response?.data?.detail || t('approval.approveError'));
            refetch();
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

    const templateMutation = useMutation({
        mutationFn: (values: any) => editingTemplate 
            ? updateApprovalTemplate(editingTemplate.id, values) 
            : createApprovalTemplate(values),
        onSuccess: () => {
            message.success(t('common.success'));
            setIsTemplateModalOpen(false);
            refetchTemplates();
        },
        onError: (err: any) => message.error(err?.message || t('common.error'))
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
        onError: (err: any) => message.error(err?.message || t('common.error'))
    });

    const deleteTemplateMutation = useMutation({
        mutationFn: deleteApprovalTemplate,
        onSuccess: () => {
            message.success(t('common.success'));
            refetchTemplates();
        }
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
            okType: 'danger'
        });
    };

    const columns = [
        {
            title: t('approval.columnIdResource'),
            dataIndex: 'id',
            key: 'id',
            render: (id: number, record: ApprovalTicket) => (
                <Space orientation="vertical" size={2}>
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
        },
        {
            title: t('approval.columnStatus'),
            key: 'status',
            render: (_: any, record: ApprovalTicket) => {
                const map = STATUS_MAP(t)[record.status as keyof ReturnType<typeof STATUS_MAP>] || STATUS_MAP(t)['pending'];
                return (
                    <div>
                        <Badge status={map.status as any} text={<Typography.Text strong style={{ color: (token as any)[map.color] }}>{map.text}</Typography.Text>} />
                        {(record.status === 'finished' || record.status === 'failed') && (
                            <div style={{ fontSize: '11px', color: token.colorTextQuaternary, marginTop: 4, width: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record.remark || ''}>
                                {t('approval.receiptTitle')} {record.remark}
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
                    {hasPermission('system:approval_ticket:view') && (
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
                    )}
                    {record.status === 'pending' && hasPermission('system:approval_ticket:approve') && (
                        <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => {
                                setCurrentTicket(record);
                                setRejectModalVisible(true);
                            }}
                        >
                            {t('approval.reject')}
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const templateColumns = [
        { title: t('approval.templateName'), dataIndex: 'name', key: 'name', render: (v: string) => <Typography.Text strong>{v}</Typography.Text> },
        { title: t('approval.templateDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
        { title: t('approval.templateSteps'), key: 'steps', render: (_: any, r: ApprovalTemplate) => <Tag color="blue">{r.steps?.length || 0} {t('approval.steps')}</Tag> },
        { title: t('common.status'), dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? t('common.active') : t('common.inactive')} /> },
        {
            title: t('common.action'),
            key: 'action',
            width: 120,
            render: (_: any, record: ApprovalTemplate) => (
                <Space>
                    {hasPermission('system:approval_template:edit') && (
                    <Button type="text" icon={<EditOutlined />} onClick={() => {
                        setEditingTemplate(record);
                        templateForm.setFieldsValue(record);
                        setIsTemplateModalOpen(true);
                    }} />
                    )}
                    {hasPermission('system:approval_template:delete') && (
                    <Popconfirm title={t('common.confirmDelete')} onConfirm={() => deleteTemplateMutation.mutate(record.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                    )}
                </Space>
            )
        }
    ];

    const policyColumns = [
        { title: t('approval.policyName'), dataIndex: 'name', key: 'name' },
        { title: t('approval.resourceType'), dataIndex: 'resource_type', key: 'resource_type', render: (v: string) => <Tag>{v}</Tag> },
        { title: t('approval.environment'), dataIndex: 'environment', key: 'environment', render: (v: string) => v ? <Tag color="purple">{v}</Tag> : '-' },
        { title: t('approval.template'), dataIndex: 'template_name', key: 'template_name', render: (v: string) => v || '-' },
        {
            title: t('common.action'),
            key: 'action',
            width: 120,
            render: (_: any, record: ApprovalPolicy) => (
                <Space>
                    {hasPermission('system:approval_policy:edit') && (
                    <Button type="text" icon={<EditOutlined />} onClick={() => {
                        setEditingPolicy(record);
                        policyForm.setFieldsValue(record);
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
                                                { value: 'approved', label: t('approval.selectApproved') },
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
                                        {hasPermission('system:approval_ticket:view') && (
                                            <Button icon={<SyncOutlined />} onClick={() => refetch()}>{t('approval.refresh')}</Button>
                                        )}
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
                            label: t('approval.templates'),
                            children: (
                                <>
                                    <div className="mb-4 flex justify-between">
                                        <Text type="secondary">{t('approval.templateTip')}</Text>
                                        {hasPermission('system:approval_template:add') && (
                                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                                setEditingTemplate(null);
                                                templateForm.resetFields();
                                                setIsTemplateModalOpen(true);
                                            }}>{t('approval.addTemplate')}</Button>
                                        )}
                                    </div>
                                    <Table
                                        columns={templateColumns}
                                        dataSource={(templatesData as any)?.data || []}
                                        rowKey="id"
                                        pagination={false}
                                    />
                                </>
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

            {/* 模板编辑 Modal */}
            <Modal
                title={editingTemplate ? t('approval.editTemplate') : t('approval.addTemplate')}
                open={isTemplateModalOpen}
                onCancel={() => setIsTemplateModalOpen(false)}
                onOk={() => templateForm.submit()}
                confirmLoading={templateMutation.isPending}
                width={800}
                style={{ top: 20 }}
            >
                <Form form={templateForm} layout="vertical" onFinish={templateMutation.mutate}>
                    <Form.Item name="name" label={t('approval.templateName')} rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="description" label={t('approval.templateDescription')}>
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="is_active" label={t('common.isActive')} valuePropName="checked" initialValue={true}>
                        <Switch />
                    </Form.Item>
                    
                    <Divider {...({ orientation: 'left', orientationMargin: '0' } as any)}>{t('approval.stepsConfig')}</Divider>
                    <Form.List name="steps">
                        {(fields, { add, remove, move }) => (
                            <div className="space-y-4 max-h-[400px] overflow-y-auto p-2">
                                {fields.map(({ key, name, ...restField }, index) => (
                                    <Card 
                                        key={key} 
                                        size="small" 
                                        className="shadow-sm border-gray-200"
                                        title={<Typography.Text strong>{t('approval.step')} {index + 1}</Typography.Text>} 
                                        extra={
                                            <Space>
                                                <Button type="text" size="small" icon={<ArrowUpOutlined />} onClick={() => move(index, index - 1)} disabled={index === 0} />
                                                <Button type="text" size="small" icon={<ArrowDownOutlined />} onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} />
                                                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                                            </Space>
                                        }
                                    >
                                        <div className="grid grid-cols-2 gap-4">
                                            <Form.Item {...restField} name={[name, 'name']} label={t('approval.stepName')} rules={[{ required: true }]}>
                                                <Input placeholder={t('approval.exampleStepName')} />
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'mode']} label={t('approval.stepMode')} initialValue="any">
                                                <Select options={[{ label: t('approval.modeAny'), value: 'any' }, { label: t('approval.modeAll'), value: 'all' }]} />
                                            </Form.Item>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Form.Item {...restField} name={[name, 'approver_roles']} label={t('approval.approverRoles')}>
                                                <Select mode="multiple" placeholder={t('approval.selectRoles')} options={(rolesData as any)?.data?.map((r: any) => ({ label: r.name, value: r.id }))} />
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'approver_users']} label={t('approval.approverUsers')}>
                                                <Select mode="multiple" placeholder={t('approval.selectUsers')} options={(usersData as any)?.data?.map((u: any) => ({ label: u.username, value: u.id }))} />
                                            </Form.Item>
                                        </div>
                                    </Card>
                                ))}
                                <Button type="dashed" onClick={() => add({ mode: 'any' })} block icon={<PlusOutlined />}>
                                    {t('approval.addStep')}
                                </Button>
                            </div>
                        )}
                    </Form.List>
                </Form>
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
                        <Input />
                    </Form.Item>
                    <Form.Item name="resource_type" label={t('approval.resourceType')} rules={[{ required: true }]}>
                        <Input placeholder="e.g. pipeline:run" />
                    </Form.Item>
                    <Form.Item name="environment" label={t('approval.environment')}>
                        <Input placeholder="e.g. PROD" />
                    </Form.Item>
                    <Form.Item name="template" label={t('approval.template')} rules={[{ required: true }]}>
                        <Select options={(templatesData as any)?.data?.map((t: any) => ({ label: t.name, value: t.id }))} />
                    </Form.Item>
                    <Form.Item name="is_active" label={t('common.isActive')} valuePropName="checked" initialValue={true}>
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
                            <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectModalVisible(true)}>{t('approval.destroyPayload')}</Button>
                            <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending} onClick={() => handleApprove(currentTicket!.id)}>{t('approval.forceApprove')}</Button>
                        </Space>
                    )
                }
            >
                {currentTicket && (
                    <div className="space-y-6">
                        <Descriptions column={2} bordered size="small" labelStyle={{ background: token.colorFillQuaternary, width: '130px' }}>
                            <Descriptions.Item label={t('approval.descItemId')}>APP-{currentTicket.id}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemSubmitter')}>{currentTicket.submitter_name}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemMethod')}>{currentTicket.method}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemUrl')}>{currentTicket.url_path}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemTemplate')}>{currentTicket.template_name || '-'}</Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemStatus')}>
                                <Badge status={STATUS_MAP(t)[currentTicket.status as keyof ReturnType<typeof STATUS_MAP>]?.status as any} text={STATUS_MAP(t)[currentTicket.status as keyof ReturnType<typeof STATUS_MAP>]?.text} />
                            </Descriptions.Item>
                        </Descriptions>

                        <Divider {...({ orientation: 'left', orientationMargin: '0' } as any)}>{t('approval.progressTimeline')}</Divider>
                        <Timeline
                            items={[
                                {
                                    color: 'green',
                                    children: (
                                        <div>
                                            <Text strong>{t('approval.statusTicketCreated')}</Text>
                                            <div className="text-xs text-gray-400">{dayjs(currentTicket.create_time).format('YYYY-MM-DD HH:mm:ss')}</div>
                                        </div>
                                    ),
                                },
                                ...(currentTicket.progresses || []).map(p => ({
                                    color: p.status === 'approved' ? 'green' : 'red',
                                    children: (
                                        <div>
                                            <Space>
                                                <Text strong>{p.step_name}</Text>
                                                <Tag color={p.status === 'approved' ? 'success' : 'error'}>{p.status === 'approved' ? t('approval.approved') : t('approval.rejected')}</Tag>
                                            </Space>
                                            <div className="text-sm mt-1">{t('approval.approver')}: {p.approver_name}</div>
                                            {p.remark && <div className="text-sm text-gray-500 italic">"{p.remark}"</div>}
                                            <div className="text-xs text-gray-400 mt-1">{dayjs(p.create_time).format('YYYY-MM-DD HH:mm:ss')}</div>
                                        </div>
                                    )
                                })),
                                ...(currentTicket.status === 'pending' ? [{
                                    color: 'gray',
                                    children: <Text italic type="secondary">{t('approval.waitingNextStep')}</Text>
                                }] : [])
                            ]}
                        />

                        <div>
                            <Typography.Title level={5}>{t('approval.payloadTitle')}</Typography.Title>
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
