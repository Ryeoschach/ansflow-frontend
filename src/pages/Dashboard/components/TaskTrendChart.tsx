import React from 'react';
import { Card, Skeleton, theme } from 'antd';
import ReactECharts from 'echarts-for-react';
import useAppStore from '../../../store/useAppStore';

interface TaskTrendChartProps {
    data: any;
    isLoading: boolean;
}

const TaskTrendChart: React.FC<TaskTrendChartProps> = ({ data, isLoading }) => {
    const { token } = theme.useToken();
    const { isDark } = useAppStore();
    const trendData = data?.taskTrend || [];

    const option = {
        title: {
            text: '24小时任务执行趋势',
            textStyle: {
                color: token.colorTextHeading,
                fontSize: 16,
                fontWeight: 'bold',
            },
            left: '0',
            top: '0',
        },
        tooltip: {
            trigger: 'axis',
        },
        legend: {
            data: ['成功', '失败'],
            right: 0,
            top: '0',
            textStyle: {
                color: token.colorTextSecondary,
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '40',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: trendData.map((d: any) => d.time),
            axisLabel: {
                color: token.colorTextSecondary,
            }
        },
        yAxis: {
            type: 'value',
            splitLine: {
                lineStyle: {
                    color: isDark ? '#303030' : '#f0f0f0',
                }
            },
            axisLabel: {
                color: token.colorTextSecondary,
            }
        },
        series: [
            {
                name: '成功',
                type: 'line',
                smooth: true,
                itemStyle: { color: isDark ? '#34D399' : '#10b981' },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{
                            offset: 0, color: isDark ? 'rgba(52,211,153,0.3)' : 'rgba(16,185,129,0.3)'
                        }, {
                            offset: 1, color: isDark ? 'rgba(52,211,153,0.01)' : 'rgba(16,185,129,0.01)'
                        }]
                    }
                },
                data: trendData.map((d: any) => d.success),
            },
            {
                name: '失败',
                type: 'line',
                smooth: true,
                itemStyle: { color: '#ef4444' },
                data: trendData.map((d: any) => d.failed),
            }
        ]
    };

    return (
        <Card className="shadow-sm border-0 h-full">
            {isLoading ? (
                <div className="pt-2">
                    <Skeleton active title={true} paragraph={{ rows: 6 }} />
                </div>
            ) : (
                <ReactECharts option={option} style={{ height: 320 }} />
            )}
        </Card>
    );
};

export default TaskTrendChart;
