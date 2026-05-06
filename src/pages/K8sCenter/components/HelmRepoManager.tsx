import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Typography,
  App,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getHelmRepos,
  createHelmRepo,
  updateHelmRepo,
  deleteHelmRepo,
  testHelmRepo,
} from '../../../api/k8s';
import useAppStore from "../../../store/useAppStore";

const { Text } = Typography;

const HelmRepoManager: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const { hasPermission } = useAppStore();
  const queryClient = useQueryClient();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [form] = Form.useForm();

  // Queries
  const { data: reposData, isLoading } = useQuery({
    queryKey: ['helm', 'repos'],
    queryFn: () => getHelmRepos({ page: 1, size: 100 }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createHelmRepo,
    onSuccess: () => {
      message.success(t('common.createSuccess'));
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['helm', 'repos'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => updateHelmRepo(id, data),
    onSuccess: () => {
      message.success(t('common.updateSuccess'));
      setIsModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['helm', 'repos'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHelmRepo,
    onSuccess: () => {
      message.success(t('common.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['helm', 'repos'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: testHelmRepo,
    onSuccess: () => {
      message.success(t('helm.repoConnectSuccess'));
    },
    onError: (err: any) => {
      message.error(`${t('helm.repoConnectFailed')}: ${err.response?.data?.error || err.message}`);
    }
  });

  const handleSubmit = (values: any) => {
    if (selectedRepo) {
      updateMutation.mutate({ id: selectedRepo.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns = [
    { title: t('helm.repoName'), dataIndex: 'name', key: 'name' },
    { title: t('helm.repoUrl'), dataIndex: 'url', key: 'url', ellipsis: true },
    { title: t('helm.username'), dataIndex: 'username', key: 'username', render: (v: string) => v || '-' },
    {
      title: t('common.action'),
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title={t('helm.testConnection')}>
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => testMutation.mutate(record.id)}
              loading={testMutation.isPending && testMutation.variables === record.id}
            />
          </Tooltip>
          {hasPermission('helm:repo:edit') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedRepo(record);
                form.setFieldsValue(record);
                setIsModalVisible(true);
              }}
            />
          )}
          {hasPermission('helm:repo:delete') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                modal.confirm({
                  title: t('common.deleteConfirm'),
                  content: t('helm.confirmDeleteRepo', { name: record.name }),
                  onOk: () => deleteMutation.mutate(record.id),
                });
              }}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <Text type="secondary">{t('helm.repoManagerDesc')}</Text>
        {hasPermission('helm:repo:add') && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedRepo(null);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            {t('helm.addRepo')}
          </Button>
        )}
      </div>

      <Table
        dataSource={(reposData as any)?.data || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={false}
      />

      <Modal
        title={selectedRepo ? t('helm.editRepo') : t('helm.addRepo')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label={t('helm.repoName')} rules={[{ required: true }]}>
            <Input placeholder="bitnami" disabled={!!selectedRepo} />
          </Form.Item>
          <Form.Item name="url" label={t('helm.repoUrl')} rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://charts.bitnami.com/bitnami" />
          </Form.Item>
          <Form.Item name="username" label={t('helm.username')}>
            <Input placeholder={t('helm.optional')} />
          </Form.Item>
          <Form.Item name="password" label={t('helm.password')}>
            <Input.Password placeholder={selectedRepo ? t('helm.keepCurrentPassword') : t('helm.optional')} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HelmRepoManager;
