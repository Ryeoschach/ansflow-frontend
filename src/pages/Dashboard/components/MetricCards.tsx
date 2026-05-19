import { Card, Statistic, Row, Col } from 'antd';
import { StatsSkeleton } from '../../../components/Skeletons';
import {
    DatabaseOutlined,
    HddOutlined,
    CodeOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface MetricCardsProps {
    data: any;
    isLoading: boolean;
}

const MetricCards: React.FC<MetricCardsProps> = ({ data, isLoading }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const metrics = data?.metrics || {};

    const cardClass = "ans-card h-full cursor-pointer hover:-translate-y-1";

    const IconWrapper = ({ children, color }: { children: React.ReactNode, color: string }) => (
        <div 
            className="w-10 h-10 rounded-ans-md flex items-center justify-center mb-3 transition-colors"
            style={{ backgroundColor: `color-mix(in srgb, ${color}, transparent 90%)`, color: color }}
        >
            {React.cloneElement(children as React.ReactElement, { style: { fontSize: 20 } })}
        </div>
    );

    return (
        <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} md={6}>
                <Card className={cardClass} onClick={() => navigate('/v1/system/hosts')}>
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <>
                            <IconWrapper color="var(--ans-primary)">
                                <HddOutlined />
                            </IconWrapper>
                            <Statistic
                                title={<span className="text-ans-text-secondary text-xs font-bold uppercase tracking-wider">{t('dashboard.totalHosts')}</span>}
                                value={metrics.totalHosts}
                                suffix={<span className="text-[10px] opacity-40 font-normal">/ {metrics.onlineHosts} ONLINE</span>}
                                valueStyle={{ color: 'var(--ans-text-primary)', fontWeight: 800, fontSize: '28px' }}
                            />
                        </>
                    )}
                </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
                <Card className={cardClass} onClick={() => navigate('/v1/system/resourcepool')}>
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <>
                            <IconWrapper color="var(--ans-primary)">
                                <DatabaseOutlined />
                            </IconWrapper>
                            <Statistic
                                title={<span className="text-ans-text-secondary text-xs font-bold uppercase tracking-wider">{t('dashboard.resourcePools')}</span>}
                                value={metrics.totalResourcePools}
                                valueStyle={{ color: 'var(--ans-text-primary)', fontWeight: 800, fontSize: '28px' }}
                            />
                        </>
                    )}
                </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
                <Card className={cardClass} onClick={() => navigate('/v1/task/executions')}>
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <>
                            <IconWrapper color="var(--ans-primary)">
                                <CodeOutlined />
                            </IconWrapper>
                            <Statistic
                                title={<span className="text-ans-text-secondary text-xs font-bold uppercase tracking-wider">{t('dashboard.dailyTasks')}</span>}
                                value={metrics.dailyTaskRuns}
                                valueStyle={{ color: 'var(--ans-text-primary)', fontWeight: 800, fontSize: '28px' }}
                            />
                        </>
                    )}
                </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
                <Card className={cardClass} onClick={() => navigate('/v1/task/executions?status=failed')}>
                    {isLoading ? (
                        <StatsSkeleton />
                    ) : (
                        <>
                            <IconWrapper color={metrics.dailyFailedTasks > 0 ? "var(--ans-error)" : "var(--ans-success)"}>
                                <WarningOutlined />
                            </IconWrapper>
                            <Statistic
                                title={<span className="text-ans-text-secondary text-xs font-bold uppercase tracking-wider">{t('dashboard.failedTasks24h')}</span>}
                                value={metrics.dailyFailedTasks}
                                valueStyle={{ 
                                    color: metrics.dailyFailedTasks > 0 ? 'var(--ans-error)' : 'var(--ans-text-primary)', 
                                    fontWeight: 800, 
                                    fontSize: '28px' 
                                }}
                            />
                        </>
                    )}
                </Card>
            </Col>
        </Row>
    );
};

export default MetricCards;