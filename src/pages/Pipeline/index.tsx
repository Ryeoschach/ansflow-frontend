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

const { Title, Text } = Typography;

/**
 * @name TemplateList
 * @description 流水线模板管理子模块。提供 DAG 模板的搜索、删除、编排入口及即时触发执行能力。
 */
const TemplateList = () => {
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
      message.success('流水线模板已安全移除');
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (err: any) => message.error(`操作被拒绝: ${err.message}`)
  });

  /** @description 立即触发流水线执行：支持审批拦截逻辑 */
  const executeMutation = useMutation({
    mutationFn: executePipeline,
    onSuccess: (res: any) => {
      if (res.code === 202 || res.status === 'pending_approval') {
          modal.warning({
            title: '触发安全风控拦截',
            content: (
                <div className="mt-3">
                    <p>{res.message || '系统安全策略：该操作需要审批，已自动转入后台审批池。'}</p>
                    <p className="text-gray-400 text-xs mt-2">
                        拦截凭证: <Tag color="warning">#APP-{res.ticket_id || 'N/A'}</Tag>
                    </p>
                    <p className="mt-3 font-semibold text-blue-600">一旦审批通过，系统将为您自动完成本次部署补发。</p>
                </div>
            ),
            okText: '前往审批中心',
            maskClosable: false,
            onOk: () => navigate('/v1/system/approvals')
          });
          return;
      }
      const runId = res.run_id || res.data?.run_id;
      message.success(`执行引擎已响应 (Run ID: ${runId})`);
      navigate(`/v1/pipeline/runs/${runId}`);
    },
    onError: (err: any) => message.error(`执行引擎拒绝触发: ${err.message}`)
  });

  const columns = [
    {
      title: '流水线名称',
      dataIndex: 'name',
      key: 'name',
      width: 280,
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
      title: '描述',
      dataIndex: 'desc',
      key: 'desc',
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary" className="text-[11px] italic">暂无架构描述</Text>
    },
    {
        title: '流水线状态',
        dataIndex: 'is_active',
        key: 'is_active',
        width: 120,
        render: (active: boolean) => active ? (
            <Tag color="success" className="rounded-full px-3">ACTIVE</Tag>
        ) : (
            <Tag color="default" className="rounded-full px-3 text-gray-400 border-dashed">PAUSED</Tag>
        )
    },
    {
      title: '更新时间',
      dataIndex: 'update_time',
      key: 'update_time',
      width: 170,
      render: (t: string) => <Text type="secondary" className="text-xs">{dayjs(t).format('YYYY/MM/DD HH:mm')}</Text>
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
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
            执行
          </Button>
          )}
          {hasPermission('pipeline:template:edit') && (
          <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/v1/pipeline/designer?id=${record.id}`)}
              className="rounded-lg"
            >
              编排
          </Button>
          )}
          {hasPermission('pipeline:run:view') && (
          <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => navigate(`/v1/pipeline/list?tab=history&pipeline_id=${record.id}`)}
              className="rounded-lg"
            >
              历史
          </Button>
          )}
          {hasPermission('pipeline:template:delete') && (
          <Popconfirm
            title="确定要销毁该蓝图吗？"
            description="删除后相关定时任务将一并失效。"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定销毁"
            okButtonProps={{ danger: true }}
            cancelText="取消"
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
              placeholder="搜索流水线名称或 ID..."
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
              新建流水线
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
                scroll={{ x: 1000 }}
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
                    <Title level={4} style={{ margin: 0 }}>流水线列表中心</Title>
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
                            <RocketOutlined /> 流水线模板
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
                            <FieldTimeOutlined /> 执行历史
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
                            <ClockCircleOutlined /> 定时编排
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
