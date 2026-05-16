import React from 'react';
import { Card, List, Tag, Typography, theme, Empty, Button } from 'antd';
import { WarningOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

interface FiringAlertsWidgetProps {
    data: any;
    isLoading: boolean;
}

const FiringAlertsWidget: React.FC<FiringAlertsWidgetProps> = ({ data, isLoading }) => {
    const { token } = theme.useToken();
    const navigate = useNavigate();
    const alerts = data?.firingAlerts || [];

    return (
        <Card 
            title={
                <div className="flex items-center gap-2">
                    <WarningOutlined className="text-red-500 animate-pulse" />
                    <span className="text-sm font-bold text-red-600">活动告警 (Top 5)</span>
                </div>
            }
            extra={
                <Button type="link" size="small" onClick={() => navigate('/v1/sre/alerts')}>
                    查看全部 <ArrowRightOutlined />
                </Button>
            }
            className="shadow-sm border-0"
            styles={{ body: { padding: '12px' } }}
        >
            {alerts.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无活动告警" />
            ) : (
                <List
                    size="small"
                    dataSource={alerts}
                    renderItem={(item: any) => (
                        <List.Item 
                            className="hover:bg-red-50/50 cursor-pointer rounded-lg transition-colors border-0"
                            onClick={() => navigate(`/v1/sre/alerts`)}
                        >
                            <div className="flex flex-col w-full gap-1">
                                <div className="flex justify-between items-center">
                                    <Text strong className="text-[12px] truncate max-w-[70%]">{item.alert_name}</Text>
                                    <Tag color={item.severity === 'critical' ? 'error' : 'warning'} className="m-0 text-[10px] scale-90">
                                        {item.severity.toUpperCase()}
                                    </Tag>
                                </div>
                                <Text type="secondary" className="text-[10px]">
                                    {new Date(item.create_time).toLocaleString()}
                                </Text>
                            </div>
                        </List.Item>
                    )}
                />
            )}
        </Card>
    );
};

export default FiringAlertsWidget;
