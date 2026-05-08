import React, { useState } from 'react';
import { 
  Table, Card, Tag, Space, Button, Typography, App, Drawer, 
  Descriptions, Divider, Badge, Tabs, Modal, Form, Input, 
  Select, Switch, Tooltip, Popconfirm 
} from 'antd';
import { 
  SyncOutlined, 
  RobotOutlined, 
  PlayCircleOutlined, 
  CloseCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  WarningOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  getAlertEvents, ignoreAlert, getHealingPolicies, 
  createHealingPolicy, updateHealingPolicy, deleteHealingPolicy 
} from '@/api/sre';
import { executePipeline, getPipelines } from '@/api/pipeline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Text, Title } = Typography;

const AlertCenter: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const [activeTab, setActiveTab] = useState('alerts');

    // --- 告警事件相关状态 ---
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<any>(null);
    const [alertParams, setAlertParams] = useState({ page: 1, size: 20 });

    // --- 自愈策略相关状态 ---
    const [policyModalVisible, setPolicyModalVisible] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<any>(null);
    const [policyForm] = Form.useForm();
    const [policyParams, setPolicyParams] = useState({ page: 1, size: 20 });

    // --- 数据获取 ---
    const { data: alertData, isLoading: alertsLoading } = useQuery({
        queryKey: ['sre-alerts', alertParams],
        queryFn: () => getAlertEvents(alertParams),
        refetchInterval: activeTab === 'alerts' ? 5000 : false,
    });

    const { data: policyData, isLoading: policiesLoading } = useQuery({
        queryKey: ['sre-policies', policyParams],
        queryFn: () => getHealingPolicies(policyParams),
        enabled: activeTab === 'policies',
    });

    const { data: pipelinesData } = useQuery({
        queryKey: ['pipelines-list-all'],
        queryFn: () => getPipelines({ page_size: 1000 }),
        enabled: policyModalVisible,
    });

    // --- 变更操作 ---
    const healingMutation = useMutation({
        mutationFn: (id: number) => executePipeline(id),
        onSuccess: () => {
            message.success('自愈流水线已触发执行');
            queryClient.invalidateQueries({ queryKey: ['sre-alerts'] });
        }
    });

    const policyMutation = useMutation({
        mutationFn: (values: any) => {
            if (editingPolicy) return updateHealingPolicy(editingPolicy.id, values);
            return createHealingPolicy(values);
        },
        onSuccess: () => {
            message.success(editingPolicy ? '策略已更新' : '策略已创建');
            setPolicyModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['sre-policies'] });
        }
    });

    const deletePolicyMutation = useMutation({
        mutationFn: (id: number) => deleteHealingPolicy(id),
        onSuccess: () => {
            message.success('策略已删除');
            queryClient.invalidateQueries({ queryKey: ['sre-policies'] });
        }
    });

    // --- 映射常量 ---
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

    // --- 表格定义 ---
    const alertColumns = [
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
                <Button 
                    type="link" 
                    size="small"
                    icon={<InfoCircleOutlined />} 
                    onClick={() => {
                        setSelectedAlert(record);
                        setDetailVisible(true);
                    }}
                >
                    诊断详情
                </Button>
            )
        }
    ];

    const policyColumns = [
        {
            title: '策略名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: '匹配关键词 (JSON)',
            dataIndex: 'alert_match_rule',
            key: 'alert_match_rule',
            render: (rule: any) => (
                <div className="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {Object.entries(rule).map(([k, v]: any) => (
                        <Tag key={k} color="blue" size="small">{k}: {v}</Tag>
                    ))}
                </div>
            )
        },
        {
            title: '绑定流水线',
            dataIndex: 'pipeline_name',
            key: 'pipeline_name',
            render: (text: string, record: any) => <Tag color="cyan">{text || `ID: ${record.pipeline}`}</Tag>
        },
        {
            title: '自动执行',
            dataIndex: 'is_auto_execute',
            key: 'is_auto_execute',
            render: (val: boolean) => <Badge status={val ? 'success' : 'default'} text={val ? '开启' : '关闭'} />
        },
        {
            title: '状态',
            dataIndex: 'is_active',
            key: 'is_active',
            render: (val: boolean) => <Switch checked={val} size="small" disabled />
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button 
                        type="link" 
                        size="small"
                        icon={<EditOutlined />} 
                        onClick={() => {
                            setEditingPolicy(record);
                            policyForm.setFieldsValue({
                                ...record,
                                alert_match_rule: JSON.stringify(record.alert_match_rule, null, 2)
                            });
                            setPolicyModalVisible(true);
                        }}
                    >
                        编辑
                    </Button>
                    <Popconfirm 
                        title="确定删除此策略吗？" 
                        onConfirm={() => deletePolicyMutation.mutate(record.id)}
                    >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center px-4 pt-2">
                <div>
                    <Title level={3} className="m-0!">SRE 智能运维中心</Title>
                    <Text type="secondary">集成告警监测、AI 根因分析与自动化自愈闭环</Text>
                </div>
                <Space>
                    <Tooltip title="配置通知渠道">
                        <Button shape="circle" icon={<BellOutlined />} />
                    </Tooltip>
                    <Button 
                        type="primary" 
                        icon={<SyncOutlined />} 
                        onClick={() => queryClient.invalidateQueries({ queryKey: [activeTab === 'alerts' ? 'sre-alerts' : 'sre-policies'] })}
                    >
                        刷新数据
                    </Button>
                </Space>
            </div>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden" styles={{ body: { padding: '0 24px 24px' } }}>
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab}
                    className="sre-tabs"
                    items={[
                        {
                            key: 'alerts',
                            label: (
                                <Space>
                                    <WarningOutlined />
                                    <span>实时告警</span>
                                    {alertData?.total ? <Badge count={alertData.total} overflowCount={99} size="small" offset={[5, 0]} /> : null}
                                </Space>
                            ),
                            children: (
                                <Table 
                                    dataSource={alertData?.data} 
                                    columns={alertColumns} 
                                    rowKey="id" 
                                    loading={alertsLoading}
                                    pagination={{
                                        total: alertData?.total,
                                        current: alertParams.page,
                                        pageSize: alertParams.size,
                                        onChange: (page) => setAlertParams({ ...alertParams, page })
                                    }}
                                />
                            )
                        },
                        {
                            key: 'policies',
                            label: (
                                <Space>
                                    <SafetyCertificateOutlined />
                                    <span>自愈策略</span>
                                </Space>
                            ),
                            children: (
                                <div className="pt-4">
                                    <div className="mb-4 flex justify-end">
                                        <Button 
                                            type="primary" 
                                            icon={<PlusOutlined />} 
                                            onClick={() => {
                                                setEditingPolicy(null);
                                                policyForm.resetFields();
                                                setPolicyModalVisible(true);
                                            }}
                                        >
                                            新增策略
                                        </Button>
                                    </div>
                                    <Table 
                                        dataSource={policyData?.data} 
                                        columns={policyColumns} 
                                        rowKey="id" 
                                        loading={policiesLoading}
                                        pagination={{
                                            total: policyData?.total,
                                            current: policyParams.page,
                                            pageSize: policyParams.size,
                                            onChange: (page) => setPolicyParams({ ...policyParams, page })
                                        }}
                                    />
                                </div>
                            )
                        }
                    ]}
                />
            </Card>

            {/* 告警诊断详情抽屉 */}
            <Drawer
                title={
                    <Space>
                        <RobotOutlined className="text-blue-600" />
                        <span>AI 智能诊断报告</span>
                    </Space>
                }
                width={700}
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
                styles={{ body: { padding: '24px', backgroundColor: '#f8fafc' } }}
            >
                {selectedAlert && (
                    <div className="flex flex-col gap-6">
                        <Descriptions title="告警上下文" bordered column={1} size="small" className="bg-white rounded-xl overflow-hidden">
                            <Descriptions.Item label="告警名称">{selectedAlert.alert_name}</Descriptions.Item>
                            <Descriptions.Item label="源">{selectedAlert.source}</Descriptions.Item>
                            <Descriptions.Item label="严重程度"><Tag color="red">{selectedAlert.severity}</Tag></Descriptions.Item>
                            <Descriptions.Item label="标签">
                                {Object.entries(selectedAlert.labels).map(([k, v]: any) => (
                                    <Tag key={k} className="mb-1">{k}: {v}</Tag>
                                ))}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card 
                            title={<Space><RobotOutlined className="text-blue-600" /> 诊断结论</Space>} 
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
                                <div className="py-10 text-center text-slate-400 italic">
                                    {selectedAlert.healing_status === 'analyzing' ? 'AI 正在分析历史知识库并生成报告...' : '暂无分析报告'}
                                </div>
                            )}
                        </Card>

                        {selectedAlert.suggested_pipeline && (
                            <div className="p-5 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold opacity-80 tracking-widest mb-1">Recommended Remediation</div>
                                        <div className="text-lg font-bold">执行自愈流水线</div>
                                        <div className="text-xs opacity-90 mt-1">流水线: {selectedAlert.suggested_pipeline_name || `ID: ${selectedAlert.suggested_pipeline}`}</div>
                                    </div>
                                    <Button 
                                        size="large"
                                        className="h-12 px-8 rounded-xl font-bold bg-white text-blue-600 border-none hover:!bg-blue-50"
                                        icon={<PlayCircleOutlined />}
                                        onClick={() => {
                                            modal.confirm({
                                                title: '确认执行自愈任务？',
                                                content: 'AI 评估此操作可以恢复业务。',
                                                onOk: () => healingMutation.mutate(selectedAlert.suggested_pipeline)
                                            });
                                        }}
                                    >
                                        立即执行
                                    </Button>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-3 mt-4">
                            <Button icon={<CloseCircleOutlined />} onClick={() => setDetailVisible(false)}>关闭详情</Button>
                        </div>
                    </div>
                )}
            </Drawer>

            {/* 策略编辑/创建弹窗 */}
            <Modal
                title={editingPolicy ? "编辑自愈策略" : "新增自愈策略"}
                open={policyModalVisible}
                onCancel={() => setPolicyModalVisible(false)}
                onOk={() => policyForm.submit()}
                width={600}
                confirmLoading={policyMutation.isPending}
            >
                <Form 
                    form={policyForm} 
                    layout="vertical" 
                    className="mt-4"
                    onFinish={(values) => {
                        try {
                            // 校验并转换 JSON 规则
                            const rule = typeof values.alert_match_rule === 'string' 
                                ? JSON.parse(values.alert_match_rule) 
                                : values.alert_match_rule;
                            policyMutation.mutate({ ...values, alert_match_rule: rule });
                        } catch (e) {
                            message.error('匹配规则 JSON 格式错误');
                        }
                    }}
                >
                    <Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
                        <Input placeholder="例如：CPU 高负载自愈" />
                    </Form.Item>
                    
                    <Form.Item 
                        name="alert_match_rule" 
                        label="告警匹配规则 (JSON 格式)" 
                        rules={[{ required: true }]}
                        extra='例如：{"alertname": "CPUUsageTooHigh", "severity": "critical"}'
                    >
                        <Input.TextArea rows={4} placeholder='{"key": "value"}' className="font-mono" />
                    </Form.Item>

                    <Form.Item name="pipeline" label="关联自愈流水线" rules={[{ required: true }]}>
                        <Select 
                            showSearch
                            placeholder="请选择执行修复的流水线"
                            optionFilterProp="label"
                            options={(pipelinesData?.data || []).map((p: any) => ({ label: p.name, value: p.id }))}
                        />
                    </Form.Item>

                    <Space size={32}>
                        <Form.Item name="is_auto_execute" label="是否自动执行" valuePropName="checked" initialValue={false}>
                            <Switch />
                        </Form.Item>
                        <Form.Item name="is_active" label="是否启用" valuePropName="checked" initialValue={true}>
                            <Switch />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>
        </div>
    );
};

export default AlertCenter;
