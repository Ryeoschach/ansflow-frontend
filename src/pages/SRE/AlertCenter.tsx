import React, { useState } from 'react';
import { Table, Card, Tag, Space, Button, Typography, App, Drawer, Descriptions, Divider, Badge } from 'antd';
import { 
  SyncOutlined, 
  RobotOutlined, 
  PlayCircleOutlined, 
  CloseCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getAlertEvents, ignoreAlert } from '@/api/sre';
import { executePipeline } from '@/api/pipeline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Text, Title } = Typography;

const AlertCenter: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<any>(null);

    const [params, setParams] = useState({ page: 1, size: 20 });

    const { data, isLoading } = useQuery({
        queryKey: ['sre-alerts', params],
        queryFn: () => getAlertEvents(params),
        refetchInterval: 5000, // 每5秒轮询一次
    });

    const healingMutation = useMutation({
        mutationFn: (id: number) => executePipeline(id),
        onSuccess: () => {
            message.success('自愈流水线已触发执行');
            queryClient.invalidateQueries({ queryKey: ['sre-alerts'] });
        }
    });

    const statusMap: any = {
        'firing': { color: 'error', text: '告警中', icon: <WarningOutlined /> },
        'resolved': { color: 'success', text: '已恢复', icon: <CheckCircleOutlined /> },
    };

    const healingStatusMap: any = {
        'none': { color: 'default', text: '未处理' },
        'analyzing': { color: 'processing', text: 'AI 分析中', icon: <LoadingOutlined /> },
        'suggested': { color: 'cyan', text: '已有建议', icon: <RobotOutlined /> },
        'executing': { color: 'warning', text: '自愈中', icon: <SyncOutlined spin /> },
        'success': { color: 'success', text: '自愈成功' },
        'failed': { color: 'error', text: '自愈失败' },
        'ignored': { color: 'default', text: '已忽略' },
    };

    const columns = [
        {
            title: '告警名称',
            dataIndex: 'alert_name',
            key: 'alert_name',
            render: (text: string, record: any) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{text}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>{record.fingerprint.slice(0, 8)}</Text>
                </Space>
            )
        },
        {
            title: '级别',
            dataIndex: 'severity',
            key: 'severity',
            render: (val: string) => {
                let color = 'orange';
                if (val === 'critical') color = 'red';
                if (val === 'info') color = 'blue';
                return <Tag color={color}>{val.toUpperCase()}</Tag>;
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (val: string) => {
                const s = statusMap[val] || { color: 'default', text: val };
                return <Tag icon={s.icon} color={s.color}>{s.text}</Tag>;
            }
        },
        {
            title: '自愈进度',
            dataIndex: 'healing_status',
            key: 'healing_status',
            render: (val: string) => {
                const s = healingStatusMap[val] || { color: 'default', text: val };
                return <Badge status={s.color as any} text={s.text} />;
            }
        },
        {
            title: '创建时间',
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => new Date(val).toLocaleString()
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button 
                        type="link" 
                        icon={<InfoCircleOutlined />} 
                        onClick={() => {
                            setSelectedAlert(record);
                            setDetailVisible(true);
                        }}
                    >
                        详情
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6">
            <Card className="rounded-2xl border-none shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <Title level={4} className="m-0">SRE 智能告警中心</Title>
                        <Text type="secondary">实时监测系统异常并由 AI 提供自愈辅助</Text>
                    </div>
                    <Button icon={<SyncOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['sre-alerts'] })}>刷新</Button>
                </div>

                <Table 
                    dataSource={data?.data} 
                    columns={columns} 
                    rowKey="id" 
                    loading={isLoading}
                    pagination={{
                        total: data?.total,
                        current: params.page,
                        pageSize: params.size,
                        onChange: (page) => setParams({ ...params, page })
                    }}
                />
            </Card>

            <Drawer
                title={
                    <Space>
                        <RobotOutlined className="text-blue-600" />
                        <span>告警诊断详情</span>
                    </Space>
                }
                width={700}
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
                styles={{ body: { padding: '24px', backgroundColor: '#f8fafc' } }}
            >
                {selectedAlert && (
                    <div className="flex flex-col gap-6">
                        <Descriptions title="基础信息" bordered column={1} size="small" className="bg-white rounded-xl overflow-hidden">
                            <Descriptions.Item label="告警名称">{selectedAlert.alert_name}</Descriptions.Item>
                            <Descriptions.Item label="源">{selectedAlert.source}</Descriptions.Item>
                            <Descriptions.Item label="标签">
                                {Object.entries(selectedAlert.labels).map(([k, v]: any) => (
                                    <Tag key={k} style={{ marginBottom: '4px' }}>{k}: {v}</Tag>
                                ))}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card 
                            title={<Space><RobotOutlined /> AI 诊断报告</Space>} 
                            className="rounded-xl border-none shadow-md"
                            extra={selectedAlert.healing_status === 'analyzing' && <LoadingOutlined />}
                        >
                            {selectedAlert.ai_analysis ? (
                                <div className="prose prose-slate max-w-none prose-sm">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {selectedAlert.ai_analysis}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <div className="py-10 text-center text-slate-400">
                                    {selectedAlert.healing_status === 'analyzing' ? 'AI 正在全力分析中...' : '暂无分析报告'}
                                </div>
                            )}
                        </Card>

                        {selectedAlert.suggested_pipeline && (
                            <Card className="rounded-xl border-blue-100 bg-blue-50/30">
                                <div className="flex items-center justify-between">
                                    <Space direction="vertical" size={2}>
                                        <Text type="secondary" className="text-xs uppercase font-bold tracking-wider">推荐自愈方案</Text>
                                        <Text strong className="text-blue-700">执行流水线: {selectedAlert.suggested_pipeline_name || `ID: ${selectedAlert.suggested_pipeline}`}</Text>
                                    </Space>
                                    <Button 
                                        type="primary" 
                                        icon={<PlayCircleOutlined />}
                                        onClick={() => {
                                            modal.confirm({
                                                title: '确认执行自愈流水线？',
                                                content: 'AI 认为该流水线可以修复当前故障。执行过程将被审计。',
                                                onOk: () => healingMutation.mutate(selectedAlert.suggested_pipeline)
                                            });
                                        }}
                                    >
                                        立即执行
                                    </Button>
                                </div>
                            </Card>
                        )}
                        
                        <div className="flex justify-end gap-3 mt-4">
                            <Button icon={<CloseCircleOutlined />} onClick={() => setDetailVisible(false)}>忽略告警</Button>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default AlertCenter;
