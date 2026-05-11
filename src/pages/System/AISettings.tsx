import React, { useState } from 'react';
import { 
  Card, Tabs, Table, Button, Space, Modal, Form, 
  Input, Select, Switch, message, Tag, Typography, Alert
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ApiOutlined, RocketOutlined, SettingOutlined 
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { 
    getAIProviders, createAIProvider, updateAIProvider, deleteAIProvider, syncAIProviderModels,
    getAIModels, createAIModel, updateAIModel, deleteAIModel,
    getCurrentAIConfig, updateAIConfig,
    AIProvider, AIModel
} from '../../api/ai';

const { Title, Text } = Typography;

const AISettings: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('config');

  // -- Providers State --
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [providerForm] = Form.useForm();

  // -- Models State --
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [modelForm] = Form.useForm();

  const appToken = useAppStore(state => state.token);
  const isInitializing = useAppStore(state => state.isInitializing);
  const queryEnabled = !isInitializing && !!appToken;

  // -- Queries --
  const { data: providersData, isLoading: providersLoading } = useQuery({
    queryKey: ['aiProviders'],
    queryFn: getAIProviders,
    enabled: queryEnabled
  });

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['aiModels'],
    queryFn: () => getAIModels(),
    enabled: queryEnabled
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['aiConfig'],
    queryFn: getCurrentAIConfig,
    enabled: queryEnabled
  });

  // 当 configData 加载后，手动设置表单值
  const [configForm] = Form.useForm();
  React.useEffect(() => {
    if (configData) {
      configForm.setFieldsValue(configData);
    }
  }, [configData, configForm]);

  // -- Mutations --
  const providerMutation = useMutation({
    mutationFn: (values: any) => editingProvider 
      ? updateAIProvider(editingProvider.id, values) 
      : createAIProvider(values),
    onSuccess: () => {
      message.success(t('ai.settings.saveSuccess'));
      setIsProviderModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] });
    }
  });

  const syncModelsMutation = useMutation({
    mutationFn: (id: number) => syncAIProviderModels(id),
    onSuccess: (res) => {
      message.success(res.message || t('ai.settings.syncSuccess'));
      queryClient.invalidateQueries({ queryKey: ['aiProviders'] });
      queryClient.invalidateQueries({ queryKey: ['aiModels'] });
    },
    onError: (err: any) => message.error(err.response?.data?.error || t('ai.settings.syncFailed'))
  });

  const configMutation = useMutation({
    mutationFn: (values: any) => updateAIConfig(configData!.id, values),
    onSuccess: () => {
      message.success(t('ai.settings.saveSuccess'));
      queryClient.invalidateQueries({ queryKey: ['aiConfig'] });
    }
  });

  // -- Handlers --
  const handleEditProvider = (record?: AIProvider) => {
    setEditingProvider(record || null);
    providerForm.setFieldsValue(record || { is_active: true, provider_type: 'openai' });
    setIsProviderModalOpen(true);
  };

  const handleEditModel = (record?: AIModel) => {
    setEditingModel(record || null);
    modelForm.setFieldsValue(record || { is_active: true, model_type: 'llm' });
    setIsModelModalOpen(true);
  };

  // -- Render Components --
  const renderProviderTab = () => {
    const rawData = providersData as any;
    // 适配后端返回格式：优先读取 data，其次读取 results，最后默认为空数组
    const providers = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.results || []);

    const columns = [
// ... (保持 columns 定义不变)
      { title: '名称', dataIndex: 'name', key: 'name' },
      { 
        title: '类型', 
        dataIndex: 'provider_type', 
        key: 'provider_type',
        render: (t: string) => <Tag color="blue">{t.toUpperCase()}</Tag>
      },
      { title: 'API 地址', dataIndex: 'base_url', key: 'base_url', ellipsis: true },
      { 
        title: '状态', 
        dataIndex: 'is_active', 
        key: 'is_active',
        render: (active: boolean) => <Switch checked={active} disabled />
      },
      {
        title: '操作',
        key: 'action',
        render: (_: any, record: AIProvider) => (
          <Space>
            <Button 
              size="small" 
              icon={<ApiOutlined />} 
              loading={syncModelsMutation.isPending && syncModelsMutation.variables === record.id}
              onClick={() => syncModelsMutation.mutate(record.id)}
            >
              同步模型
            </Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditProvider(record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({
                title: '确认删除?',
                onOk: () => deleteAIProvider(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['aiProviders'] }))
              });
            }} />
          </Space>
        ),
      },
    ];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Text type="secondary">配置 AI 模型供应商（如 OpenAI, DeepSeek, Ollama 等）</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditProvider()}>添加供应商</Button>
        </div>
        <Table 
          dataSource={providers} 
          columns={columns} 
          rowKey="id" 
          loading={providersLoading}
        />
      </div>
    );
  };

  const renderModelTab = () => {
    const rawData = modelsData as any;
    const models = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.results || []);

    const columns = [
// ... (保持 columns 不变)
      { title: '显示名称', dataIndex: 'display_name', key: 'display_name' },
      { title: '模型标识', dataIndex: 'name', key: 'name' },
      { title: '供应商', dataIndex: 'provider_name', key: 'provider_name' },
      { 
        title: '类型', 
        dataIndex: 'model_type', 
        key: 'model_type',
        render: (t: string) => <Tag color={t === 'llm' ? 'green' : 'orange'}>{t === 'llm' ? 'LLM' : 'Embedding'}</Tag>
      },
      {
        title: '操作',
        key: 'action',
        render: (_: any, record: AIModel) => (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditModel(record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({
                title: '确认删除?',
                onOk: () => deleteAIModel(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['aiModels'] }))
              });
            }} />
          </Space>
        ),
      },
    ];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Text type="secondary">管理各供应商下的具体模型实例</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditModel()}>添加模型</Button>
        </div>
        <Table 
          dataSource={models} 
          columns={columns} 
          rowKey="id" 
          loading={modelsLoading}
        />
      </div>
    );
  };

  const renderConfigTab = () => {
    const rawData = modelsData as any;
    const allModels: AIModel[] = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.results || []);
    const llmModels = allModels.filter(m => m.model_type === 'llm');
    const embModels = allModels.filter(m => m.model_type === 'embedding');

    return (
      <div className="max-w-2xl space-y-6">
        <Alert 
          message={t('ai.settings.suggestion')} 
          description={t('ai.settings.ragWarning')} 
          type="info" 
          showIcon 
        />
        <Form 
          form={configForm}
          layout="vertical" 
          onFinish={configMutation.mutate}
        >
          <Form.Item label={t('ai.settings.defaultLlm')} name="default_llm" tooltip={t('ai.settings.defaultLlmTip')}>
            <Select placeholder="选择默认 LLM">
              {llmModels.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.display_name} ({m.provider_name})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item label={t('ai.settings.defaultEmbedding')} name="default_embedding" tooltip={t('ai.settings.defaultEmbeddingTip')}>
            <Select placeholder="选择默认 Embedding">
              {embModels.map(m => (
                <Select.Option key={m.id} value={m.id}>{m.display_name} ({m.provider_name})</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={configMutation.isPending}>
              {t('ai.settings.saveConfig')}
            </Button>
          </Form.Item>
        </Form>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Title level={4}>{t('ai.settings.pageTitle')}</Title>
      
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab={<span><SettingOutlined />{t('ai.settings.globalConfig')}</span>} key="config">
            {renderConfigTab()}
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><ApiOutlined />{t('ai.settings.providers')}</span>} key="providers">
            {renderProviderTab()}
          </Tabs.TabPane>
          <Tabs.TabPane tab={<span><RocketOutlined />{t('ai.settings.models')}</span>} key="models">
            {renderModelTab()}
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* Provider Modal */}
      <Modal
        title={editingProvider ? t('ai.settings.editProvider') : t('ai.settings.addProvider')}
        open={isProviderModalOpen}
        onCancel={() => setIsProviderModalOpen(false)}
        onOk={() => providerForm.submit()}
        confirmLoading={providerMutation.isPending}
      >
        <Form form={providerForm} layout="vertical" onFinish={providerMutation.mutate}>
          <Form.Item name="name" label={t('ai.settings.providerName')} rules={[{ required: true }]}>
            <Input placeholder="如 DeepSeek 官方" />
          </Form.Item>
          <Form.Item name="provider_type" label={t('ai.settings.providerType')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="deepseek">DeepSeek</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
              <Select.Option value="ollama">Ollama (Local)</Select.Option>
              <Select.Option value="other">Other (OpenAI Compatible)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="base_url" label={t('ai.settings.apiUrl')} rules={[{ required: true }]}>
            <Input placeholder="https://api.deepseek.com" />
          </Form.Item>
          <Form.Item name="api_key" label={t('ai.settings.apiKey')}>
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>
          <Form.Item name="is_active" label={t('ai.settings.isActive')} valuePropName="checked">
            <Switch checkedChildren={t('common.active')} unCheckedChildren={t('common.inactive')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Model Modal */}
      <Modal
        title={editingModel ? t('ai.settings.editModel') : t('ai.settings.addModel')}
        open={isModelModalOpen}
        onCancel={() => setIsModelModalOpen(false)}
        onOk={() => modelForm.submit()}
      >
        <Form form={modelForm} layout="vertical" onFinish={(values) => {
          const m = editingModel 
            ? updateAIModel(editingModel.id, values) 
            : createAIModel(values);
          m.then(() => {
            message.success(t('ai.settings.saveSuccess'));
            setIsModelModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['aiModels'] });
          });
        }}>
          <Form.Item name="provider" label={t('ai.settings.belongProvider')} rules={[{ required: true }]}>
            <Select placeholder="选择供应商">
              {(Array.isArray(providersData) ? providersData : (providersData as any)?.data || (providersData as any)?.results || []).map((p: any) => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="display_name" label={t('ai.settings.displayName')} rules={[{ required: true }]}>
            <Input placeholder="如 DeepSeek Chat V3" />
          </Form.Item>
          <Form.Item name="name" label={t('ai.settings.modelId')} rules={[{ required: true }]}>
            <Input placeholder="如 deepseek-chat" />
          </Form.Item>
          <Form.Item name="model_type" label={t('ai.settings.modelType')} rules={[{ required: true }]}>
            <Select>
              <Select.Option value="llm">{t('ai.settings.llm')}</Select.Option>
              <Select.Option value="embedding">{t('ai.settings.embedding')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label={t('ai.settings.isActive')} valuePropName="checked">
            <Switch checkedChildren={t('common.active')} unCheckedChildren={t('common.inactive')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AISettings;
