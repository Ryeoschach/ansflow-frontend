import React, { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography
} from 'antd';
import {
  ApiOutlined, CheckCircleOutlined, CloudServerOutlined, CodeOutlined, CopyOutlined,
  DeleteOutlined, EditOutlined, ExperimentOutlined, FileSearchOutlined,
  PlusOutlined, ReloadOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
  AlertRuleTemplate,
  createDiagnosisRun,
  createObservabilityDataSource,
  createObservedService,
  deleteObservabilityDataSource,
  deleteObservedService,
  DiagnosisRun,
  getAlertRuleTemplates,
  getDiagnosisRuns,
  getObservabilityDataSources,
  getObservedServices,
  ObservabilityDataSource,
  ObservedService,
  renderAlertRuleTemplate,
  retryDiagnosisRun,
  testObservabilityDataSource,
  updateObservabilityDataSource,
  updateObservedService,
} from '@/api/sre';
import { getProjects } from '@/api/rbac';
import useAppStore from '@/store/useAppStore';

const { Text, Title } = Typography;
const { TextArea } = Input;

const parseJsonObject = (value?: string) => {
  if (!value?.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON must be an object');
  }
  return parsed;
};

const parseJsonArray = (value?: string) => {
  if (!value?.trim()) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array');
  }
  return parsed;
};

