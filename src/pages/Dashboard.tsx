import React from 'react';
import { Row, Col, theme } from 'antd';
import { useDashboardData } from './Dashboard/hooks/useDashboardData';
import MetricCards from './Dashboard/components/MetricCards';
import TaskTrendChart from './Dashboard/components/TaskTrendChart';
import RecentTasksTable from './Dashboard/components/RecentTasksTable';
import { useTranslation } from 'react-i18next';

/**
 * 仪表盘概览页面 - AnsFlow DevOps Platform
 */
const Dashboard: React.FC = () => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { data, isLoading } = useDashboardData();

    return (
        <div style={{
            color: token.colorText,
        }} className="flex flex-col gap-6">

            <div>
                <h2 className="text-2xl font-bold mb-1 tracking-tight">{t('dashboard.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('dashboard.subtitle')}</p>
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
