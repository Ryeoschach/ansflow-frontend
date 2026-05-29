import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Switch,
  Typography,
  Card,
  App,
  theme,
  Tooltip,
  Select,
  Badge,
  Tabs,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHostBaselines,
  createHostBaseline,
  updateHostBaseline,
  deleteHostBaseline,
  checkHostBaselineManual,
  getResourcePools,
} from '../../api/hosts';
import K8sYamlEditor from '../K8sCenter/components/K8sYamlEditor';

const { Title, Text } = Typography;

const HostBaselinePage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message, modal: antModal } = App.useApp();
  const queryClient = useQueryClient();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBaseline, setEditingBaseline] = useState<any>(null);
  const [form] = Form.useForm();
  
  // YAML Editor states
  const [checkPlaybook, setCheckPlaybook] = useState('');
  const [remediatePlaybook, setRemediatePlaybook] = useState('');

  // Queries
  const { data: baselinesData, isLoading } = useQuery({
    queryKey: ['host', 'baselines'],
    queryFn: () => getHostBaselines({ page: 1, size: 100 }),
    refetchInterval: (query) => {
      // 智能轮询：如果列表中有任何一个正在巡检的任务，则每 3 秒刷新一次
      const hasRunning = query.state.data?.data?.some((b: any) => b.last_check_status === 'running');
      return hasRunning ? 3000 : false;
    },
  });

  const { data: poolsData } = useQuery({
    queryKey: ['resource_pools'],
    queryFn: () => getResourcePools({ page: 1, size: 100 }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => createHostBaseline(data),
    onSuccess: () => {
      message.success(t('host.baseline.saveSuccess'));
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['host', 'baselines'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateHostBaseline(id, data),
    onSuccess: () => {
      message.success(t('host.baseline.updateSuccess'));
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['host', 'baselines'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteHostBaseline(id),
    onSuccess: () => {
      message.success(t('host.baseline.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['host', 'baselines'] });
    },
  });

  const checkMutation = useMutation({
    mutationFn: (id: number) => checkHostBaselineManual(id),
    onSuccess: (_, id) => {
      message.success(t('host.baseline.checkTaskDispatched'));
      
      // 本地乐观更新：把该条记录的状态改为 'running'，从而自动触发轮询
      queryClient.setQueryData(['host', 'baselines'], (oldData: any) => {
        if (!oldData || !oldData.data) return oldData;
        return {
          ...oldData,
          data: oldData.data.map((b: any) =>
            b.id === id ? { ...b, last_check_status: 'running' } : b
          )
        };
      });

      // 延迟 1 秒后刷新，确保 Celery 已经在数据库中写入了 'running' 状态
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['host', 'baselines'] });
      }, 1000);
    },
  });


  const showModal = (baseline?: any) => {
    setEditingBaseline(baseline || null);
    if (baseline) {
      form.setFieldsValue(baseline);
      setCheckPlaybook(baseline.check_playbook || '');
      setRemediatePlaybook(baseline.remediate_playbook || '');
    } else {
      form.resetFields();
      setCheckPlaybook(t('host.baseline.defaultCheckPlaybook'));
      setRemediatePlaybook(t('host.baseline.defaultRemediatePlaybook'));
    }
    setIsModalVisible(true);
  };

  const columns = [
    {
      title: t('host.baseline.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('host.baseline.targetPool'),
      dataIndex: 'pool_name',
      key: 'pool_name',
      render: (text: string) => <Tag color="cyan">{text}</Tag>,
    },
    {
      title: t('host.baseline.autoRemediate'),
      dataIndex: 'auto_remediate',
      key: 'auto_remediate',
      render: (val: boolean) => (val ? <Tag color="green">{t('host.baseline.enabled')}</Tag> : <Tag>{t('host.baseline.disabled')}</Tag>),
    },
    {
      title: t('host.baseline.lastCheck'),
      dataIndex: 'last_check_time',
      key: 'last_check_time',
      width: 280,
      render: (val: string, record: any) => {
        if (!val) return <Text type="secondary">{t('host.baseline.neverChecked')}</Text>;
        const status = record.last_check_status || 'unknown';
        let color = 'default';
        let text = status;

        if (status === 'success') { color = 'success'; text = t('host.baseline.statusCompliant'); }
        else if (status === 'failed') { color = 'error'; text = t('host.baseline.statusNonCompliant'); }
        else if (status === 'running') { color = 'processing'; text = t('host.baseline.statusRunning'); }

        return (
          <Space direction="vertical" size={0}>
            <Text className="text-xs">{new Date(val).toLocaleString()}</Text>
            <Space>
               <Tag color={color}>{text}</Tag>
               {record.last_execution_id && (
                 <Button 
                    type="link" 
                    size="small" 
                    onClick={() => window.open(`/v1/task/executions?id=${record.last_execution_id}`)}
                 >
                    {t('host.baseline.viewLog')}
                 </Button>
               )}
            </Space>
          </Space>
        );
      }
    },

    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (val: boolean) => (
        <Badge status={val ? 'success' : 'default'} text={val ? t('host.baseline.active') : t('host.baseline.inactive')} />
      ),
    },
    {
      title: t('common.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title={t('host.baseline.inspectNow')}>
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => checkMutation.mutate(record.id)}
              loading={checkMutation.isPending && checkMutation.variables === record.id}
            />
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          />
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              antModal.confirm({
                title: t('host.baseline.confirmDeleteTitle'),
                content: t('host.baseline.confirmDeleteContent'),
                onOk: () => deleteMutation.mutate(record.id),
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="p-0">
      <div className="mb-6">
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ color: token.colorPrimary, marginRight: 8 }} />
            {t('host.baseline.title')}
          </Title>
          <Text type="secondary">
            {t('host.baseline.description')}
          </Text>
        </Space>
      </div>

      <Card
        className="shadow-sm border-none"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            {t('host.baseline.create')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={baselinesData?.data || []}
          loading={isLoading}
          rowKey="id"
        />
      </Card>

      <Modal
        title={editingBaseline ? t('host.baseline.editTitle') : t('host.baseline.createTitle')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={1100}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const payload = { ...values, check_playbook: checkPlaybook, remediate_playbook: remediatePlaybook };
            if (editingBaseline) {
              updateMutation.mutate({ id: editingBaseline.id, data: payload });
            } else {
              createMutation.mutate(payload);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-x-6 mb-6">
            <Form.Item name="name" label={t('host.baseline.name')} rules={[{ required: true, message: t('host.baseline.nameRequired') }]}>
              <Input placeholder={t('host.baseline.namePlaceholder')} />
            </Form.Item>
            <Form.Item name="resource_pool" label={t('host.baseline.targetPool')} rules={[{ required: true, message: t('host.baseline.resourcePoolRequired') }]}>
              <Select
                options={(poolsData?.data || []).map((p: any) => ({ label: p.name, value: p.id }))}
                placeholder={t('host.baseline.poolPlaceholder')}
              />
            </Form.Item>
            <Form.Item name="is_active" label={t('host.baseline.enablePeriodic')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="auto_remediate" label={t('host.baseline.autoRemediate')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <div className="flex gap-x-6" style={{ height: '400px' }}>
            <div className="flex-1 flex flex-col min-w-0">
              <Text strong className="mb-2 block">
                <InfoCircleOutlined className="mr-1" /> {t('host.baseline.checkPlaybook')}
              </Text>
              <div className="flex-1 overflow-hidden">
                <K8sYamlEditor 
                  height="400px" 
                  value={checkPlaybook} 
                  onChange={(v) => setCheckPlaybook(v || '')} 
                />
              </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <Text strong className="mb-2 block">
                <SafetyCertificateOutlined className="mr-1" /> {t('host.baseline.remediatePlaybook')}
              </Text>
              <div className="flex-1 overflow-hidden">
                <K8sYamlEditor 
                  height="400px" 
                  value={remediatePlaybook} 
                  onChange={(v) => setRemediatePlaybook(v || '')} 
                />
              </div>
            </div>
          </div>
          <div className="h-4" />

        </Form>
      </Modal>
    </div>
  );
};

export default HostBaselinePage;
