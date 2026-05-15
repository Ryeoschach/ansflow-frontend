import React, { useState } from 'react';
import { 
  Card, Tabs, Table, Button, Space, Modal, Form, 
  Input, Select, Switch, message, Tag, Typography, Alert, Drawer, Divider, List, Badge, Upload, UploadProps, Popconfirm, Tooltip, Empty,
  Slider, Row, Col
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, 
  ApiOutlined, RocketOutlined, SettingOutlined,
  BookOutlined, DatabaseOutlined, SyncOutlined,
  UploadOutlined, InboxOutlined, EyeOutlined, ReloadOutlined,
  SafetyCertificateOutlined, CheckCircleOutlined, StopOutlined, SaveOutlined,
  SearchOutlined, BugOutlined, FileTextOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppStore from '../../store/useAppStore';
import { 
    getAIProviders, createAIProvider, updateAIProvider, deleteAIProvider, syncAIProviderModels,
    getAIModels, createAIModel, updateAIModel, deleteAIModel,
    getCurrentAIConfig, updateAIConfig,
    getKnowledgeBases, createKnowledgeBase, updateKnowledgeBase, reindexKnowledgeBase, 
    getKnowledgeDocuments, deleteKnowledgeDocument, uploadKnowledgeDocument, getDocumentChunks,
    updateKnowledgeChunk, deleteKnowledgeChunk, testSearchKnowledgeBase,
    AIProvider, AIModel, KnowledgeBase, KnowledgeDocument, DocumentChunk
} from '../../api/ai';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

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
  
  // -- Cleaning & Preview State --
  const [isPreviewDrawerOpen, setIsPreviewDrawerOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [editingChunkId, setEditingChunkId] = useState<number | null>(null);
  const [chunkEditContent, setChunkEditContent] = useState("");

  // -- Playground State --
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // -- Providers State --
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [providerForm] = Form.useForm();

  // -- Models State --
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [modelForm] = Form.useForm();

  const handleEditProvider = (provider?: AIProvider) => {
    setEditingProvider(provider || null);
    if (provider) {
      providerForm.setFieldsValue(provider);
    } else {
      providerForm.resetFields();
      providerForm.setFieldsValue({ is_active: true });
    }
    setIsProviderModalOpen(true);
  };

  const handleEditModel = (model?: AIModel) => {
    setEditingModel(model || null);
    if (model) {
      modelForm.setFieldsValue(model);
    } else {
      modelForm.resetFields();
      modelForm.setFieldsValue({ is_active: true, model_type: 'llm' });
    }
    setIsModelModalOpen(true);
  };

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

  const { data: configData } = useQuery({
    queryKey: ['aiConfig'],
    queryFn: getCurrentAIConfig,
    enabled: queryEnabled
  });

  const { data: kbData, isLoading: kbLoading } = useQuery({
    queryKey: ['aiKnowledgeBases'],
    queryFn: () => getKnowledgeBases(),
    enabled: queryEnabled
  });

  const { data: docsData, isLoading: docsLoading, refetch: refetchDocs } = useQuery({
    queryKey: ['aiDocuments', selectedKB?.id],
    queryFn: () => getKnowledgeDocuments({ kb: selectedKB!.id }),
    enabled: !!selectedKB && isDocDrawerOpen,
    refetchInterval: (query) => {
      const docs = query.state.data as any;
      const results = docs?.results || docs?.data || (Array.isArray(docs) ? docs : []);
      const hasProcessing = results.some((d: any) => d.status === 'processing' || d.status === 'pending');
      return hasProcessing ? 3000 : false;
    }
  });

  const { data: chunksData, isLoading: chunksLoading } = useQuery({
    queryKey: ['docChunks', previewDoc?.id],
    queryFn: () => getDocumentChunks(previewDoc!.id),
    enabled: !!previewDoc && isPreviewDrawerOpen
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
    mutationFn: (values: any) => editingProvider ? updateAIProvider(editingProvider.id, values) : createAIProvider(values),
    onSuccess: () => { message.success(t('ai.settings.saveSuccess')); setIsProviderModalOpen(false); queryClient.invalidateQueries({ queryKey: ['aiProviders'] }); }
  });

  const syncModelsMutation = useMutation({
    mutationFn: (id: number) => syncAIProviderModels(id),
    onSuccess: (res) => { message.success(res.message || t('ai.settings.syncSuccess')); queryClient.invalidateQueries({ queryKey: ['aiProviders'] }); queryClient.invalidateQueries({ queryKey: ['aiModels'] }); },
    onError: (err: any) => message.error(err.response?.data?.error || t('ai.settings.syncFailed'))
  });

  const configMutation = useMutation({
    mutationFn: (values: any) => updateAIConfig(configData!.id, values),
    onSuccess: () => { message.success(t('ai.settings.saveSuccess')); queryClient.invalidateQueries({ queryKey: ['aiConfig'] }); }
  });

  const reindexMutation = useMutation({
    mutationFn: (id: number) => reindexKnowledgeBase(id),
    onSuccess: (res) => { message.success(res.message || t('ai.settings.reindexSuccess')); queryClient.invalidateQueries({ queryKey: ['aiKnowledgeBases'] }); },
    onError: (err: any) => message.error(err.response?.data?.error || 'Re-index failed')
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => deleteKnowledgeDocument(id),
    onSuccess: () => { message.success(t('common.deleteSuccess')); queryClient.invalidateQueries({ queryKey: ['aiDocuments', selectedKB?.id] }); }
  });

  const kbMutation = useMutation({
    mutationFn: (values: any) => editingKB ? updateKnowledgeBase(editingKB.id, values) : createKnowledgeBase(values),
    onSuccess: () => { message.success(t('ai.settings.saveSuccess')); setIsKBModalOpen(false); setEditingKB(null); kbForm.resetFields(); queryClient.invalidateQueries({ queryKey: ['aiKnowledgeBases'] }); }
  });

  const uploadMutation = useMutation({
    mutationFn: ({ kbId, file }: { kbId: number, file: File }) => uploadKnowledgeDocument(kbId, file),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['aiDocuments', selectedKB?.id] }); },
    onError: (err: any) => message.error(err.response?.data?.error || 'Upload failed')
  });

  const searchMutation = useMutation({
    mutationFn: ({ kbId, query }: { kbId: number, query: string }) => testSearchKnowledgeBase(kbId, query),
    onSuccess: (data) => { setSearchResults(data); },
    onError: (err: any) => message.error(err.response?.data?.error || 'Search failed')
  });

  // -- Chunk Mutations --
  const chunkUpdateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => updateKnowledgeChunk(id, data),
    onSuccess: () => { message.success(t('common.saveSuccess')); setEditingChunkId(null); queryClient.invalidateQueries({ queryKey: ['docChunks', previewDoc?.id] }); }
  });

  const chunkDeleteMutation = useMutation({
    mutationFn: (id: number) => deleteKnowledgeChunk(id),
    onSuccess: () => { message.success(t('common.deleteSuccess')); queryClient.invalidateQueries({ queryKey: ['docChunks', previewDoc?.id] }); }
  });

  // -- Upload Props --
  const uploadProps: UploadProps = {
    name: 'file', 
    multiple: true,
    beforeUpload: (_, fileList) => { 
      if (selectedKB) {
        fileList.forEach(file => {
          uploadMutation.mutate({ kbId: selectedKB.id, file });
        });
        message.loading(`正在上传 ${fileList.length} 个文件...`, 1);
        setUploadVisible(false);
      }
      return false; 
    },
    showUploadList: false
  };

  // -- Render Components --
  const renderProviderTab = () => {
    const rawData = providersData as any;
    const providers = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.results || []);
    const columns = [
      { title: t('ai.settings.providerName'), dataIndex: 'name', key: 'name' },
      { 
        title: t('ai.settings.providerType'), dataIndex: 'provider_type', key: 'provider_type',
        render: (type: string) => {
          const colorMap: Record<string, string> = { openai: 'green', deepseek: 'cyan', ollama: 'blue', local: 'purple', anthropic: 'volcano', zhipu: 'orange' };
          return <Tag color={colorMap[type] || 'default'}>{type.toUpperCase()}</Tag>;
        }
      },
      { title: t('ai.settings.apiUrl'), dataIndex: 'base_url', key: 'base_url', ellipsis: true },
      { title: t('common.status'), dataIndex: 'is_active', key: 'is_active', render: (active: boolean) => <Switch checked={active} size="small" disabled /> },
      {
        title: t('common.action'), key: 'action', width: 200,
        render: (_: any, record: AIProvider) => (
          <Space wrap>
            <Button size="small" icon={<ApiOutlined />} loading={syncModelsMutation.isPending && syncModelsMutation.variables === record.id} onClick={() => syncModelsMutation.mutate(record.id)}>{t('ai.settings.syncModels')}</Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditProvider(record)} />
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => { Modal.confirm({ title: t('ai.settings.confirmDelete'), onOk: () => deleteAIProvider(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['aiProviders'] })) }); }} />
          </Space>
        ),
      },
    ];
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center"><Text type="secondary">{t('ai.settings.providerTip')}</Text><Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditProvider()}>{t('ai.settings.addProvider')}</Button></div>
        <Table dataSource={providers} columns={columns} rowKey="id" loading={providersLoading} pagination={{ size: 'small' }} />
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
      { title: t('ai.settings.modelType'), dataIndex: 'model_type', key: 'model_type', render: (type: string) => (<Tag color={type === 'llm' ? 'gold' : 'magenta'}>{type === 'llm' ? t('ai.settings.llm') : t('ai.settings.embedding')}</Tag>) },
      {
        title: t('common.action'), key: 'action', width: 120,
        render: (_: any, record: AIModel) => (
          <Space wrap><Button size="small" icon={<EditOutlined />} onClick={() => handleEditModel(record)} /><Button size="small" danger icon={<DeleteOutlined />} onClick={() => { Modal.confirm({ title: t('ai.settings.confirmDelete'), onOk: () => deleteAIModel(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['aiModels'] })) }); }} /></Space>
        ),
      },
    ];
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center"><Text type="secondary">{t('ai.settings.modelTip')}</Text><Button type="primary" icon={<PlusOutlined />} onClick={() => handleEditModel()}>{t('ai.settings.addModel')}</Button></div>
        <Table dataSource={models} columns={columns} rowKey="id" loading={modelsLoading} pagination={{ size: 'small' }} />
      </div>
    );
  };

  const renderKnowledgeTab = () => {
    const rawData = kbData as any;
    const kbs = Array.isArray(rawData) ? rawData : (rawData?.data || rawData?.results || []);
    const isEn = i18n.language.startsWith('en');
    const columns = [
      { title: t('ai.settings.kbName'), key: 'name', width: 150, render: (_: any, record: KnowledgeBase) => (<span>{isEn ? (record.name_en || record.name) : record.name}</span>) },
      { title: t('ai.settings.kbDesc'), key: 'description', width: 200, ellipsis: true, render: (_: any, record: KnowledgeBase) => (<span title={isEn ? (record.description_en || record.description) : record.description}>{isEn ? (record.description_en || record.description) : record.description}</span>) },
      { 
        title: t('ai.settings.retrievalStrategy'), 
        key: "retrieval", 
        width: 150, 
        render: () => (
          <Tooltip title={`BM25 (${configData?.rag_bm25_weight ?? 0.3}) + Vector (${configData?.rag_vector_weight ?? 0.7}) 混合加权`}>
            <Tag color="geekblue" icon={<SyncOutlined spin />}>{t('ai.settings.hybridSearch')}</Tag>
          </Tooltip>
        ) 
      },
      { title: t('ai.settings.kbCollection'), dataIndex: 'collection_name', key: 'collection_name', width: 150 },
      {
        title: t('common.action'), key: 'action', width: 450,
        render: (_: any, record: KnowledgeBase) => (
          <Space size="small" wrap>
            <Button size="small" icon={<DatabaseOutlined />} onClick={() => { setSelectedKB(record); setIsDocDrawerOpen(true); }}>{t('ai.settings.docManagement')}</Button>
            <Button size="small" icon={<BugOutlined />} onClick={() => { setSelectedKB(record); setIsPlaygroundOpen(true); setSearchResults([]); setSearchQuery(""); }}>Playground</Button>
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingKB(record); kbForm.setFieldsValue(record); setIsKBModalOpen(true); }} />
            <Button size="small" icon={<SyncOutlined />} loading={reindexMutation.isPending && reindexMutation.variables === record.id} onClick={() => reindexMutation.mutate(record.id)}>{t('ai.settings.reindex')}</Button>
          </Space>
        ),
      },
    ];
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center"><Text type="secondary">{t('ai.settings.kbDescription')}</Text><Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingKB(null); kbForm.resetFields(); setIsKBModalOpen(true); }}>{t('ai.settings.addKnowledgeBase')}</Button></div>
        <Table dataSource={kbs} columns={columns} rowKey="id" loading={kbLoading} pagination={{ size: 'small' }} scroll={{ x: 1000 }} />

        {/* KB Playgound Drawer */}
        <Drawer
          title={
            <Space>
              <BugOutlined style={{ color: '#fa8c16' }} />
              <span>检索调试工作台 (Search Playground) - {selectedKB?.name}</span>
            </Space>
          }
          width={800}
          onClose={() => setIsPlaygroundOpen(false)}
          open={isPlaygroundOpen}
        >
          <div className="space-y-6">
            <Alert message="提示" description="在此处输入您想要测试的问题，系统将展示基于混合检索（BM25 + Vector）命中的 TOP-K 分块内容。" type="info" showIcon />
            <div className="flex gap-2">
              <Input.Search 
                placeholder="输入测试问题，如：如何处理 CPU 负载过高？" 
                enterButton={<Button type="primary" icon={<SearchOutlined />}>开始检索</Button>}
                size="large"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onSearch={val => selectedKB && searchMutation.mutate({ kbId: selectedKB.id, query: val })}
                loading={searchMutation.isPending}
              />
            </div>

            <List
              header={<div className="font-semibold text-gray-500">检索命中结果 ({searchResults.length})</div>}
              loading={searchMutation.isPending}
              dataSource={searchResults}
              locale={{ emptyText: <Empty description="暂无检索结果，请先输入 Query" /> }}
              renderItem={(item) => (
                <List.Item>
                  <Card size="small" className="w-full border-l-4 border-l-blue-500 shadow-sm" 
                    title={
                      <div className="flex justify-between items-center">
                        <Space>
                          <Tag color="blue">Rank #{item.index}</Tag>
                          {item.score && <Tag color="orange">{t('ai.settings.searchScore')}: {item.score}</Tag>}
                        </Space>
                        <Text type="secondary" className="text-[10px]">
                          <Tag icon={<FileTextOutlined />} style={{ border: 'none', background: 'transparent' }}>
                            {item.source} (ID: {item.metadata?.document_id || 'N/A'})
                          </Tag>
                        </Text>
                      </div>
                    }
                  >
                    <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700 m-0">{item.content}</pre>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                       {Object.entries(item.metadata).map(([k, v]: [string, any]) => (
                         <Tag key={k} style={{ fontSize: '10px' }}>{k}: {String(v)}</Tag>
                       ))}
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          </div>
        </Drawer>

        <Modal title={editingKB ? t('ai.settings.editKnowledgeBase') : t('ai.settings.addKnowledgeBase')} open={isKBModalOpen} onOk={() => kbForm.submit()} onCancel={() => { setIsKBModalOpen(false); setEditingKB(null); }} confirmLoading={kbMutation.isPending}><Form form={kbForm} layout="vertical" onFinish={kbMutation.mutate}><Form.Item name="name" label={t('ai.settings.kbNameCN')} rules={[{ required: true }]}><Input placeholder={t('ai.settings.kbNamePlaceholder')} /></Form.Item><Form.Item name="name_en" label={t('ai.settings.kbNameEn')}><Input placeholder="English Name" /></Form.Item><Form.Item name="collection_name" label={t('ai.settings.kbCollection')} rules={[{ required: true }]}><Input placeholder={t('ai.settings.kbCollectionPlaceholder')} readOnly={!!editingKB} /></Form.Item><Form.Item name="description" label={t('ai.settings.kbDescCN')}><Input.TextArea placeholder={t('ai.settings.kbDescPlaceholder')} /></Form.Item><Form.Item name="description_en" label={t('ai.settings.kbDescEn')}><Input.TextArea placeholder="English Description" /></Form.Item></Form></Modal>

        {/* Document Management Drawer */}
        <Drawer title={`${t('ai.settings.docManagement')} - ${isEn ? (selectedKB?.name_en || selectedKB?.name) : selectedKB?.name}`} width={900} onClose={() => setIsDocDrawerOpen(false)} open={isDocDrawerOpen} 
          extra={
            <Space>
              <Text type="secondary" style={{ marginRight: 8 }}>
                共 {docsData?.total ?? (Array.isArray((docsData as any)?.data) ? (docsData as any).data.length : 0)} 份文档
              </Text>
              <Button icon={<ReloadOutlined />} onClick={() => refetchDocs()}>{t('common.refresh') || '刷新'}</Button>
              <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>{t('common.upload')}</Button>
            </Space>
          }
        >
          <Table 
            size="small" 
            loading={docsLoading} 
            dataSource={(docsData as any)?.data || (docsData as any)?.results || (Array.isArray(docsData) ? docsData : [])} 
            rowKey="id" 
            columns={[
            { title: t('ai.settings.docTitle'), dataIndex: 'title', key: 'title', ellipsis: true },
            { 
              title: t('common.status'), dataIndex: 'status', key: 'status', width: 100,
              render: (status: string) => {
                const map: any = { pending: { color: 'default', text: '待处理' }, processing: { color: 'processing', text: '处理中' }, ready: { color: 'success', text: '就绪' }, error: { color: 'error', text: '错误' } };
                const config = map[status] || map.ready;
                return <Badge status={config.color} text={config.text} />;
              }
            },
            { title: t('ai.settings.chunkCount'), dataIndex: 'chunk_count', key: 'chunks', width: 80 },
            { 
              title: t('common.action'), key: 'action', width: 300,
              render: (_: any, record: KnowledgeDocument) => (<Space wrap><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setViewingDoc(record)}>{t('ai.settings.docView')}</Button><Button type="link" size="small" icon={<SettingOutlined />} onClick={() => { setPreviewDoc(record); setIsPreviewDrawerOpen(true); }}>{t('ai.settings.cleanPreview')}</Button><Button type="link" size="small" danger onClick={() => { Modal.confirm({ title: t('ai.settings.confirmDelete'), onOk: () => deleteDocMutation.mutate(record.id) }); }}>{t('common.delete')}</Button></Space>)
            }
          ]} />
          <Modal title={t('common.upload')} open={uploadVisible} onCancel={() => setUploadVisible(false)} footer={null}>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件到此区域进行上传</p>
              <p className="ant-upload-hint">
                {t('ai.settings.uploadHint')}
                <br />
                <span className="text-blue-500 font-medium italic">{t('ai.settings.ocrTip')}：</span>
                {t('ai.settings.ocrDescription')}
              </p>
            </Dragger>
          </Modal>
        </Drawer>

        {/* Chunk Cleaning & Preview Drawer */}
        <Drawer title={<Space><SafetyCertificateOutlined /><span>知识清洗工作台: {previewDoc?.title}</span></Space>} width={750} onClose={() => { setIsPreviewDrawerOpen(false); setEditingChunkId(null); }} open={isPreviewDrawerOpen}><Alert message="知识分块管理 (Hybrid Search)" description="此处支持对文档切片进行细粒度管理。禁用或修改分块内容将实时同步至向量库和 BM25 语料库。" type="warning" showIcon style={{ marginBottom: 16 }} /><List loading={chunksLoading} dataSource={chunksData} renderItem={(item: DocumentChunk) => (
          <List.Item><Card size="small" className={`w-full ${!item.is_active ? 'opacity-50 grayscale' : 'bg-gray-50 border-gray-200'}`} title={<div className="flex justify-between items-center text-xs"><Space><Tag color={item.is_active ? "blue" : "default"}>Chunk #{item.index + 1}</Tag>{!item.is_active && <Tag icon={<StopOutlined />}>已禁用</Tag>}</Space><Space>{editingChunkId === item.id ? (<><Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => chunkUpdateMutation.mutate({ id: item.id, content: chunkEditContent })} loading={chunkUpdateMutation.isPending}>保存</Button><Button size="small" onClick={() => setEditingChunkId(null)}>取消</Button></>) : (<><Button size="small" icon={<EditOutlined />} onClick={() => { setEditingChunkId(item.id); setChunkEditContent(item.content); }}>编辑</Button><Switch size="small" checked={item.is_active} onChange={(checked) => chunkUpdateMutation.mutate({ id: item.id, is_active: checked })} loading={chunkUpdateMutation.isPending && chunkUpdateMutation.variables?.id === item.id} /><Popconfirm title="确定彻底删除此知识块？(不可恢复)" onConfirm={() => chunkDeleteMutation.mutate(item.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></>)}</Space></div>}>{editingChunkId === item.id ? (<Input.TextArea rows={6} value={chunkEditContent} onChange={e => setChunkEditContent(e.target.value)} className="text-xs font-sans" />) : (<pre className="text-xs whitespace-pre-wrap font-sans text-gray-700 m-0">{item.content}</pre>)}<div className="mt-2 text-[10px] text-gray-400">Length: {item.content?.length || 0} chars</div></Card></List.Item>
        )} /></Drawer>

        {/* View Document Content Modal */}
        <Modal
          title={viewingDoc?.title}
          open={!!viewingDoc}
          onCancel={() => setViewingDoc(null)}
          footer={[
            <Button key="close" onClick={() => setViewingDoc(null)}>{t('common.close')}</Button>
          ]}
          width={800}
        >
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="mb-4 flex gap-4">
              <Tag icon={<FileTextOutlined />}>{t('ai.settings.docSource')}: {viewingDoc?.source_type}</Tag>
              <Tag>{t('ai.settings.chunkCount')}: {viewingDoc?.chunk_count}</Tag>
            </div>
            <Divider titlePlacement="start">{t('ai.settings.docContent')}</Divider>
            <pre className="whitespace-pre-wrap font-sans text-gray-700 bg-gray-50 p-4 rounded text-sm">
              {viewingDoc?.content || t('common.noData')}
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
      <div className="max-w-4xl space-y-6">
        <Alert message={t('ai.settings.suggestion')} description={t('ai.settings.ragWarning')} type="info" showIcon />
        <Form form={configForm} layout="vertical" onFinish={configMutation.mutate}>
          <Row gutter={24}>
            <Col span={12}>
              <Card size="small" title={t('ai.settings.globalConfig')} className="h-full">
                <Form.Item label={t('ai.settings.defaultLlm')} name="default_llm" tooltip={t('ai.settings.defaultLlmTip')}>
                  <Select placeholder="选择默认 LLM">
                    {llmModels.map(m => (<Select.Option key={m.id} value={m.id}>{m.display_name} ({m.provider_name})</Select.Option>))}
                  </Select>
                </Form.Item>
                <Form.Item label={t('ai.settings.defaultEmbedding')} name="default_embedding" tooltip={t('ai.settings.defaultEmbeddingTip')}>
                  <Select placeholder="选择默认 Embedding">
                    {embModels.map(m => (<Select.Option key={m.id} value={m.id}>{m.display_name} ({m.provider_name})</Select.Option>))}
                  </Select>
                </Form.Item>
              </Card>
            </Col>
            
            <Col span={12}>
              <Card size="small" title="RAG 参数调优 (Advanced Tuning)" className="h-full">
                <Form.Item label={t('ai.settings.ragTopK')} name="rag_top_k" tooltip={t('ai.settings.ragTopKTip')}>
                  <Slider min={1} max={20} marks={{ 1: '1', 5: '5', 10: '10', 20: '20' }} />
                </Form.Item>
                <Form.Item label={t('ai.settings.ragScoreThreshold')} name="rag_score_threshold" tooltip={t('ai.settings.ragScoreThresholdTip')}>
                  <Slider min={0} max={1} step={0.05} marks={{ 0: '0', 0.4: '0.4', 0.6: '0.6', 1: '1' }} />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label={t('ai.settings.ragVectorWeight')} name="rag_vector_weight" tooltip={t('ai.settings.ragWeightTip')}>
                      <Input type="number" step={0.1} min={0} max={1} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label={t('ai.settings.ragBm25_Weight')} name="rag_bm25_weight">
                      <Input type="number" step={0.1} min={0} max={1} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
          
          <Form.Item className="mt-6">
            <Button type="primary" htmlType="submit" loading={configMutation.isPending}>{t('ai.settings.saveConfig')}</Button>
          </Form.Item>
        </Form>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Title level={4}>{t('ai.settings.pageTitle')}</Title>
      <Card><Tabs activeKey={activeTab} onChange={setActiveTab}><Tabs.TabPane tab={<span><SettingOutlined />{t('ai.settings.globalConfig')}</span>} key="config">{renderConfigTab()}</Tabs.TabPane><Tabs.TabPane tab={<span><BookOutlined />{t('ai.settings.knowledgeBase')}</span>} key="knowledge">{renderKnowledgeTab()}</Tabs.TabPane><Tabs.TabPane tab={<span><ApiOutlined />{t('ai.settings.providers')}</span>} key="providers">{renderProviderTab()}</Tabs.TabPane><Tabs.TabPane tab={<span><RocketOutlined />{t('ai.settings.models')}</span>} key="models">{renderModelTab()}</Tabs.TabPane></Tabs></Card>
      <Modal title={editingProvider ? t('ai.settings.editProvider') : t('ai.settings.addProvider')} open={isProviderModalOpen} onCancel={() => setIsProviderModalOpen(false)} onOk={() => providerForm.submit()} confirmLoading={providerMutation.isPending}><Form form={providerForm} layout="vertical" onFinish={providerMutation.mutate}><Form.Item name="name" label={t('ai.settings.providerName')} rules={[{ required: true }]}><Input placeholder="如 DeepSeek 官方" /></Form.Item><Form.Item name="provider_type" label={t('ai.settings.providerType')} rules={[{ required: true }]}><Select onChange={(val) => { if (val === 'local') providerForm.setFieldValue('base_url', 'http://localhost'); }}><Select.Option value="openai">OpenAI</Select.Option><Select.Option value="deepseek">DeepSeek</Select.Option><Select.Option value="anthropic">Anthropic</Select.Option><Select.Option value="ollama">Ollama (Local)</Select.Option><Select.Option value="local">FastEmbed (Local)</Select.Option><Select.Option value="other">Other (OpenAI Compatible)</Select.Option></Select></Form.Item><Form.Item noStyle shouldUpdate={(prev, curr) => prev.provider_type !== curr.provider_type}>{({ getFieldValue }) => (<Form.Item name="base_url" label={t('ai.settings.apiUrl')} rules={[{ required: getFieldValue('provider_type') !== 'local' }]}><Input placeholder={getFieldValue('provider_type') === 'local' ? "本地模式无需配置" : "https://api.deepseek.com"} disabled={getFieldValue('provider_type') === 'local'} /></Form.Item>)}</Form.Item><Form.Item name="api_key" label={t('ai.settings.apiKey')}><Input.Password placeholder="输入 API Key" /></Form.Item><Form.Item name="is_active" label={t('ai.settings.isActive')} valuePropName="checked"><Switch checkedChildren={t('common.active')} unCheckedChildren={t('common.inactive')} /></Form.Item></Form></Modal>
      <Modal title={editingModel ? t('ai.settings.editModel') : t('ai.settings.addModel')} open={isModelModalOpen} onCancel={() => setIsModelModalOpen(false)} onOk={() => modelForm.submit()}><Form form={modelForm} layout="vertical" onFinish={(values) => { const m = editingModel ? updateAIModel(editingModel.id, values) : createAIModel(values); m.then(() => { message.success(t('ai.settings.saveSuccess')); setIsModelModalOpen(false); queryClient.invalidateQueries({ queryKey: ['aiModels'] }); }); }}><Form.Item name="provider" label={t('ai.settings.belongProvider')} rules={[{ required: true }]}><Select placeholder="选择供应商">{(Array.isArray(providersData) ? providersData : (providersData as any)?.data || (providersData as any)?.results || []).map((p: any) => (<Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>))}</Select></Form.Item><Form.Item name="display_name" label={t('ai.settings.displayName')} rules={[{ required: true }]}><Input placeholder="如 DeepSeek Chat V3" /></Form.Item><Form.Item name="name" label={t('ai.settings.modelId')} rules={[{ required: true }]}><Input placeholder="如 deepseek-chat" /></Form.Item><Form.Item name="model_type" label={t('ai.settings.modelType')} rules={[{ required: true }]}><Select><Select.Option value="llm">{t('ai.settings.llm')}</Select.Option><Select.Option value="embedding">{t('ai.settings.embedding')}</Select.Option></Select></Form.Item><Form.Item name="is_active" label={t('ai.settings.isActive')} valuePropName="checked"><Switch checkedChildren={t('common.active')} unCheckedChildren={t('common.inactive')} /></Form.Item></Form></Modal>
    </div>
  );
};

export default AISettings;
