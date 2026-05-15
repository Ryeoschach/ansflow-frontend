import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, message, Badge, Modal, Descriptions, Tabs, Empty, Radio, theme } from 'antd';
import { 
  ThunderboltOutlined, 
  ClusterOutlined, 
  SyncOutlined, 
  CloseCircleOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  SearchOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPulseStats, getWorkerNodes, getTaskPulseList, revokeTaskPulse } from '@/api/pulse';
import request from '@/utils/requests'; 
import dayjs from 'dayjs';

const TaskPulse: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterState, setFilterState] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<{ visible: boolean; type: 'task' | 'worker'; data: any }>({
    visible: false,
    type: 'task',
    data: null,
  });

  // 获取统计数据
  const { data: stats } = useQuery({
    queryKey: ['pulseStats'],
    queryFn: () => getPulseStats() as Promise<any>,
    refetchInterval: 5000,
  });

  // 获取 Worker 列表
  const { data: workers } = useQuery({
    queryKey: ['pulseWorkers'],
    queryFn: () => getWorkerNodes(),
    refetchInterval: 5000,
  });

  // 获取任务列表
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['pulseTasks', page, filterState],
    queryFn: () => getTaskPulseList({ 
        page, 
        page_size: 10, 
        state: filterState || undefined 
    }),
    refetchInterval: 3000,
  });

  const fetchWorkerDetail = async (id: number) => {
    try {
      const res = await request.get(`/pulse/workers/${id}/detail_info/`);
      setDetailModal({ visible: true, type: 'worker', data: res });
    } catch (err) {
      message.error(t('pulse.noWorker'));
    }
  };

  const revokeMutation = useMutation({
    mutationFn: revokeTaskPulse,
    onSuccess: () => {
      message.success(t('pulse.revokeConfirm'));
      queryClient.invalidateQueries({ queryKey: ['pulseTasks'] });
    },
  });

  const getStateTag = (state: string) => {
    const config: any = {
      SUCCESS: { color: 'success', icon: <CheckCircleOutlined />, text: t('pulse.status_map.success') },
      FAILURE: { color: 'error', icon: <CloseCircleOutlined />, text: t('pulse.status_map.failure') },
      STARTED: { color: 'processing', icon: <SyncOutlined spin />, text: t('pulse.status_map.running') },
      PENDING: { color: 'default', icon: <PlayCircleOutlined />, text: t('pulse.status_map.pending') },
      REVOKED: { color: 'warning', icon: <ExclamationCircleOutlined />, text: t('pulse.status_map.revoked') },
      RETRY: { color: 'warning', icon: <SyncOutlined />, text: t('pulse.status_map.retry') },
    };
    // Fallback translation if key not found in i18n
    const item = config[state] || { color: 'default', text: state };
    return <Tag icon={item.icon} color={item.color}>{item.text || state}</Tag>;
  };

  const columns = [
    { title: t('pulse.taskId'), dataIndex: 'task_id', key: 'task_id', width: 180, ellipsis: true },
    { title: t('pulse.taskName'), dataIndex: 'name', key: 'name', ellipsis: true },
    { title: t('pulse.status'), dataIndex: 'state', key: 'state', render: (s: string) => getStateTag(s) },
    { title: t('pulse.worker'), dataIndex: 'worker_name', key: 'worker_name' },
    { 
      title: `${t('pulse.runtime')}(s)`, 
      dataIndex: 'runtime', 
      key: 'runtime', 
      render: (r: number) => <Tag color="blue">{(Number(r) || 0).toFixed(2)}s</Tag> 
    },
    { 
      title: t('pulse.updateTime'), 
      dataIndex: 'update_time', 
      key: 'update_time', 
      render: (t: string) => dayjs(t).format('HH:mm:ss') 
    },
    {
      title: t('pulse.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<SearchOutlined />}
            onClick={() => setDetailModal({ visible: true, type: 'task', data: record })}
          >
            {t('pulse.detail')}
          </Button>
          {['STARTED', 'PENDING'].includes(record.state) && (
            <Button 
              danger 
              type="link"
              size="small" 
              onClick={() => revokeMutation.mutate(record.id)}
            >
              {t('pulse.revoke')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const getListData = (data: any) => {
    if (!data) return [];
    if (data.total !== undefined && Array.isArray(data.data)) return data.data;
    if (data.data !== undefined && Array.isArray(data.data)) return data.data;
    if (Array.isArray(data)) return data;
    if (data.results !== undefined && Array.isArray(data.results)) return data.results;
    return [];
  };

  const getCount = (data: any) => {
    if (!data) return 0;
    if (typeof data.total === 'number') return data.total;
    if (data.data && typeof data.data.total === 'number') return data.data.total;
    if (typeof data.count === 'number') return data.count;
    return getListData(data).length;
  };

  const workerList = getListData(workers);
  const taskList = getListData(tasks);
  const taskCount = getCount(tasks);

  return (
    <div className="p-6">
      <Row gutter={[16, 16]} className="mb-6">
        <Col span={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title={t('pulse.onlineWorkers')}
              value={stats?.online_workers || 0}
              suffix={`/ ${stats?.total_workers || 0}`}
              prefix={<ClusterOutlined className="text-blue-500" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title={t('pulse.runningTasks')}
              value={stats?.running_tasks || 0}
              valueStyle={{ color: token.colorPrimary }}
              prefix={<SyncOutlined spin={stats?.running_tasks > 0} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title={t('pulse.totalTasks')}
              value={stats?.total_tasks || 0}
              prefix={<HistoryOutlined className="text-orange-500" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title={t('pulse.health')}
              value={100}
              suffix="%"
              valueStyle={{ color: token.colorSuccess }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            title={<Space><ClusterOutlined />{t('pulse.workerStatus')}</Space>} 
            className="mb-6 shadow-sm border-none"
          >
            <Row gutter={[16, 16]}>
              {workerList.map((w: any) => (
                <Col span={6} key={w.id}>
                  <Card 
                    size="small" 
                    hoverable 
                    style={{ 
                        borderLeft: `4px solid ${w.status === 'online' ? token.colorSuccess : token.colorBorder}`,
                        backgroundColor: token.colorFillAlter
                    }}
                    onClick={() => fetchWorkerDetail(w.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold truncate" style={{ maxWidth: '120px' }}>{w.hostname}</span>
                      <Badge status={w.status === 'online' ? 'success' : 'default'} text={w.status === 'online' ? t('common.online') : t('common.offline')} />
                    </div>
                    <div className="mt-2 text-neutral-500 text-xs flex justify-between">
                      <span>{t('pulse.processed')}: {w.processed_count || 0}</span>
                      <span>{t('pulse.poolConfig')}: {w.concurrency || 0}</span>
                    </div>
                  </Card>
                </Col>
              ))}
              {workerList.length === 0 && (
                 <Col span={24}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pulse.noWorker')} /></Col>
              )}
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Card 
            title={
                <div className="flex justify-between items-center w-full">
                    <Space><ThunderboltOutlined />{t('pulse.taskTrack')}</Space>
                    <Radio.Group 
                        value={filterState} 
                        onChange={(e) => {
                            setFilterState(e.target.value);
                            setPage(1);
                        }}
                        optionType="button"
                        buttonStyle="solid"
                        size="small"
                    >
                        <Radio.Button value={null}>{t('pulse.allTasks')}</Radio.Button>
                        <Radio.Button value="STARTED">{t('pulse.onlyRunning')}</Radio.Button>
                    </Radio.Group>
                </div>
            } 
            className="shadow-sm border-none"
          >
            <Table 
              columns={columns} 
              dataSource={taskList} 
              rowKey="id"
              loading={isLoading}
              size="middle"
              pagination={{
                current: page,
                total: taskCount,
                pageSize: 10,
                showSizeChanger: false,
                onChange: (p) => setPage(p),
              }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={detailModal.type === 'task' ? t('pulse.taskDetail') : `${t('pulse.workerInspection')}: ${detailModal.data?.db_info?.hostname}`}
        open={detailModal.visible}
        onCancel={() => setDetailModal({ ...detailModal, visible: false })}
        footer={null}
        width={detailModal.type === 'task' ? 700 : 900}
        centered
        styles={{ body: { padding: '20px' } }}
      >
        {detailModal.type === 'task' && detailModal.data && (
          <Descriptions bordered column={1} size="small" className="mt-4">
            <Descriptions.Item label={t('pulse.taskId')}><span className="font-mono text-xs">{detailModal.data.task_id}</span></Descriptions.Item>
            <Descriptions.Item label={t('pulse.taskName')}><code>{detailModal.data.name}</code></Descriptions.Item>
            <Descriptions.Item label={t('pulse.status')}>{getStateTag(detailModal.data.state)}</Descriptions.Item>
            <Descriptions.Item label={t('pulse.args')}>
              <div className="max-h-32 overflow-auto bg-neutral-900 dark:bg-black p-3 rounded">
                 <pre className="text-white text-[11px] m-0">
                    Args: {detailModal.data.args || '[]'}\n
                    Kwargs: {detailModal.data.kwargs || '{}'}
                 </pre>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label={t('pulse.result')}>
              <pre className="text-xs bg-neutral-50 dark:bg-neutral-800 p-2 overflow-auto max-h-48 border border-neutral-200 dark:border-neutral-700 rounded">
                {detailModal.data.result || '...'}
              </pre>
            </Descriptions.Item>
            {detailModal.data.traceback && (
              <Descriptions.Item label={t('pulse.traceback')}>
                <pre className="text-xs bg-red-50 dark:bg-red-950 p-2 overflow-auto max-h-48 text-red-500 border border-red-100 dark:border-red-900 rounded">
                    {detailModal.data.traceback}
                </pre>
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('pulse.routing')}>
                <Space>
                    <Tag color="cyan">Key: {detailModal.data.routing_key || 'default'}</Tag>
                    <Tag color="geekblue">Exchange: {detailModal.data.exchange || 'default'}</Tag>
                </Space>
            </Descriptions.Item>
          </Descriptions>
        )}

        {detailModal.type === 'worker' && detailModal.data && (
          <div className="mt-4">
            <Tabs defaultActiveKey="stats" items={[
                {
                    key: 'stats',
                    label: t('pulse.realtimeStats'),
                    children: (
                        <Row gutter={16}>
                            <Col span={14}>
                                <Descriptions bordered column={1} size="small">
                                    <Descriptions.Item label={t('pulse.os')}>{detailModal.data.db_info?.sw_sys || 'Unknown'}</Descriptions.Item>
                                    <Descriptions.Item label={t('pulse.swVersion')}>{detailModal.data.db_info?.sw_ver || '-'}</Descriptions.Item>
                                    <Descriptions.Item label={t('pulse.poolConfig')}>{detailModal.data.realtime_stats?.pool?.['max-concurrency'] || 'N/A'} (Prefork)</Descriptions.Item>
                                    <Descriptions.Item label={t('pulse.loadAvg')}>{JSON.stringify(detailModal.data.realtime_stats?.loadavg || detailModal.data.db_info?.load_avg || [])}</Descriptions.Item>
                                </Descriptions>
                            </Col>
                            <Col span={10}>
                                <Card size="small" title="Resource Usage" className="h-full bg-neutral-50 dark:bg-neutral-800 border-none">
                                    <pre className="text-[10px] opacity-70">{JSON.stringify(detailModal.data.realtime_stats?.rusage || {}, null, 2)}</pre>
                                </Card>
                            </Col>
                        </Row>
                    )
                },
                {
                    key: 'active',
                    label: `${t('pulse.activeTasks')} (${detailModal.data.active_tasks?.length || 0})`,
                    children: (
                        <Table 
                            size="small" 
                            dataSource={detailModal.data.active_tasks} 
                            pagination={false}
                            rowKey="id"
                            columns={[
                                { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
                                { title: t('pulse.taskName'), dataIndex: 'name', key: 'name' },
                                { 
                                    title: t('pulse.runtime'), 
                                    dataIndex: 'runtime', 
                                    key: 'runtime', 
                                    render: (t) => <Tag color="orange">{(Number(t) || 0).toFixed(1)}s</Tag> 
                                }
                            ]} 
                        />
                    )
                },
                {
                    key: 'registered',
                    label: t('pulse.registeredCapabilities'),
                    children: (
                        <div className="max-h-64 overflow-y-auto p-4 border rounded bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                            {detailModal.data.registered_tasks?.map((t: string) => <Tag className="mb-1" key={t} color="blue">{t}</Tag>)}
                            {(!detailModal.data.registered_tasks || detailModal.data.registered_tasks.length === 0) && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                        </div>
                    )
                }
            ]} />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TaskPulse;
