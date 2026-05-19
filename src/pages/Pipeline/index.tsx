import { useState, useEffect } from 'react';
import {
    Table, Button, Space, Input, App, Popconfirm, Tag, Typography, Tabs, Card as AntdCard, Tooltip
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  ProjectOutlined,
  FieldTimeOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  BranchesOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPipelines, deletePipeline, executePipeline } from '../../api/pipeline';
import dayjs from 'dayjs';
import History from './History';
import ScheduleList from './Schedule';
import VersionHistoryDrawer from './VersionHistory';
import useAppStore from '../../store/useAppStore';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

/**
 * @name TemplateList
 * @description 流水线模板管理子模块。提供 DAG 模板的搜索、删除、编排入口及即时触发执行能力。
 */
const TemplateList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAppStore();
  const [searchText, setSearchText] = useState('');
  const { message, modal } = App.useApp();
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [versionPipelineId, setVersionPipelineId] = useState<number | null>(null);
  const [versionPipelineName, setVersionPipelineName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['pipelines', searchText, page, pageSize],
    queryFn: () => getPipelines({ 
        search: searchText,
        page: page,
        size: pageSize
    }),
  });

  useEffect(() => {
    setPage(1);
  }, [searchText]);

  const deleteMutation = useMutation({
    mutationFn: deletePipeline,
    onSuccess: () => {
      message.success(t('pipeline.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (err: any) => message.error(`${t('pipeline.deleteFailed')}: ${err.message}`)
  });

  const executeMutation = useMutation({
    mutationFn: executePipeline,
    onSuccess: (res: any) => {
      if (res.code === 202 || res.status === 'pending_approval') {
          modal.warning({
            title: t('pipeline.approvalInterceptTitle'),
            content: (
                <div className="mt-3">
                    <p className="text-ans-text-primary">{res.message || t('pipeline.approvalInterceptContent')}</p>
                    <p className="text-ans-text-secondary text-xs mt-2">
                        {t('pipeline.approvalTicket')}: <Tag className="border-0 bg-ans-warning/10 text-ans-warning font-bold">#APP-{res.ticket_id || 'N/A'}</Tag>
                    </p>
                    <p className="mt-3 font-bold text-ans-primary">{t('pipeline.approvalNote')}</p>
                </div>
            ),
            okText: t('pipeline.goToApproval'),
            maskClosable: false,
            onOk: () => navigate('/v1/system/approvals')
          });
          return;
      }
      const runId = res.run_id || res.data?.run_id;
      message.success(t('pipeline.executeSuccess').replace('{{runId}}', runId));
      navigate(`/v1/pipeline/runs/${runId}`);
    },
    onError: (err: any) => message.error(`${t('pipeline.executeFailed')}: ${err.message}`)
  });

  const columns = [
    {
      title: t('pipeline.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space size="middle">
            <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                style={{ backgroundColor: 'color-mix(in srgb, var(--ans-primary), transparent 90%)', color: 'var(--ans-primary)' }}
            >
                <RocketOutlined className="text-lg" />
            </div>
            <div onClick={() => navigate(`/v1/pipeline/designer?id=${record.id}`)} className="cursor-pointer group">
                <Text strong className="text-sm block group-hover:text-primary transition-colors text-ans-text-primary">
                    {text}
                </Text>
                <Text className="text-[10px] uppercase opacity-40 font-mono tracking-tighter">ID: {record.id}</Text>
            </div>
        </Space>
      )
    },
    {
      title: t('pipeline.desc'),
      dataIndex: 'desc',
      key: 'desc',
      ellipsis: true,
      render: (text: string) => text ? (
          <Text className="text-ans-text-secondary text-xs opacity-70">{text}</Text>
      ) : (
          <Text className="text-[11px] italic opacity-30">{t('pipeline.descPlaceholder')}</Text>
      )
    },
    {
        title: t('pipeline.status'),
        dataIndex: 'is_active',
        key: 'is_active',
        render: (active: boolean) => active ? (
            <Tag className="rounded-full px-3 border-0 font-bold text-[10px] bg-ans-success/10 text-ans-success uppercase">{t('pipeline.active')}</Tag>
        ) : (
            <Tag className="rounded-full px-3 border-0 font-bold text-[10px] bg-ans-text-secondary/10 text-ans-text-secondary opacity-50 uppercase">{t('pipeline.paused')}</Tag>
        )
    },
    {
      title: t('pipeline.updateTime'),
      dataIndex: 'update_time',
      key: 'update_time',
      render: (val: string) => <Text className="text-[10px] text-ans-text-secondary opacity-50 font-mono">{dayjs(val).format('YYYY/MM/DD HH:mm')}</Text>
    },
    {
      title: t('pipeline.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {hasPermission('pipeline:template:execute') && (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => executeMutation.mutate(record.id)}
            loading={executeMutation.isPending}
            className="rounded-lg shadow-none font-bold text-xs"
          >
            {t('pipeline.execute')}
          </Button>
          )}
          {hasPermission('pipeline:template:edit') && (
          <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/v1/pipeline/designer?id=${record.id}`)}
              className="rounded-lg text-xs"
            >
              {t('pipeline.edit')}
          </Button>
          )}
          <Tooltip title={t('version.title', { name: '' })}>
            <Button
              size="small"
              icon={<BranchesOutlined />}
              onClick={() => {
                setVersionPipelineId(record.id);
                setVersionPipelineName(record.name);
                setVersionDrawerOpen(true);
              }}
              className="rounded-lg"
            />
          </Tooltip>
          {hasPermission('pipeline:template:delete') && (
          <Popconfirm
            title={t('pipeline.confirmDeleteTitle')}
            description={t('pipeline.confirmDeleteContent')}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText={t('pipeline.confirmDestroy')}
            okButtonProps={{ danger: true }}
            cancelText={t('common.cancel')}
          >
            <Button size="small" danger ghost icon={<DeleteOutlined />} className="rounded-lg border-ans-error/20" />
          </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-ans-bg-container">
        <div className="mb-6 flex justify-between items-center px-1">
            <Input
              placeholder={t('pipeline.searchPlaceholder')}
              prefix={<SearchOutlined className="opacity-30" />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-80 h-10 rounded-ans-md border-ans-border hover:border-ans-primary transition-all bg-ans-bg-layout/20"
              allowClear
            />
            {hasPermission('pipeline:template:add') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/v1/pipeline/designer')}
              className="h-10 px-6 rounded-ans-md font-bold tracking-tight shadow-none"
            >
              {t('pipeline.create')}
            </Button>
            )}
        </div>

        <div className="flex-1">
            <Table
                columns={columns}
                dataSource={pipelineData?.data || []}
                rowKey="id"
                loading={isLoading}
                pagination={{ 
                    current: page,
                    pageSize: pageSize,
                    total: pipelineData?.total || 0,
                    showSizeChanger: true,
                    showTotal: (total) => t('common.total', { total }),
                    className: "pt-6",
                    onChange: (p, s) => {
                        setPage(p);
                        setPageSize(s);
                    }
                }}
                className="ans-table-clean"
                scroll={{ x: 'max-content' }}
            />
        </div>

        <VersionHistoryDrawer
            pipelineId={versionPipelineId}
            pipelineName={versionPipelineName}
            open={versionDrawerOpen}
            onClose={() => setVersionDrawerOpen(false)}
        />
    </div>
  );
};

/**
 * @name PipelinePage
 * @description 流水线管理门户。集成了模板管理、运行历史、定时调度三大核心视窗。
 */
export default function PipelinePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { pipelineActiveTab, setPipelineActiveTab } = useAppStore();
  const queryTab = searchParams.get('tab');

  useEffect(() => {
    if (queryTab && queryTab !== pipelineActiveTab) {
        setPipelineActiveTab(queryTab);
    }
  }, [queryTab, pipelineActiveTab, setPipelineActiveTab]);

  const handleTabChange = (key: string) => {
    setPipelineActiveTab(key);
    setSearchParams({ tab: key });
  };

  return (
    <div className="p-8 h-full flex flex-col animate-in fade-in duration-500 bg-ans-bg-layout">
        <div className="flex items-center justify-between mb-8">
            <Space size="middle">
                <div 
                  className="w-12 h-12 rounded-2xl text-white items-center justify-center flex shadow-ans-soft"
                  style={{ background: 'var(--ans-primary)' }}
                >
                    <ProjectOutlined className="text-2xl" />
                </div>
                <div>
                    <Title level={4} className="!m-0 !font-extrabold !tracking-tighter !text-ans-text-primary uppercase italic">{t('pipeline.title')}</Title>
                    <Text className="text-xs text-ans-text-secondary opacity-60 font-medium">PIPELINE ORCHESTRATION CENTER</Text>
                </div>
            </Space>
        </div>
        
        <Tabs
            activeKey={pipelineActiveTab}
            onChange={handleTabChange}
            type="line"
            className="flex-1 custom-tabs-modern"
            items={[
                {
                    label: (
                        <Space className="px-4 font-bold tracking-tight text-xs uppercase">
                            <RocketOutlined /> {t('pipeline.templates')}
                        </Space>
                    ),
                    key: 'templates',
                    children: (
                        <div className="ans-card p-6 h-full mt-4 bg-ans-bg-container overflow-hidden">
                            <TemplateList />
                        </div>
                    )
                },
                {
                    label: (
                        <Space className="px-4 font-bold tracking-tight text-xs uppercase">
                            <FieldTimeOutlined /> {t('pipeline.history')}
                        </Space>
                    ),
                    key: 'history',
                    children: (
                        <div className="ans-card p-6 h-full mt-4 bg-ans-bg-container overflow-hidden">
                            <History />
                        </div>
                    )
                },
                {
                    label: (
                        <Space className="px-4 font-bold tracking-tight text-xs uppercase">
                            <ClockCircleOutlined /> {t('pipeline.schedule')}
                        </Space>
                    ),
                    key: 'schedule',
                    children: (
                        <div className="ans-card p-6 h-full mt-4 bg-ans-bg-container overflow-hidden">
                            <ScheduleList />
                        </div>
                    )
                }
            ]}
        />
    </div>
  );
}