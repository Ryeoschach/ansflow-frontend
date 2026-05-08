import React, { useState } from 'react';
import {
  Table, Card, Tag, Space, Button, Typography, App, Drawer,
  Descriptions, Divider, Badge, Tabs, Modal, Form, Input,
  Select, Switch, Tooltip, Popconfirm, theme
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
    const { token } = theme.useToken();
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
            message.success(t('alertCenter.messages.healingTriggered'));
            queryClient.invalidateQueries({ queryKey: ['sre-alerts'] });
        }
    });

    const policyMutation = useMutation({
        mutationFn: (values: any) => {
            if (editingPolicy) return updateHealingPolicy(editingPolicy.id, values);
            return createHealingPolicy(values);
        },
        onSuccess: () => {
            message.success(editingPolicy ? t('alertCenter.messages.policyUpdated') : t('alertCenter.messages.policyCreated'));
            setPolicyModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['sre-policies'] });
        }
    });

    const deletePolicyMutation = useMutation({
        mutationFn: (id: number) => deleteHealingPolicy(id),
        onSuccess: () => {
            message.success(t('alertCenter.messages.policyDeleted'));
            queryClient.invalidateQueries({ queryKey: ['sre-policies'] });
        }
    });

    // --- 映射常量 ---
    const statusMap: any = {
        'firing': { color: 'error', text: t('alertCenter.statusText.firing'), icon: <WarningOutlined /> },
        'resolved': { color: 'success', text: t('alertCenter.statusText.resolved'), icon: <CheckCircleOutlined /> },
    };

    const healingStatusMap: any = {
        'none': { color: 'default', text: t('alertCenter.healingStatus.none') },
        'analyzing': { color: 'processing', text: t('alertCenter.healingStatus.analyzing'), icon: <LoadingOutlined /> },
        'suggested': { color: 'cyan', text: t('alertCenter.healingStatus.suggested'), icon: <RobotOutlined /> },
        'executing': { color: 'warning', text: t('alertCenter.healingStatus.executing'), icon: <SyncOutlined spin /> },
        'success': { color: 'success', text: t('alertCenter.healingStatus.success') },
        'failed': { color: 'error', text: t('alertCenter.healingStatus.failed') },
        'ignored': { color: 'default', text: t('alertCenter.healingStatus.ignored') },
    };

    // --- 表格定义 ---
    const alertColumns = [
        {
            title: t('alertCenter.alertName'),
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
            title: t('alertCenter.level'),
            dataIndex: 'severity',
            key: 'severity',
            render: (val: string) => {
                let color = 'orange';
                if (val === 'critical') color = 'red';
                if (val === 'info') color = 'blue';
                const severityKey = val as 'critical' | 'warning' | 'info';
                const severityText = t(`alertCenter.severity.${severityKey}`, val);
                return <Tag color={color}>{severityText}</Tag>;
            }
        },
        {
            title: t('alertCenter.status'),
            dataIndex: 'status',
            key: 'status',
            render: (val: string) => {
                const s = statusMap[val] || { color: 'default', text: val };
                return <Tag icon={s.icon} color={s.color}>{s.text}</Tag>;
            }
        },
        {
            title: t('alertCenter.healingProgress'),
            dataIndex: 'healing_status',
            key: 'healing_status',
            render: (val: string) => {
                const s = healingStatusMap[val] || { color: 'default', text: val };
                return <Badge status={s.color as any} text={s.text} />;
            }
        },
        {
            title: t('alertCenter.createTime'),
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => new Date(val).toLocaleString()
        },
        {
            title: t('alertCenter.action'),
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
                    {t('alertCenter.actions.viewDetail')}
                </Button>
            )
        }
    ];

    const policyColumns = [
        {
            title: t('alertCenter.policyName'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: t('alertCenter.matchKeywords'),
            dataIndex: 'alert_match_rule',
            key: 'alert_match_rule',
            render: (rule: any) => (
                <div className="flex gap-1 flex-wrap max-w-[240px] overflow-x-auto">
                    {Object.entries(rule).map(([k, v]: any) => (
                        <Tag key={k} style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary, borderColor: token.colorPrimaryBorder }}>{k}: {v}</Tag>
                    ))}
                </div>
            )
        },
        {
            title: t('alertCenter.boundPipeline'),
            dataIndex: 'pipeline_name',
            key: 'pipeline_name',
            render: (text: string, record: any) => <Tag color="cyan">{text || `ID: ${record.pipeline}`}</Tag>
        },
        {
            title: t('alertCenter.autoExecute'),
            dataIndex: 'is_auto_execute',
            key: 'is_auto_execute',
            render: (val: boolean) => <Badge status={val ? 'success' : 'default'} text={val ? t('common.enabled') : t('common.disabled')} />
        },
        {
            title: t('alertCenter.status'),
            dataIndex: 'is_active',
            key: 'is_active',
            render: (val: boolean) => <Switch checked={val} size="small" disabled />
        },
        {
            title: t('alertCenter.action'),
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
                        {t('alertCenter.actions.edit')}
                    </Button>
                    <Popconfirm
                        title={t('alertCenter.confirmDelete')}
                        onConfirm={() => deletePolicyMutation.mutate(record.id)}
                    >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>{t('alertCenter.actions.delete')}</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center px-4 pt-2">
                <div>
                    <Title level={3} className="m-0!">{t('alertCenter.pageTitle')}</Title>
                    <Text type="secondary">{t('alertCenter.pageSubtitle')}</Text>
                </div>
                <Space>
                    <Tooltip title={t('alertCenter.actions.configNotification')}>
                        <Button shape="circle" icon={<BellOutlined />} />
                    </Tooltip>
                    <Button
                        type="primary"
                        icon={<SyncOutlined />}
                        onClick={() => queryClient.invalidateQueries({ queryKey: [activeTab === 'alerts' ? 'sre-alerts' : 'sre-policies'] })}
                    >
                        {t('alertCenter.actions.refresh')}
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
                                    <span>{t('alertCenter.alertTab')}</span>
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
                                    <span>{t('alertCenter.policyTab')}</span>
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
                                            {t('alertCenter.actions.createPolicy')}
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
                        <RobotOutlined style={{ color: token.colorPrimary }} />
                        <span>{t('alertCenter.detail.aiDiagnosisTitle')}</span>
                    </Space>
                }
                width={700}
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
                styles={{ body: { padding: '24px', backgroundColor: token.colorBgLayout } }}
            >
                {selectedAlert && (
                    <div className="flex flex-col gap-6">
                        <Descriptions title={t('alertCenter.detail.context')} bordered column={1} size="small" className="rounded-xl overflow-hidden" style={{ backgroundColor: token.colorBgContainer }}>
                            <Descriptions.Item label={t('alertCenter.alertName')}>{selectedAlert.alert_name}</Descriptions.Item>
                            <Descriptions.Item label={t('alertCenter.detail.source')}>{selectedAlert.source}</Descriptions.Item>
                            <Descriptions.Item label={t('alertCenter.detail.severity')}><Tag color="red">{selectedAlert.severity}</Tag></Descriptions.Item>
                            <Descriptions.Item label="Labels">
                                {Object.entries(selectedAlert.labels).map(([k, v]: any) => (
                                    <Tag key={k} className="mb-1">{k}: {v}</Tag>
                                ))}
                            </Descriptions.Item>
                        </Descriptions>

                        <Card
                            title={<Space><RobotOutlined style={{ color: token.colorPrimary }} /> {t('alertCenter.detail.diagnosisTitle')}</Space>} 
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
                                <div className="py-10 text-center italic" style={{ color: token.colorTextTertiary }}>
                                    {selectedAlert.healing_status === 'analyzing' ? t('alertCenter.detail.analyzing') : t('common.noData')}
                                </div>
                            )}
                        </Card>

                        {selectedAlert.suggested_pipeline && (
                            <div
                                className="p-5 rounded-2xl text-white shadow-lg"
                                style={{ backgroundColor: token.colorPrimary, boxShadow: `0 8px 24px ${token.colorPrimary}40` }}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold opacity-80 tracking-widest mb-1">{t('alertCenter.detail.recommendedRemediation')}</div>
                                        <div className="text-lg font-bold">{t('alertCenter.actions.executeHealing')}</div>
                                        <div className="text-xs opacity-90 mt-1">Pipeline: {selectedAlert.suggested_pipeline_name || `ID: ${selectedAlert.suggested_pipeline}`}</div>
                                    </div>
                                    <Button
                                        size="large"
                                        className="h-12 px-8 rounded-xl font-bold border-none"
                                        style={{ backgroundColor: token.colorBgContainer, color: token.colorPrimary }}
                                        icon={<PlayCircleOutlined />}
                                        onClick={() => {
                                            modal.confirm({
                                                title: t('alertCenter.confirmHealingTitle'),
                                                content: t('alertCenter.confirmHealingContent'),
                                                onOk: () => healingMutation.mutate(selectedAlert.suggested_pipeline)
                                            });
                                        }}
                                    >
                                        {t('alertCenter.actions.executeNow')}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-4">
                            <Button icon={<CloseCircleOutlined />} onClick={() => setDetailVisible(false)}>{t('common.close')}</Button>
                        </div>
                    </div>
                )}
            </Drawer>

            {/* 策略编辑/创建弹窗 */}
            <Modal
                title={editingPolicy ? t('alertCenter.policy.editTitle') : t('alertCenter.policy.createTitle')}
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
                            message.error(t('alertCenter.policy.jsonFormatError'));
                        }
                    }}
                >
                    <Form.Item name="name" label={t('alertCenter.policy.name')} rules={[{ required: true }]}>
                        <Input placeholder={t('alertCenter.policy.namePlaceholder')} />
                    </Form.Item>

                    <Form.Item
                        name="alert_match_rule"
                        label={t('alertCenter.policy.matchRule')}
                        rules={[{ required: true }]}
                        extra={t('alertCenter.policy.matchRuleExtra')}
                    >
                        <Input.TextArea rows={4} placeholder='{"key": "value"}' className="font-mono" />
                    </Form.Item>

                    <Form.Item name="pipeline" label={t('alertCenter.policy.pipeline')} rules={[{ required: true }]}>
                        <Select
                            showSearch
                            placeholder={t('alertCenter.policy.pipelinePlaceholder')}
                            optionFilterProp="label"
                            options={(pipelinesData?.data || []).map((p: any) => ({ label: p.name, value: p.id }))}
                        />
                    </Form.Item>

                    <Space size={32}>
                        <Form.Item name="is_auto_execute" label={t('alertCenter.policy.autoExecute')} valuePropName="checked" initialValue={false}>
                            <Switch />
                        </Form.Item>
                        <Form.Item name="is_active" label={t('alertCenter.policy.enabled')} valuePropName="checked" initialValue={true}>
                            <Switch />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>
        </div>
    );
};

export default AlertCenter;
