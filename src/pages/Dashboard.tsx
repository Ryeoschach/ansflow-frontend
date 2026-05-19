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
    const { data, isLoading } = useDashboardData();

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700">

            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-extrabold mb-1 tracking-tight text-ans-text-primary italic">
                        {t('dashboard.title')}
                    </h2>
                    <p className="text-ans-text-secondary text-sm font-medium opacity-80">
                        {t('dashboard.subtitle')}
                    </p>
                </div>
                <div className="hidden md:block">
                    <div className="flex items-center gap-2 px-3 py-1 bg-ans-primary/5 rounded-full border border-ans-primary/10">
                        <Badge status="processing" color="var(--ans-primary)" />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-ans-primary">{t('dashboard.syncing')}</span>
                    </div>
                </div>
            </div>

            {/* 1. 核心指标卡片 */}
            <MetricCards data={data} isLoading={isLoading} />

            {/* 2. 资产分布情况 (饼图) */}
            <DistributionCharts data={data} isLoading={isLoading} />

            {/* 3. 主体图表与侧边栏组件 */}
            <Row gutter={[24, 24]}>
                <Col xs={24} lg={16}>
                    <TaskTrendChart data={data} isLoading={isLoading} />
                </Col>
                <Col xs={24} lg={8}>
                    <FiringAlertsWidget data={data} isLoading={isLoading} />
                </Col>
            </Row>

            {/* 4. 最近执行动态表格 */}
            <Card 
                title={<span className="text-sm font-bold opacity-80 tracking-wide uppercase">{t('dashboard.recentDynamic')}</span>} 
                className="ans-card overflow-hidden"
            >
                <RecentTasksTable data={data} isLoading={isLoading} />
            </Card>

        </div>
    );
};

export default Dashboard;
