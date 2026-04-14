import { Card, Statistic, Row, Col, theme } from 'antd';
import { StatsSkeleton } from '../../../components/Skeletons';
import {
    DatabaseOutlined,
    HddOutlined,
    CodeOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import React from 'react';

interface MetricCardsProps {
    data: any;
    isLoading: boolean;
}

const MetricCards: React.FC<MetricCardsProps> = ({ data, isLoading }) => {
    const { token } = theme.useToken();
    const metrics = data?.metrics || {};

    return (
        <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
                <Card className="shadow-sm border-0 h-full">
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <Statistic
                            title={<span className="text-gray-500 dark:text-gray-400 font-medium">托管主机总数</span>}
                            value={metrics.totalHosts}
                            suffix={<span className="text-sm text-gray-400">/ {metrics.onlineHosts} 在线</span>}
                            prefix={<HddOutlined className="text-blue-500" />}
                            styles={{
                                content: {
                                    color: token.colorText, fontWeight: 'bold'
                                }
                            }}
                        />
                    )}
                </Card>
            </Col>
            
            <Col xs={24} sm={12} md={6}>
                <Card className="shadow-sm border-0 h-full">
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <Statistic
                            title={<span className="text-gray-500 dark:text-gray-400 font-medium">资源池数量</span>}
                            value={metrics.totalResourcePools}
                            prefix={<DatabaseOutlined className="text-purple-500" />}
                            styles={{
                                content: {
                                    color: token.colorText, fontWeight: 'bold'
                                }
                            }}
                        />
                    )}
                </Card>
            </Col>
            
            <Col xs={24} sm={12} md={6}>
                <Card className="shadow-sm border-0 h-full">
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <Statistic
                            title={<span className="text-gray-500 dark:text-gray-400 font-medium">今日任务执行</span>}
                            value={metrics.dailyTaskRuns}
                            styles={{
                                content: {
                                    color: token.colorText,
                                    fontWeight: 'bold'
                                }
                            }}
                            prefix={<CodeOutlined className="text-green-500" />}
                        />
                    )}
                </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
                <Card className="shadow-sm border-0 h-full">
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <Statistic
                            title={<span className="text-gray-500 dark:text-gray-400 font-bold">失败任务数 (24h)</span>}
                            value={metrics.dailyFailedTasks}
                            styles={{
                                content: {
                                    color: metrics.dailyFailedTasks > 0 ? token.colorError : token.colorSuccess, fontWeight: 'bold'
                                }
                            }}
                            prefix={<WarningOutlined className={metrics.dailyFailedTasks > 0 ? "text-red-500" : "text-green-500"} />}
                        />
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default MetricCards;
