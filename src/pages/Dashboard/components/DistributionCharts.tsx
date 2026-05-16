import React from 'react';
import { Row, Col, Card, theme, Skeleton, Typography, List, Badge, Space } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface DistributionChartsProps {
    data: any;
    isLoading: boolean;
}

const DistributionCharts: React.FC<DistributionChartsProps> = ({ data, isLoading }) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();

    const getPieOption = (chartData: any[]) => ({
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        series: [
            {
                type: 'pie',
                radius: ['60%', '85%'],
                avoidLabelOverlap: false,
                center: ['50%', '50%'],
                itemStyle: {
                    borderRadius: 4,
                    borderColor: token.colorBgContainer,
                    borderWidth: 2
                },
                label: { show: false },
                emphasis: { label: { show: false } },
                data: chartData.map(item => ({
                    name: item.name,
                    value: item.value,
                    itemStyle: item.color ? { color: item.color } : undefined
                }))
            }
        ]
    });

    const renderDetailList = (chartData: any[]) => {
        const total = chartData.reduce((sum, item) => sum + item.value, 0);
        return (
            <div className="flex flex-col gap-y-1.5 py-2">
                {chartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-end whitespace-nowrap overflow-hidden pr-2 w-full">
                        <div 
                            className="w-3 h-1 rounded-sm mr-2 shrink-0" 
                            style={{ backgroundColor: item.color || token.colorPrimary }} 
                        />
                        <Text 
                            className="max-w-[110px] truncate mr-3 text-[12px] text-gray-500 text-right" 
                            title={item.name}
                        >
                            {item.name}
                        </Text>
                        <Space size={4} className="items-baseline shrink-0">
                            <Text strong className="text-[13px]">{item.value}</Text>
                            <Text type="secondary" className="text-[10px] opacity-40">
                                {total > 0 ? `(${((item.value / total) * 100).toFixed(0)}%)` : '(0%)'}
                            </Text>
                        </Space>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
                <Card 
                    title={<Text strong className="text-sm">{t('dashboard.platformDist') || "云平台分布"}</Text>} 
                    className="shadow-sm border-0"
                    styles={{ body: { padding: '12px 16px' } }}
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 4 }} />
                    ) : (
                        <Row align="middle">
                            <Col span={10}>
                                <ReactECharts 
                                    option={getPieOption(data?.platformDistribution || [])} 
                                    style={{ height: 160 }} 
                                />
                            </Col>
                            <Col span={14} className="pl-4">
                                {renderDetailList(data?.platformDistribution || [])}
                            </Col>
                        </Row>
                    )}
                </Card>
            </Col>
            <Col xs={24} md={12}>
                <Card 
                    title={<Text strong className="text-sm">{t('dashboard.envDist') || "业务环境分布"}</Text>} 
                    className="shadow-sm border-0"
                    styles={{ body: { padding: '12px 16px' } }}
                >
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 4 }} />
                    ) : (
                        <Row align="middle">
                            <Col span={10}>
                                <ReactECharts 
                                    option={getPieOption(data?.envDistribution || [])} 
                                    style={{ height: 160 }} 
                                />
                            </Col>
                            <Col span={14} className="pl-4">
                                {renderDetailList(data?.envDistribution || [])}
                            </Col>
                        </Row>
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default DistributionCharts;
