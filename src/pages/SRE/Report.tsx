import React, { useState } from 'react';
import { Card, Row, Col, DatePicker, Button, Table, Typography, Space, Input, Progress, Skeleton, theme, Badge, Tag } from 'antd';
import { DownloadOutlined, SearchOutlined, AlertOutlined, CheckCircleOutlined, ThunderboltOutlined, SyncOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../store/useAppStore';
import { getAlertReport, exportAlertReport } from '../../api/sre';
import dayjs from 'dayjs';
import { message } from '../../utils/antd';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

interface SreReportProps {
    hideHeader?: boolean;
    timeRange?: [dayjs.Dayjs, dayjs.Dayjs];
    onTimeRangeChange?: (val: [dayjs.Dayjs, dayjs.Dayjs]) => void;
}

const SreReport: React.FC<SreReportProps> = ({
    hideHeader = false,
    timeRange: propTimeRange,
    onTimeRangeChange
}) => {
    const { t } = useTranslation();
    const { isDark } = useAppStore();
    const { token } = theme.useToken();
    const [searchText, setSearchText] = useState('');
    const [localTimeRange, setLocalTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(7, 'day'),
        dayjs()
    ]);

    const activeTimeRange = propTimeRange || localTimeRange;
    const setActiveTimeRange = onTimeRangeChange || setLocalTimeRange;

    const startTimeStr = activeTimeRange[0].startOf('day').toISOString();
    const endTimeStr = activeTimeRange[1].endOf('day').toISOString();

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['sreAlertReport', startTimeStr, endTimeStr],
        queryFn: () => getAlertReport({ start_time: startTimeStr, end_time: endTimeStr }),
        enabled: !!activeTimeRange[0] && !!activeTimeRange[1]
    });

    const handleExport = async () => {
        try {
            const res = await exportAlertReport({ start_time: startTimeStr, end_time: endTimeStr });
            message.success(res.message || '报表生成任务已提交，完成后将在通知中心收到下载提示');
        } catch (err) {
            console.error(err);
        }
    };

    const summary = reportData?.summary || {
        total_alerts: 0,
        firing_alerts: 0,
        resolved_alerts: 0,
        healing_triggered: 0,
        healing_success: 0,
        healing_failed: 0,
        healing_success_rate: 0
    };

    const trend = reportData?.trend || [];
    const severityDist = reportData?.severity_distribution || [];
    const statusDist = reportData?.healing_status_distribution || [];
    const alertsByName = reportData?.alerts_by_name || [];

    // Filter table by search text
    const filteredAlerts = alertsByName.filter((item: any) =>
        item.alert_name.toLowerCase().includes(searchText.toLowerCase())
    );

    // Dynamic color calculations based on theme
    const trendColor = getComputedStyle(document.documentElement).getPropertyValue('--ans-primary').trim() || '#606C38';

    const getTrendOption = () => {
        return {
            tooltip: {
                trigger: 'axis',
                backgroundColor: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderWidth: 0,
                padding: [10, 16],
                textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 12 },
                extraCssText: 'box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius: 8px;'
            },
            legend: {
                data: [t('report.totalAlerts'), t('report.resolvedAlerts'), t('report.healingTriggered')],
                right: 0,
                top: '0',
                icon: 'circle',
                textStyle: {
                    color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                    fontSize: 11
                }
            },
            grid: { left: '2%', right: '2%', bottom: '2%', top: '50', containLabel: true },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: trend.map((item: any) => item.date),
                axisLabel: { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' },
                axisLine: { show: false },
                axisTick: { show: false }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', type: 'dashed' } },
                axisLabel: { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }
            },
            series: [
                {
                    name: t('report.totalAlerts'),
                    type: 'line',
                    smooth: 0.3,
                    showSymbol: false,
                    itemStyle: { color: trendColor },
                    lineStyle: { width: 3 },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [{ offset: 0, color: 'rgba(96, 108, 56, 0.15)' }, { offset: 1, color: 'rgba(96, 108, 56, 0)' }]
                        }
                    },
                    data: trend.map((item: any) => item.count)
                },
                {
                    name: t('report.resolvedAlerts'),
                    type: 'line',
                    smooth: 0.3,
                    showSymbol: false,
                    itemStyle: { color: '#52c41a' },
                    lineStyle: { width: 3 },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [{ offset: 0, color: 'rgba(82, 196, 26, 0.1)' }, { offset: 1, color: 'rgba(82, 196, 26, 0)' }]
                        }
                    },
                    data: trend.map((item: any) => item.resolved)
                },
                {
                    name: t('report.healingTriggered'),
                    type: 'line',
                    smooth: 0.3,
                    showSymbol: false,
                    itemStyle: { color: '#faad14' },
                    lineStyle: { width: 3 },
                    data: trend.map((item: any) => item.healing)
                }
            ]
        };
    };

    const getSeverityOption = () => {
        const severityColors: Record<string, string> = {
            critical: '#ff4d4f',
            warning: '#faad14',
            info: '#1890ff'
        };

        return {
            tooltip: {
                trigger: 'item',
                backgroundColor: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderWidth: 0,
                textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 12 },
                formatter: '{b}: <b>{c}</b> ({d}%)'
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                textStyle: { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }
            },
            series: [
                {
                    type: 'pie',
                    radius: ['55%', '75%'],
                    avoidLabelOverlap: false,
                    center: ['60%', '50%'],
                    itemStyle: { borderRadius: 4, borderColor: isDark ? '#1d2619' : '#fff', borderWidth: 2 },
                    label: { show: false },
                    emphasis: { scale: true },
                    data: severityDist.map((item: any) => {
                        const key = item.severity.toLowerCase();
                        let labelName = item.severity;
                        if (key === 'critical') labelName = '致命 (Critical)';
                        else if (key === 'warning') labelName = '警告 (Warning)';
                        else if (key === 'info') labelName = '提示 (Info)';

                        return {
                            name: labelName,
                            value: item.count,
                            itemStyle: { color: severityColors[key] || '#d9d9d9' }
                        };
                    })
                }
            ]
        };
    };

    const getHealingStatusOption = () => {
        const statusColors: Record<string, string> = {
            success: '#52c41a',
            failed: '#ff4d4f',
            executing: '#1890ff',
            ignored: '#d9d9d9',
            none: '#8c8c8c',
            suggested: '#faad14',
            awaiting_approval: '#fa8c16',
            analyzing: '#13c2c2'
        };

        return {
            tooltip: {
                trigger: 'item',
                backgroundColor: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderWidth: 0,
                textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 12 },
                formatter: '{b}: <b>{c}</b> ({d}%)'
            },
            legend: {
                orient: 'vertical',
                left: 'left',
                textStyle: { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }
            },
            series: [
                {
                    type: 'pie',
                    radius: ['55%', '75%'],
                    avoidLabelOverlap: false,
                    center: ['60%', '50%'],
                    itemStyle: { borderRadius: 4, borderColor: isDark ? '#1d2619' : '#fff', borderWidth: 2 },
                    label: { show: false },
                    emphasis: { scale: true },
                    data: statusDist.map((item: any) => {
                        const key = item.status;
                        let labelName = key;
                        if (key === 'success') labelName = '自愈成功';
                        else if (key === 'failed') labelName = '自愈失败';
                        else if (key === 'executing') labelName = '自愈中';
                        else if (key === 'ignored') labelName = '已忽略';
                        else if (key === 'none') labelName = '未处理';
                        else if (key === 'suggested') labelName = '已有建议';
                        else if (key === 'awaiting_approval') labelName = '待审批';
                        else if (key === 'analyzing') labelName = 'AI分析中';

                        return {
                            name: labelName,
                            value: item.count,
                            itemStyle: { color: statusColors[key] || '#8c8c8c' }
                        };
                    })
                }
            ]
        };
    };

    const columns = [
        {
            title: t('report.alertName'),
            dataIndex: 'alert_name',
            key: 'alert_name',
            sorter: (a: any, b: any) => a.alert_name.localeCompare(b.alert_name),
            render: (text: string) => <Text className="font-semibold">{text}</Text>
        },
        {
            title: t('report.severity'),
            dataIndex: 'severity',
            key: 'severity',
            render: (text: string) => {
                const key = text.toLowerCase();
                let color = 'blue';
                if (key === 'critical') color = 'red';
                else if (key === 'warning') color = 'orange';
                return <Tag color={color}>{text.toUpperCase()}</Tag>;
            }
        },
        {
            title: t('report.count'),
            dataIndex: 'count',
            key: 'count',
            sorter: (a: any, b: any) => a.count - b.count,
            render: (val: number) => <Text className="font-bold">{val}</Text>
        },
        {
            title: t('report.resolvedCount'),
            dataIndex: 'resolved_count',
            key: 'resolved_count'
        },
        {
            title: t('report.recoveryRate'),
            dataIndex: 'recovery_rate',
            key: 'recovery_rate',
            render: (val: number) => (
                <Space size="middle" className="w-32">
                    <Progress percent={val} size="small" status={val === 100 ? 'success' : 'normal'} />
                </Space>
            )
        },
        {
            title: t('report.healingCount'),
            dataIndex: 'healing_count',
            key: 'healing_count'
        },
        {
            title: t('report.healingSuccessCount'),
            dataIndex: 'healing_success_count',
            key: 'healing_success_count',
            render: (val: number) => <Text className="text-emerald-500 font-bold">{val}</Text>
        },
        {
            title: t('report.healingFailedCount'),
            dataIndex: 'healing_failed_count',
            key: 'healing_failed_count',
            render: (val: number) => val > 0 ? <Text className="text-red-500 font-bold">{val}</Text> : 0
        },
        {
            title: t('report.healingSuccessRate'),
            dataIndex: 'healing_success_rate',
            key: 'healing_success_rate',
            render: (val: number, record: any) => {
                const totalHealing = record.healing_success_count + record.healing_failed_count;
                if (totalHealing === 0) {
                    return <Text className="text-neutral-400">-</Text>;
                }
                return (
                    <Space size="middle" className="w-32">
                        <Progress percent={val} size="small" status={val === 100 ? 'success' : 'normal'} strokeColor="#10b981" />
                    </Space>
                );
            }
        }
    ];

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Header section */}
            {!hideHeader && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-extrabold mb-1 tracking-tight text-ans-text-primary italic">
                            {t('report.title')}
                        </h2>
                        <p className="text-ans-text-secondary text-sm font-medium opacity-80">
                            {t('report.subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <RangePicker 
                            value={activeTimeRange} 
                            onChange={(val) => {
                                if (val && val[0] && val[1]) {
                                    setActiveTimeRange([val[0], val[1]]);
                                }
                            }}
                            className="ans-range-picker shadow-sm"
                        />
                        <Button 
                            type="primary" 
                            icon={<DownloadOutlined />} 
                            onClick={handleExport}
                            className="ans-btn shadow-sm"
                            disabled={isLoading || summary.total_alerts === 0}
                        >
                            {t('report.exportCsv')}
                        </Button>
                    </div>
                </div>
            )}

            {/* Metrics cards grid */}
            {isLoading ? (
                <Row gutter={[24, 24]}>
                    {[1, 2, 3, 4].map(i => (
                        <Col xs={24} sm={12} lg={6} key={i}>
                            <Card className="ans-card shadow-sm"><Skeleton active paragraph={{ rows: 2 }} /></Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Card className="ans-card border border-solid border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
                            <div className="absolute right-[-10px] bottom-[-10px] text-primary/5 text-8xl group-hover:scale-110 transition-transform duration-500">
                                <AlertOutlined />
                            </div>
                            <Space direction="vertical" size="small">
                                <span className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.totalAlerts')}</span>
                                <span className="text-3xl font-black">{summary.total_alerts}</span>
                                <div className="text-xs mt-1">
                                    <Badge status="error" text={`${summary.firing_alerts} Firing`} className="mr-3" />
                                    <Badge status="success" text={`${summary.resolved_alerts} Resolved`} />
                                </div>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card className="ans-card border border-solid border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
                            <div className="absolute right-[-10px] bottom-[-10px] text-amber-500/5 text-8xl group-hover:scale-110 transition-transform duration-500">
                                <ThunderboltOutlined />
                            </div>
                            <Space direction="vertical" size="small">
                                <span className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.healingTriggered')}</span>
                                <span className="text-3xl font-black text-amber-500">{summary.healing_triggered}</span>
                                <div className="text-xs mt-1">
                                    <span className="text-emerald-500 font-bold mr-3">{summary.healing_success} Success</span>
                                    <span className="text-red-500 font-bold">{summary.healing_failed} Failed</span>
                                </div>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card className="ans-card border border-solid border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
                            <div className="absolute right-[-10px] bottom-[-10px] text-emerald-500/5 text-8xl group-hover:scale-110 transition-transform duration-500">
                                <CheckCircleOutlined />
                            </div>
                            <Space direction="vertical" size="small">
                                <span className="text-xs uppercase tracking-widest font-bold opacity-50">{t('report.healingSuccessRate')}</span>
                                <span className="text-3xl font-black text-emerald-500">
                                    {summary.healing_success_rate}%
                                </span>
                                <div className="w-full mt-2" style={{ width: '120px' }}>
                                    <Progress percent={summary.healing_success_rate} showInfo={false} size="small" strokeColor="#10b981" />
                                </div>
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Card className="ans-card border border-solid border-black/5 dark:border-white/5 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform duration-300">
                            <div className="absolute right-[-10px] bottom-[-10px] text-blue-500/5 text-8xl group-hover:scale-110 transition-transform duration-500">
                                <SyncOutlined />
                            </div>
                            <Space direction="vertical" size="small">
                                <span className="text-xs uppercase tracking-widest font-bold opacity-50">告警自动恢复率</span>
                                <span className="text-3xl font-black text-blue-500">
                                    {summary.total_alerts > 0 ? round(summary.resolved_alerts * 100 / summary.total_alerts, 1) : 0}%
                                </span>
                                <div className="w-full mt-2" style={{ width: '120px' }}>
                                    <Progress percent={summary.total_alerts > 0 ? round(summary.resolved_alerts * 100 / summary.total_alerts, 1) : 0} showInfo={false} size="small" strokeColor="#1890ff" />
                                </div>
                            </Space>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Charts section */}
            <Row gutter={[24, 24]}>
                <Col xs={24} xl={12}>
                    <Card title={<span className="text-sm font-bold opacity-80 uppercase tracking-wide">{t('report.trendTitle')}</span>} className="ans-card shadow-sm h-[380px] overflow-hidden">
                        {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
                            trend.length === 0 ? <div className="flex justify-center items-center h-[280px] opacity-40">暂无趋势数据</div> : (
                                <ReactECharts option={getTrendOption()} style={{ height: '300px' }} />
                            )
                        )}
                    </Card>
                </Col>
                <Col xs={24} md={12} xl={6}>
                    <Card title={<span className="text-sm font-bold opacity-80 uppercase tracking-wide">{t('report.severityTitle')}</span>} className="ans-card shadow-sm h-[380px] overflow-hidden">
                        {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
                            severityDist.length === 0 ? <div className="flex justify-center items-center h-[280px] opacity-40">暂无级别分布数据</div> : (
                                <ReactECharts option={getSeverityOption()} style={{ height: '300px' }} />
                            )
                        )}
                    </Card>
                </Col>
                <Col xs={24} md={12} xl={6}>
                    <Card title={<span className="text-sm font-bold opacity-80 uppercase tracking-wide">{t('report.healingStatusTitle')}</span>} className="ans-card shadow-sm h-[380px] overflow-hidden">
                        {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : (
                            statusDist.length === 0 ? <div className="flex justify-center items-center h-[280px] opacity-40">暂无自愈分布数据</div> : (
                                <ReactECharts option={getHealingStatusOption()} style={{ height: '300px' }} />
                            )
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Aggregated details table */}
            <Card 
                title={
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
                        <span className="text-sm font-bold opacity-80 uppercase tracking-wide">告警明细统计</span>
                        <Input 
                            placeholder={t('report.searchAlertName')} 
                            prefix={<SearchOutlined className="opacity-40" />} 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)}
                            className="ans-input max-w-xs shadow-sm"
                        />
                    </div>
                } 
                className="ans-card overflow-hidden shadow-sm"
            >
                <Table 
                    dataSource={filteredAlerts} 
                    columns={columns} 
                    loading={isLoading}
                    rowKey="alert_name"
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    className="custom-table"
                />
            </Card>
        </div>
    );
};

// Helper math round
function round(value: number, decimals: number) {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

export default SreReport;
