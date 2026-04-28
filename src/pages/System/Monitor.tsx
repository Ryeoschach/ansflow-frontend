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
import { useTranslation } from 'react-i18next';
import { getSystemHealth, HealthComponent, getCeleryStats } from '../../api/system';
import { Button, Table } from 'antd';
import useAppStore from '../../store/useAppStore';

const { Title, Text } = Typography;

const componentsIcons: Record<string, React.ReactNode> = {
  DatabaseOutlined: <DatabaseOutlined />,
  ThunderboltOutlined: <ThunderboltOutlined />,
  RobotOutlined: <RobotOutlined />,
  ClusterOutlined: <ClusterOutlined />,
};

const CeleryWorkerTable: React.FC<{ workers: any[] }> = ({ workers }) => {
  const { t } = useTranslation();
  const columns = [
    { 
      title: t('monitor.workerName'), dataIndex: 'worker', key: 'worker', ellipsis: true,
      render: (v: string) => <Text strong className="font-mono" style={{ fontSize: '13px' }}>{v}</Text>
    },
    { 
      title: t('monitor.workerStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => (
        <Tag bordered={false} color={status === 'online' ? 'success' : 'error'} className="rounded-full px-3">
          {status.toUpperCase()}
        </Tag>
      )
    },
    { 
      title: t('monitor.workerActive'), dataIndex: 'active_count', key: 'active', width: 100,
      render: (v: number) => <Text strong style={{ color: v > 0 ? '#10b981' : undefined }}>{v}</Text>
    },
    { title: t('monitor.workerReserved'), dataIndex: 'reserved_count', key: 'reserved', width: 100 },
    { title: t('monitor.workerConcurrency'), dataIndex: 'concurrency', key: 'concurrency', width: 100 },
    { title: t('monitor.broker'), dataIndex: 'broker_transport', key: 'broker', width: 120 },
  ];

  return (
    <Table 
      dataSource={workers} 
      columns={columns} 
      size="middle" 
      pagination={false} 
      rowKey="worker"
    />
  );
};

const SystemHealthTable: React.FC<{ components: HealthComponent[] }> = ({ components }) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const columns = [
    {
      title: t('monitor.workerName'), // 统一使用“名称”
      key: 'name',
      width: 250,
      render: (_: any, record: HealthComponent) => (
        <Space size={12}>
          <div 
            className="p-2 rounded-lg flex items-center justify-center text-lg"
            style={{ 
              background: record.status === 'healthy' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              color: record.status === 'healthy' ? '#10b981' : '#ef4444' 
            }}
          >
            {componentsIcons[record.icon] || <DashOutlined />}
          </div>
          <Text strong>{record.label}</Text>
        </Space>
      )
    },
    {
      title: t('monitor.workerStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag bordered={false} color={status === 'healthy' ? 'success' : status === 'warning' ? 'warning' : 'error'} className="rounded-full px-3">
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: t('monitor.latency'),
      dataIndex: 'latency',
      key: 'latency',
      width: 120,
      render: (v: string) => <Text className="font-mono">{v || 'N/A'}</Text>
    },
    {
      title: t('monitor.noData'), // 借用作为“详情”列名
      key: 'details',
      render: (_: any, record: HealthComponent) => {
        if (record.status !== 'healthy' && record.message) {
          return <Text type="danger" size="small">{record.message}</Text>;
        }
        const details = Object.entries(record).filter(([key]) => !['name', 'label', 'icon', 'status', 'latency', 'message'].includes(key));
        if (details.length === 0) return <Text type="secondary">-</Text>;
        return (
          <Space size={8} wrap>
            {details.map(([key, value]) => (
              <Tag key={key} bordered={false} className="m-0 bg-gray-100 dark:bg-white/5">
                <Text type="secondary" style={{ fontSize: '11px' }}>{key.replace('_', ' ')}: </Text>
                <Text strong style={{ fontSize: '11px' }}>{String(value)}</Text>
              </Tag>
            ))}
          </Space>
        );
      }
    }
  ];

  return (
    <Table 
      dataSource={components} 
      columns={columns} 
      size="middle" 
      pagination={false} 
      rowKey="name"
    />
  );
};

