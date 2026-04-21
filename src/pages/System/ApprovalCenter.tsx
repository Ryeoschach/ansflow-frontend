import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Space, Button, theme, Select, Drawer, Descriptions, Badge, Modal, Input, App, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getApprovalTickets, approveTicket, rejectTicket, ApprovalTicket } from '../../api/approval';
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

    const [queryParams, setQueryParams] = useState<any>({ page: 1, page_size: 15, status: 'pending', resource_type: '', submitter__username: '' });
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentTicket, setCurrentTicket] = useState<ApprovalTicket | null>(null);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectRemark, setRejectRemark] = useState('');

    const { data: qData, isLoading, refetch } = useQuery({
        queryKey: ['approvalTickets', queryParams],
        queryFn: () => getApprovalTickets(queryParams),
        enabled: !!authToken && hasPermission('system:approval_ticket:view'),
    });

    const tickets = qData?.results || qData?.data || [];
    const total = qData?.count || qData?.total || 0;

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

            <Card variant={"outlined"} className="shadow-sm rounded-xl mb-4">
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
                    <Select
                        value={queryParams.submitter__username}
                        style={{ width: 140 }}
                        onChange={(e) => setQueryParams({ ...queryParams, submitter__username: e, page: 1 })}
                        options={[
                            { value: '', label: t('approval.selectAllSubmitter') },
                            { value: currentUser, label: t('approval.selectMySubmitter') }
                        ]}
                    />
                    <Input.Search
                        placeholder={t('approval.searchPlaceholder')}
                        allowClear
                        onSearch={(e) => setQueryParams({ ...queryParams, resource_type: e, page: 1 })}
                        style={{ width: 280 }}
                    />
                    {hasPermission('system:approval_ticket:view') && <Button icon={<SyncOutlined />} onClick={() => refetch()}>{t('approval.refresh')}</Button>}
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

            {/* 载荷查看 Drawer */}
            <Drawer
                title={t('approval.drawerTitle')}
                placement="right"
                size={700}
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
                            <Descriptions.Item label={t('approval.descItemStatus')}>
                                <Badge status={STATUS_MAP(t)[currentTicket.status as keyof ReturnType<typeof STATUS_MAP>]?.status as any} text={STATUS_MAP(t)[currentTicket.status as keyof ReturnType<typeof STATUS_MAP>]?.text} />
                            </Descriptions.Item>
                            <Descriptions.Item label={t('approval.descItemApprover')}>{currentTicket.approver_name || t('approval.descItemApproverWaiting')}</Descriptions.Item>
                        </Descriptions>

                        {currentTicket.remark && (
                            <div style={{ padding: '12px', background: currentTicket.status === 'failed' || currentTicket.status === 'rejected' ? token.colorErrorBg : token.colorSuccessBg, borderRadius: '8px', color: currentTicket.status === 'failed' || currentTicket.status === 'rejected' ? token.colorErrorText : token.colorSuccessText }}>
                                <strong>{t('approval.receiptTitle')}</strong> {currentTicket.remark}
                            </div>
                        )}

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
                            <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                {t('approval.payloadTip')}
                            </Typography.Text>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default ApprovalCenter;
