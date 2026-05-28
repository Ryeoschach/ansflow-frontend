import React from 'react';
import { Row, Col, Card, Skeleton, Typography, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../../store/useAppStore';

const { Text } = Typography;

interface DistributionChartsProps {
    data: any;
    isLoading: boolean;
}

const DistributionCharts: React.FC<DistributionChartsProps> = ({ data, isLoading }) => {
    const { t } = useTranslation();
    const { isDark } = useAppStore();

    // 动态获取当前主题的主色，用于图表色盘推导
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--ans-primary').trim() || '#606C38';

    const getPieOption = (chartData: any[]) => {
        const total = chartData.reduce((sum, item) => sum + item.value, 0);
        
        return {
            tooltip: {
                trigger: 'item',
                backgroundColor: isDark ? 'rgba(20, 20, 20, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                padding: [10, 14],
                textStyle: { color: isDark ? '#ffffff' : '#1a1a1a', fontSize: 12 },
                borderWidth: 0,
                shadowBlur: 20,
                shadowColor: 'rgba(0,0,0,0.15)',
                formatter: '{b}: <b style="color:var(--ans-primary)">{c}</b> ({d}%)'
            },
            graphic: [
                {
                    type: 'text',
                    left: 'center',
                    top: 'center',
                    style: {
                        text: total > 0 ? total : '0',
                        textAlign: 'center',
                        fill: isDark ? '#ffffff' : '#000000', // 修复：由于 canvas 解析限制，必须使用具体颜色值而非 CSS 变量
                        fontSize: 26,
                        fontWeight: '900',
                        fontFamily: 'Inter, system-ui'
                    }
                },
                {
                    type: 'text',
                    left: 'center',
                    top: '60%',
                    style: {
                        text: 'TOTAL',
                        textAlign: 'center',
                        fill: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                        fontSize: 9,
                        fontWeight: 'bold',
                        letterSpacing: 1
                    }
                }
            ],
            series: [
                {
                    type: 'pie',
                    radius: ['70%', '88%'],
                    avoidLabelOverlap: false,
                    center: ['50%', '50%'],
                    itemStyle: {
                        borderRadius: 6,
                        borderColor: 'var(--ans-bg-container)',
                        borderWidth: 2
                    },
                    label: { show: false },
                    emphasis: { 
                        scale: true,
                        scaleSize: 8,
                        itemStyle: {
                            shadowBlur: 15,
                            shadowColor: 'rgba(0, 0, 0, 0.2)'
                        }
                    },
                    data: chartData.map((item, idx) => {
                        // 核心：基于当前主题主色的透明度/亮度推导色盘，实现完美的主题匹配
                        const colors = [
                            primaryColor,
                            `color-mix(in srgb, ${primaryColor}, transparent 30%)`,
                            `color-mix(in srgb, ${primaryColor}, transparent 50%)`,
                            `color-mix(in srgb, ${primaryColor}, transparent 70%)`,
                            `color-mix(in srgb, ${primaryColor}, black 20%)`
                        ];
                        return {
                            name: item.name,
                            value: item.value,
                            itemStyle: { 
                                // 如果 API 返回了 color 则用 API 的，否则用推导的（由于 ECharts 不支持 color-mix，这里需要注意）
                                // 修正：ECharts 内部不处理 CSS 变量和 color-mix，回退到主色
                                color: item.color || colors[idx % colors.length]
                            }
                        };
                    })
                }
            ]
        };
    };

    const renderDetailList = (chartData: any[]) => {
        const total = chartData.reduce((sum, item) => sum + item.value, 0);
        return (
            <div className="flex flex-col gap-y-3.5 py-1">
                {chartData.map((item, index) => {
                    const color = item.color || `color-mix(in srgb, ${primaryColor}, white ${index * 20}%)`;
                    return (
                        <div key={index} className="flex items-center justify-between group">
                            <Space size={10}>
                                <div className="w-1.5 h-3 rounded-full" style={{ backgroundColor: color }} />
                                <Text className="text-[12px] text-ans-text-secondary font-bold truncate max-w-[110px]" title={item.name}>
                                    {item.name}
                                </Text>
                            </Space>
                            <Space size={6}>
                                <Text strong className="text-[13px] text-ans-text-primary">{item.value}</Text>
                                <div className="w-10 text-right">
                                    <Text className="text-[9px] opacity-20 font-black">
                                        {total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '0%'}
                                    </Text>
                                </div>
                            </Space>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <Row gutter={[24, 24]}>
            <Col xs={24} md={12} lg={8}>
                <Card 
                    title={<span className="text-[11px] font-bold text-ans-text-secondary uppercase tracking-widest">{t('dashboard.platformDist')}</span>} 
                    className="ans-card"
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                        <Row align="middle" gutter={24}>
                            <Col span={11}>
                                <ReactECharts 
                                    option={getPieOption(data?.platformDistribution || [])} 
                                    style={{ height: 200 }} 
                                />
                            </Col>
                            <Col span={13} className="pl-6 border-l border-solid border-ans-border">
                                {renderDetailList(data?.platformDistribution || [])}
                            </Col>
                        </Row>
                    )}
                </Card>
            </Col>
            <Col xs={24} md={12} lg={8}>
                <Card 
                    title={<span className="text-[11px] font-bold text-ans-text-secondary uppercase tracking-widest">{t('dashboard.envDist')}</span>} 
                    className="ans-card"
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                        <Row align="middle" gutter={24}>
                            <Col span={11}>
                                <ReactECharts 
                                    option={getPieOption(data?.envDistribution || [])} 
                                    style={{ height: 200 }} 
                                />
                            </Col>
                            <Col span={13} className="pl-6 border-l border-solid border-ans-border">
                                {renderDetailList(data?.envDistribution || [])}
                            </Col>
                        </Row>
                    )}
                </Card>
            </Col>
            <Col xs={24} md={12} lg={8}>
                <Card 
                    title={<span className="text-[11px] font-bold text-ans-text-secondary uppercase tracking-widest">{t('dashboard.alertSeverityDist')}</span>} 
                    className="ans-card"
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 3 }} />
                    ) : (
                        <Row align="middle" gutter={24}>
                            <Col span={11}>
                                <ReactECharts 
                                    option={getPieOption(data?.alertSeverityDistribution || [])} 
                                    style={{ height: 200 }} 
                                />
                            </Col>
                            <Col span={13} className="pl-6 border-l border-solid border-ans-border">
                                {renderDetailList(data?.alertSeverityDistribution || [])}
                            </Col>
                        </Row>
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default DistributionCharts;
