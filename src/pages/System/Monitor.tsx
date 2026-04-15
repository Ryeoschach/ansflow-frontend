import React from 'react';
import { Card, Col, Row, Tag, Typography, Space, theme, Skeleton, Tooltip, Empty } from 'antd';
import {
  HeartOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ClusterOutlined,
  DashOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { getSystemHealth, HealthComponent } from '../../api/system';
import { Button } from 'antd';
import useAppStore from '../../store/useAppStore';

const { Title, Text } = Typography;

const componentsIcons: Record<string, React.ReactNode> = {
  DatabaseOutlined: <DatabaseOutlined />,
  ThunderboltOutlined: <ThunderboltOutlined />,
  RobotOutlined: <RobotOutlined />,
  ClusterOutlined: <ClusterOutlined />,
};

const MonitorCard: React.FC<{ component: HealthComponent }> = ({ component }) => {
  const { token } = theme.useToken();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'unhealthy': return '#ef4444';
      default: return token.colorTextSecondary;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'rgba(16, 185, 129, 0.08)';
      case 'warning': return 'rgba(245, 158, 11, 0.08)';
      case 'unhealthy': return 'rgba(239, 68, 68, 0.08)';
      default: return 'rgba(0, 0, 0, 0.04)';
    }
  };

  const statusColor = getStatusColor(component.status);
  const statusBg = getStatusBg(component.status);

  return (
    <Card 
      hoverable
      style={{
        borderRadius: 16,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        background: token.colorBgContainer,
        height: '100%',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      styles={{ body: { padding: '20px'} }}
    >
      <div className="flex justify-between items-start mb-4">
        <div 
          className="p-3 rounded-xl flex items-center justify-center text-xl"
          style={{ background: statusBg, color: statusColor }}
        >
          {componentsIcons[component.icon] || <DashOutlined />}
        </div>
        <Tag color={component.status === 'healthy' ? 'success' : component.status === 'warning' ? 'warning' : 'error'}>
          {component.status.toUpperCase()}
        </Tag>
      </div>

      <Title level={5} style={{ margin: '0 0 8px 0' }}>{component.label}</Title>
      
      {component.status === 'unhealthy' ? (
        <Text type="danger" style={{ fontSize: '13px', display: 'block', minHeight: '40px' }}>
          {component.message || '连接不可达'}
        </Text>
      ) : (
        <div className="space-y-2 mt-4 min-h-15">
          {Object.entries(component).map(([key, value]) => {
            if (['name', 'label', 'icon', 'status', 'latency', 'message'].includes(key)) return null;
            return (
              <div key={key} className="flex justify-between items-center bg-gray-50/50 dark:bg-white/5 p-1 px-2 rounded-md">
                <Text type="secondary" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                  {key.replace('_', ' ')}
                </Text>
                <Text strong style={{ fontSize: '12px' }}>{String(value)}</Text>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/10 flex justify-between items-center">
        <Space size={4}>
          <ClockCircleOutlined style={{ fontSize: '12px', color: token.colorTextSecondary }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>耗时</Text>
        </Space>
        <Text strong style={{ fontSize: '12px', color: statusColor }}>
          {component.latency || 'N/A'}
        </Text>
      </div>
    </Card>
  );
};

const MonitorCenter: React.FC = () => {
  const { token: authToken, hasPermission } = useAppStore();
  const { token: antdToken } = theme.useToken();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: getSystemHealth,
    refetchInterval: 30000, // 每 30 秒自动刷新一次
    enabled: !!authToken && hasPermission('system:monitor:view'),
  });

  const overallStatus = data?.status || 'unknown';

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-end mb-8">
        <div>
          <Title level={4} className="m-0 flex items-center gap-2">
            <HeartOutlined style={{ color: antdToken.colorError }} />
            系统健康监测
          </Title>
          <Text type="secondary" className="mt-1 block">
             实时监测 AnsFlow 各个核心组件的运行状态与响应时延
          </Text>
        </div>
        <Space direction="vertical" align="end">
          {hasPermission('system:monitor:view') && (
          <Button
            icon={<SyncOutlined spin={isRefetching} />}
            onClick={() => refetch()}
            type="text"
          >
            立即同步
          </Button>
          )}
          {data?.timestamp && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <span className="hidden md:inline">最后更新: </span>{new Date(data.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </Space>
      </div>

      {isLoading ? (
        <Row gutter={[24, 24]}>
          {[1, 2, 3, 4].map(i => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <Card style={{ borderRadius: 16 }}>
                <Skeleton active avatar paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : data?.components ? (
        <>
          <Card 
            className="mb-8 overflow-hidden" 
            style={{ 
              borderRadius: 24, 
              border: 'none',
              background: overallStatus === 'healthy' 
                ? 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' 
                : 'linear-gradient(135deg, #44403c 0%, #292524 100%)',
              boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)',
              position: 'relative'
            }}
          >
            <div className="absolute right-5 top-5 opacity-10">
               <HeartOutlined style={{ fontSize: 240, color: '#fff' }} />
            </div>

            <div className="flex items-center gap-8 py-4 relative z-10">
                <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-md hidden sm:block border border-white/10">
                   <HeartOutlined style={{ fontSize: 48, color: '#fff' }} className={overallStatus === 'healthy' ? 'animate-pulse' : ''} />
                </div>
                <div className="text-white">
                  <div className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em]">Infrastructure Intelligence</div>
                  <div className="text-3xl font-semibold mt-1 tracking-tight">
                    {overallStatus === 'healthy' ? '全系统节点运行稳健' : '监测到部分组件响应异常'}
                  </div>
                  <div className="flex items-center gap-4 mt-5">
                    <Tooltip title="Healthy Components">
                       <Space size={6} className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-2xl text-[11px] font-medium transition-colors hover:bg-white/10">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                         {data.components.filter(c => c.status === 'healthy').length} 运行中
                       </Space>
                    </Tooltip>
                    {data.components.some(c => c.status !== 'healthy') && (
                       <Space size={6} className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-2xl text-[11px] font-medium transition-colors hover:bg-white/10">
                         <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]"></div>
                         {data.components.filter(c => c.status !== 'healthy').length} 待扫描
                       </Space>
                    )}
                  </div>
                </div>
            </div>
          </Card>

          <Row gutter={[24, 24]}>
            {data.components.map((comp) => (
              <Col key={comp.name} xs={24} sm={12} lg={6}>
                <MonitorCard component={comp} />
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <Empty description="未能获取到监控数据" />
      )}
    </div>
  );
};

export default MonitorCenter;


