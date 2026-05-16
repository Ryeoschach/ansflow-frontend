import React from 'react';
import { Row, Col, theme, Badge, Card } from 'antd';
import { useDashboardData } from './Dashboard/hooks/useDashboardData';
import MetricCards from './Dashboard/components/MetricCards';
import TaskTrendChart from './Dashboard/components/TaskTrendChart';
import RecentTasksTable from './Dashboard/components/RecentTasksTable';
import DistributionCharts from './Dashboard/components/DistributionCharts';
import FiringAlertsWidget from './Dashboard/components/FiringAlertsWidget';
import { useTranslation } from 'react-i18next';

/**
 * 仪表盘概览页面 - AnsFlow DevOps Platform
 */
const Dashboard: React.FC = () => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const { data, isLoading } = useDashboardData();

    return (
        <div style={{ color: token.colorText }} className="flex flex-col gap-6 animate-in fade-in duration-700">

            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold mb-1 tracking-tight">{t('dashboard.title')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{t('dashboard.subtitle')}</p>
                </div>
                <div className="hidden md:block">
                    <Badge status="processing" text={t('dashboard.syncing')} className="opacity-60 text-xs" />
                </div>
            </div>

            {/* 1. 核心指标卡片 */}
            <MetricCards data={data} isLoading={isLoading} />

            {/* 2. 资产分布情况 (饼图) */}
            <DistributionCharts data={data} isLoading={isLoading} />

            {/* 3. 主体图表与侧边栏组件 */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <TaskTrendChart data={data} isLoading={isLoading} />
                </Col>
                <Col xs={24} lg={8}>
                    <FiringAlertsWidget data={data} isLoading={isLoading} />
                </Col>
            </Row>

            {/* 4. 最近执行动态表格 */}
            <Card title={t('dashboard.recentDynamic')} className="shadow-sm border-0">
                <RecentTasksTable data={data} isLoading={isLoading} />
            </Card>

        </div>
    );
};

export default Dashboard;
