import { useState, useEffect } from 'react';
import {Table, Space, Tag, Button, Typography, Input, App} from 'antd';
import {
  SearchOutlined,
  RedoOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPipelineRuns, stopPipelineRun } from '../../api/pipeline';
import dayjs from 'dayjs';
import useWebSocket from 'react-use-websocket';
import useAppStore from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

/**
 * @name PipelineHistory
 * @description 流水线执行历史子模块。负责全局/单流水线的运行记录追踪。
 * 支持：WebSocket 实时状态补丁、多维搜索、强制中止、耗时统计渲染。
 */
export default function PipelineHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const { token, hasPermission } = useAppStore();
  
  // URL 参数：支持从蓝图模板点选“历史”进入，自动过滤
  const pipelineId = searchParams.get('pipeline_id');
  const [searchText, setSearchText] = useState('');

  /**
   * @section 数据查询 (React Query)
   */
  const { data: runsData, isLoading, refetch } = useQuery({
    queryKey: ['pipelineRuns', searchText, pipelineId],
    queryFn: () => getPipelineRuns({ search: searchText, pipeline: pipelineId }),
    // 即使有 WS，也保持 1 分钟一次的钝化同步，防止心跳失效后的孤岛数据
    refetchInterval: 60000,
    enabled: !!token && hasPermission('pipeline:run:view'),
  });

  /**
   * @section WebSocket 实时补丁逻辑
   * 基于全局广播频道 /ws/pipeline/all/ 实现免刷新的状态同步。
   */
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  // 修正：使用 host 保证端口一致，避免跨域握手失败
  const wsUrl = `${protocol}://${window.location.host}/ws/pipeline/all/`;
  
  const { lastJsonMessage } = useWebSocket(wsUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 15,
    reconnectInterval: 5000,
  });

  /** @description 接收全局推送，精准更新本地缓存列表中的特定任务行 */
  useEffect(() => {
    if (lastJsonMessage && (lastJsonMessage as any).type === 'all_status_update') {
        const newData = (lastJsonMessage as any).data;
        queryClient.setQueryData(['pipelineRuns', searchText, pipelineId], (old: any) => {
            if (!old || !old.data) return old;
            const index = old.data.findIndex((r: any) => r.id === newData.id);
            if (index > -1) {
                const newDataList = [...old.data];
                // 仅更新变更字段，合并保留上下文
                newDataList[index] = { ...newDataList[index], ...newData };
                return { ...old, data: newDataList };
            } else {
                // 如果是新任务且处于第一页，触发 Refetch 以拉取最新行
                refetch();
                return old;
            }
        });
    }
  }, [lastJsonMessage, queryClient, searchText, pipelineId, refetch]);

  /** @description 任务调度指令：中止 */
  const stopRunMutation = useMutation({
    mutationFn: (id: number) => stopPipelineRun(id),
    onSuccess: () => {
        message.success(t('pipeline.stopSuccess'));
        queryClient.invalidateQueries({ queryKey: ['pipelineRuns'] });
    },
    onError: (err: any) => message.error(`${t('pipeline.stopError')}: ${err.message}`)
  });

  /** @description 状态标识美化渲染 */
  const getStatusTag = (status: string) => {
    const config: any = {
      success: { color: 'success', icon: <CheckCircleOutlined />, text: t('pipeline.statusSuccess') },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: t('pipeline.statusFailed') },
      running: { color: 'processing', icon: <SyncOutlined spin />, text: t('pipeline.statusRunning') },
      cancelled: { color: 'default', icon: <StopOutlined />, text: t('pipeline.statusCancelled') },
      pending: { color: 'warning', icon: <ClockCircleOutlined />, text: t('pipeline.statusPending') },
    };
    const c = config[status] || config.pending;
    return <Tag icon={c.icon} color={c.color} className="rounded-full px-3">{c.text}</Tag>;
  };

  const columns = [
    {
      title: t('pipeline.runId'),
      dataIndex: 'id',
      key: 'id',
      render: (id: number) => <Text code className="text-blue-600 font-mono">#{id}</Text>
    },
    {
      title: t('pipeline.blueprint'),
      dataIndex: 'pipeline_name',
      key: 'pipeline_name',
      ellipsis: true,
      render: (text: string, record: any) => (
          <div className="flex flex-col">
              <Text strong className="text-sm">{text || record.pipeline?.name}</Text>
              <Text type="secondary" className="text-[10px] opacity-40 uppercase tracking-tighter">
                Ref: {record.pipeline}
              </Text>
          </div>
      )
    },
    {
      title: t('pipeline.currentStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    {
        title: t('pipeline.triggerSource'),
        dataIndex: 'trigger_user_name',
        key: 'trigger_user_name',
        render: (text: string) => (
            <Space className="text-xs text-slate-500">
                <UserOutlined className="text-[10px]" />
                {text || 'SYSTEM'}
            </Space>
        )
    },
    {
      title: t('pipeline.timeline'),
      dataIndex: 'start_time',
      key: 'start_time',
      render: (time: string, record: any) => {
          if (!time) return '-';
          const start = dayjs(time);
          const end = record.end_time ? dayjs(record.end_time) : dayjs();
          const diffSec = end.diff(start, 'second');
          return (
              <div className="flex flex-col">
                  <Text className="text-xs">{start.format('YYYY-MM-DD HH:mm')}</Text>
                  <Text type="secondary" className="text-[10px] text-blue-500 font-medium">
                    {t('dashboard.duration')}: {diffSec > 60 ? `${Math.floor(diffSec/60)}m ${diffSec%60}s` : `${diffSec}s`}
                  </Text>
              </div>
          );
      }
    },
    {
      title: t('pipeline.actionCenter'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          {hasPermission('pipeline:run:view') && (
          <Button 
            type="link" 
            size="small"
            icon={<EyeOutlined />} 
            onClick={() => navigate(`/v1/pipeline/runs/${record.id}`)}
            className="p-0"
          >
            {t('pipeline.detail')}
          </Button>
          )}
          {hasPermission('pipeline:run:stop') && (record.status === 'running' || record.status === 'pending') && (
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => {
                   modal.confirm({
                     title: t('pipeline.confirmStopTitle'),
                     content: t('pipeline.confirmStopContent'),
                     okText: t('pipeline.confirmStop'),
                     okButtonProps: { danger: true },
                     onOk: () => stopRunMutation.mutate(record.id),
                   });
                }}
                loading={stopRunMutation.isPending && (stopRunMutation.variables as any) === record.id}
                className="p-0"
              >
                {t('pipeline.stop')}
              </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="mb-4 flex justify-between items-center px-1">
            <Space size="middle">
                <Input
                    placeholder={t('pipeline.searchHistoryPlaceholder')}
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    className="w-72 h-9 rounded-xl"
                    allowClear
                />
            </Space>
            <Button 
                icon={<RedoOutlined />} 
                onClick={() => refetch()}
                className="rounded-lg"
            >
                {t('pipeline.manualRefresh')}
            </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Table
          columns={columns}
          dataSource={runsData?.data || []}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={{ 
              total: runsData?.total || 0,
              showSizeChanger: true,
              className: "pt-4 px-2"
          }}
          className="custom-table-modern"
          scroll={{ x: 'max-content', y: 'calc(100vh - 420px)' }}
         
        />
      </div>
    </div>
  );
}
