import React, { useState } from 'react';
import { 
  Card, Tabs, Table, Button, Space, Modal, Form, 
  Input, Select, Switch, message, Tag, Typography, Alert, Drawer, Divider, List
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ApiOutlined, RocketOutlined, SettingOutlined,
  BookOutlined, DatabaseOutlined, SyncOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { 
    getAIProviders, createAIProvider, updateAIProvider, deleteAIProvider, syncAIProviderModels,
    getAIModels, createAIModel, updateAIModel, deleteAIModel,
    getCurrentAIConfig, updateAIConfig,
    getKnowledgeBases, createKnowledgeBase, updateKnowledgeBase, reindexKnowledgeBase, getKnowledgeDocuments, deleteKnowledgeDocument,
    AIProvider, AIModel, KnowledgeBase, KnowledgeDocument
} from '../../api/ai';

const { Title, Text, Paragraph } = Typography;

const AISettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('config');

  // -- Knowledge Base State --
  const [isKBModalOpen, setIsKBModalOpen] = useState(false);
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null);
  const [kbForm] = Form.useForm();
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [isDocDrawerOpen, setIsDocDrawerOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDocument | null>(null);

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

  const { data: kbData, isLoading: kbLoading } = useQuery({
    queryKey: ['aiKnowledgeBases'],
    queryFn: () => getKnowledgeBases(),
    enabled: queryEnabled
  });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['aiDocuments', selectedKB?.id],
    queryFn: () => getKnowledgeDocuments({ kb: selectedKB?.id }),
    enabled: !!selectedKB && isDocDrawerOpen
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

  const reindexMutation = useMutation({
    mutationFn: (id: number) => reindexKnowledgeBase(id),
    onSuccess: (res) => {
      message.success(res.message || t('ai.settings.reindexSuccess'));
    },
    onError: (err: any) => message.error(err.response?.data?.error || 'Re-index failed')
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => deleteKnowledgeDocument(id),
    onSuccess: () => {
      message.success(t('common.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['aiDocuments', selectedKB?.id] });
    }
  });

  const kbMutation = useMutation({
    mutationFn: (values: any) => editingKB 
      ? updateKnowledgeBase(editingKB.id, values)
      : createKnowledgeBase(values),
    onSuccess: () => {
      message.success(t('ai.settings.saveSuccess'));
      setIsKBModalOpen(false);
      setEditingKB(null);
      kbForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['aiKnowledgeBases'] });
    },
    onError: (err: any) => {
      console.error('KB Mutation Error:', err);
      message.error(err.response?.data?.error || err.message || 'Operation failed');
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
      { title: t('ai.settings.providerName'), dataIndex: 'name', key: 'name' },
      { 
        title: t('ai.settings.providerType'), 
        dataIndex: 'provider_type', 
        key: 'provider_type',
        render: (type: string) => {
          const colorMap: Record<string, string> = {
            openai: 'green',
            deepseek: 'cyan',
            ollama: 'blue',
            local: 'purple',
            anthropic: 'volcano',
            zhipu: 'orange'
          };
          return <Tag color={colorMap[type] || 'default'}>{type.toUpperCase()}</Tag>;
        }
      },
      { title: t('ai.settings.apiUrl'), dataIndex: 'base_url', key: 'base_url', ellipsis: true },
      { 
        title: t('common.status'), 
        dataIndex: 'is_active', 
        key: 'is_active',
        render: (active: boolean) => <Switch checked={active} size="small" disabled />
      },
      {
        title: t('common.action'),
        key: 'action',
        render: (_: any, record: AIProvider) => (
          <Space>
            <Button 
              size="small" 
              icon={<ApiOutlined />} 
              loading={syncModelsMutation.isPending && syncModelsMutation.variables === record.id}
              onClick={() => syncModelsMutation.mutate(record.id)}
            >
              {t('ai.settings.syncModels')}
            </Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditProvider(record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({
                title: t('ai.settings.confirmDelete'),
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
          <Text type="secondary">{t('ai.settings.providerTip')}</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditProvider()}>{t('ai.settings.addProvider')}</Button>
        </div>
        <Table 
          dataSource={providers} 
          columns={columns} 
          rowKey="id" 
          loading={providersLoading}
          pagination={{ size: 'small' }}
        />
      </div>
    );
  };

  const renderModelTab = () => {
    const rawData = modelsData as any;
    const models = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.results || []);

    const columns = [
      { title: t('ai.settings.displayName'), dataIndex: 'display_name', key: 'display_name' },
      { title: t('ai.settings.modelId'), dataIndex: 'name', key: 'name' },
      { title: t('ai.settings.belongProvider'), dataIndex: 'provider_name', key: 'provider_name' },
      { 
        title: t('ai.settings.modelType'), 
        dataIndex: 'model_type', 
        key: 'model_type',
        render: (type: string) => (
          <Tag color={type === 'llm' ? 'gold' : 'magenta'}>
            {type === 'llm' ? t('ai.settings.llm') : t('ai.settings.embedding')}
          </Tag>
        )
      },
      {
        title: t('common.action'),
        key: 'action',
        render: (_: any, record: AIModel) => (
          <Space>
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditModel(record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
              Modal.confirm({
                title: t('ai.settings.confirmDelete'),
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
          <Text type="secondary">{t('ai.settings.modelTip')}</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditModel()}>{t('ai.settings.addModel')}</Button>
        </div>
        <Table 
          dataSource={models} 
          columns={columns} 
          rowKey="id" 
          loading={modelsLoading}
          pagination={{ size: 'small' }}
        />
      </div>
    );
  };

  const renderKnowledgeTab = () => {
    const rawData = kbData as any;
    const kbs = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.results || []);
    const { i18n } = useTranslation();
    const isEn = i18n.language.startsWith('en');

    const columns = [
      { 
        title: t('ai.settings.kbName'), 
        key: 'name',
        width: 150,
        render: (_: any, record: KnowledgeBase) => (
          <span>{isEn ? (record.name_en || record.name) : record.name}</span>
        )
      },
      { 
        title: t('ai.settings.kbDesc'), 
        key: 'description',
        width: 320,
        ellipsis: true,
        render: (_: any, record: KnowledgeBase) => (
          <span title={isEn ? (record.description_en || record.description) : record.description}>
            {isEn ? (record.description_en || record.description) : record.description}
          </span>
        )
      },
      { 
        title: t('ai.settings.kbCollection'), 
        dataIndex: 'collection_name', 
        key: 'collection_name',
        width: 180,
      },
      {
        title: t('common.action'),
        key: 'action',
        render: (_: any, record: KnowledgeBase) => (
          <Space size="middle">
            <Button 
              size="small" 
              icon={<DatabaseOutlined />} 
              onClick={() => {
                setSelectedKB(record);
                setIsDocDrawerOpen(true);
              }}
            >
              {t('ai.settings.docManagement')}
            </Button>
            <Button 
              size="small" 
              icon={<EditOutlined />} 
              onClick={() => {
                setEditingKB(record);
                kbForm.setFieldsValue(record);
                setIsKBModalOpen(true);
              }} 
            />
            <Button 
              size="small" 
              icon={<SyncOutlined />} 
              loading={reindexMutation.isPending && reindexMutation.variables === record.id}
              onClick={() => reindexMutation.mutate(record.id)}
            >
              {t('ai.settings.reindex')}
            </Button>
          </Space>
        ),
      },
    ];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Text type="secondary">{t('ai.settings.kbDescription')}</Text>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => {
              setEditingKB(null);
              kbForm.resetFields();
              setIsKBModalOpen(true);
            }}
          >
            {t('ai.settings.addKnowledgeBase')}
          </Button>
        </div>
        <Table 
          dataSource={kbs} 
          columns={columns} 
          rowKey="id" 
          loading={kbLoading}
          pagination={{ size: 'small' }}
          scroll={{ x: 800 }}
        />

        {/* KB Creation/Edit Modal */}
        <Modal
          title={editingKB ? t('ai.settings.editKnowledgeBase') : t('ai.settings.addKnowledgeBase')}
          open={isKBModalOpen}
          onOk={() => kbForm.submit()}
          onCancel={() => {
            setIsKBModalOpen(false);
            setEditingKB(null);
          }}
          confirmLoading={kbMutation.isPending}
        >
          <Form form={kbForm} layout="vertical" onFinish={kbMutation.mutate}>
            <Form.Item name="name" label={t('ai.settings.kbNameCN')} rules={[{ required: true }]}>
              <Input placeholder={t('ai.settings.kbNamePlaceholder')} />
            </Form.Item>
            <Form.Item name="name_en" label={t('ai.settings.kbNameEn')}>
              <Input placeholder="English Name" />
            </Form.Item>
            <Form.Item name="collection_name" label={t('ai.settings.kbCollection')} rules={[{ required: true }]}>
              <Input placeholder={t('ai.settings.kbCollectionPlaceholder')} readOnly={!!editingKB} />
            </Form.Item>
            <Form.Item name="description" label={t('ai.settings.kbDescCN')}>
              <Input.TextArea placeholder={t('ai.settings.kbDescPlaceholder')} />
            </Form.Item>
            <Form.Item name="description_en" label={t('ai.settings.kbDescEn')}>
              <Input.TextArea placeholder="English Description" />
            </Form.Item>
          </Form>
        </Modal>

        <Drawer
          title={`${t('ai.settings.docManagement')} - ${isEn ? (selectedKB?.name_en || selectedKB?.name) : selectedKB?.name}`}
          width={800}
          onClose={() => setIsDocDrawerOpen(false)}
          open={isDocDrawerOpen}
        >
          <List
            loading={docsLoading}
            dataSource={docsData?.results || docsData?.data || (Array.isArray(docsData) ? docsData : [])}
            renderItem={(item: KnowledgeDocument) => (
              <List.Item
                actions={[
                  <Button type="link" onClick={() => setViewingDoc(item)}>{t('ai.settings.docView')}</Button>,
                  <Button type="link" danger onClick={() => {
                    Modal.confirm({
                      title: t('ai.settings.confirmDelete'),
                      onOk: () => deleteDocMutation.mutate(item.id)
                    });
                  }}>{t('common.delete')}</Button>
                ]}
              >
                <List.Item.Meta
                  title={item.title}
                  description={
                    <Space split={<Divider type="vertical" />}>
                      <Text type="secondary">{item.source_type}</Text>
                      <Text type="secondary">{new Date(item.create_time).toLocaleString()}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Drawer>

        <Modal
          title={viewingDoc?.title}
          open={!!viewingDoc}
          onCancel={() => setViewingDoc(null)}
          footer={null}
          width={800}
        >
          <div className="max-h-[60vh] overflow-y-auto">
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {viewingDoc?.content}
            </Paragraph>
            <Divider />
            <Text type="secondary">Metadata:</Text>
            <pre className="bg-black/5 dark:bg-white/5 p-3 mt-2 text-xs rounded border border-black/5 dark:border-white/10 overflow-x-auto">
              {JSON.stringify(viewingDoc?.metadata, null, 2)}
            </pre>
          </div>
        </Modal>
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
          <Tabs.TabPane tab={<span><BookOutlined />{t('ai.settings.knowledgeBase')}</span>} key="knowledge">
            {renderKnowledgeTab()}
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
            <Select onChange={(val) => {
              // 如果是本地模型，清空或设置默认提示的 URL
              if (val === 'local') {
                providerForm.setFieldValue('base_url', 'http://localhost');
              }
            }}>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="deepseek">DeepSeek</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
              <Select.Option value="ollama">Ollama (Local)</Select.Option>
              <Select.Option value="local">FastEmbed (Local)</Select.Option>
              <Select.Option value="other">Other (OpenAI Compatible)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item 
            noStyle
            shouldUpdate={(prev, curr) => prev.provider_type !== curr.provider_type}
          >
            {({ getFieldValue }) => (
              <Form.Item 
                name="base_url" 
                label={t('ai.settings.apiUrl')} 
                rules={[{ required: getFieldValue('provider_type') !== 'local' }]}
              >
                <Input 
                  placeholder={getFieldValue('provider_type') === 'local' ? "本地模式无需配置" : "https://api.deepseek.com"} 
                  disabled={getFieldValue('provider_type') === 'local'}
                />
              </Form.Item>
            )}
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
