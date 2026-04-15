import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Space, Button, theme, Select, Drawer, Descriptions, Badge, Modal, Input, App, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getApprovalTickets, approveTicket, rejectTicket, ApprovalTicket } from '../../api/approval';
import useAppStore from '../../store/useAppStore';

const STATUS_MAP = {
    'pending': { color: 'colorWarning', text: '待审批', status: 'processing' },
    'approved': { color: 'colorSuccess', text: '已放行', status: 'success' },
    'rejected': { color: 'colorError', text: '已驳回', status: 'error' },
    'canceled': { color: 'colorTextSecondary', text: '已撤销', status: 'default' },
    'finished': { color: 'colorSuccess', text: '执行成功', status: 'success' },
    'failed': { color: 'colorError', text: '执行失败', status: 'error' },
} as const;

const ApprovalCenter: React.FC = () => {
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
            message.success('已同意放行，代理开始执行！');
            setDetailVisible(false);
            refetch();
            queryClient.invalidateQueries({ queryKey: ['auditLogs'] }); // 如果有联动影响审计
        },
        onError: (err: any) => {
            message.error(err.response?.data?.detail || '放行失败或底层返回错误');
            refetch();
        }
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, remark }: { id: number, remark: string }) => rejectTicket(id, remark),
        onSuccess: () => {
            message.success('已驳回拦截单');
            setRejectModalVisible(false);
            setRejectRemark('');
            setDetailVisible(false);
            refetch();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.detail || '驳回失败');
        }
    });

    const handleApprove = (id: number) => {
        modal.confirm({
            title: '二次签批确认',
            content: '这将立即恢复挂起的底层 API 请求，并可能在生产环境产生实际操作，确认放行？',
            onOk: () => approveMutation.mutate(id),
            okText: '确认放行',
            okType: 'danger'
        });
    };

    const columns = [
        {
            title: '单号 & 资源层',
            dataIndex: 'id',
            key: 'id',
            width: 150,
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
            title: '请求上下文及意图',
            key: 'intent',
            width: 250,
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
            title: '申请发起人',
            dataIndex: 'submitter_name',
            key: 'submitter',
            width: 100,
        },
        {
            title: '处理状态 / 代理回执',
            key: 'status',
            width: 200,
            render: (_: any, record: ApprovalTicket) => {
                const map = STATUS_MAP[record.status as keyof typeof STATUS_MAP] || STATUS_MAP['pending'];
                return (
                    <div>
                        <Badge status={map.status as any} text={<Typography.Text strong style={{ color: (token as any)[map.color] }}>{map.text}</Typography.Text>} />
                        {(record.status === 'finished' || record.status === 'failed') && (
                            <div style={{ fontSize: '11px', color: token.colorTextQuaternary, marginTop: 4, width: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record.remark || ''}>
                                回执: {record.remark}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: '发起时间',
            dataIndex: 'create_time',
            key: 'time',
            width: 160,
            render: (time: string) => <span style={{ color: token.colorTextSecondary }}>{dayjs(time).format('MM-DD HH:mm:ss')}</span>
        },
        {
            title: '操作',
            key: 'action',
            width: 150,
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
                        审查载荷
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
                            否决
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
                    <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>安全挂起与审批 (Approval Center)</Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                        所有触及红线的“高危动作”都会在此挂起，等待拥有审查权限人员的手动确认。
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
                            { value: '', label: '全部状态' },
                            { value: 'pending', label: '待审批 (挂起)' },
                            { value: 'approved', label: '已批复等待流转' },
                            { value: 'finished', label: '已无感放行 (复发成功)' },
                            { value: 'failed', label: '已放行但底层报错' },
                            { value: 'rejected', label: '已拦截/驳回' }
                        ]}
                    />
                    <Select 
                        value={queryParams.submitter__username} 
                        style={{ width: 140 }} 
                        onChange={(e) => setQueryParams({ ...queryParams, submitter__username: e, page: 1 })}
                        options={[
                            { value: '', label: '所有人发起的' },
                            { value: currentUser, label: '仅看我发起的' }
                        ]}
                    />
                    <Input.Search 
                        placeholder="检索底层组件代码(如 pipeline)..." 
                        allowClear 
                        onSearch={(e) => setQueryParams({ ...queryParams, resource_type: e, page: 1 })} 
                        style={{ width: 280 }} 
                    />
                    {hasPermission('system:approval_ticket:view') && <Button icon={<SyncOutlined />} onClick={() => refetch()}>刷新</Button>}
                </Space>
                
                <Table 
                    columns={columns} 
                    dataSource={tickets} 
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 1200 }}
                    pagination={{
                        current: queryParams.page,
                        pageSize: queryParams.page_size,
                        total: total,
                        onChange: (page, size) => setQueryParams({ ...queryParams, page, page_size: size }),
                        showTotal: total => `共 ${total} 个拦截挂起单`
                    }}
                />
            </Card>

            {/* 驳回 Modal */}
            <Modal
                title="冻结且驳回此 API 请求"
                open={rejectModalVisible}
                onOk={() => currentTicket && rejectMutation.mutate({ id: currentTicket.id, remark: rejectRemark })}
                onCancel={() => setRejectModalVisible(false)}
                okText="永久废弃该载荷"
                okButtonProps={{ danger: true, loading: rejectMutation.isPending }}
            >
                <div className="mb-2">为发起人（{currentTicket?.submitter_name}）留下您的驳回原因：</div>
                <Input.TextArea 
                    rows={4} 
                    value={rejectRemark} 
                    onChange={e => setRejectRemark(e.target.value)} 
                    placeholder="如：业务高峰期，严禁执行数据库升配..." 
                />
            </Modal>

            {/* 载荷查看 Drawer */}
            <Drawer
                title="审批"
                placement="right"
                size={700}
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
                extra={
                    currentTicket?.status === 'pending' && hasPermission('system:approval_ticket:approve') && (
                        <Space>
                            <Button danger icon={<CloseCircleOutlined />} onClick={() => setRejectModalVisible(true)}>废弃载荷</Button>
                            <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending} onClick={() => handleApprove(currentTicket!.id)}>强制签发恢复</Button>
                        </Space>
                    )
                }
            >
                {currentTicket && (
                    <div className="space-y-6">
                        <Descriptions column={2} bordered size="small" labelStyle={{ background: token.colorFillQuaternary, width: '130px' }}>
                            <Descriptions.Item label="单号追踪">APP-{currentTicket.id}</Descriptions.Item>
                            <Descriptions.Item label="发起人">{currentTicket.submitter_name}</Descriptions.Item>
                            <Descriptions.Item label="截留动词">{currentTicket.method}</Descriptions.Item>
                            <Descriptions.Item label="原 API 终点">{currentTicket.url_path}</Descriptions.Item>
                            <Descriptions.Item label="当前状态">
                                <Badge status={STATUS_MAP[currentTicket.status as keyof typeof STATUS_MAP]?.status as any} text={STATUS_MAP[currentTicket.status as keyof typeof STATUS_MAP]?.text} />
                            </Descriptions.Item>
                            <Descriptions.Item label="签批主">{currentTicket.approver_name || '等待中'}</Descriptions.Item>
                        </Descriptions>

                        {currentTicket.remark && (
                            <div style={{ padding: '12px', background: currentTicket.status === 'failed' || currentTicket.status === 'rejected' ? token.colorErrorBg : token.colorSuccessBg, borderRadius: '8px', color: currentTicket.status === 'failed' || currentTicket.status === 'rejected' ? token.colorErrorText : token.colorSuccessText }}>
                                <strong>代理底层回执：</strong> {currentTicket.remark}
                            </div>
                        )}

                        <div>
                            <Typography.Title level={5}>发起人尝试上传的数据结构 (Body)</Typography.Title>
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
                                提示：如果点击右上角放行，后台将携带这套被冻结的数据，重新调用该接口完成真正的业务。
                            </Typography.Text>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default ApprovalCenter;
