import React from 'react';
import { Row, Col, theme } from 'antd';
import { useDashboardData } from './Dashboard/hooks/useDashboardData';
import MetricCards from './Dashboard/components/MetricCards';
import TaskTrendChart from './Dashboard/components/TaskTrendChart';
import RecentTasksTable from './Dashboard/components/RecentTasksTable';

/**
 * 仪表盘概览页面 - AnsFlow DevOps Platform
 */
const Dashboard: React.FC = () => {
    const { token } = theme.useToken();
    const { data, isLoading } = useDashboardData();

    return (
        <div style={{
            color: token.colorText,
        }} className="flex flex-col gap-6">
            
            <div>
                <h2 className="text-2xl font-bold mb-1 tracking-tight">全局总览</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">监控 AnsFlow 平台的资源池、主机状态与任务执行情况</p>
            </div>

            {/* 四个卡片 */}
            <MetricCards data={data} isLoading={isLoading} />

            {/* 图表与任务流组件 */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={14} xl={16}>
                    <TaskTrendChart data={data} isLoading={isLoading} />
                </Col>
                <Col xs={24} lg={10} xl={8}>
                    <RecentTasksTable data={data} isLoading={isLoading} />
                </Col>
            </Row>

        </div>
    );
};

export default Dashboard;
