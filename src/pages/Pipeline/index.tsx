import { useState, useEffect } from 'react';
import {
    Table, Button, Space, Input, App, Popconfirm, Tag, Typography, Tabs, theme, Card as AntdCard
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
  ClockCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPipelines, deletePipeline, executePipeline } from '../../api/pipeline';
import dayjs from 'dayjs';
import History from './History';
import ScheduleList from './Schedule';
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
  const { token } = theme.useToken();
  const { hasPermission } = useAppStore();
  const [searchText, setSearchText] = useState('');
  const { message, modal } = App.useApp();

  /** @description 拉取所有流水线模板，支持全局搜索 */
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['pipelines', searchText],
    queryFn: () => getPipelines({ search: searchText }),
  });

  /** @description 逻辑销毁指令 */
  const deleteMutation = useMutation({
    mutationFn: deletePipeline,
    onSuccess: () => {
      message.success(t('pipeline.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (err: any) => message.error(`${t('pipeline.deleteFailed')}: ${err.message}`)
  });

  /** @description 立即触发流水线执行：支持审批拦截逻辑 */
  const executeMutation = useMutation({
    mutationFn: executePipeline,
    onSuccess: (res: any) => {
      if (res.code === 202 || res.status === 'pending_approval') {
          modal.warning({
            title: t('pipeline.approvalInterceptTitle'),
            content: (
                <div className="mt-3">
                    <p>{res.message || t('pipeline.approvalInterceptContent')}</p>
                    <p className="text-gray-400 text-xs mt-2">
                        {t('pipeline.approvalTicket')}: <Tag color="warning">#APP-{res.ticket_id || 'N/A'}</Tag>
                    </p>
                    <p className="mt-3 font-semibold text-blue-600">{t('pipeline.approvalNote')}</p>
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
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shadow-sm">
                <RocketOutlined className="text-blue-500 text-lg" />
            </div>
            <div onClick={() => navigate(`/v1/pipeline/designer?id=${record.id}`)} className="cursor-pointer group">
                <Text strong className="text-sm block group-hover:text-blue-500 transition-colors">
                    {text}
                </Text>
                <Text type="secondary" className="text-[10px] uppercase opacity-50">ID: {record.id}</Text>
            </div>
        </Space>
      )
    },
    {
      title: t('pipeline.desc'),
      dataIndex: 'desc',
      key: 'desc',
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary" className="text-[11px] italic">{t('pipeline.descPlaceholder')}</Text>
    },
    {
        title: t('pipeline.status'),
        dataIndex: 'is_active',
        key: 'is_active',
        render: (active: boolean) => active ? (
            <Tag color="success" className="rounded-full px-3">{t('pipeline.active')}</Tag>
        ) : (
            <Tag color="default" className="rounded-full px-3 text-gray-400 border-dashed">{t('pipeline.paused')}</Tag>
        )
    },
    {
      title: t('pipeline.updateTime'),
      dataIndex: 'update_time',
      key: 'update_time',
      render: (val: string) => <Text type="secondary" className="text-xs">{dayjs(val).format('YYYY/MM/DD HH:mm')}</Text>
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
            className="rounded-lg shadow-blue-100"
          >
            {t('pipeline.execute')}
          </Button>
          )}
          {hasPermission('pipeline:template:edit') && (
          <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/v1/pipeline/designer?id=${record.id}`)}
              className="rounded-lg"
            >
              {t('pipeline.edit')}
          </Button>
          )}
          {hasPermission('pipeline:run:view') && (
          <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/v1/pipeline/list?tab=history&pipeline_id=${record.id}`)}
              className="rounded-lg"
            >
              {t('pipeline.history2')}
          </Button>
          )}
          {hasPermission('pipeline:template:delete') && (
          <Popconfirm
            title={t('pipeline.confirmDeleteTitle')}
            description={t('pipeline.confirmDeleteContent')}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText={t('pipeline.confirmDestroy')}
            okButtonProps={{ danger: true }}
            cancelText={t('common.cancel')}
          >
            <Button size="small" danger ghost icon={<DeleteOutlined />} className="rounded-lg" />
          </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: token.colorBgContainer }} className="flex flex-col h-full antialiased">
        <div className="mb-5 flex justify-between items-center px-1">
            <Input
              placeholder={t('pipeline.searchPlaceholder')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-80 h-10 rounded-xl"
              allowClear
            />
            {hasPermission('pipeline:template:add') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/v1/pipeline/designer')}
              className="h-10 px-6 rounded-xl"
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
                    total: pipelineData?.total || 0,
                    showSizeChanger: true,
                    className: "pt-4"
                }}
                className="custom-table-modern"
                scroll={{ x: 'max-content' }}
               
            />
        </div>
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
  const { token } = theme.useToken();

  // Zustand 持久化：活跃标签页
  const { pipelineActiveTab, setPipelineActiveTab } = useAppStore();
  
  // 响应 URL 参数中的 Tab 切换 (例如：从历史详情链接跳回)
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
    <div style={{ background: token.colorBgLayout }} className="p-7 h-full flex flex-col antialiased">
        <div className="flex items-center justify-between mb-6">
            <Space size="middle">
                <div 
                  style={{ background: token.colorPrimary }} 
                  className="p-2 rounded-xl text-white items-center justify-center flex shadow-lg shadow-indigo-500/20"
                >
                    <ProjectOutlined className="text-xl" />
                </div>
                <div>
                    <Title level={4} style={{ margin: 0 }}>{t('pipeline.title')}</Title>
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
                        <Space className="px-2">
                            <RocketOutlined /> {t('pipeline.templates')}
                        </Space>
                    ),
                    key: 'templates',
                    children: (
                        <AntdCard variant={"borderless"} className="shadow-sm rounded-2xl h-full mt-2 border-none">
                            <TemplateList />
                        </AntdCard>
                    )
                },
                {
                    label: (
                        <Space className="px-2">
                            <FieldTimeOutlined /> {t('pipeline.history')}
                        </Space>
                    ),
                    key: 'history',
                    children: (
                        <AntdCard variant={"borderless"} className="shadow-sm rounded-2xl h-full mt-2 border-none">
                            <History />
                        </AntdCard>
                    )
                },
                {
                    label: (
                        <Space className="px-2">
                            <ClockCircleOutlined /> {t('pipeline.schedule')}
                        </Space>
                    ),
                    key: 'schedule',
                    children: (
                        <AntdCard variant={"borderless"} className="shadow-sm rounded-2xl h-full mt-2 border-none">
                            <ScheduleList />
                        </AntdCard>
                    )
                }
            ]}
        />
    </div>
  );
}
