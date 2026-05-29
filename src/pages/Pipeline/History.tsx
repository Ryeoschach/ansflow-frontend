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
 * @description 流水线执行历史子模块。
 */
export default function PipelineHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const { token, hasPermission } = useAppStore();
  
  const pipelineId = searchParams.get('pipeline_id');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: runsData, isLoading, refetch } = useQuery({
    queryKey: ['pipelineRuns', searchText, pipelineId, page, pageSize],
    queryFn: () => getPipelineRuns({ 
        search: searchText, 
        pipeline: pipelineId,
        page: page,
        size: pageSize
    }),
    refetchInterval: 60000,
    enabled: !!token && hasPermission('pipeline:run:view'),
  });

  useEffect(() => {
    setPage(1);
  }, [searchText, pipelineId]);

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws/pipeline/all/`;
  
  const { lastJsonMessage } = useWebSocket(wsUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 15,
    reconnectInterval: 5000,
  });

  useEffect(() => {
    if (lastJsonMessage && (lastJsonMessage as any).type === 'all_status_update') {
        const newData = (lastJsonMessage as any).data;
        queryClient.setQueryData(['pipelineRuns', searchText, pipelineId], (old: any) => {
            if (!old || !old.data) return old;
            const index = old.data.findIndex((r: any) => r.id === newData.id);
            if (index > -1) {
                const newDataList = [...old.data];
                newDataList[index] = { ...newDataList[index], ...newData };
                return { ...old, data: newDataList };
            } else {
                refetch();
                return old;
            }
        });
    }
  }, [lastJsonMessage, queryClient, searchText, pipelineId, refetch]);

  const stopRunMutation = useMutation({
    mutationFn: (id: number) => stopPipelineRun(id),
    onSuccess: () => {
        message.success(t('pipeline.stopSuccess'));
        queryClient.invalidateQueries({ queryKey: ['pipelineRuns'] });
    },
    onError: (err: any) => message.error(`${t('pipeline.stopError')}: ${err.message}`)
  });

  const getStatusTag = (status: string) => {
    const config: any = {
      success: { color: 'var(--ans-success)', icon: <CheckCircleOutlined />, text: t('pipeline.statusSuccess') },
      failed: { color: 'var(--ans-error)', icon: <CloseCircleOutlined />, text: t('pipeline.statusFailed') },
      running: { color: 'var(--ans-primary)', icon: <SyncOutlined spin />, text: t('pipeline.statusRunning') },
      cancelled: { color: 'var(--ans-text-secondary)', icon: <StopOutlined />, text: t('pipeline.statusCancelled') },
      pending: { color: 'var(--ans-warning)', icon: <ClockCircleOutlined />, text: t('pipeline.statusPending') },
    };
    const c = config[status] || config.pending;
    return (
        <Tag 
            className="rounded-full px-3 border-0 font-extrabold text-[10px] uppercase flex items-center gap-1 w-fit"
            style={{ 
                backgroundColor: `color-mix(in srgb, ${c.color}, transparent 90%)`,
                color: c.color
            }}
        >
            {c.icon} {c.text}
        </Tag>
    );
  };

  const columns = [
    {
      title: t('pipeline.runId'),
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (id: number) => <span className="font-mono text-[11px] font-bold opacity-30 tracking-tighter">#{id}</span>
    },
    {
      title: t('pipeline.blueprint'),
      dataIndex: 'pipeline_name',
      key: 'pipeline_name',
      ellipsis: true,
      render: (text: string, record: any) => (
          <div className="flex flex-col group cursor-pointer" onClick={() => navigate(`/v1/pipeline/runs/${record.id}`)}>
              <Text strong className="text-sm text-ans-text-primary group-hover:text-primary transition-colors">{text || record.pipeline?.name}</Text>
              <Text className="text-[9px] opacity-30 font-mono tracking-widest mt-0.5 uppercase">
                Reference: {record.pipeline}
              </Text>
          </div>
      )
    },
    {
      title: t('pipeline.currentStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusTag(status)
    },
    {
        title: t('pipeline.triggerSource'),
        dataIndex: 'trigger_user_name',
        key: 'trigger_user_name',
        render: (text: string) => (
            <div className="flex items-center gap-1.5 text-ans-text-secondary opacity-60">
                <div className="w-5 h-5 rounded-full bg-ans-bg-layout flex items-center justify-center border border-ans-border">
                    <UserOutlined className="text-[9px]" />
                </div>
                <span className="text-[11px] font-medium tracking-tight">{text || 'SYSTEM'}</span>
            </div>
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
                  <div className="flex items-center gap-2">
                    <Text className="text-xs text-ans-text-primary font-medium">{start.format('MM/DD HH:mm')}</Text>
                    <div className="w-1 h-1 rounded-full bg-ans-border" />
                    <Text className="text-[10px] text-ans-primary font-extrabold uppercase italic">
                        {diffSec > 60 ? `${Math.floor(diffSec/60)}m ${diffSec%60}s` : `${diffSec}s`}
                    </Text>
                  </div>
                  <Text className="text-[9px] opacity-30 uppercase tracking-tighter mt-0.5">ESTIMATED RUNTIME</Text>
              </div>
          );
      }
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="text" 
            size="small"
            icon={<EyeOutlined style={{ fontSize: 14, color: 'var(--ans-primary)' }} />} 
            onClick={() => navigate(`/v1/pipeline/runs/${record.id}`)}
            className="hover:bg-ans-primary/5 rounded-lg"
          />
          {hasPermission('pipeline:run:stop') && (record.status === 'running' || record.status === 'pending') && (
              <Button
                type="text"
                size="small"
                danger
                icon={<StopOutlined style={{ fontSize: 14 }} />}
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
                className="hover:bg-ans-error/5 rounded-lg"
              />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-ans-bg-container">
      <div className="mb-6 flex justify-between items-center px-1">
            <Input
                placeholder={t('pipeline.searchHistoryPlaceholder')}
                prefix={<SearchOutlined className="opacity-30" />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-80 h-10 rounded-ans-md border-ans-border hover:border-ans-primary transition-all bg-ans-bg-layout/20"
                allowClear
            />
            <Button 
                icon={<RedoOutlined className="text-ans-primary" />} 
                onClick={() => refetch()}
                className="h-10 rounded-ans-md border-ans-border font-bold text-xs uppercase tracking-tight"
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
              current: page,
              pageSize: pageSize,
              total: runsData?.total || 0,
              showSizeChanger: true,
              className: "pt-6 px-2",
              onChange: (p, s) => {
                  setPage(p);
                  setPageSize(s);
              }
          }}
          className="ans-table-clean"
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  );
}
