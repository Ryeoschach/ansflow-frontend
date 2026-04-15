import React, { useState } from 'react';
import { Table, Button, Space, Typography, Tag, Modal, Form, Input, Switch, App, Select, theme } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  ClockCircleOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  AppstoreAddOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPipelines, updatePipeline } from '../../api/pipeline';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';

const { Text } = Typography;

/**
 * @name ScheduleList
 * @description 定时任务引擎中心。
 * 将静态的流水线蓝图（Blueprint）装载至 Celery Beat 调度器，实现基于 Crontab 的自动化触发。
 */
const ScheduleList: React.FC = () => {
  const { isDark, token: _authToken, hasPermission } = useAppStore();
  const { token: antdToken } = theme.useToken();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const { isMobile } = useBreakpoint();
  const [form] = Form.useForm();

  // 局部状态：控制配置弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  /**
   * @section 配置查询 (React Query)
   */
  
  /** @description 获取当前所有已装载定时器的流水线 */
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['pipelines', 'scheduled'],
    queryFn: () => getPipelines({ has_cron: 'true' }),
    enabled: !!_authToken && hasPermission('pipeline:template:edit'),
  });

  /** @description 获取所有健康状态的流水线，用于装载目标选择 */
  const { data: allPipelinesData } = useQuery({
    queryKey: ['pipelines', 'all_active'],
    queryFn: () => getPipelines({ is_active: true, page_size: 500 }),
  });

  /**
   * @section 修改指令 (Mutations)
   */

  /** @description 存入/更新调度配置 */
  const saveMutation = useMutation({
    mutationFn: (values: any) => updatePipeline(values.id, { 
      cron_expression: values.cron_expression,
      is_cron_enabled: values.is_cron_enabled 
    }),
    onSuccess: () => {
      message.success(editingRecord ? '调度策略已即时生效' : '定时引擎装载成功');
      setModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (err: any) => message.error(`调度中心拒绝请求: ${err.message}`)
  });

  /** @description 卸载定时任务：切断流水线与 Beat 引擎的关联 */
  const destroyMutation = useMutation({
    mutationFn: (id: number) => updatePipeline(id, { 
      cron_expression: null, 
      is_cron_enabled: false 
    }),
    onSuccess: () => {
      message.success('定时引擎已卸载');
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (err: any) => message.error(`卸载失败: ${err.message}`)
  });

  /** @description 切换任务活跃状态 (Switch) */
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number, enabled: boolean }) => 
        updatePipeline(id, { is_cron_enabled: enabled }),
    onSuccess: (_, variables) => {
        message.success(variables.enabled ? '调度器已恢复心跳' : '调度器已进入休眠');
        queryClient.invalidateQueries({ queryKey: ['pipelines', 'scheduled'] });
    },
    onError: (err: any) => message.error(`状态切换失败: ${err.message}`)
  });

  /**
   * @section 交互处理
   */

  const handleOpenModal = (record?: any) => {
    setEditingRecord(record || null);
    if (record) {
      form.setFieldsValue({
        id: record.id,
        cron_expression: record.cron_expression,
        is_cron_enabled: record.is_cron_enabled
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleDelete = (id: number) => {
    modal.confirm({
      title: '高危操作：废止定时引擎',
      content: '此操作将关闭流水线的自动触发逻辑，流水线模板本身将被保留，确认销毁？',
      okText: '确认废止',
      okType: 'danger',
      onOk: () => destroyMutation.mutate(id)
    });
  };

  const columns = [
    {
      title: '流水线名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
            <SettingOutlined style={{ color: antdToken.colorTextDescription }} />
            <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Cron 定时规则',
      dataIndex: 'cron_expression',
      key: 'cron_expression',
      render: (text: string) => (
        <Tag 
          style={{ background: isDark ? 'rgba(129, 140, 248, 0.1)' : 'rgba(99, 102, 241, 0.1)', borderColor: antdToken.colorBorderSecondary }}
          icon={<ClockCircleOutlined style={{ color: antdToken.colorPrimary }} />} 
          className="font-mono rounded-lg px-3 border-none"
        >
          <Text style={{ color: antdToken.colorPrimary }}>{text}</Text>
        </Tag>
      )
    },
    {
      title: '激活状态',
      key: 'status',
      width: 150,
      render: (_: any, record: any) => (
        hasPermission('pipeline:template:edit') ? (
        <Switch 
            checked={record.is_cron_enabled} 
            onChange={(c) => toggleStatusMutation.mutate({ id: record.id, enabled: c })}
            loading={toggleStatusMutation.isPending && (toggleStatusMutation.variables as any)?.id === record.id}
            checkedChildren="激活"
            unCheckedChildren="停用"
            className="custom-switch-premium"
        />
        ) : null
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <Space size="middle">
          {hasPermission('pipeline:template:edit') && (
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => handleOpenModal(record)}
            className="p-0 text-blue-500 hover:text-blue-600"
          >
            更改
          </Button>
          )}
          {hasPermission('pipeline:template:edit') && (
          <Button 
            type="link" 
            size="small" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDelete(record.id)}
            className="p-0"
          >
            卸载
          </Button>
          )}
        </Space>
      )
    }
  ];

  const tableData = scheduleData?.data || (scheduleData as any)?.results || [];

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="mb-6">
        <Button 
            type="dashed" 
            icon={<AppstoreAddOutlined />} 
            onClick={() => handleOpenModal()} 
            className="w-full h-12 rounded-xl flex items-center justify-center border-dashed border-slate-200 text-slate-500 hover:text-blue-500 hover:border-blue-400 hover:bg-white transition-all group"
          >
            {hasPermission('pipeline:template:edit') && <span className="font-medium">为流水线配置定时器</span>}
          </Button>
      </div>
      
      <div className="flex-1">
        <Table 
            columns={columns} 
            dataSource={tableData} 
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 1200 }}
            pagination={false}
            className="custom-table-modern"
        />
      </div>

      {/* Schedule Configuration Modal */}
      <Modal
        title={
            <Space className="pt-2">
                <PlayCircleOutlined className="text-blue-500" />
                <span>{editingRecord ? "修改流水线定时器" : "初始化流水线定时器"}</span>
            </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText="保存并生效"
        centered
        width={isMobile ? '95vw' : 500}
        bodyStyle={{ overflowX: 'auto' }}
        className="custom-modal-premium"
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} className="pt-4 px-1">
          <Form.Item label="选择流水线" name="id" rules={[{ required: true, message: '请选择一项目标流水线' }]}>
            <Select 
                showSearch
                placeholder="搜索现有的流水线"
                className="rounded-lg h-10"
                options={(allPipelinesData?.data || []).map((p: any) => ({ label: p.name, value: p.id }))}
                filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                disabled={!!editingRecord}
            />
          </Form.Item>
          
          <Form.Item 
            label="Cron 定时器"
            name="cron_expression" 
            rules={[{ required: true, message: '定时器不能为空' }]}
            extra={
                <div 
                  style={{ background: antdToken.colorBgLayout, borderColor: antdToken.colorBorderSecondary }}
                  className="p-3 rounded-lg border border-solid mt-2"
                >
                    <Text strong type="secondary" className="text-[10px] block mb-2 uppercase tracking-wider">示例</Text>
                    <div className="flex flex-col gap-1 text-[11px] font-mono">
                        <Text type="secondary" className="block transform scale-95 origin-left">0 2 * * *    &nbsp;&nbsp;&nbsp;&nbsp;- 每天凌晨 2:00 准时触发</Text>
                        <Text type="secondary" className="block transform scale-95 origin-left">*/15 * * * *  - 每隔 15 分钟触发一次</Text>
                        <Text type="secondary" className="block transform scale-95 origin-left">0 23 * * 5   &nbsp;- 每周五 23:00 触发</Text>
                    </div>
                </div>
            }
          >
            <Input placeholder="兼容 Linux Cron 格式" className="rounded-lg h-10 font-mono" />
          </Form.Item>

          <Form.Item label="开启定时器" name="is_cron_enabled" valuePropName="checked" initialValue={true} className="mb-0">
            <Switch className="custom-switch-premium" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ScheduleList;
