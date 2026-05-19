import React from 'react';
import { Card, Skeleton } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../../store/useAppStore';

interface TaskTrendChartProps {
    data: any;
    isLoading: boolean;
}

const TaskTrendChart: React.FC<TaskTrendChartProps> = ({ data, isLoading }) => {
    const { t } = useTranslation();
    const { isDark } = useAppStore();
    const trendData = data?.taskTrend || [];

    const option = {
        title: {
            text: t('dashboard.trendTitle'),
            textStyle: {
                color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
                fontSize: 14,
                fontWeight: '800',
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            left: '0',
            top: '0',
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderWidth: 0,
            padding: [10, 16],
            textStyle: { color: isDark ? '#ffffff' : '#000000', fontSize: 12 },
            extraCssText: 'box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius: 8px;'
        },
        legend: {
            data: [t('dashboard.success'), t('dashboard.failed')],
            right: 0,
            top: '0',
            icon: 'circle',
            itemWidth: 8,
            textStyle: {
                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                fontSize: 11,
                fontWeight: 'bold',
            }
        },
        grid: {
            left: '0',
            right: '10',
            bottom: '0',
            top: '60',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: trendData.map((d: any) => d.time),
            axisLabel: {
                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                fontSize: 10,
            },
            axisLine: { show: false },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            splitLine: {
                lineStyle: {
                    color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    type: 'dashed',
                }
            },
            axisLabel: {
                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                fontSize: 10,
            }
        },
        series: [
            {
                name: t('dashboard.success'),
                type: 'line',
                smooth: 0.4,
                showSymbol: false,
                itemStyle: { color: isDark ? '#73d13d' : '#52c41a' },
                lineStyle: { width: 3, cap: 'round' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{
                            offset: 0, color: isDark ? 'rgba(115, 209, 61, 0.2)' : 'rgba(82, 196, 26, 0.2)' // 成功绿透明
                        }, {
                            offset: 1, color: isDark ? 'rgba(115, 209, 61, 0)' : 'rgba(82, 196, 26, 0)'
                        }]
                    }
                },
                data: trendData.map((d: any) => d.success),
            },
            {
                name: t('dashboard.failed'),
                type: 'line',
                smooth: 0.4,
                showSymbol: false,
                itemStyle: { color: isDark ? '#ff7875' : '#ff4d4f' },
                lineStyle: { width: 2, type: 'dashed' },
                data: trendData.map((d: any) => d.failed),
            }
        ]
    };

    return (
        <Card className="ans-card h-full" styles={{ body: { padding: '24px' } }}>
            {isLoading ? (
                <div className="pt-2">
                    <Skeleton active title={true} paragraph={{ rows: 7 }} />
                </div>
            ) : (
                <ReactECharts option={option} style={{ height: 320 }} />
            )}
        </Card>
    );
};

export default TaskTrendChart;