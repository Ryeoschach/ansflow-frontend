import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Space, Input, Button, theme, Form, Select, Drawer, Descriptions, Alert } from 'antd';
import { SyncOutlined, SearchOutlined, SafetyCertificateOutlined, CodeOutlined, ExceptionOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '../../api/system';
import useAppStore from '../../store/useAppStore';

interface AuditLogRecord {
    id: number;
    username: string;
    ip_address: string;
    method: string;
    path: string;
    resource: string;
    resource_name: string;
    action: string;
    action_name: string;
    object_id: string;
    old_data: any;
    request_data: any;
    response_data: any;
    response_status: number;
    duration: number;
    create_time: string;
}

const AuditLog: React.FC = () => {
    const { token: authToken, hasPermission } = useAppStore();
    const { token: antdToken } = theme.useToken();
    const [queryParams, setQueryParams] = useState({ page: 1, page_size: 15, search: '', method: '' });

    const [form] = Form.useForm();
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentRecord, setCurrentRecord] = useState<AuditLogRecord | null>(null);

    const { data: qData, isLoading: loading, refetch } = useQuery({
        queryKey: ['auditLogs', queryParams],
        queryFn: () => getAuditLogs(queryParams),
        enabled: !!authToken && hasPermission('rbac:audit:view'),
    });

    const logs = qData?.results || qData?.data || [];
    const total = qData?.count || qData?.total || 0;

    const onSearch = (values: any) => {
        setQueryParams({
            ...queryParams,
            page: 1,
            search: values.username || '',
            method: values.method || '',
        });
    };

    const getMethodColor = (method: string) => {
        switch (method?.toUpperCase()) {
            case 'POST': return antdToken.colorSuccess;
            case 'PUT': return antdToken.colorWarning;
            case 'PATCH': return antdToken.colorPrimary;
            case 'DELETE': return antdToken.colorError;
            default: return antdToken.colorTextSecondary;
        }
    };

    const columns = [
        {
            title: '操作人',
            dataIndex: 'username',
            key: 'username',
            width: 120,
            render: (text: string) => (
                <Space>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: `linear-gradient(135deg, ${antdToken.colorPrimary}, ${antdToken.colorPrimaryActive})`,
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '14px'
                    }}>
                        {text ? text.charAt(0).toUpperCase() : '?'}
                    </div>
                    <Typography.Text strong>{text || 'Anonymous'}</Typography.Text>
                </Space>
            )
        },
        {
            title: '意图 / 资源',
            key: 'intent',
            width: 250,
            render: (_: any, record: AuditLogRecord) => (
                <div>
                    <div>
                        <Typography.Text strong style={{ fontSize: '14px' }}>
                            {record.action_name || record.action || '操作'}
                        </Typography.Text>
                        <span style={{ fontSize: '12px', color: antdToken.colorTextQuaternary, marginLeft: 6 }}>
                            ({record.resource_name || record.resource || '-'})
                        </span>
                    </div>
                    {(record.object_id || record.path) && (
                        <div style={{ marginTop: '4px', fontSize: '12px', fontFamily: 'monospace', color: antdToken.colorTextSecondary }}>
                            Obj: {record.object_id || record.path.split('/').pop() || '-'}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: '接口快照',
            key: 'api',
            width: 280,
            render: (_: any, record: AuditLogRecord) => (
                <div>
                    <div>
                        <Tag style={{ fontWeight: 'bold', border: 'none', background: antdToken.colorFillTertiary, color: getMethodColor(record.method) }}>
                            {record.method}
                        </Tag>
                        <Tag
                            color={record.response_status >= 400 ? 'error' : 'success'}
                            style={{ fontWeight: 'bold', border: 'none' }}
                        >
                            {record.response_status}
                        </Tag>
                    </div>
                    <div style={{
                        marginTop: 4, fontSize: '11px', color: antdToken.colorTextTertiary,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px'
                    }}>
                        {record.path}
                    </div>
                </div>
            )
        },
        {
            title: '请求耗时',
            dataIndex: 'duration',
            key: 'duration',
            width: 120,
            render: (duration: number) => {
                const color = duration > 1.5 ? antdToken.colorError : (duration > 0.5 ? antdToken.colorWarning : antdToken.colorSuccess);
                return (
                    <Typography.Text style={{ color, fontWeight: 500 }}>
                        {duration > 0 ? `${(duration).toFixed(3)} s` : '< 0.001 s'}
                    </Typography.Text>
                );
            }
        },
        {
            title: 'IP 地址',
            dataIndex: 'ip_address',
            key: 'ip_address',
            width: 150,
            render: (ip: string) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{ip}</Typography.Text>
        },
        {
            title: '操作时间',
            dataIndex: 'create_time',
            key: 'create_time',
            width: 180,
            render: (time: string) => (
                <div style={{ color: antdToken.colorTextSecondary }}>
                    {dayjs(time).format('YYYY-MM-DD HH:mm:ss')}
                </div>
            )
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_: any, record: AuditLogRecord) => (
                hasPermission('rbac:audit:view') ? (
                <Button
                    type="link"
                    icon={<CodeOutlined />}
                    onClick={() => {
                        setCurrentRecord(record);
                        setDetailVisible(true);
                    }}
                >
                    快照
                </Button>
                ) : null
            ),
        },
    ];

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <Typography.Title level={3} style={{ margin: 0, fontWeight: 600 }}>环境审计 (Audit Logs)</Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
                        跟踪全站所有关键操作变更与接口调用耗时
                    </Typography.Text>
                </div>
            </div>

            <Card variant={"outlined"} className="shadow-sm rounded-xl mb-4">
                <Form layout="inline" form={form} onFinish={onSearch}>
                    <Form.Item name="username">
                        <Input placeholder="检索操作人..." prefix={<SearchOutlined />} style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item name="method">
                        <Select 
                            placeholder="请求类型" 
                            allowClear 
                            style={{ width: 120 }}
                            options={[
                                { label: 'POST', value: 'POST' },
                                { label: 'PUT', value: 'PUT' },
                                { label: 'PATCH', value: 'PATCH' },
                                { label: 'DELETE', value: 'DELETE' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            {hasPermission('rbac:audit:view') && (
                    <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>检索</Button>
                    )}
                    {hasPermission('rbac:audit:view') && (
                    <Button onClick={() => { form.resetFields(); setQueryParams({ ...queryParams, page: 1, search: '', method: '' }); }}>重置</Button>
                    )}
                    {hasPermission('rbac:audit:view') && (
                    <Button icon={<SyncOutlined />} onClick={() => refetch()}>刷新</Button>
                    )}
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            <Card variant={"outlined"} className="shadow-sm rounded-xl">
                <Table
                    columns={columns}
                    dataSource={logs}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                        current: queryParams.page,
                        pageSize: queryParams.page_size,
                        total: total,
                        showSizeChanger: true,
                        onChange: (page, size) => setQueryParams({ ...queryParams, page, page_size: size }),
                        showTotal: total => `共 ${total} 条历史足迹`
                    }}
                />
            </Card>

            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        <SafetyCertificateOutlined style={{ color: antdToken.colorPrimary }} />
                        <span>操作快照详情</span>
                    </div>
                }
                placement="right"
                size={800}
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
            >
                {currentRecord && (
                    <div className="space-y-6">
                        {currentRecord.response_status >= 400 && (
                            <Alert
                                message={<span style={{ fontWeight: 600 }}>操作被驳回或执行失败 ({currentRecord.response_status})</span>}
                                description="后方检测到此请求为异常拦截状态，具体原因请参考底部 'Response 摘要'"
                                type="error"
                                showIcon
                                icon={<ExceptionOutlined />}
                            />
                        )}

                        <Descriptions column={2} bordered size="small" labelStyle={{ width: '130px', background: antdToken.colorFillQuaternary }}>
                            <Descriptions.Item label="操作人">
                                <Typography.Text strong>{currentRecord.username}</Typography.Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="客户端 IP">
                                <Typography.Text code>{currentRecord.ip_address}</Typography.Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="意图动作">
                                {currentRecord.action_name || '-'} ({currentRecord.action || '-'})
                            </Descriptions.Item>
                            <Descriptions.Item label="目标资源">
                                {currentRecord.resource_name || '-'} ({currentRecord.resource || '-'})
                            </Descriptions.Item>
                            <Descriptions.Item label="对象主键 (PK)">
                                <Typography.Text copyable>{currentRecord.object_id || '未识别'}</Typography.Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="耗时分析">
                                {currentRecord.duration ? `${currentRecord.duration} 秒` : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="接口路径" span={2}>
                                <Typography.Text code>{currentRecord.method}</Typography.Text> {currentRecord.path}
                            </Descriptions.Item>
                        </Descriptions>

                        {(currentRecord.method === 'PUT' || currentRecord.method === 'PATCH' || currentRecord.method === 'DELETE') && currentRecord.old_data ? (
                            <div>
                                <Typography.Title level={5}>数据快照比对 (Diff)</Typography.Title>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                        <div style={{ padding: '4px 8px', background: antdToken.colorErrorBg, color: antdToken.colorErrorText, fontWeight: 'bold', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontSize: '12px' }}>
                                            修改前 (Old Data)
                                        </div>
                                        <div style={{
                                            background: '#1e1e1e', color: '#d4d4d4', padding: '16px', 
                                            borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', 
                                            overflow: 'auto', maxHeight: '400px', fontSize: '13px', fontFamily: 'monospace'
                                        }}>
                                            <pre style={{ margin: 0 }}>
                                                {JSON.stringify(currentRecord.old_data, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div style={{ padding: '4px 8px', background: antdToken.colorSuccessBg, color: antdToken.colorSuccessText, fontWeight: 'bold', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontSize: '12px' }}>
                                            拦截 / 更新的载荷 (New Request)
                                        </div>
                                        <div style={{
                                            background: '#1e1e1e', color: '#d4d4d4', padding: '16px', 
                                            borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px', 
                                            overflow: 'auto', maxHeight: '400px', fontSize: '13px', fontFamily: 'monospace'
                                        }}>
                                            <pre style={{ margin: 0 }}>
                                                {JSON.stringify(currentRecord.request_data, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Typography.Title level={5}>Request 报文</Typography.Title>
                                <div style={{
                                    background: '#1e1e1e', color: '#d4d4d4', 
                                    padding: '16px', borderRadius: '8px', 
                                    overflow: 'auto', maxHeight: '400px', 
                                    fontSize: '13px', fontFamily: 'monospace'
                                }}>
                                    <pre style={{ margin: 0 }}>
                                        {JSON.stringify(currentRecord.request_data, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {(currentRecord.response_data && Object.keys(currentRecord.response_data).length > 0) && (
                            <div>
                                <Typography.Title level={5} style={{ color: currentRecord.response_status >= 400 ? antdToken.colorError : antdToken.colorPrimary }}>
                                    Response 简短摘要
                                </Typography.Title>
                                <div style={{
                                    background: currentRecord.response_status >= 400 ? antdToken.colorErrorBg : antdToken.colorFillTertiary,
                                    padding: '16px', borderRadius: '8px',
                                    overflow: 'auto', maxHeight: '300px',
                                    fontSize: '13px', fontFamily: 'monospace'
                                }}>
                                    <pre style={{ margin: 0 }}>
                                        {JSON.stringify(currentRecord.response_data, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default AuditLog;
