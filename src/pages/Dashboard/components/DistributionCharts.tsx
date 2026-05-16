import React from 'react';
import { Row, Col, Card, theme, Skeleton } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';

interface DistributionChartsProps {
    data: any;
    isLoading: boolean;
}

const DistributionCharts: React.FC<DistributionChartsProps> = ({ data, isLoading }) => {
    const { t } = useTranslation();
    const { token } = theme.useToken();

    const getPieOption = (title: string, chartData: any[]) => ({
        title: {
            text: title,
            textStyle: {
                color: token.colorTextHeading,
                fontSize: 14,
            },
            left: 'center',
        },
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        series: [
            {
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 8,
                    borderColor: token.colorBgContainer,
                    borderWidth: 2
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 12,
                        fontWeight: 'bold'
                    }
                },
                labelLine: {
                    show: false
                },
                data: chartData
            }
        ]
    });

    return (
        <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
                <Card className="shadow-sm border-0">
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 4 }} />
                    ) : (
                        <ReactECharts 
                            option={getPieOption("云平台分布", data?.platformDistribution || [])} 
                            style={{ height: 240 }} 
                        />
                    )}
                </Card>
            </Col>
            <Col xs={24} md={12}>
                <Card className="shadow-sm border-0">
                    {isLoading ? (
                        <Skeleton active paragraph={{ rows: 4 }} />
                    ) : (
                        <ReactECharts 
                            option={getPieOption("业务环境分布", data?.envDistribution || [])} 
                            style={{ height: 240 }} 
                        />
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default DistributionCharts;
