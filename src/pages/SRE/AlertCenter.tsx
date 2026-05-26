import React, { useState } from 'react';
import {
  Table, Card, Tag, Space, Button, Typography, App, Drawer,
  Descriptions, Divider, Badge, Tabs, Modal, Form, Input,
  Select, Switch, Tooltip, Popconfirm, theme, Progress
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
  BellOutlined,
  BookOutlined,
  ArrowRightOutlined,
  UserOutlined,
  ThunderboltOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import useAppStore from '@/store/useAppStore';
import ShareAssetModal from '@/components/ShareAssetModal';
import { 
  getAlertEvents, ignoreAlert, getHealingPolicies, 
  createHealingPolicy, updateHealingPolicy, deleteHealingPolicy,
  exportAlertToKnowledge, triggerAlertHealing, reDiagnoseAlert,
  bulkDeleteAlerts, bulkDeletePolicies
} from '@/api/sre';
import { getPipelines, getPipelineRunDetail } from '@/api/pipeline';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useWebSocket from 'react-use-websocket';

const { Text, Title } = Typography;
const { Search } = Input;

const AlertCenter: React.FC = () => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const setAiDiagnosis = useAppStore(state => state.setAiDiagnosis);
    const { hasPermission, currentProject } = useAppStore();
    const [activeTab, setActiveTab] = useState('alerts');

    // --- 告警事件相关状态 ---
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<any>(null);
    const [alertParams, setAlertParams] = useState<any>({ page: 1, size: 20 });
    const [selectedAlertKeys, setSelectedAlertKeys] = useState<React.Key[]>([]);

    // --- 自愈策略相关状态 ---
    const [policyModalVisible, setPolicyModalVisible] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<any>(null);
    const [sharingPolicy, setSharingPolicy] = useState<any>(null);
    const [policyForm] = Form.useForm();
    const [policyParams, setPolicyParams] = useState<any>({ page: 1, size: 20 });
    const [selectedPolicyKeys, setSelectedPolicyKeys] = useState<React.Key[]>([]);

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

    // 实时追踪自愈流水线状态
    const { data: runDetailQuery } = useQuery({
        queryKey: ['pipeline_run_detail', selectedAlert?.latest_run_id],
        queryFn: () => getPipelineRunDetail(selectedAlert.latest_run_id),
        enabled: !!selectedAlert?.latest_run_id && detailVisible,
        staleTime: Infinity,
    });

    const wsUrl = (selectedAlert?.latest_run_id && detailVisible) ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/pipeline/${selectedAlert.latest_run_id}/` : null;
    const { lastJsonMessage } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
    });

    const runDetail = lastJsonMessage || runDetailQuery;

    // --- 变更操作 ---
    const healingMutation = useMutation({
        mutationFn: (id: number) => triggerAlertHealing(id),
        onSuccess: (res: any) => {
            message.success(t('alertCenter.messages.healingTriggered'));
            if (selectedAlert) {
                setSelectedAlert({ ...selectedAlert, latest_run_id: res.run_id, healing_status: 'executing' });
            }
            queryClient.invalidateQueries({ queryKey: ['sre-alerts'] });
        }
    });

    const reDiagnoseMutation = useMutation({
        mutationFn: (id: number) => reDiagnoseAlert(id),
        onSuccess: () => {
            message.success('已重新诊断，建议已更新');
            queryClient.invalidateQueries({ queryKey: ['sre-alerts'] });
            // Close detail or refresh it
            if (selectedAlert) {
                getAlertEvents({ search: selectedAlert.fingerprint }).then((res: any) => {
                    const data = res.data || [];
                    const updated = data.find((a: any) => a.id === selectedAlert.id);
                    if (updated) setSelectedAlert(updated);
                });
            }
        },
        onError: (err: any) => {
            message.error(err.response?.data?.error || '重新诊断失败');
        }
    });

    const exportAlertMutation = useMutation({
        mutationFn: (id: number) => exportAlertToKnowledge(id),
        onSuccess: () => {
            message.success('已存入知识库');
            if (selectedAlert) {
                setSelectedAlert({ ...selectedAlert, is_exported: true });
            }
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

    const bulkDeleteAlertMutation = useMutation({
        mutationFn: (ids: number[]) => bulkDeleteAlerts(ids),
        onSuccess: () => {
            message.success(t('common.deleteSuccess'));
            setSelectedAlertKeys([]);
            queryClient.invalidateQueries({ queryKey: ['sre-alerts'] });
        }
    });

    const bulkDeletePolicyMutation = useMutation({
        mutationFn: (ids: number[]) => bulkDeletePolicies(ids),
        onSuccess: () => {
            message.success(t('common.deleteSuccess'));
            setSelectedPolicyKeys([]);
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
        'awaiting_approval': { color: 'magenta', text: t('alertCenter.healingStatus.awaiting_approval'), icon: <SafetyCertificateOutlined /> },
        'executing': { color: 'warning', text: t('alertCenter.healingStatus.executing'), icon: <SyncOutlined spin /> },
        'success': { color: 'success', text: t('alertCenter.healingStatus.success'), icon: <CheckCircleOutlined /> },
        'failed': { color: 'error', text: t('alertCenter.healingStatus.failed'), icon: <CloseCircleOutlined /> },
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
            render: (val: string, record: any) => {
                const s = healingStatusMap[val] || { color: 'default', text: val };
                const isAuto = record.is_auto_execute;
                const policyName = record.matched_policy_name;
                
                if (val === 'awaiting_approval' && record.latest_ticket_id) {
                    return (
                        <Link to={`/v1/system/approvals?id=${record.latest_ticket_id}`}>
                            <Space direction="vertical" size={0}>
                                <Space size={4}>
                                    <Badge status={s.color as any} text={s.text} />
                                    {isAuto && <Tag color="gold" style={{ fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}>AUTO</Tag>}
                                </Space>
                                <Text style={{ fontSize: '10px' }} className="text-blue-500 cursor-pointer">
                                    查看工单 #{record.latest_ticket_id}
                                </Text>
                            </Space>
                        </Link>
                    );
                }
                
                if (val === 'executing' && record.latest_run_id) {
                    return (
                        <Tooltip title={`策略: ${policyName || '未知'} | 运行 ID: #${record.latest_run_id} ${isAuto ? '(自动触发)' : ''}`}>
                            <Space direction="vertical" size={2} className="w-24">
                                <Badge status="warning" text={t('alertCenter.healingInProgress')} />
                                <Progress percent={30} size={[80, 4]} showInfo={false} status="active" />
                            </Space>
                        </Tooltip>
                    );
                }
                
                return (
                    <Space direction="vertical" size={0}>
                        <Space size={4}>
                            <Badge status={s.color as any} text={s.text} />
                            {isAuto ? (
                                <Tag color="gold" style={{ fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}>AUTO</Tag>
                            ) : policyName ? (
                                <Tag color="blue" style={{ fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}>MANUAL</Tag>
                            ) : null}
                        </Space>
                        {policyName && (
                            <Text type="secondary" style={{ fontSize: '10px' }} ellipsis={{ tooltip: policyName }}>
                                {policyName}
                            </Text>
                        )}
                    </Space>
                );
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
            render: (val: boolean, record: any) => (
                <Switch 
                    checked={val} 
                    size="small" 
                    onChange={(checked) => {
                        updateHealingPolicy(record.id, { is_auto_execute: checked })
                            .then(() => {
                                message.success('自动执行设置已更新');
                                queryClient.invalidateQueries({ queryKey: ['sre-policies'] });
                            });
                    }}
                />
            )
        },
        {
            title: t('alertCenter.status'),
            dataIndex: 'is_active',
            key: 'is_active',
            render: (val: boolean, record: any) => (
                <Switch 
                    checked={val} 
                    size="small" 
                    onChange={(checked) => {
                        updateHealingPolicy(record.id, { is_active: checked })
                            .then(() => {
                                message.success(checked ? '策略已启用' : '策略已禁用');
                                queryClient.invalidateQueries({ queryKey: ['sre-policies'] });
                            });
                    }}
                />
            )
        },
        {
            title: t('alertCenter.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Tooltip title="跨项目授权">
                        <Button
                            type="link"
                            size="small"
                            icon={<ShareAltOutlined style={{ color: '#1677ff' }} />}
                            onClick={() => setSharingPolicy(record)}
                        />
                    </Tooltip>
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
                                <div className="pt-4 flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <Space>
                                            <Search 
                                                placeholder={t('alertCenter.alertName')} 
                                                allowClear 
                                                onSearch={(val) => setAlertParams({ ...alertParams, alert_name__icontains: val, page: 1 })}
                                                className="w-64"
                                            />
                                            {selectedAlertKeys.length > 0 && (
                                                <Button 
                                                    danger 
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => {
                                                        modal.confirm({
                                                            title: t('common.deleteConfirm'),
                                                            content: `确认删除选中的 ${selectedAlertKeys.length} 条告警？`,
                                                            onOk: () => bulkDeleteAlertMutation.mutate(selectedAlertKeys as number[])
                                                        });
                                                    }}
                                                >
                                                    {t('common.delete')} ({selectedAlertKeys.length})
                                                </Button>
                                            )}
                                        </Space>
                                    </div>
                                    <Table 
                                        dataSource={alertData?.data} 
                                        columns={alertColumns} 
                                        rowKey="id" 
                                        loading={alertsLoading}
                                        rowSelection={{
                                            selectedRowKeys: selectedAlertKeys,
                                            onChange: (keys) => setSelectedAlertKeys(keys)
                                        }}
                                        pagination={{
                                            total: alertData?.total,
                                            current: alertParams.page,
                                            pageSize: alertParams.size,
                                            onChange: (page) => setAlertParams({ ...alertParams, page })
                                        }}
                                    />
                                </div>
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
                                <div className="pt-4 flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <Space>
                                            <Search 
                                                placeholder={t('alertCenter.policyName')} 
                                                allowClear 
                                                onSearch={(val) => setPolicyParams({ ...policyParams, name__icontains: val, page: 1 })}
                                                className="w-64"
                                            />
                                            {selectedPolicyKeys.length > 0 && (
                                                <Button 
                                                    danger 
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => {
                                                        modal.confirm({
                                                            title: t('common.deleteConfirm'),
                                                            content: `确认删除选中的 ${selectedPolicyKeys.length} 条自愈策略？`,
                                                            onOk: () => bulkDeletePolicyMutation.mutate(selectedPolicyKeys as number[])
                                                        });
                                                    }}
                                                >
                                                    {t('common.delete')} ({selectedPolicyKeys.length})
                                                </Button>
                                            )}
                                        </Space>
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
                                        rowSelection={{
                                            selectedRowKeys: selectedPolicyKeys,
                                            onChange: (keys) => setSelectedPolicyKeys(keys)
                                        }}
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
                            className="rounded-xl border-none shadow-md overflow-hidden"
                            extra={selectedAlert.healing_status === 'analyzing' && <LoadingOutlined />}
                            styles={{ body: { paddingBottom: selectedAlert.ai_analysis ? 0 : '24px' } }}
                        >
                            {selectedAlert.ai_analysis ? (
                                <>
                                    <div className="prose prose-slate max-w-none prose-sm pb-4">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {selectedAlert.ai_analysis}
                                        </ReactMarkdown>
                                    </div>
                                    <div className="flex justify-end items-center py-3 border-t -mx-6 px-6 bg-gray-50/50 dark:bg-white/5 gap-2">
                                        <Button 
                                            type="link" 
                                            size="small" 
                                            icon={<ThunderboltOutlined />}
                                            onClick={() => {
                                                setAiDiagnosis({
                                                    target_type: 'alert',
                                                    target_id: selectedAlert.id,
                                                    target_name: selectedAlert.alert_name
                                                });
                                            }}
                                            className="text-xs"
                                        >
                                            {t('alertCenter.deepDiagnosis')}
                                        </Button>
                                        <Button 
                                            type="text" 
                                            size="small" 
                                            icon={selectedAlert.is_exported ? <CheckCircleOutlined style={{ color: token.colorSuccess }} /> : <BookOutlined />}
                                            disabled={selectedAlert.is_exported}
                                            loading={exportAlertMutation.isPending}
                                            onClick={() => exportAlertMutation.mutate(selectedAlert.id)}
                                            className="text-xs"
                                        >
                                            {selectedAlert.is_exported ? t('alertCenter.alreadyExported') : t('alertCenter.exportToKnowledge')}
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="py-10 text-center italic" style={{ color: token.colorTextTertiary }}>
                                    {selectedAlert.healing_status === 'analyzing' ? t('alertCenter.detail.analyzing') : t('common.noData')}
                                </div>
                            )}
                        </Card>

                        {selectedAlert.suggested_pipeline && (
                            <div
                                className="p-6 rounded-2xl text-white shadow-lg overflow-hidden relative"
                                style={{ backgroundColor: token.colorPrimary, boxShadow: `0 8px 24px ${token.colorPrimary}40` }}
                            >
                                <div className="flex flex-col gap-4 relative z-10">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="text-[10px] uppercase font-bold opacity-80 tracking-widest">{t('alertCenter.detail.recommendedRemediation')}</div>
                                                {selectedAlert.trigger_type === 'auto' ? (
                                                    <Tag color="gold" className="border-none text-[9px] px-2 py-0 leading-normal flex items-center gap-1">
                                                        <SafetyCertificateOutlined /> 自动执行已触发
                                                    </Tag>
                                                ) : selectedAlert.latest_run_id ? (
                                                     <Tag color="blue" className="border-none text-[9px] px-2 py-0 leading-normal flex items-center gap-1 opacity-90" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                                                        <UserOutlined /> 手动干预中
                                                     </Tag>
                                                ) : selectedAlert.suggested_pipeline ? (
                                                     <Tag color="white" className="border-none text-[9px] px-2 py-0 leading-normal flex items-center gap-1 opacity-80" style={{ color: token.colorPrimary }}>
                                                        <InfoCircleOutlined /> 匹配自愈策略
                                                     </Tag>
                                                ) : null}
                                            </div>
                                            <div className="text-lg font-bold flex items-center gap-2">
                                                {t('alertCenter.actions.executeHealing')}
                                                {runDetail?.data?.status && (
                                                    <Tag color="white" style={{ color: token.colorPrimary }} className="border-none px-2 py-0 text-[10px]">
                                                        {runDetail.data.status.toUpperCase()}
                                                    </Tag>
                                                )}
                                            </div>
                                            <div className="text-xs opacity-90 mt-1">Pipeline: {selectedAlert.suggested_pipeline_name || `ID: ${selectedAlert.suggested_pipeline}`}</div>
                                        </div>

                                        {!selectedAlert.latest_run_id || runDetail?.data?.status === 'failed' ? (
                                            <Space>
                                                <Button
                                                    size="large"
                                                    className="h-12 px-8 rounded-xl font-bold border-none shadow-md"
                                                    style={{ backgroundColor: token.colorBgContainer, color: token.colorPrimary }}
                                                    icon={<PlayCircleOutlined />}
                                                    loading={healingMutation.isPending}
                                                    onClick={() => {
                                                        modal.confirm({
                                                            title: t('alertCenter.confirmHealingTitle'),
                                                            content: t('alertCenter.confirmHealingContent'),
                                                            onOk: () => healingMutation.mutate(selectedAlert.id)
                                                        });
                                                    }}
                                                >
                                                    {t('alertCenter.actions.executeNow')}
                                                </Button>
                                                {runDetail?.data?.status === 'failed' && (
                                                    <Button
                                                        size="large"
                                                        className="h-12 px-6 rounded-xl font-bold border border-white/20 text-white hover:border-white shadow-md"
                                                        style={{ backgroundColor: 'transparent' }}
                                                        icon={<SyncOutlined />}
                                                        loading={reDiagnoseMutation.isPending}
                                                        onClick={() => reDiagnoseMutation.mutate(selectedAlert.id)}
                                                    >
                                                        一键重诊
                                                    </Button>
                                                )}
                                            </Space>
                                        ) : (
                                            <Link to={`/v1/pipeline/runs/${selectedAlert.latest_run_id}`}>
                                                <Button
                                                    size="large"
                                                    className="h-12 px-8 rounded-xl font-bold border-none shadow-md"
                                                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
                                                    icon={<ArrowRightOutlined />}
                                                >
                                                    查看执行详情
                                                </Button>
                                            </Link>
                                        )}
                                    </div>

                                    {selectedAlert.latest_run_id && (
                                        <div className="bg-black/10 p-3 rounded-xl">
                                            <div className="flex justify-between items-center text-[10px] mb-2 opacity-90 text-white">
                                                <span>自愈执行进度</span>
                                                <span>{runDetail?.data?.progress || (selectedAlert.healing_status === 'success' ? 100 : 0)}%</span>
                                            </div>
                                            <Progress 
                                                percent={runDetail?.data?.progress || (selectedAlert.healing_status === 'success' ? 100 : 0)} 
                                                size="small" 
                                                strokeColor="#fff" 
                                                trailColor="rgba(255,255,255,0.2)" 
                                                showInfo={false}
                                                status={runDetail?.data?.status === 'failed' ? 'exception' : 'active'}
                                            />
                                        </div>
                                    )}
                                </div>
                                {/* 背景修饰图标 */}
                                <RobotOutlined className="absolute -right-4 -bottom-4 text-8xl opacity-10 rotate-12" />
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

            {sharingPolicy && currentProject && (
                <ShareAssetModal
                    open={!!sharingPolicy}
                    onClose={() => setSharingPolicy(null)}
                    assetType="self_healing_policy"
                    assetId={sharingPolicy.id}
                    assetName={sharingPolicy.name}
                    fromProjectId={currentProject.id}
                />
            )}
        </div>
    );
};

export default AlertCenter;
