import React, { useState } from 'react';
import { Card, Row, Col, DatePicker, Button, Table, Typography, Space, Input, Progress, Skeleton, theme, Badge, Tag, Tabs, Modal, Checkbox, Select, Tooltip } from 'antd';
import { DownloadOutlined, SearchOutlined, AlertOutlined, CheckCircleOutlined, ThunderboltOutlined, SyncOutlined, BarChartOutlined, LineChartOutlined, SecurityScanOutlined, FilterOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../../store/useAppStore';
import { getPipelineReport, getAnsibleReport, getComplianceReport, exportSystemReport } from '../../../api/system';
import { getEnvironments, getPlatforms, getResourcePools } from '../../../api/hosts';
import SreReport from '../../SRE/Report';
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
            message.success(t('report.exportSubmitted'));
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
                data: [t('report.pipelineLegendTotal'), t('report.pipelineLegendSuccess'), t('report.pipelineLegendFailed')],
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
                    name: t('report.pipelineLegendTotal'),
                    type: 'line',
                    smooth: true,
                    data: trend.map((item: any) => item.total),
                    itemStyle: { color: '#1890ff' }
                },
                {
                    name: t('report.pipelineLegendSuccess'),
                    type: 'line',
                    smooth: true,
                    data: trend.map((item: any) => item.success),
                    itemStyle: { color: '#52c41a' }
                },
                {
                    name: t('report.pipelineLegendFailed'),
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
                    name: t('report.triggerSourceSeries'),
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
            legend: { data: [t('report.taskRunSeries'), t('report.taskSuccessSeries'), t('report.taskFailedSeries')], bottom: 0, textStyle: { color: isDark ? '#fff' : '#000' } },
            grid: { left: '3%', right: '3%', bottom: '10%', top: '30', containLabel: true },
            xAxis: { type: 'category', data: trend.map((item: any) => item.day), axisLabel: { color: isDark ? '#aaa' : '#555' } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } } },
            series: [
                { name: t('report.taskRunSeries'), type: 'bar', data: trend.map((item: any) => item.total), itemStyle: { color: '#13c2c2' } },
                { name: t('report.taskSuccessSeries'), type: 'line', data: trend.map((item: any) => item.success), itemStyle: { color: '#52c41a' } },
                { name: t('report.taskFailedSeries'), type: 'line', data: trend.map((item: any) => item.failed), itemStyle: { color: '#f5222d' } }
            ]
        };
    };

    const getAnsibleBreakdownOption = (dimension: 'environment' | 'platform' | 'resource_pool') => {
        const list = ansibleData?.breakdown?.[dimension] || [];
        return {
            tooltip: { trigger: 'item' },
            series: [
                {
                    name: t('report.executionShareSeries'),
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
                    name: t('report.clauseScanStatus'),
                    type: 'pie',
                    radius: '70%',
                    data: [
                        { value: dist.success, name: t('report.compliantLabel'), itemStyle: { color: '#52c41a' } },
                        { value: dist.failed, name: t('report.nonCompliantLabel'), itemStyle: { color: '#ff4d4f' } },
                        { value: dist.running, name: t('report.scanningLabel'), itemStyle: { color: '#1890ff' } },
                        { value: dist.pending, name: t('report.pendingScanLabel'), itemStyle: { color: '#faad14' } }
                    ]
                }
            ]
        };
    };

    // -------------------------------------------------------------
    // Column Definitions for tables
    // -------------------------------------------------------------
    const slowNodeColumns = [
        { title: t('report.nodeName'), dataIndex: 'node_label', key: 'node_label' },
        { title: t('report.nodeType'), dataIndex: 'node_type', key: 'node_type', render: (text: string) => <Tag color="blue">{text}</Tag> },
        { title: t('report.pipelineName'), dataIndex: 'pipeline_name', key: 'pipeline_name' },
        { title: t('report.durationSeconds'), dataIndex: 'duration', key: 'duration', render: (text: number) => <Text strong type="danger">{text}s</Text> },
        {
            title: t('report.nodeStatus'), dataIndex: 'status', key: 'status', render: (text: string) => (
                <Tag color={text === 'success' ? 'success' : 'error'}>{text}</Tag>
            )
        }
    ];

    const complianceColumns = [
        { title: t('report.clauseCode'), dataIndex: 'code', key: 'code', width: 100 },
        { title: t('report.clauseName'), dataIndex: 'name', key: 'name', width: 150 },
        { title: t('report.complianceFramework'), dataIndex: 'framework', key: 'framework', width: 120 },
        { title: t('report.relatedHostBaselines'), dataIndex: 'baselines', key: 'baselines', render: (text: string[]) => text.join(', ') },
        { title: t('report.resourcePools'), dataIndex: 'resource_pools', key: 'resource_pools', render: (text: string[]) => text.join(', ') },
        {
            title: t('report.complianceStatus'), key: 'status', width: 100, render: () => (
                <Tag color="error">{t('report.nonCompliant')}</Tag>
            )
        }
    ];



    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold mb-1 tracking-tight text-ans-text-primary italic">
                        {t('report.analysisTitle')}
                    </h2>
                    <Paragraph className="text-ans-text-secondary text-sm font-medium opacity-80 mb-0">
                        {t('report.analysisSubtitle')}
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
                        {t('report.exportMultiDimensional')}
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
                        label: <span><LineChartOutlined />{t('report.pipelineExecutionAnalysis')}</span>,
                        children: (
                            <div className="flex flex-col gap-6">
                                {isPipelineLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
                                    <>
                                        {/* Metrics */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.totalRuns')}</Text>
                                                        <Title level={2} className="my-1 font-bold">{pipelineData?.summary?.total_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.successfulRuns')}</Text>
                                                        <Title level={2} className="my-1 font-bold text-success">{pipelineData?.summary?.success_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.failedRuns')}</Text>
                                                        <Title level={2} className="my-1 font-bold text-error">{pipelineData?.summary?.failed_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.avgSuccessRate')}</Text>
                                                        <Title level={2} className="my-1 font-bold text-primary">{pipelineData?.summary?.success_rate || 0}%</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Charts */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} lg={16}>
                                                <Card title={t('report.pipelineDailyTrend')} className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getPipelineTrendOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} lg={8}>
                                                <Card title={t('report.triggerSourceDistribution')} className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getPipelineTriggerOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Top Slowest nodes */}
                                        <Card title={t('report.slowestNodeRanking')} className="ans-card shadow-sm">
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
                        label: <span><BarChartOutlined />{t('report.ansibleExecutionAnalysis')}</span>,
                        children: (
                            <div className="flex flex-col gap-6">
                                {/* Local filters */}
                                <Card className="ans-card shadow-sm" size="small">
                                    <Space size="large" wrap>
                                        <span><FilterOutlined /> {t('report.dimensionFilter')}</span>
                                        <Select
                                            placeholder={t('report.environmentPlaceholder')}
                                            style={{ width: 140 }}
                                            allowClear
                                            value={ansibleFilters.envId}
                                            onChange={(val) => setAnsibleFilters(p => ({ ...p, envId: val }))}
                                        >
                                            {envsList.map((e: any) => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
                                        </Select>
                                        <Select
                                            placeholder={t('report.platformPlaceholder')}
                                            style={{ width: 160 }}
                                            allowClear
                                            value={ansibleFilters.platformId}
                                            onChange={(val) => setAnsibleFilters(p => ({ ...p, platformId: val }))}
                                        >
                                            {platformsList.map((p: any) => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
                                        </Select>
                                        <Select
                                            placeholder={t('report.resourcePoolPlaceholder')}
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
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.taskTotalRuns')}</Text>
                                                        <Title level={2} className="my-1 font-bold">{ansibleData?.summary?.total_executions || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.taskSuccessCount')}</Text>
                                                        <Title level={2} className="my-1 font-bold text-success">{ansibleData?.summary?.success_executions || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('dashboard.successRate')}</Text>
                                                        <Title level={2} className="my-1 font-bold text-primary">{ansibleData?.summary?.success_rate || 0}%</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.totalHostRuns')}</Text>
                                                        <Title level={2} className="my-1 font-bold">{ansibleData?.summary?.total_host_runs || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Charts */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} lg={16}>
                                                <Card title={t('report.ansibleTaskTrend')} className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getAnsibleTrendOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} lg={8}>
                                                <Card title={t('report.executionDistEnvironment')} className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getAnsibleBreakdownOption('environment')} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                        </Row>
                                        
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} md={12}>
                                                <Card title={t('report.executionDistPlatform')} className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getAnsibleBreakdownOption('platform')} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} md={12}>
                                                <Card title={t('report.executionDistResourcePool')} className="ans-card shadow-sm h-[380px]">
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
                        label: <span><SecurityScanOutlined />{t('report.complianceScan')}</span>,
                        children: (
                            <div className="flex flex-col gap-6">
                                {isComplianceLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : (
                                    <>
                                        {/* Metrics */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.complianceOverallScore')}</Text>
                                                        <Title level={2} className="my-1 font-bold text-success">{complianceData?.summary?.overall_score || 100}%</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.frameworkCount')}</Text>
                                                        <Title level={2} className="my-1 font-bold">{complianceData?.summary?.total_frameworks || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.complianceItemCount')}</Text>
                                                        <Title level={2} className="my-1 font-bold">{complianceData?.summary?.total_compliance_items || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                            <Col xs={24} sm={12} lg={6}>
                                                <Card className="ans-card shadow-sm">
                                                    <div className="flex flex-col">
                                                        <Text className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.failedComplianceItems')}</Text>
                                                        <Title level={2} className="my-1 font-bold text-error">{complianceData?.summary?.failed_compliance_items || 0}</Title>
                                                    </div>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {/* Distribution & Failed items */}
                                        <Row gutter={[24, 24]}>
                                            <Col xs={24} lg={8}>
                                                <Card title={t('report.complianceStatusDistribution')} className="ans-card shadow-sm h-[380px]">
                                                    <ReactECharts option={getComplianceDistributionOption()} style={{ height: 280 }} />
                                                </Card>
                                            </Col>
                                            <Col xs={24} lg={16}>
                                                <Card title={t('report.nonCompliantList')} className="ans-card shadow-sm h-[380px] overflow-auto">
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
                        label: <span><AlertOutlined />{t('report.sreSelfHealingReport')}</span>,
                        children: <SreReport hideHeader timeRange={timeRange} onTimeRangeChange={setTimeRange} />
                    }
                ]}
            />

            {/* Export Modal */}
            <Modal
                title={t('report.systemReportExport')}
                open={exportModalVisible}
                onCancel={() => setExportModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setExportModalVisible(false)}>{t('common.cancel')}</Button>,
                    <Button key="export" type="primary" onClick={handleExport} disabled={exportTypes.length === 0}>
                        {t('report.confirmExport')}
                    </Button>
                ]}
            >
                <div className="flex flex-col gap-6 py-4">
                    {/* Checkboxes */}
                    <div>
                        <Text strong className="block mb-2">{t('report.selectExportItems')}</Text>
                        <Checkbox.Group
                            options={[
                                { label: t('report.pipelineReport'), value: 'pipeline' },
                                { label: t('report.ansibleReport'), value: 'ansible' },
                                { label: t('report.complianceReport'), value: 'compliance' },
                                { label: t('report.sreAlertReport'), value: 'sre_alert' }
                            ]}
                            value={exportTypes}
                            onChange={(val) => setExportTypes(val as string[])}
                            className="flex flex-col gap-2"
                        />
                    </div>

                    {/* Date Range */}
                    <div>
                        <Text strong className="block mb-2">{t('report.selectExportRange')}</Text>
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
                        <Text strong className="block mb-2">{t('report.sliceFilters')}</Text>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Text className="text-xs opacity-75">{t('report.project')}</Text>
                                <Select
                                    placeholder={t('report.allProjects')}
                                    className="w-full mt-1"
                                    allowClear
                                    value={exportFilters.projectId}
                                    onChange={val => setExportFilters(p => ({ ...p, projectId: val }))}
                                >
                                    {projects.map((pr: any) => <Select.Option key={pr.id} value={pr.id}>{pr.name}</Select.Option>)}
                                </Select>
                            </div>
                            <div>
                                <Text className="text-xs opacity-75">{t('report.environmentPlaceholder')}</Text>
                                <Select
                                    placeholder={t('report.allEnvironments')}
                                    className="w-full mt-1"
                                    allowClear
                                    value={exportFilters.envId}
                                    onChange={val => setExportFilters(p => ({ ...p, envId: val }))}
                                >
                                    {envsList.map((e: any) => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
                                </Select>
                            </div>
                            <div>
                                <Text className="text-xs opacity-75">{t('report.cloudPlatform')}</Text>
                                <Select
                                    placeholder={t('report.allVendors')}
                                    className="w-full mt-1"
                                    allowClear
                                    value={exportFilters.platformId}
                                    onChange={val => setExportFilters(p => ({ ...p, platformId: val }))}
                                >
                                    {platformsList.map((pl: any) => <Select.Option key={pl.id} value={pl.id}>{pl.name}</Select.Option>)}
                                </Select>
                            </div>
                            <div>
                                <Text className="text-xs opacity-75">{t('report.resourcePoolPlaceholder')}</Text>
                                <Select
                                    placeholder={t('report.allResourcePools')}
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
