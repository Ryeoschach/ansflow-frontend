import React, { useState } from 'react';
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
  });

  const { data: poolsData } = useQuery({
    queryKey: ['resource_pools'],
    queryFn: () => getResourcePools({ page: 1, size: 100 }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => createHostBaseline(data),
    onSuccess: () => {
      message.success('基线配置已保存');
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['host', 'baselines'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateHostBaseline(id, data),
    onSuccess: () => {
      message.success('基线配置已更新');
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['host', 'baselines'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteHostBaseline(id),
    onSuccess: () => {
      message.success('基线已删除');
      queryClient.invalidateQueries({ queryKey: ['host', 'baselines'] });
    },
  });

  const checkMutation = useMutation({
    mutationFn: (id: number) => checkHostBaselineManual(id),
    onSuccess: () => {
      message.success('巡检任务已下发');
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
      setCheckPlaybook('---\n- hosts: all\n  tasks:\n    - name: 检查 Nginx 状态\n      shell: systemctl is-active nginx');
      setRemediatePlaybook('---\n- hosts: all\n  tasks:\n    - name: 尝试重启 Nginx\n      service: name=nginx state=restarted');
    }
    setIsModalVisible(true);
  };

  const columns = [
    {
      title: '基线名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '目标资源池',
      dataIndex: 'pool_name',
      key: 'pool_name',
      render: (text: string) => <Tag color="cyan">{text}</Tag>,
    },
    {
      title: '自动修复',
      dataIndex: 'auto_remediate',
      key: 'auto_remediate',
      render: (val: boolean) => (val ? <Tag color="green">已开启</Tag> : <Tag>未开启</Tag>),
    },
    {
      title: '最近巡检',
      dataIndex: 'last_check_time',
      key: 'last_check_time',
      render: (val: string) => (val ? new Date(val).toLocaleString() : '从不'),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (val: boolean) => (
        <Badge status={val ? 'success' : 'default'} text={val ? '启用中' : '已禁用'} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="立即巡检">
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
                title: '确认删除基线?',
                content: '删除后将停止自动巡检和告警触发。',
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
            主机基线巡检
          </Title>
          <Text type="secondary">
            通过 Ansible 定期扫描物理机/虚拟机配置状态，发现漂移并自动触发 AI 诊断与自愈
          </Text>
        </Space>
      </div>

      <Card
        className="shadow-sm border-none"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            创建基线
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
        title={editingBaseline ? '编辑基线配置' : '创建基线配置'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={1000}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const payload = { ...values, check_playbook, remediate_playbook: remediatePlaybook };
            if (editingBaseline) {
              updateMutation.mutate({ id: editingBaseline.id, data: payload });
            } else {
              createMutation.mutate(payload);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-x-6">
            <Form.Item name="name" label="基线名称" rules={[{ required: true }]}>
              <Input placeholder="例如: 标准 Nginx 服务配置检查" />
            </Form.Item>
            <Form.Item name="resource_pool" label="目标资源池" rules={[{ required: true }]}>
              <Select
                options={(poolsData?.data || []).map((p: any) => ({ label: p.name, value: p.id }))}
                placeholder="请选择资源池"
              />
            </Form.Item>
            <Form.Item name="is_active" label="启用定期巡检" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="auto_remediate" label="发现异常自动修复" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-6 h-[500px]">
            <div className="flex flex-col">
              <Text strong className="mb-2">
                <InfoCircleOutlined className="mr-1" /> 巡检剧本 (Check Playbook)
              </Text>
              <div className="flex-1 min-h-0">
                <K8sYamlEditor value={checkPlaybook} onChange={(v) => setCheckPlaybook(v || '')} />
              </div>
            </div>
            <div className="flex flex-col">
              <Text strong className="mb-2">
                <SafetyCertificateOutlined className="mr-1" /> 修复剧本 (Remediate Playbook)
              </Text>
              <div className="flex-1 min-h-0">
                <K8sYamlEditor value={remediatePlaybook} onChange={(v) => setRemediatePlaybook(v || '')} />
              </div>
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default HostBaselinePage;
