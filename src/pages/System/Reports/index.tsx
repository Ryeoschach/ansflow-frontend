import React, { useState } from 'react';
import { Card, Row, Col, DatePicker, Button, Table, Typography, Space, Input, Progress, Skeleton, theme, Badge, Tag, Tabs, Modal, Checkbox, Select, Tooltip } from 'antd';
import { DownloadOutlined, SearchOutlined, AlertOutlined, CheckCircleOutlined, ThunderboltOutlined, SyncOutlined, BarChartOutlined, LineChartOutlined, SecurityScanOutlined, FilterOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../../store/useAppStore';
import { getAlertReport } from '../../../api/sre';
import { getPipelineReport, getAnsibleReport, getComplianceReport, exportSystemReport } from '../../../api/system';
import { getEnvironments, getPlatforms, getResourcePools } from '../../../api/hosts';
import dayjs from 'dayjs';
import { message } from '../../../utils/antd';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

const SystemReports: React.FC = () => {
    const { t } = useTranslation();
    const { isDark, projects, currentProject } = useAppStore();
    const { token } = theme.useToken();
    const [activeTab, setActiveTab] = useState('pipeline');
    const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(7, 'day'),
        dayjs()
    ]);

    // Search and filter states
    const [alertSearchText, setAlertSearchText] = useState('');
    const [ansibleFilters, setAnsibleFilters] = useState({
        envId: undefined as number | undefined,
        platformId: undefined as number | undefined,
        poolId: undefined as number | undefined,
    });

    // Export Modal State
    const [exportModalVisible, setExportModalVisible] = useState(false);
    const [exportTypes, setExportTypes] = useState<string[]>(['pipeline', 'ansible', 'compliance']);
    const [exportFilters, setExportFilters] = useState({
        projectId: currentProject?.id || undefined,
        envId: undefined,
        platformId: undefined,
        poolId: undefined,
    });
    const [exportTimeRange, setExportTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(7, 'day'),
        dayjs()
    ]);

    const startTimeStr = timeRange[0].startOf('day').toISOString();
    const endTimeStr = timeRange[1].endOf('day').toISOString();

    // -------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------
    const { data: pipelineData, isLoading: isPipelineLoading } = useQuery({
        queryKey: ['pipelineReport', startTimeStr, endTimeStr, currentProject?.id],
        queryFn: () => getPipelineReport({ start_time: startTimeStr, end_time: endTimeStr, project_id: currentProject?.id }),
        enabled: activeTab === 'pipeline' && !!timeRange[0]
    });

    const { data: ansibleData, isLoading: isAnsibleLoading } = useQuery({
        queryKey: ['ansibleReport', startTimeStr, endTimeStr, currentProject?.id, ansibleFilters.envId, ansibleFilters.platformId, ansibleFilters.poolId],
        queryFn: () => getAnsibleReport({
            start_time: startTimeStr,
            end_time: endTimeStr,
            project_id: currentProject?.id,
            env_id: ansibleFilters.envId,
            platform_id: ansibleFilters.platformId,
            resource_pool_id: ansibleFilters.poolId
        }),
        enabled: activeTab === 'ansible' && !!timeRange[0]
    });

    const { data: complianceData, isLoading: isComplianceLoading } = useQuery({
        queryKey: ['complianceReport'],
        queryFn: () => getComplianceReport(),
        enabled: activeTab === 'compliance'
    });

    const { data: alertData, isLoading: isAlertLoading } = useQuery({
        queryKey: ['sreAlertReport', startTimeStr, endTimeStr],
        queryFn: () => getAlertReport({ start_time: startTimeStr, end_time: endTimeStr }),
        enabled: activeTab === 'sre' && !!timeRange[0]
    });

    // Helper options queries
    const { data: envsData } = useQuery({
        queryKey: ['environments_all'],
        queryFn: () => getEnvironments({ page: 1, size: 100 })
    });
    const { data: platformsData } = useQuery({
        queryKey: ['platforms_all'],
        queryFn: () => getPlatforms({ page: 1, size: 100 })
    });
    const { data: poolsData } = useQuery({
        queryKey: ['pools_all'],
        queryFn: () => getResourcePools({ page: 1, size: 100 })
    });

    const envsList = envsData?.data || [];
    const platformsList = platformsData?.data || [];
    const poolsList = poolsData?.data || [];

    // -------------------------------------------------------------
    // Export handler
    // -------------------------------------------------------------
    const handleExport = async () => {
        try {
            await exportSystemReport({
                export_types: exportTypes,
                start_time: exportTimeRange[0].startOf('day').toISOString(),
                end_time: exportTimeRange[1].endOf('day').toISOString(),
                filters: {
                    project_id: exportFilters.projectId,
                    env_id: exportFilters.envId,
                    platform_id: exportFilters.platformId,
                    resource_pool_id: exportFilters.poolId
                }
            });
            message.success(t('report.exportSubmitted') || '报表生成任务已提交，多维报表包生成完成后将在通知中心收到下载提示');
            setExportModalVisible(false);
        } catch (err) {
            console.error('Failed to trigger export:', err);
        }
    };

    // -------------------------------------------------------------
    // Charts options definitions
    // -------------------------------------------------------------
    const getPipelineTrendOption = () => {
        const trend = pipelineData?.trend || [];
        return {
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderWidth: 0,
                textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 12 },
                extraCssText: 'box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius: 8px;'
            },
            legend: {
                data: ['总运行次数', '执行成功', '执行失败'],
                bottom: 0,
                icon: 'circle',
                textStyle: { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }
            },
            grid: { left: '3%', right: '3%', bottom: '10%', top: '30', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: trend.map((item: any) => item.day),
                axisLabel: { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' },
                axisLine: { show: false }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', type: 'dashed' } },
                axisLabel: { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }
            },
            series: [
                {
                    name: '总运行次数',
                    type: 'line',
                    smooth: true,
                    data: trend.map((item: any) => item.total),
                    itemStyle: { color: '#1890ff' }
                },
                {
                    name: '执行成功',
                    type: 'line',
                    smooth: true,
                    data: trend.map((item: any) => item.success),
                    itemStyle: { color: '#52c41a' }
                },
                {
                    name: '执行失败',
                    type: 'line',
                    smooth: true,
                    data: trend.map((item: any) => item.failed),
                    itemStyle: { color: '#ff4d4f' }
                }
            ]
        };
    };

    const getPipelineTriggerOption = () => {
        const dist = pipelineData?.trigger_distribution || [];
        return {
            tooltip: { trigger: 'item' },
            legend: { orient: 'vertical', left: 'left', textStyle: { color: isDark ? '#fff' : '#000' } },
            series: [
                {
                    name: '触发源分布',
                    type: 'pie',
                    radius: ['40%', '70%'],
                    avoidLabelOverlap: false,
                    itemStyle: { borderRadius: 10, borderColor: isDark ? '#141414' : '#fff', borderWidth: 2 },
                    label: { show: false },
                    data: dist.map((item: any) => ({ value: item.count, name: item.label }))
                }
            ]
        };
    };

    const getAnsibleTrendOption = () => {
        const trend = ansibleData?.trend || [];
        return {
            tooltip: { trigger: 'axis' },
            legend: { data: ['任务运行数', '成功数', '失败数'], bottom: 0, textStyle: { color: isDark ? '#fff' : '#000' } },
            grid: { left: '3%', right: '3%', bottom: '10%', top: '30', containLabel: true },
            xAxis: { type: 'category', data: trend.map((item: any) => item.day), axisLabel: { color: isDark ? '#aaa' : '#555' } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } } },
            series: [
                { name: '任务运行数', type: 'bar', data: trend.map((item: any) => item.total), itemStyle: { color: '#13c2c2' } },
                { name: '成功数', type: 'line', data: trend.map((item: any) => item.success), itemStyle: { color: '#52c41a' } },
                { name: '失败数', type: 'line', data: trend.map((item: any) => item.failed), itemStyle: { color: '#f5222d' } }
            ]
        };
    };

    const getAnsibleBreakdownOption = (dimension: 'environment' | 'platform' | 'resource_pool') => {
        const list = ansibleData?.breakdown?.[dimension] || [];
        return {
            tooltip: { trigger: 'item' },
            series: [
                {
                    name: '执行次数占比',
                    type: 'pie',
                    radius: '60%',
                    data: list.map((item: any) => ({ value: item.count, name: `${item.name} (${item.success_rate}%)` })),
                    emphasis: {
                        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                    }
                }
            ]
        };
    };

    const getComplianceDistributionOption = () => {
        const dist = complianceData?.clause_distribution || { success: 0, failed: 0, running: 0, pending: 0 };
        return {
            tooltip: { trigger: 'item' },
            legend: { orient: 'vertical', left: 'left', textStyle: { color: isDark ? '#fff' : '#000' } },
            series: [
                {
                    name: '条款巡检状态',
                    type: 'pie',
                    radius: '70%',
                    data: [
                        { value: dist.success, name: '合规 (Compliant)', itemStyle: { color: '#52c41a' } },
                        { value: dist.failed, name: '不合规 (Non-compliant)', itemStyle: { color: '#ff4d4f' } },
                        { value: dist.running, name: '巡检中 (Scanning)', itemStyle: { color: '#1890ff' } },
                        { value: dist.pending, name: '待巡检 (Pending)', itemStyle: { color: '#faad14' } }
                    ]
                }
            ]
        };
    };

    // -------------------------------------------------------------
    // Column Definitions for tables
    // -------------------------------------------------------------
    const slowNodeColumns = [
        { title: '节点名称', dataIndex: 'node_label', key: 'node_label' },
        { title: '节点类型', dataIndex: 'node_type', key: 'node_type', render: (text: string) => <Tag color="blue">{text}</Tag> },
        { title: '所属流水线', dataIndex: 'pipeline_name', key: 'pipeline_name' },
        { title: '耗时 (秒)', dataIndex: 'duration', key: 'duration', render: (text: number) => <Text strong type="danger">{text}s</Text> },
        {
            title: '节点状态', dataIndex: 'status', key: 'status', render: (text: string) => (
                <Tag color={text === 'success' ? 'success' : 'error'}>{text}</Tag>
            )
        }
    ];

    const complianceColumns = [
        { title: '条款编号', dataIndex: 'code', key: 'code', width: 100 },
        { title: '条款名称', dataIndex: 'name', key: 'name', width: 150 },
        { title: '合规框架', dataIndex: 'framework', key: 'framework', width: 120 },
        { title: '关联主机基线', dataIndex: 'baselines', key: 'baselines', render: (text: string[]) => text.join(', ') },
        { title: '所属资源池', dataIndex: 'resource_pools', key: 'resource_pools', render: (text: string[]) => text.join(', ') },
        {
            title: '合规状态', key: 'status', width: 100, render: () => (
                <Tag color="error">不合规</Tag>
            )
        }
    ];

    // SRE Alert copy table from SreReport
    const sreSummary = alertData?.summary || { total_alerts: 0, firing_alerts: 0, resolved_alerts: 0, healing_triggered: 0, healing_success: 0, healing_failed: 0, healing_success_rate: 0 };
    const sreTrend = alertData?.trend || [];
    const sreSeverityDist = alertData?.severity_distribution || [];
    const sreStatusDist = alertData?.healing_status_distribution || [];
    const sreAlertsByName = alertData?.alerts_by_name || [];
    const filteredSreAlerts = sreAlertsByName.filter((item: any) =>
        item.alert_name.toLowerCase().includes(alertSearchText.toLowerCase())
    );

    const getSreTrendOption = () => {
        return {
            tooltip: { trigger: 'axis' },
            legend: { data: ['告警触发', '已恢复', '自愈触发'], bottom: 0, textStyle: { color: isDark ? '#fff' : '#000' } },
            grid: { left: '3%', right: '3%', bottom: '10%', top: '30', containLabel: true },
            xAxis: { type: 'category', boundaryGap: false, data: sreTrend.map((item: any) => item.date), axisLabel: { color: isDark ? '#aaa' : '#555' } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } } },
            series: [
                { name: '告警触发', type: 'line', data: sreTrend.map((item: any) => item.total), itemStyle: { color: '#faad14' } },
                { name: '已恢复', type: 'line', data: sreTrend.map((item: any) => item.resolved), itemStyle: { color: '#52c41a' } },
                { name: '自愈触发', type: 'line', data: sreTrend.map((item: any) => item.healing), itemStyle: { color: '#13c2c2' } }
            ]
        };
    };

    const alertColumns = [
        { title: '告警名称', dataIndex: 'alert_name', key: 'alert_name' },
        { title: '严重程度', dataIndex: 'severity', key: 'severity', render: (text: string) => <Tag color={text === 'critical' ? 'red' : 'orange'}>{text}</Tag> },
        { title: '触发频次', dataIndex: 'count', key: 'count', sorter: (a: any, b: any) => a.count - b.count },
        { title: '自愈执行次数', dataIndex: 'healing_count', key: 'healing_count' },
        { title: '自愈成功率 (%)', dataIndex: 'healing_success_rate', key: 'healing_success_rate', render: (text: number) => <Progress percent={text} size="small" status={text >= 90 ? 'success' : 'normal'} /> }
    ];

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold mb-1 tracking-tight text-ans-text-primary italic">
                        报表分析中心
                    </h2>
                    <Paragraph className="text-ans-text-secondary text-sm font-medium opacity-80 mb-0">
                        流水线运行效率、Ansible 自动化执行质量及等保合规安全扫描多维分析。
                    </Paragraph>
                </div>
                <div className="flex items-center gap-3">
                    <RangePicker
                        value={timeRange}
                        onChange={(val) => {
                            if (val && val[0] && val[1]) {
                                setTimeRange([val[0], val[1]]);
                            }
                        }}
                        className="ans-range-picker shadow-sm"
                    />
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={() => {
                            setExportTimeRange(timeRange);
                            setExportModalVisible(true);
                        }}
                        className="ans-btn shadow-sm"
                    >
                        多维导出报表
                    </Button>
                </div>
            </div>

            {/* Tabs for modules */}
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                type="card"
                className="ans-tabs"
                items={[
                    {
                        key: 'pipeline',
                        label: <span><LineChartOutlined />流水线执行分析</span>,
                        children: (
                            <div className="flex flex-col gap-6">
                                {isPipelineLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
                                    <>
                                        {/* Metrics */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">总运行次数</Text>
                                                        <Title level={2} className="my-1 font-bold">{pipelineData?.summary?.total_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">成功运行</Text>
                                                        <Title level={2} className="my-1 font-bold text-success">{pipelineData?.summary?.success_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">失败运行</Text>
                                                        <Title level={2} className="my-1 font-bold text-error">{pipelineData?.summary?.failed_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">平均执行成功率</Text>
                                                        <Title level={2} className="my-1 font-bold text-primary">{pipelineData?.summary?.success_rate || 0}%</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Charts */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} lg={16}>
                                                <Card title="流水线每日执行趋势" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getPipelineTrendOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} lg={8}>
                                                <Card title="触发源分布占比" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getPipelineTriggerOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Top Slowest nodes */}
                                        <Card title="执行时间最长的单节点排行" className="ans-card shadow-sm">
                                            <Table
                                                dataSource={pipelineData?.slowest_nodes || []}
                                                columns={slowNodeColumns}
                                                rowKey="node_label"
                                                pagination={false}
                                                size="middle"
                                            />
                                        </Card>
                                    </>
                                )}
                            </div>
                        )
                    },
                    {
                        key: 'ansible',
                        label: <span><BarChartOutlined />Ansible 执行分析</span>,
                        children: (
                            <div className="flex flex-col gap-6">
                                {/* Local filters */}
                                <Card className="ans-card shadow-sm" size="small">
                                    <Space size="large" wrap>
                                        <span><FilterOutlined /> 维度筛选:</span>
                                        <Select
                                            placeholder="所属环境"
                                            style={{ width: 140 }}
                                            allowClear
                                            value={ansibleFilters.envId}
                                            onChange={(val) => setAnsibleFilters(p => ({ ...p, envId: val }))}
                                        >
                                            {envsList.map((e: any) => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
                                        </Select>
                                        <Select
                                            placeholder="平台/云厂商"
                                            style={{ width: 160 }}
                                            allowClear
                                            value={ansibleFilters.platformId}
                                            onChange={(val) => setAnsibleFilters(p => ({ ...p, platformId: val }))}
                                        >
                                            {platformsList.map((p: any) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
                                        </Select>
                                        <Select
                                            placeholder="目标资源池"
                                            style={{ width: 180 }}
                                            allowClear
                                            value={ansibleFilters.poolId}
                                            onChange={(val) => setAnsibleFilters(p => ({ ...p, poolId: val }))}
                                        >
                                            {poolsList.map((po: any) => <Select.Option key={po.id} value={po.id}>{po.name}</Select.Option>)}
                                        </Select>
                                    </Space>
                                </Card>

                                {isAnsibleLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
                                    <>
                                        {/* Metrics */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">任务总运行数</Text>
                                                        <Title level={2} className="my-1 font-bold">{ansibleData?.summary?.total_executions || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">执行成功数</Text>
                                                        <Title level={2} className="my-1 font-bold text-success">{ansibleData?.summary?.success_executions || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">成功率</Text>
                                                        <Title level={2} className="my-1 font-bold text-primary">{ansibleData?.summary?.success_rate || 0}%</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">累计主机执行人次</Text>
                                                        <Title level={2} className="my-1 font-bold">{ansibleData?.summary?.total_host_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Charts */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} lg={16}>
                                                <Card title="Ansible 任务执行趋势" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getAnsibleTrendOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} lg={8}>
                                                <Card title="执行分布（环境维度）" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getAnsibleBreakdownOption('environment')} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                        </Row>
                                        
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} md={12}>
                                                <Card title="执行分布（云平台维度）" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getAnsibleBreakdownOption('platform')} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Card title="执行分布（资源池维度）" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getAnsibleBreakdownOption('resource_pool')} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                        </Row>
                                    </>
                                )}
                            </div>
                        )
                    },
                    {
                        key: 'compliance',
                        label: <span><SecurityScanOutlined />等保合规扫描</span>,
                        children: (
                            <div className="flex flex-col gap-6">
                                {isComplianceLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
                                    <>
                                        {/* Metrics */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">等保合规总体评分</Text>
                                                        <Title level={2} className="my-1 font-bold text-success">{complianceData?.summary?.overall_score || 100}%</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">合规框架数</Text>
                                                        <Title level={2} className="my-1 font-bold">{complianceData?.summary?.total_frameworks || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">评估指标条款总数</Text>
                                                        <Title level={2} className="my-1 font-bold">{complianceData?.summary?.total_compliance_items || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">不合规条款数</Text>
                                                        <Title level={2} className="my-1 font-bold text-error">{complianceData?.summary?.failed_compliance_items || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Distribution & Failed items */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} lg={8}>
                                                <Card title="等保指标项状态分布" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getComplianceDistributionOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} lg={16}>
                                                <Card title="异常不合规条款明细列表（亟需修复）" className="ans-card shadow-sm h-[380px] overflow-auto">
                                                    <Table
                                                        dataSource={complianceData?.non_compliant_clauses || []}
                                                        columns={complianceColumns}
                                                        rowKey="code"
                                                        pagination={false}
                                                        size="middle"
                                                    />
                                                </Card>
                                            </Col>
                                        </Row>
                                    </>
                                )}
                            </div>
                        )
                    },
                    {
                        key: 'sre',
                        label: <span><AlertOutlined />告警自愈报表</span>,
                        children: (
                            <div className="flex flex-col gap-6">
                                {isAlertLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
                                    <>
                                        {/* Metrics */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">总告警触发次数</Text>
                                                        <Title level={2} className="my-1 font-bold">{sreSummary.total_alerts}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">触发自愈次数</Text>
                                                        <Title level={2} className="my-1 font-bold text-info">{sreSummary.healing_triggered}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">自愈成功率</Text>
                                                        <Title level={2} className="my-1 font-bold text-success">{sreSummary.healing_success_rate}%</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">活动中告警</Text>
                                                        <Title level={2} className="my-1 font-bold text-warning">{sreSummary.firing_alerts}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Charts */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24}>
                                                <Card title="告警与自愈执行趋势" className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getSreTrendOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Table list */}
                                        <Card title="按名称统计告警分类列表" className="ans-card shadow-sm" extra={
                                            <Input
                                                placeholder="搜索告警名称"
                                                prefix={<SearchOutlined />}
                                                value={alertSearchText}
                                                onChange={e => setAlertSearchText(e.target.value)}
                                                style={{ width: 240 }}
                                            />
                                        }>
                                            <Table
                                                dataSource={filteredSreAlerts}
                                                columns={alertColumns}
                                                rowKey="alert_name"
                                                size="middle"
                                                pagination={{ pageSize: 10 }}
                                            />
                                        </Card>
                                    </>
                                )}
                            </div>
                        )
                    }
                ]}
            />

            {/* Export Modal */}
            <Modal
                title="多维系统报表导出"
                open={exportModalVisible}
                onCancel={() => setExportModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setExportModalVisible(false)}>取消</Button>,
                    <Button key="export" type="primary" onClick={handleExport} disabled={exportTypes.length === 0}>
                        确认发起导出
                    </Button>
                ]}
            >
                <div className="flex flex-col gap-6 py-4">
                    {/* Checkboxes */}
                    <div>
                        <Text strong className="block mb-2">选择需要导出的子报表项 (多选将打包为 ZIP 压缩包):</Text>
                        <Checkbox.Group
                            options={[
                                { label: '流水线执行报表', value: 'pipeline' },
                                { label: 'Ansible 执行报表 (汇总与明细)', value: 'ansible' },
                                { label: '等保 2.0 安全扫描结果', value: 'compliance' },
                                { label: '告警事件与故障自愈记录', value: 'sre_alert' }
                            ]}
                            value={exportTypes}
                            onChange={(val) => setExportTypes(val as string[])}
                            className="flex flex-col gap-2"
                        />
                    </div>

                    {/* Date Range */}
                    <div>
                        <Text strong className="block mb-2">选择导出时间段:</Text>
                        <RangePicker
                            value={exportTimeRange}
                            onChange={(val) => {
                                if (val && val[0] && val[1]) {
                                    setExportTimeRange([val[0], val[1]]);
                                }
                            }}
                            className="w-full"
                        />
                    </div>

                    {/* Filters */}
                    <div>
                        <Text strong className="block mb-2">切片过滤维度 (可选):</Text>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Text className="text-xs opacity-75">所属项目</Text>
                                <Select
                                    placeholder="全部项目"
                                    className="w-full mt-1"
                                    allowClear
                                    value={exportFilters.projectId}
                                    onChange={val => setExportFilters(p => ({ ...p, projectId: val }))}
                                >
                                    {projects.map((pr: any) => <Select.Option key={pr.id} value={pr.id}>{pr.name}</Select.Option>)}
                                </Select>
                            </div>
                            <div>
                                <Text className="text-xs opacity-75">所属环境</Text>
                                <Select
                                    placeholder="全部环境"
                                    className="w-full mt-1"
                                    allowClear
                                    value={exportFilters.envId}
                                    onChange={val => setExportFilters(p => ({ ...p, envId: val }))}
                                >
                                    {envsList.map((e: any) => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
                                </Select>
                            </div>
                            <div>
                                <Text className="text-xs opacity-75">云厂商/平台</Text>
                                <Select
                                    placeholder="全部厂商"
                                    className="w-full mt-1"
                                    allowClear
                                    value={exportFilters.platformId}
                                    onChange={val => setExportFilters(p => ({ ...p, platformId: val }))}
                                >
                                    {platformsList.map((pl: any) => <Select.Option key={pl.id} value={pl.id}>{pl.name}</Select.Option>)}
                                </Select>
                            </div>
                            <div>
                                <Text className="text-xs opacity-75">目标资源池</Text>
                                <Select
                                    placeholder="全部资源池"
                                    className="w-full mt-1"
                                    allowClear
                                    value={exportFilters.poolId}
                                    onChange={val => setExportFilters(p => ({ ...p, poolId: val }))}
                                >
                                    {poolsList.map((po: any) => <Select.Option key={po.id} value={po.id}>{po.name}</Select.Option>)}
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SystemReports;