const MonitorCenter: React.FC = () => {
  const { t } = useTranslation();
  const { token: authToken, hasPermission } = useAppStore();
  const { token: antdToken } = theme.useToken();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: getSystemHealth,
    refetchInterval: 30000,
    enabled: !!authToken && hasPermission('system:monitor:view'),
  });

  const { data: celeryData, isLoading: celeryLoading, refetch: refetchCelery } = useQuery({
    queryKey: ['celeryStats'],
    queryFn: getCeleryStats,
    refetchInterval: 30000,
    enabled: !!authToken && hasPermission('system:monitor:view'),
  });

  const overallStatus = data?.status || 'unknown';

  const handleRefreshAll = () => {
    refetch();
    refetchCelery();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex justify-between items-end mb-8">
        <div>
          <Title level={4} className="m-0 flex items-center gap-2">
            <HeartOutlined style={{ color: antdToken.colorError }} />
            {t('monitor.title')}
          </Title>
          <Text type="secondary" className="mt-1 block">
             {t('monitor.subtitle')}
          </Text>
        </div>
        <Space direction="vertical" align="end">
          {hasPermission('system:monitor:view') && (
          <Button
            icon={<SyncOutlined spin={isRefetching || celeryLoading} />}
            onClick={handleRefreshAll}
            type="text"
          >
            {t('monitor.syncNow')}
          </Button>
          )}
          {data?.timestamp && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <span className="hidden md:inline">{t('monitor.lastUpdate')}</span>{new Date(data.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </Space>
      </div>

      {isLoading || celeryLoading ? (
        <Row gutter={[24, 24]}>
          {[1, 2, 3, 4].map(i => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <Card style={{ borderRadius: 16 }}>
                <Skeleton active avatar paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
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
                <div className="text-white flex-1">
                  <div className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em]">Infrastructure Intelligence</div>
                  <div className="text-3xl font-semibold mt-1 tracking-tight">
                    {overallStatus === 'healthy' ? t('monitor.statusHealthy') : t('monitor.statusUnhealthy')}
                  </div>
                  <div className="flex items-center gap-4 mt-5">
                    <Tooltip title={t('monitor.healthyComponents')}>
                       <Space size={6} className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-2xl text-[11px] font-medium transition-colors hover:bg-white/10">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                         {data?.components?.filter(c => c.status === 'healthy').length || 0} {t('monitor.runningCount')}
                       </Space>
                    </Tooltip>
                    {data?.components?.some(c => c.status !== 'healthy') && (
                       <Space size={6} className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-2xl text-[11px] font-medium transition-colors hover:bg-white/10">
                         <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]"></div>
                         {data.components.filter(c => c.status !== 'healthy').length} {t('monitor.pendingCount')}
                       </Space>
                    )}
                  </div>
                </div>

                {/* Celery Quick Stats */}
                {celeryData && (
                  <div className="text-white bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md hidden lg:block min-w-80">
                    <div className="text-[10px] text-white/50 font-bold uppercase mb-4 tracking-widest">{t('monitor.celeryStatus')}</div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <div className="text-white/40 text-[10px] uppercase font-bold">{t('monitor.activeWorkers')}</div>
                        <div className="text-xl font-semibold tracking-tighter">
                          {celeryData.workers.filter(w => w.status === 'online').length}
                          <span className="text-xs text-white/30 ml-1 font-normal">/ {celeryData.workers.length}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-white/40 text-[10px] uppercase font-bold">{t('monitor.queueLength')}</div>
                        <div className="text-xl font-semibold tracking-tighter">
                          {celeryData.queues.reduce((acc, cur) => acc + cur.length, 0)}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-white/40 text-[10px] uppercase font-bold">{t('monitor.totalConcurrency')}</div>
                        <div className="text-xl font-semibold tracking-tighter">
                          {celeryData.workers.reduce((acc, cur) => acc + cur.concurrency, 0)}
                        </div>
                      </div>
                      {celeryData.beat && (
                        <div className="col-span-2 mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                           <Space size={8}>
                             <div className={`w-1.5 h-1.5 rounded-full ${celeryData.beat.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                             <span className="text-white/40 text-[10px] uppercase font-bold">{t('monitor.celeryBeatStatus')}</span>
                           </Space>
                           <span className="text-[10px] text-white/60 font-mono">{new Date(celeryData.beat.last_run).toLocaleTimeString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </Card>

          <Card 
            className="mb-8 shadow-sm" 
            style={{ borderRadius: 16 }}
            title={
              <Space>
                 <HeartOutlined className="text-rose-500" />
                 <Text strong>{t('monitor.title')}</Text>
              </Space>
            }
          >
            <SystemHealthTable components={data?.components || []} />
          </Card>

          {celeryData && (
            <Card 
              className="shadow-sm" 
              style={{ borderRadius: 16 }}
              title={
                <div className="flex justify-between items-center w-full">
                  <Space>
                    <ClusterOutlined className="text-blue-500" />
                    <Text strong>{t('monitor.celeryStatus')}</Text>
                  </Space>
                  {celeryData.beat && (
                    <Space>
                      <Text type="secondary" size="small" style={{ fontSize: '12px' }}>{t('monitor.celeryBeatStatus')}:</Text>
                      <Tag bordered={false} color={celeryData.beat.status === 'online' ? 'success' : 'error'} className="rounded-full px-3">{celeryData.beat.status.toUpperCase()}</Tag>
                      <Tooltip title={t('monitor.lastRunTime')}>
                        <Text type="secondary" style={{ fontSize: '11px' }} className="font-mono">
                          {new Date(celeryData.beat.last_run).toLocaleString()}
                        </Text>
                      </Tooltip>
                    </Space>
                  )}
                </div>
              }
            >
              <CeleryWorkerTable workers={celeryData.workers} />
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default MonitorCenter;