const DiagnosisCenter: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProject } = useAppStore();

  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [datasourceModalOpen, setDatasourceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ObservedService | null>(null);
  const [editingDatasource, setEditingDatasource] = useState<ObservabilityDataSource | null>(null);
  const [selectedRun, setSelectedRun] = useState<DiagnosisRun | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AlertRuleTemplate | null>(null);
  const [renderedRule, setRenderedRule] = useState<any>(null);

  const [diagnosisForm] = Form.useForm();
  const [serviceForm] = Form.useForm();
  const [datasourceForm] = Form.useForm();
  const [ruleForm] = Form.useForm();

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['sre-diagnosis-runs'],
    queryFn: () => getDiagnosisRuns({ page_size: 50 }),
    refetchInterval: 5000,
  });
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['sre-observed-services'],
    queryFn: () => getObservedServices({ page_size: 1000 }),
  });
  const { data: datasources, isLoading: datasourcesLoading } = useQuery({
    queryKey: ['sre-observability-datasources'],
    queryFn: () => getObservabilityDataSources({ page_size: 1000 }),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects-for-diagnosis'],
    queryFn: () => getProjects({ page_size: 1000 }),
  });
  const { data: templates } = useQuery({
    queryKey: ['sre-alert-rule-templates'],
    queryFn: getAlertRuleTemplates,
  });

  const datasourceList = datasources?.data || [];
  const serviceList = services?.data || [];
  const metricDatasources = datasourceList.filter(item => item.type === 'victoriametrics');
  const logDatasources = datasourceList.filter(item => item.type === 'victorialogs');

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: t('diagnosis.status.pending') },
    running: { color: 'processing', text: t('diagnosis.status.running') },
    success: { color: 'success', text: t('diagnosis.status.success') },
    failed: { color: 'error', text: t('diagnosis.status.failed') },
  };

  useEffect(() => {
    const alertId = searchParams.get('alert_id');
    if (!alertId) return;
    diagnosisForm.setFieldsValue({
      alert: Number(alertId),
      trigger_type: 'alert',
      project: currentProject?.id,
      title: searchParams.get('alert_name') || t('diagnosis.alertDiagnosisTitle'),
      diagnosis_time: searchParams.get('time') ? dayjs(searchParams.get('time')) : dayjs(),
      window_minutes: 10,
    });
    setDiagnosisModalOpen(true);
    setSearchParams({});
  }, [searchParams, setSearchParams, diagnosisForm, currentProject?.id, t]);

  const createDiagnosisMutation = useMutation({
    mutationFn: (values: any) => createDiagnosisRun(values),
    onSuccess: () => {
      message.success(t('diagnosis.messages.submitted'));
      setDiagnosisModalOpen(false);
      diagnosisForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['sre-diagnosis-runs'] });
    },
  });

  const serviceMutation = useMutation({
    mutationFn: (values: any) => editingService ? updateObservedService(editingService.id, values) : createObservedService(values),
    onSuccess: () => {
      message.success(editingService ? t('common.updateSuccess') : t('common.createSuccess'));
      setServiceModalOpen(false);
      setEditingService(null);
      serviceForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['sre-observed-services'] });
    },
  });

  const datasourceMutation = useMutation({
    mutationFn: (values: any) => editingDatasource ? updateObservabilityDataSource(editingDatasource.id, values) : createObservabilityDataSource(values),
    onSuccess: () => {
      message.success(editingDatasource ? t('common.updateSuccess') : t('common.createSuccess'));
      setDatasourceModalOpen(false);
      setEditingDatasource(null);
      datasourceForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['sre-observability-datasources'] });
    },
  });

  const ruleRenderMutation = useMutation({
    mutationFn: (values: any) => renderAlertRuleTemplate(selectedTemplate!.id, values),
    onSuccess: setRenderedRule,
  });

  const openServiceModal = (record?: ObservedService) => {
    setEditingService(record || null);
    serviceForm.setFieldsValue(record ? {
      ...record,
      metric_label_selector: JSON.stringify(record.metric_label_selector || {}, null, 2),
      log_label_selector: JSON.stringify(record.log_label_selector || {}, null, 2),
      metric_queries: JSON.stringify(record.metric_queries || [], null, 2),
    } : {
      project: currentProject?.id,
      metric_label_selector: JSON.stringify(currentProject ? { project: currentProject.code } : {}, null, 2),
      log_label_selector: JSON.stringify(currentProject ? { project: currentProject.code } : {}, null, 2),
      metric_queries: JSON.stringify([], null, 2),
      is_active: true,
    });
    setServiceModalOpen(true);
  };

  const openDatasourceModal = (record?: ObservabilityDataSource) => {
    setEditingDatasource(record || null);
    datasourceForm.setFieldsValue(record || {
      type: 'victoriametrics',
      auth_type: 'none',
      timeout_seconds: 10,
      is_active: true,
      is_default: false,
    });
    setDatasourceModalOpen(true);
  };

  const runColumns = [
    { title: t('diagnosis.title'), dataIndex: 'title', render: (text: string, record: DiagnosisRun) => <Button type="link" onClick={() => setSelectedRun(record)}>{text}</Button> },
    { title: t('diagnosis.service'), dataIndex: 'service_name', render: (text: string) => text || '-' },
    { title: t('diagnosis.time'), dataIndex: 'diagnosis_time', render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
    { title: t('diagnosis.window'), dataIndex: 'window_minutes', render: (value: number) => `±${value}m` },
    { title: t('diagnosis.status.label'), dataIndex: 'status', render: (value: string) => <Tag color={statusMap[value]?.color}>{statusMap[value]?.text || value}</Tag> },
    {
      title: t('common.action'),
      render: (_: any, record: DiagnosisRun) => (
        <Space>
          <Button size="small" icon={<FileSearchOutlined />} onClick={() => setSelectedRun(record)}>{t('common.detail')}</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => retryDiagnosisRun(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['sre-diagnosis-runs'] }))}>{t('diagnosis.retry')}</Button>
        </Space>
      ),
    },
  ];

  const serviceColumns = [
    { title: t('diagnosis.service'), dataIndex: 'name' },
    { title: t('diagnosis.code'), dataIndex: 'code' },
    { title: t('diagnosis.project'), dataIndex: 'project_name' },
    { title: t('diagnosis.metricDatasource'), dataIndex: 'metric_datasource_name', render: (text: string) => text || '-' },
    { title: t('diagnosis.logDatasource'), dataIndex: 'log_datasource_name', render: (text: string) => text || '-' },
    { title: t('common.status'), dataIndex: 'is_active', render: (value: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? t('common.enabled') : t('common.disabled')}</Tag> },
    {
      title: t('common.action'),
      render: (_: any, record: ObservedService) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openServiceModal(record)}>{t('common.edit')}</Button>
          <Popconfirm title={t('common.confirmDelete')} onConfirm={() => deleteObservedService(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['sre-observed-services'] }))}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const datasourceColumns = [
    { title: t('diagnosis.datasourceName'), dataIndex: 'name' },
    { title: t('diagnosis.datasourceType'), dataIndex: 'type', render: (value: string) => <Tag color={value === 'victoriametrics' ? 'blue' : 'green'}>{value}</Tag> },
    { title: t('diagnosis.baseUrl'), dataIndex: 'base_url' },
    { title: t('diagnosis.authType'), dataIndex: 'auth_type' },
    { title: t('diagnosis.default'), dataIndex: 'is_default', render: (value: boolean) => value ? <CheckCircleOutlined className="text-green-500" /> : '-' },
    {
      title: t('common.action'),
      render: (_: any, record: ObservabilityDataSource) => (
        <Space>
          <Button size="small" icon={<ExperimentOutlined />} onClick={() => testObservabilityDataSource(record.id).then(res => res.ok ? message.success(t('diagnosis.messages.connectionOk')) : message.error(res.error))}>{t('diagnosis.test')}</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openDatasourceModal(record)}>{t('common.edit')}</Button>
          <Popconfirm title={t('common.confirmDelete')} onConfirm={() => deleteObservabilityDataSource(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['sre-observability-datasources'] }))}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const templateColumns = [
    { title: t('diagnosis.templateName'), dataIndex: 'name' },
    { title: t('diagnosis.category'), dataIndex: 'category', render: (value: string) => <Tag>{value}</Tag> },
    { title: t('common.description'), dataIndex: 'description' },
    {
      title: t('common.action'),
      render: (_: any, record: AlertRuleTemplate) => (
        <Button
          size="small"
          icon={<CodeOutlined />}
          onClick={() => {
            setSelectedTemplate(record);
            ruleForm.setFieldsValue(record.variables);
            setRenderedRule(null);
          }}
        >
          {t('diagnosis.renderRule')}
        </Button>
      ),
    },
  ];

  const projectOptions = useMemo(() => (projects?.data || []).map((item: any) => ({ value: item.id, label: `${item.name} (${item.code})` })), [projects]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <Title level={3} className="m-0!">{t('diagnosis.pageTitle')}</Title>
          <Text type="secondary">{t('diagnosis.pageSubtitle')}</Text>
        </div>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => {
          diagnosisForm.setFieldsValue({ project: currentProject?.id, diagnosis_time: dayjs(), window_minutes: 10, trigger_type: 'manual' });
          setDiagnosisModalOpen(true);
        }}>{t('diagnosis.create')}</Button>
      </div>

      <Card>
        <Tabs
          items={[
            {
              key: 'runs',
              label: <Space><FileSearchOutlined />{t('diagnosis.tabs.runs')}</Space>,
              children: <Table rowKey="id" loading={runsLoading} columns={runColumns as any} dataSource={runs?.data || []} pagination={{ total: runs?.total }} />,
            },
            {
              key: 'services',
              label: <Space><CloudServerOutlined />{t('diagnosis.tabs.services')}</Space>,
              children: (
                <Space direction="vertical" className="w-full">
                  <Button icon={<PlusOutlined />} onClick={() => openServiceModal()}>{t('diagnosis.addService')}</Button>
                  <Table rowKey="id" loading={servicesLoading} columns={serviceColumns as any} dataSource={serviceList} />
                </Space>
              ),
            },
            {
              key: 'datasources',
              label: <Space><ApiOutlined />{t('diagnosis.tabs.datasources')}</Space>,
              children: (
                <Space direction="vertical" className="w-full">
                  <Button icon={<PlusOutlined />} onClick={() => openDatasourceModal()}>{t('diagnosis.addDatasource')}</Button>
                  <Table rowKey="id" loading={datasourcesLoading} columns={datasourceColumns as any} dataSource={datasourceList} />
                </Space>
              ),
            },
            {
              key: 'rules',
              label: <Space><CodeOutlined />{t('diagnosis.tabs.rules')}</Space>,
              children: <Table rowKey="id" columns={templateColumns as any} dataSource={templates || []} />,
            },
          ]}
        />
      </Card>

      <Modal
        title={t('diagnosis.create')}
        open={diagnosisModalOpen}
        onCancel={() => setDiagnosisModalOpen(false)}
        onOk={() => diagnosisForm.submit()}
        confirmLoading={createDiagnosisMutation.isPending}
      >
        <Form form={diagnosisForm} layout="vertical" onFinish={(values) => {
          createDiagnosisMutation.mutate({
            ...values,
            diagnosis_time: values.diagnosis_time?.toISOString(),
          });
        }}>
          <Form.Item name="title" label={t('diagnosis.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="project" label={t('diagnosis.project')}>
            <Select options={projectOptions} allowClear />
          </Form.Item>
          <Form.Item name="service" label={t('diagnosis.service')} rules={[{ required: true }]}>
            <Select options={serviceList.map(item => ({ value: item.id, label: `${item.name} (${item.code})` }))} />
          </Form.Item>
          <Form.Item name="diagnosis_time" label={t('diagnosis.time')} rules={[{ required: true }]}>
            <DatePicker showTime className="w-full" />
          </Form.Item>
          <Form.Item name="window_minutes" label={t('diagnosis.window')} rules={[{ required: true }]}>
            <InputNumber min={1} max={120} className="w-full" />
          </Form.Item>
          <Form.Item name="alert" hidden><InputNumber /></Form.Item>
          <Form.Item name="trigger_type" hidden><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingService ? t('diagnosis.editService') : t('diagnosis.addService')}
        open={serviceModalOpen}
        onCancel={() => setServiceModalOpen(false)}
        onOk={() => serviceForm.submit()}
        confirmLoading={serviceMutation.isPending}
        width={760}
      >
        <Form form={serviceForm} layout="vertical" onFinish={(values) => {
          try {
            serviceMutation.mutate({
              ...values,
              metric_label_selector: parseJsonObject(values.metric_label_selector),
              log_label_selector: parseJsonObject(values.log_label_selector),
              metric_queries: parseJsonArray(values.metric_queries),
            });
          } catch (err: any) {
            message.error(err.message);
          }
        }}>
          <Space className="w-full" align="start">
            <Form.Item name="name" label={t('diagnosis.service')} rules={[{ required: true }]} className="flex-1"><Input /></Form.Item>
            <Form.Item name="code" label={t('diagnosis.code')} rules={[{ required: true }]} className="flex-1"><Input /></Form.Item>
          </Space>
          <Form.Item name="project" label={t('diagnosis.project')} rules={[{ required: true }]}><Select options={projectOptions} /></Form.Item>
          <Space className="w-full" align="start">
            <Form.Item name="metric_datasource" label={t('diagnosis.metricDatasource')} className="flex-1"><Select allowClear options={metricDatasources.map(item => ({ value: item.id, label: item.name }))} /></Form.Item>
            <Form.Item name="log_datasource" label={t('diagnosis.logDatasource')} className="flex-1"><Select allowClear options={logDatasources.map(item => ({ value: item.id, label: item.name }))} /></Form.Item>
          </Space>
          <Form.Item name="namespace" label={t('diagnosis.namespace')}><Input /></Form.Item>
          <Form.Item name="metric_label_selector" label={t('diagnosis.metricLabels')}><TextArea rows={4} /></Form.Item>
          <Form.Item name="log_label_selector" label={t('diagnosis.logLabels')}><TextArea rows={4} /></Form.Item>
          <Form.Item name="metric_queries" label={t('diagnosis.metricQueries')}><TextArea rows={4} /></Form.Item>
          <Form.Item name="log_query" label={t('diagnosis.logQuery')}><TextArea rows={3} /></Form.Item>
          <Form.Item name="is_active" valuePropName="checked"><Switch /> {t('common.enabled')}</Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingDatasource ? t('diagnosis.editDatasource') : t('diagnosis.addDatasource')}
        open={datasourceModalOpen}
        onCancel={() => setDatasourceModalOpen(false)}
        onOk={() => datasourceForm.submit()}
        confirmLoading={datasourceMutation.isPending}
      >
        <Form form={datasourceForm} layout="vertical" onFinish={datasourceMutation.mutate}>
          <Form.Item name="name" label={t('diagnosis.datasourceName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label={t('diagnosis.datasourceType')} rules={[{ required: true }]}>
            <Select options={[{ value: 'victoriametrics', label: 'VictoriaMetrics' }, { value: 'victorialogs', label: 'VictoriaLogs' }]} />
          </Form.Item>
          <Form.Item name="base_url" label={t('diagnosis.baseUrl')} rules={[{ required: true }]}><Input placeholder="http://victoriametrics:8428" /></Form.Item>
          <Form.Item name="auth_type" label={t('diagnosis.authType')}><Select options={[{ value: 'none', label: 'None' }, { value: 'bearer', label: 'Bearer Token' }, { value: 'basic', label: 'Basic Auth' }]} /></Form.Item>
          <Form.Item name="username" label={t('diagnosis.username')}><Input /></Form.Item>
          <Form.Item name="password" label={t('diagnosis.password')}><Input.Password placeholder={editingDatasource?.has_password ? t('diagnosis.keepSecret') : undefined} /></Form.Item>
          <Form.Item name="token" label="Token"><TextArea rows={3} placeholder={editingDatasource?.has_token ? t('diagnosis.keepSecret') : undefined} /></Form.Item>
          <Form.Item name="timeout_seconds" label={t('diagnosis.timeout')}><InputNumber min={1} max={120} className="w-full" /></Form.Item>
          <Form.Item name="is_default" valuePropName="checked"><Switch /> {t('diagnosis.default')}</Form.Item>
          <Form.Item name="is_active" valuePropName="checked"><Switch /> {t('common.enabled')}</Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedTemplate?.name}
        open={!!selectedTemplate}
        onCancel={() => setSelectedTemplate(null)}
        footer={null}
        width={820}
      >
        {selectedTemplate && (
          <Space direction="vertical" className="w-full">
            <Form form={ruleForm} layout="vertical" onFinish={ruleRenderMutation.mutate}>
              {Object.keys(selectedTemplate.variables).map(key => (
                <Form.Item key={key} name={key} label={key} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              ))}
              <Button type="primary" htmlType="submit" loading={ruleRenderMutation.isPending}>{t('diagnosis.renderRule')}</Button>
            </Form>
            {renderedRule && (
              <>
                <Text strong>{t('diagnosis.vmalertYaml')}</Text>
                <TextArea value={renderedRule.yaml} rows={14} readOnly />
                <Button icon={<CopyOutlined />} onClick={() => navigator.clipboard.writeText(renderedRule.yaml)}>{t('common.copy')}</Button>
                <Descriptions size="small" bordered>
                  <Descriptions.Item label="Alertmanager Webhook">{renderedRule.alertmanager_webhook_example}</Descriptions.Item>
                </Descriptions>
              </>
            )}
          </Space>
        )}
      </Modal>

      <Drawer
        title={selectedRun?.title}
        open={!!selectedRun}
        width={860}
        onClose={() => setSelectedRun(null)}
      >
        {selectedRun && (
          <Space direction="vertical" className="w-full">
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('diagnosis.status.label')}><Tag color={statusMap[selectedRun.status]?.color}>{statusMap[selectedRun.status]?.text}</Tag></Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.service')}>{selectedRun.service_name || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.time')}>{dayjs(selectedRun.diagnosis_time).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.error')}>{selectedRun.error_message || '-'}</Descriptions.Item>
            </Descriptions>
            <Card title={t('diagnosis.aiResult')}>
              {selectedRun.ai_result ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedRun.ai_result}</ReactMarkdown> : <Text type="secondary">{t('common.noData')}</Text>}
            </Card>
            <Card title={t('diagnosis.contextSnapshot')}>
              <TextArea rows={12} readOnly value={JSON.stringify(selectedRun.context_snapshot || {}, null, 2)} />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default DiagnosisCenter;
