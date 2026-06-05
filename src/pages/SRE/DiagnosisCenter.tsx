import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  Collapse, Modal, Popconfirm, Select, Space, Switch, Table, Tabs, Tag, Typography
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
  copyDiagnosisTemplate,
  createDiagnosisRun,
  createDiagnosisTemplate,
  createObservabilityDataSource,
  createObservedService,
  deleteDiagnosisTemplate,
  deleteObservabilityDataSource,
  deleteObservedService,
  DiagnosisRun,
  DiagnosisTemplate,
  getDiagnosisTemplates,
  getAlertRuleTemplates,
  getDiagnosisRuns,
  getObservabilityDataSourceCapabilities,
  getObservabilityDataSources,
  getObservedServices,
  matchObservedServiceForAlert,
  ObservabilityDataSource,
  ObservedService,
  previewObservedServiceLogs,
  previewObservedServiceMetrics,
  renderAlertRuleTemplate,
  retryDiagnosisRun,
  testObservabilityDataSource,
  updateDiagnosisTemplate,
  updateObservabilityDataSource,
  updateObservedService,
} from '@/api/sre';
import { getProjects } from '@/api/rbac';
import useAppStore from '@/store/useAppStore';

const { Text, Title } = Typography;
const { TextArea } = Input;

const datasourceProviderOptions = [
  { value: 'victoriametrics', label: 'VictoriaMetrics', kind: 'metric' },
  { value: 'victorialogs', label: 'VictoriaLogs', kind: 'log' },
  { value: 'elasticsearch', label: 'Elasticsearch', kind: 'log' },
  { value: 'loki', label: 'Loki', kind: 'log' },
  { value: 'generic_http', label: 'Generic HTTP', kind: 'log' },
  { value: 'aliyun_sls', label: 'Aliyun SLS', kind: 'log' },
  { value: 'tencent_cls', label: 'Tencent CLS', kind: 'log' },
];

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

const defaultDiagnosisTemplateContent = {
  target_type: 'pipeline_run',
  context_collection: {
    pipeline_run: true,
    failed_nodes: true,
    node_logs: true,
    approval_records: true,
    related_alerts: true,
    service_logs: false,
    metrics: false,
    ansible_execution: false,
    ansible_task_logs: false,
  },
  log_keywords: ['error', 'failed', 'exception', 'timeout'],
  prompt_template: '{prefix}\n请基于以下 CI/CD 诊断上下文输出诊断结论、证据引用和处置建议：\n{diagnosis_context}',
  report_schema: { evidence_required: true },
};

const templateCollectionKeys = [
  'pipeline_run',
  'failed_nodes',
  'node_logs',
  'approval_records',
  'related_alerts',
  'service_logs',
  'metrics',
  'ansible_execution',
  'ansible_task_logs',
];

const normalizeTemplateContent = (content?: Record<string, any>) => ({
  ...defaultDiagnosisTemplateContent,
  ...(content || {}),
  context_collection: {
    ...defaultDiagnosisTemplateContent.context_collection,
    ...((content || {}).context_collection || {}),
  },
  log_keywords: Array.isArray((content || {}).log_keywords)
    ? (content || {}).log_keywords
    : defaultDiagnosisTemplateContent.log_keywords,
  report_schema: {
    ...defaultDiagnosisTemplateContent.report_schema,
    ...((content || {}).report_schema || {}),
  },
});

const splitKeywordText = (value?: string) => (value || '')
  .split(/[\n,，]/)
  .map(item => item.trim())
  .filter(Boolean);

const buildDiagnosisTemplateContent = (values: any) => {
  const advancedContent = values.content ? parseJsonObject(values.content) : {};
  const reportSchema = values.report_schema ? parseJsonObject(values.report_schema) : {};
  const contextCollection = templateCollectionKeys.reduce((acc, key) => ({
    ...acc,
    [key]: !!values[`collect_${key}`],
  }), {});
  const logKeywords = splitKeywordText(values.log_keywords_text);

  return {
    ...advancedContent,
    target_type: values.target_type,
    context_collection: contextCollection,
    log_keywords: logKeywords.length ? logKeywords : defaultDiagnosisTemplateContent.log_keywords,
    prompt_template: values.prompt_template,
    report_schema: reportSchema,
  };
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
  const [diagnosisTemplateModalOpen, setDiagnosisTemplateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ObservedService | null>(null);
  const [editingDatasource, setEditingDatasource] = useState<ObservabilityDataSource | null>(null);
  const [editingDiagnosisTemplate, setEditingDiagnosisTemplate] = useState<DiagnosisTemplate | null>(null);
  const [selectedRun, setSelectedRun] = useState<DiagnosisRun | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<AlertRuleTemplate | null>(null);
  const [renderedRule, setRenderedRule] = useState<any>(null);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [serviceMatchCandidates, setServiceMatchCandidates] = useState<any[]>([]);
  const [serviceMatchWarnings, setServiceMatchWarnings] = useState<string[]>([]);
  const [handledPrefillQuery, setHandledPrefillQuery] = useState<string | null>(null);
  const [hasActivePrefillQuery, setHasActivePrefillQuery] = useState(false);

  const [diagnosisForm] = Form.useForm();
  const [serviceForm] = Form.useForm();
  const [datasourceForm] = Form.useForm();
  const [diagnosisTemplateForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const selectedDiagnosisTemplateId = Form.useWatch('template', diagnosisForm);
  const datasourceKind = Form.useWatch('kind', datasourceForm);
  const datasourceProvider = Form.useWatch('provider', datasourceForm);

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
  const { data: datasourceCapabilities } = useQuery({
    queryKey: ['sre-observability-datasource-capabilities'],
    queryFn: getObservabilityDataSourceCapabilities,
  });
  const { data: projects } = useQuery({
    queryKey: ['projects-for-diagnosis'],
    queryFn: () => getProjects({ page_size: 1000 }),
  });
  const { data: templates } = useQuery({
    queryKey: ['sre-alert-rule-templates'],
    queryFn: getAlertRuleTemplates,
  });
  const { data: diagnosisTemplates, isLoading: diagnosisTemplatesLoading } = useQuery({
    queryKey: ['sre-diagnosis-templates', currentProject?.id],
    queryFn: () => getDiagnosisTemplates({ page_size: 1000, project: currentProject?.id, include_inactive: true }),
  });

  const datasourceList = datasources?.data || [];
  const serviceList = services?.data || [];
  const diagnosisTemplateList = diagnosisTemplates?.data || [];
  const selectedDiagnosisTemplate = diagnosisTemplateList.find(item => item.id === selectedDiagnosisTemplateId);
  const selectedTemplateTargetType = selectedDiagnosisTemplate?.content?.target_type;
  const metricDatasources = datasourceList.filter(item => item.kind === 'metric' || item.type === 'victoriametrics');
  const logDatasources = datasourceList.filter(item => item.kind === 'log' || item.type === 'victorialogs');
  const providerOptions = datasourceCapabilities
    ? Object.entries(datasourceCapabilities).map(([value, item]) => ({ value, label: item.label || value, kind: item.kind }))
    : datasourceProviderOptions;
  const filteredProviderOptions = providerOptions.filter(item => !datasourceKind || item.kind === datasourceKind);
  const selectedDatasourceCapability = datasourceProvider && datasourceCapabilities?.[datasourceProvider as keyof typeof datasourceCapabilities];

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: t('diagnosis.status.pending') },
    running: { color: 'processing', text: t('diagnosis.status.running') },
    success: { color: 'success', text: t('diagnosis.status.success') },
    failed: { color: 'error', text: t('diagnosis.status.failed') },
  };

  useEffect(() => {
    const alertId = searchParams.get('alert_id');
    if (!alertId) return;
    setServiceMatchCandidates([]);
    setServiceMatchWarnings([]);
    diagnosisForm.setFieldsValue({
      alert: Number(alertId),
      trigger_type: 'alert',
      project: currentProject?.id,
      title: searchParams.get('alert_name') || t('diagnosis.alertDiagnosisTitle'),
      diagnosis_time: searchParams.get('time') ? dayjs(searchParams.get('time')) : dayjs(),
      window_minutes: 10,
    });
    setDiagnosisModalOpen(true);
    matchObservedServiceForAlert({ alert_id: Number(alertId), project: currentProject?.id })
      .then((result) => {
        setServiceMatchCandidates(result.candidates || []);
        setServiceMatchWarnings(result.warnings || []);
        if (result.best_match) {
          diagnosisForm.setFieldsValue({ service: result.best_match.id });
          message.success(t('diagnosis.messages.serviceMatched', { service: result.best_match.name }));
        }
      })
      .catch((err) => {
        setServiceMatchWarnings([err?.message || t('diagnosis.messages.serviceMatchFailed')]);
      });
    setSearchParams({});
  }, [searchParams, setSearchParams, diagnosisForm, currentProject?.id, t, message]);

  useEffect(() => {
    const runId = searchParams.get('run_id');
    if (!runId) return;
    const run = (runs?.data || []).find(item => String(item.id) === String(runId));
    if (!run) return;
    setSelectedRun(run);
    setSearchParams({});
  }, [searchParams, setSearchParams, runs?.data]);

  useEffect(() => {
    const templateCode = searchParams.get('template_code');
    if (!templateCode) return;
    const queryKey = searchParams.toString();
    if (handledPrefillQuery === queryKey) return;
    const template = diagnosisTemplateList.find(item => item.code === templateCode && item.is_active);
    if (!template) return;
    setServiceMatchCandidates([]);
    setServiceMatchWarnings([]);
    diagnosisForm.setFieldsValue({
      title: searchParams.get('title') || template.name,
      project: currentProject?.id,
      template: template.id,
      pipeline_run_id: searchParams.get('pipeline_run_id') ? Number(searchParams.get('pipeline_run_id')) : undefined,
      pipeline_node_run_id: searchParams.get('pipeline_node_run_id') ? Number(searchParams.get('pipeline_node_run_id')) : undefined,
      ansible_execution_id: searchParams.get('ansible_execution_id') ? Number(searchParams.get('ansible_execution_id')) : undefined,
      diagnosis_time: dayjs(),
      window_minutes: 10,
      trigger_type: 'manual',
    });
    setHandledPrefillQuery(queryKey);
    setHasActivePrefillQuery(true);
    setDiagnosisModalOpen(true);
  }, [searchParams, handledPrefillQuery, diagnosisTemplateList, diagnosisForm, currentProject?.id]);

  const closeDiagnosisModal = () => {
    setDiagnosisModalOpen(false);
    if (hasActivePrefillQuery) {
      setSearchParams({});
      setHasActivePrefillQuery(false);
      setHandledPrefillQuery(null);
    }
  };

  const createDiagnosisMutation = useMutation({
    mutationFn: (values: any) => createDiagnosisRun(values),
    onSuccess: () => {
      message.success(t('diagnosis.messages.submitted'));
      closeDiagnosisModal();
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

  const diagnosisTemplateMutation = useMutation({
    mutationFn: (values: any) => editingDiagnosisTemplate
      ? updateDiagnosisTemplate(editingDiagnosisTemplate.id, values)
      : createDiagnosisTemplate(values),
    onSuccess: () => {
      message.success(editingDiagnosisTemplate ? t('common.updateSuccess') : t('common.createSuccess'));
      setDiagnosisTemplateModalOpen(false);
      setEditingDiagnosisTemplate(null);
      diagnosisTemplateForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['sre-diagnosis-templates'] });
    },
  });

  const previewLogsMutation = useMutation({
    mutationFn: (serviceId: number) => previewObservedServiceLogs(serviceId, { window_minutes: 10, limit: 5 }),
    onSuccess: setPreviewResult,
    onError: (err: any) => message.error(err?.message || t('diagnosis.messages.previewFailed')),
  });

  const previewMetricsMutation = useMutation({
    mutationFn: (serviceId: number) => previewObservedServiceMetrics(serviceId, { window_minutes: 10, step: '60s' }),
    onSuccess: setPreviewResult,
    onError: (err: any) => message.error(err?.message || t('diagnosis.messages.previewFailed')),
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
    datasourceForm.setFieldsValue(record ? {
      ...record,
      query_config: JSON.stringify(record.query_config || {}, null, 2),
      field_mapping: JSON.stringify(record.field_mapping || {}, null, 2),
      response_mapping: JSON.stringify(record.response_mapping || {}, null, 2),
    } : {
      kind: 'metric',
      provider: 'victoriametrics',
      type: 'victoriametrics',
      query_config: JSON.stringify({}, null, 2),
      field_mapping: JSON.stringify({}, null, 2),
      response_mapping: JSON.stringify({}, null, 2),
      auth_type: 'none',
      timeout_seconds: 10,
      is_active: true,
      is_default: false,
    });
    setDatasourceModalOpen(true);
  };

  const openDiagnosisTemplateModal = (record?: DiagnosisTemplate) => {
    setEditingDiagnosisTemplate(record || null);
    const content = normalizeTemplateContent(record?.content);
    const collectionValues = templateCollectionKeys.reduce((acc, key) => ({
      ...acc,
      [`collect_${key}`]: content.context_collection?.[key],
    }), {});
    diagnosisTemplateForm.setFieldsValue(record ? {
      ...record,
      target_type: content.target_type,
      ...collectionValues,
      log_keywords_text: (content.log_keywords || []).join('\n'),
      prompt_template: content.prompt_template,
      report_schema: JSON.stringify(content.report_schema || {}, null, 2),
      content: JSON.stringify(content || {}, null, 2),
    } : {
      scope: currentProject?.id ? 'project' : 'global',
      project: currentProject?.id,
      category: 'ci_cd',
      target_type: defaultDiagnosisTemplateContent.target_type,
      ...templateCollectionKeys.reduce((acc, key) => ({
        ...acc,
        [`collect_${key}`]: defaultDiagnosisTemplateContent.context_collection[key as keyof typeof defaultDiagnosisTemplateContent.context_collection],
      }), {}),
      log_keywords_text: defaultDiagnosisTemplateContent.log_keywords.join('\n'),
      prompt_template: defaultDiagnosisTemplateContent.prompt_template,
      report_schema: JSON.stringify(defaultDiagnosisTemplateContent.report_schema, null, 2),
      content: JSON.stringify(defaultDiagnosisTemplateContent, null, 2),
      is_active: true,
    });
    setDiagnosisTemplateModalOpen(true);
  };

  const syncDiagnosisTemplateContent = (changedValues: any, allValues: any) => {
    if (Object.prototype.hasOwnProperty.call(changedValues, 'content')) {
      return;
    }
    try {
      const content = buildDiagnosisTemplateContent(allValues);
      diagnosisTemplateForm.setFieldValue('content', JSON.stringify(content, null, 2));
    } catch {
      // Keep the user's in-progress JSON text intact until it becomes valid again.
    }
  };

  const applyDatasourceCapability = (provider?: string) => {
    const capability = provider ? datasourceCapabilities?.[provider as keyof typeof datasourceCapabilities] : undefined;
    if (!capability) return;
    datasourceForm.setFieldsValue({
      kind: capability.kind,
      provider,
      type: provider,
      base_url: datasourceForm.getFieldValue('base_url') || capability.default_base_url,
      query_config: JSON.stringify(capability.query_config || {}, null, 2),
      field_mapping: JSON.stringify(capability.field_mapping || {}, null, 2),
      response_mapping: JSON.stringify(capability.response_mapping || {}, null, 2),
    });
  };

  const runColumns = [
    { title: t('diagnosis.title'), dataIndex: 'title', render: (text: string, record: DiagnosisRun) => <Button type="link" onClick={() => setSelectedRun(record)}>{text}</Button> },
    { title: t('diagnosis.diagnosisTemplate'), dataIndex: 'template_name', render: (text: string) => text || '-' },
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
          <Button
            size="small"
            icon={<FileSearchOutlined />}
            loading={previewLogsMutation.isPending && previewLogsMutation.variables === record.id}
            onClick={() => previewLogsMutation.mutate(record.id)}
          >
            {t('diagnosis.previewLogs')}
          </Button>
          <Button
            size="small"
            icon={<ExperimentOutlined />}
            loading={previewMetricsMutation.isPending && previewMetricsMutation.variables === record.id}
            onClick={() => previewMetricsMutation.mutate(record.id)}
          >
            {t('diagnosis.previewMetrics')}
          </Button>
          <Popconfirm title={t('common.confirmDelete')} onConfirm={() => deleteObservedService(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['sre-observed-services'] }))}>
            <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const datasourceColumns = [
    { title: t('diagnosis.datasourceName'), dataIndex: 'name' },
    { title: t('diagnosis.kind'), dataIndex: 'kind', render: (value: string) => <Tag color={value === 'metric' ? 'blue' : 'green'}>{t(`diagnosis.kinds.${value}`)}</Tag> },
    { title: t('diagnosis.provider'), dataIndex: 'provider', render: (value: string, record: ObservabilityDataSource) => <Tag>{value || record.type}</Tag> },
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

  const diagnosisTemplateColumns = [
    { title: t('diagnosis.templateName'), dataIndex: 'name' },
    { title: t('diagnosis.code'), dataIndex: 'code' },
    { title: t('diagnosis.scope'), dataIndex: 'scope', render: (value: string, record: DiagnosisTemplate) => <Tag color={value === 'global' ? 'blue' : 'purple'}>{record.project_name || t(`diagnosis.scopes.${value}`)}</Tag> },
    { title: t('diagnosis.targetType'), dataIndex: ['content', 'target_type'], render: (value: string) => value || '-' },
    { title: t('common.status'), dataIndex: 'is_active', render: (value: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? t('common.enabled') : t('common.disabled')}</Tag> },
    { title: t('diagnosis.builtin'), dataIndex: 'is_builtin', render: (value: boolean) => value ? <Tag color="gold">{t('diagnosis.builtin')}</Tag> : '-' },
    {
      title: t('common.action'),
      render: (_: any, record: DiagnosisTemplate) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} disabled={record.is_builtin} onClick={() => openDiagnosisTemplateModal(record)}>{t('common.edit')}</Button>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyDiagnosisTemplate(record.id, { project: currentProject?.id, scope: currentProject?.id ? 'project' : 'global' }).then(() => queryClient.invalidateQueries({ queryKey: ['sre-diagnosis-templates'] }))}
          >
            {t('common.copy')}
          </Button>
          <Button
            size="small"
            onClick={() => updateDiagnosisTemplate(record.id, { is_active: !record.is_active }).then(() => queryClient.invalidateQueries({ queryKey: ['sre-diagnosis-templates'] }))}
          >
            {record.is_active ? t('common.inactive') : t('common.active')}
          </Button>
          {!record.is_builtin && (
            <Popconfirm title={t('common.confirmDelete')} onConfirm={() => deleteDiagnosisTemplate(record.id).then(() => queryClient.invalidateQueries({ queryKey: ['sre-diagnosis-templates'] }))}>
              <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const projectOptions = useMemo(() => (projects?.data || []).map((item: any) => ({ value: item.id, label: `${item.name} (${item.code})` })), [projects]);
  const renderCollectionSummary = (run: DiagnosisRun) => {
    const summary = run.context_snapshot?.collection_summary || {};
    const warnings = run.context_snapshot?.warnings || [];
    const rows = ['metrics', 'logs', 'log_highlights', 'ansflow_events', 'ci_cd_context'].map(key => {
      const item = summary[key] || {};
      return {
        key,
        name: t(`diagnosis.contextTypes.${key}`),
        status: item.status || 'skipped',
        datasource: item.datasource?.name || '-',
        provider: item.datasource?.provider || '-',
        count: item.count ?? 0,
        error: item.error,
      };
    });
    const statusColor: Record<string, string> = {
      success: 'success',
      failed: 'error',
      skipped: 'default',
      pending: 'processing',
    };

    return (
      <Space direction="vertical" className="w-full">
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          columns={[
            { title: t('diagnosis.contextType'), dataIndex: 'name' },
            { title: t('diagnosis.status.label'), dataIndex: 'status', render: (value: string) => <Tag color={statusColor[value]}>{t(`diagnosis.collectionStatus.${value}`)}</Tag> },
            { title: t('diagnosis.datasourceName'), dataIndex: 'datasource' },
            { title: t('diagnosis.provider'), dataIndex: 'provider' },
            { title: t('diagnosis.collectedCount'), dataIndex: 'count' },
            { title: t('diagnosis.error'), dataIndex: 'error', render: (value: string) => value || '-' },
          ] as any}
          dataSource={rows}
        />
        {warnings.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message={t('diagnosis.warnings')}
            description={<Space direction="vertical">{warnings.slice(0, 5).map((item: string, index: number) => <Text key={index}>{item}</Text>)}</Space>}
          />
        )}
      </Space>
    );
  };
  const renderLogHighlights = (run: DiagnosisRun) => {
    const highlights = run.context_snapshot?.log_highlights || [];
    if (!highlights.length) {
      return <Text type="secondary">{t('common.noData')}</Text>;
    }
    return (
      <Table
        rowKey={(record: any) => `${record.timestamp || ''}-${record.message || ''}-${record.score || ''}`}
        size="small"
        pagination={false}
        columns={[
          { title: t('diagnosis.time'), dataIndex: 'timestamp', width: 170, render: (value: string) => value || '-' },
          { title: t('diagnosis.level'), dataIndex: 'level', width: 90, render: (value: string) => value ? <Tag color={String(value).toLowerCase().includes('error') ? 'error' : 'warning'}>{value}</Tag> : '-' },
          { title: t('diagnosis.service'), dataIndex: 'service', width: 140, render: (value: string) => value || '-' },
          { title: t('diagnosis.instance'), dataIndex: 'instance', width: 140, render: (value: string) => value || '-' },
          { title: t('diagnosis.matchedKeywords'), dataIndex: 'matched_keywords', width: 180, render: (items: string[]) => (items || []).map(item => <Tag key={item}>{item}</Tag>) },
          { title: t('diagnosis.logMessage'), dataIndex: 'message', render: (value: string) => <Text>{value}</Text> },
        ] as any}
        dataSource={highlights}
      />
    );
  };
  const renderRefTags = (refs?: string[]) => (
    <Space wrap>
      {(refs || []).map(ref => <Tag key={ref} color="blue">{ref}</Tag>)}
    </Space>
  );
  const formatTime = (value?: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
  const renderJsonSummary = (value: any) => {
    if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) return '-';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return <Text code>{text.length > 120 ? `${text.slice(0, 120)}...` : text}</Text>;
  };
  const renderCiCdContext = (run: DiagnosisRun) => {
    const context = run.context_snapshot?.ci_cd_context;
    if (!context || Object.keys(context).length === 0) {
      return null;
    }
    const pipelineRun = context.pipeline_run;
    const failedNodes = context.failed_nodes || [];
    const nodeLogHighlights = context.node_log_highlights || [];
    const ansibleExecution = context.ansible_execution;
    const taskLogHighlights = context.ansible_task_log_highlights || [];
    const approvalRecords = context.approval_records || [];
    const hasContent = pipelineRun || failedNodes.length || nodeLogHighlights.length || ansibleExecution || taskLogHighlights.length || approvalRecords.length;
    if (!hasContent) {
      return null;
    }
    const nodeStatusColor: Record<string, string> = {
      success: 'success',
      failed: 'error',
      running: 'processing',
      waiting: 'purple',
      cancelled: 'default',
      skipped: 'default',
      pending: 'default',
    };

    return (
      <Space direction="vertical" className="w-full" size="middle">
        {pipelineRun && (
          <Descriptions bordered size="small" column={2} title={t('diagnosis.ciCd.pipelineRun')}>
            <Descriptions.Item label={t('diagnosis.pipelineRunId')}>#{pipelineRun.id}</Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.pipeline')}>{pipelineRun.pipeline_name || pipelineRun.pipeline_id || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.status.label')}><Tag color={nodeStatusColor[pipelineRun.status] || 'default'}>{pipelineRun.status || '-'}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.triggerType')}>{pipelineRun.trigger_type || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('common.startTime')}>{formatTime(pipelineRun.start_time || pipelineRun.create_time)}</Descriptions.Item>
            <Descriptions.Item label={t('common.endTime')}>{formatTime(pipelineRun.end_time)}</Descriptions.Item>
          </Descriptions>
        )}

        <Table
          rowKey={(record: any) => String(record.id || record.node_id)}
          size="small"
          pagination={false}
          title={() => t('diagnosis.ciCd.failedNodes')}
          locale={{ emptyText: t('common.noData') }}
          columns={[
            { title: t('diagnosis.nodeName'), dataIndex: 'node_label', width: 160, render: (value: string, record: any) => value || record.node_id || '-' },
            { title: t('diagnosis.nodeType'), dataIndex: 'node_type', width: 130, render: (value: string) => value ? <Tag>{value}</Tag> : '-' },
            { title: t('diagnosis.status.label'), dataIndex: 'status', width: 100, render: (value: string) => <Tag color={nodeStatusColor[value] || 'default'}>{value || '-'}</Tag> },
            { title: t('common.startTime'), dataIndex: 'start_time', width: 170, render: formatTime },
            { title: t('common.endTime'), dataIndex: 'end_time', width: 170, render: formatTime },
            { title: t('diagnosis.approvalComment'), dataIndex: 'approval_comment', render: (value: string) => value || '-' },
            { title: t('diagnosis.outputData'), dataIndex: 'output_data', render: renderJsonSummary },
          ] as any}
          dataSource={failedNodes}
        />

        <Table
          rowKey={(record: any, index) => `${record.node_run_id || record.node_id || ''}-${record.line_no || index}`}
          size="small"
          pagination={false}
          title={() => t('diagnosis.ciCd.nodeLogHighlights')}
          locale={{ emptyText: t('common.noData') }}
          columns={[
            { title: t('diagnosis.nodeName'), dataIndex: 'node_label', width: 160, render: (value: string, record: any) => value || record.node_id || '-' },
            { title: t('diagnosis.lineNo'), dataIndex: 'line_no', width: 80 },
            { title: t('diagnosis.matchedKeywords'), dataIndex: 'matched_keywords', width: 180, render: (items: string[]) => (items || []).map(item => <Tag key={item}>{item}</Tag>) },
            { title: t('diagnosis.logMessage'), dataIndex: 'line', render: (value: string) => <Text>{value || '-'}</Text> },
          ] as any}
          dataSource={nodeLogHighlights}
        />

        {ansibleExecution && (
          <Descriptions bordered size="small" column={2} title={t('diagnosis.ciCd.ansibleExecution')}>
            <Descriptions.Item label={t('diagnosis.ansibleExecutionId')}>#{ansibleExecution.id}</Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.taskName')}>{ansibleExecution.task_name || ansibleExecution.task_id || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.status.label')}><Tag color={nodeStatusColor[ansibleExecution.status] || 'default'}>{ansibleExecution.status || '-'}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('common.startTime')}>{formatTime(ansibleExecution.start_time || ansibleExecution.create_time)}</Descriptions.Item>
            <Descriptions.Item label={t('common.endTime')}>{formatTime(ansibleExecution.end_time)}</Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.resultSummary')}>{renderJsonSummary(ansibleExecution.result_summary)}</Descriptions.Item>
          </Descriptions>
        )}

        <Table
          rowKey={(record: any, index) => `${record.id || ''}-${record.host || ''}-${record.line_no || index}`}
          size="small"
          pagination={false}
          title={() => t('diagnosis.ciCd.ansibleTaskLogHighlights')}
          locale={{ emptyText: t('common.noData') }}
          columns={[
            { title: t('diagnosis.host'), dataIndex: 'host', width: 150, render: (value: string) => value || '-' },
            { title: t('diagnosis.lineNo'), dataIndex: 'line_no', width: 80 },
            { title: t('diagnosis.matchedKeywords'), dataIndex: 'matched_keywords', width: 180, render: (items: string[]) => (items || []).map(item => <Tag key={item}>{item}</Tag>) },
            { title: t('diagnosis.logMessage'), dataIndex: 'line', render: (value: string) => <Text>{value || '-'}</Text> },
          ] as any}
          dataSource={taskLogHighlights}
        />

        <Table
          rowKey={(record: any) => String(record.id)}
          size="small"
          pagination={false}
          title={() => t('diagnosis.ciCd.approvalRecords')}
          locale={{ emptyText: t('common.noData') }}
          columns={[
            { title: t('diagnosis.title'), dataIndex: 'title', render: (value: string) => value || '-' },
            { title: t('diagnosis.status.label'), dataIndex: 'status', width: 110, render: (value: string) => <Tag>{value || '-'}</Tag> },
            { title: t('diagnosis.resourceType'), dataIndex: 'resource_type', width: 150, render: (value: string) => value || '-' },
            { title: t('diagnosis.targetId'), dataIndex: 'target_id', width: 100, render: (value: string) => value || '-' },
            { title: t('common.createTime'), dataIndex: 'create_time', width: 170, render: formatTime },
            { title: t('diagnosis.auditTime'), dataIndex: 'audit_time', width: 170, render: formatTime },
          ] as any}
          dataSource={approvalRecords}
        />
      </Space>
    );
  };
  const renderStructuredReport = (run: DiagnosisRun) => {
    const report = run.context_snapshot?.structured_report;
    if (!report || !report.summary) {
      return <Text type="secondary">{t('diagnosis.noStructuredReport')}</Text>;
    }
    return (
      <Space direction="vertical" className="w-full">
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label={t('diagnosis.report.summary')}>{report.summary || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('diagnosis.report.impactScope')}>
            {(report.impact_scope || []).length ? (report.impact_scope || []).map((item: string) => <Tag key={item}>{item}</Tag>) : '-'}
          </Descriptions.Item>
        </Descriptions>
        <Table
          rowKey={(record: any, index) => `${record.ref || record.title || record.action || index}`}
          size="small"
          pagination={false}
          title={() => t('diagnosis.report.evidence')}
          columns={[
            { title: t('diagnosis.ref'), dataIndex: 'ref', width: 110, render: (value: string) => value ? <Tag color="blue">{value}</Tag> : '-' },
            { title: t('diagnosis.finding'), dataIndex: 'finding' },
          ] as any}
          dataSource={report.evidence || []}
        />
        <Table
          rowKey={(record: any, index) => `${record.title || index}`}
          size="small"
          pagination={false}
          title={() => t('diagnosis.report.possibleCauses')}
          columns={[
            { title: t('diagnosis.title'), dataIndex: 'title' },
            { title: t('diagnosis.confidence'), dataIndex: 'confidence', width: 110, render: (value: string) => <Tag>{value}</Tag> },
            { title: t('diagnosis.evidenceRefs'), dataIndex: 'evidence_refs', render: renderRefTags },
          ] as any}
          dataSource={report.possible_causes || []}
        />
        <Table
          rowKey={(record: any, index) => `${record.action || index}`}
          size="small"
          pagination={false}
          title={() => t('diagnosis.report.recommendedActions')}
          columns={[
            { title: t('diagnosis.action'), dataIndex: 'action' },
            { title: t('diagnosis.priority'), dataIndex: 'priority', width: 110, render: (value: string) => <Tag>{value}</Tag> },
            { title: t('diagnosis.evidenceRefs'), dataIndex: 'evidence_refs', render: renderRefTags },
          ] as any}
          dataSource={report.recommended_actions || []}
        />
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label={t('diagnosis.report.risks')}>
            {(report.risks || []).length ? report.risks.join('\n') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('diagnosis.report.nextChecks')}>
            {(report.next_checks || []).length ? report.next_checks.join('\n') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    );
  };
  const renderEvidenceIndex = (run: DiagnosisRun) => {
    const evidence = run.context_snapshot?.evidence_index || [];
    if (!evidence.length) {
      return <Text type="secondary">{t('common.noData')}</Text>;
    }
    return (
      <Table
        rowKey="ref"
        size="small"
        pagination={false}
        columns={[
          { title: t('diagnosis.ref'), dataIndex: 'ref', width: 110, render: (value: string) => <Tag color="blue">{value}</Tag> },
          { title: t('diagnosis.type'), dataIndex: 'type', width: 140, render: (value: string) => <Tag>{value}</Tag> },
          { title: t('diagnosis.title'), dataIndex: 'title' },
          { title: t('diagnosis.summary'), dataIndex: 'summary' },
        ] as any}
        dataSource={evidence}
      />
    );
  };

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
              key: 'diagnosis-templates',
              label: <Space><FileSearchOutlined />{t('diagnosis.tabs.templates')}</Space>,
              children: (
                <Space direction="vertical" className="w-full">
                  <Button icon={<PlusOutlined />} onClick={() => openDiagnosisTemplateModal()}>{t('diagnosis.addTemplate')}</Button>
                  <Table rowKey="id" loading={diagnosisTemplatesLoading} columns={diagnosisTemplateColumns as any} dataSource={diagnosisTemplateList} />
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
        onCancel={closeDiagnosisModal}
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
          <Form.Item name="template" label={t('diagnosis.diagnosisTemplate')}>
            <Select
              allowClear
              options={diagnosisTemplateList.filter(item => item.is_active).map(item => ({ value: item.id, label: `${item.name} (${item.code})` }))}
            />
          </Form.Item>
          {selectedDiagnosisTemplate && (
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message={selectedDiagnosisTemplate.name}
              description={selectedDiagnosisTemplate.description || t('diagnosis.templateCiCdTip')}
            />
          )}
          {selectedTemplateTargetType && (
            <Space className="w-full" align="start">
              {['pipeline_run', 'service_regression'].includes(selectedTemplateTargetType) && (
                <Form.Item name="pipeline_run_id" label={t('diagnosis.pipelineRunId')} className="flex-1">
                  <InputNumber min={1} className="w-full" />
                </Form.Item>
              )}
              {['pipeline_run', 'ansible_execution'].includes(selectedTemplateTargetType) && (
                <Form.Item name="pipeline_node_run_id" label={t('diagnosis.pipelineNodeRunId')} className="flex-1">
                  <InputNumber min={1} className="w-full" />
                </Form.Item>
              )}
              {selectedTemplateTargetType === 'ansible_execution' && (
                <Form.Item name="ansible_execution_id" label={t('diagnosis.ansibleExecutionId')} className="flex-1">
                  <InputNumber min={1} className="w-full" />
                </Form.Item>
              )}
            </Space>
          )}
          <Form.Item name="service" label={t('diagnosis.service')}>
            <Select options={serviceList.map(item => ({ value: item.id, label: `${item.name} (${item.code})` }))} />
          </Form.Item>
          {(serviceMatchCandidates.length > 0 || serviceMatchWarnings.length > 0) && (
            <Alert
              type={serviceMatchCandidates.length > 0 ? 'info' : 'warning'}
              showIcon
              message={t('diagnosis.serviceMatch')}
              description={
                <Space direction="vertical">
                  {serviceMatchCandidates.slice(0, 3).map(item => (
                    <Text key={item.id}>
                      {item.name} ({item.code}) · {t('diagnosis.score')}: {item.score}
                    </Text>
                  ))}
                  {serviceMatchWarnings.map((item, index) => <Text key={`warning-${index}`} type="secondary">{item}</Text>)}
                </Space>
              }
            />
          )}
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
        title={previewResult?.type === 'metrics' ? t('diagnosis.metricPreview') : t('diagnosis.logPreview')}
        open={!!previewResult}
        onCancel={() => setPreviewResult(null)}
        footer={null}
        width={900}
      >
        {previewResult && (
          <Space direction="vertical" className="w-full" size="middle">
            {!previewResult.ok && (
              <Alert type="error" showIcon message={t('diagnosis.messages.previewFailed')} description={previewResult.error} />
            )}
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label={t('diagnosis.service')}>{previewResult.service?.name} ({previewResult.service?.code})</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.datasourceName')}>{previewResult.datasource?.name} / {previewResult.datasource?.provider}</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.time')} span={2}>
                {previewResult.time_range?.start} ~ {previewResult.time_range?.end}
              </Descriptions.Item>
              {previewResult.query && (
                <Descriptions.Item label={t('diagnosis.finalQuery')} span={2}>
                  <code>{previewResult.query}</code>
                </Descriptions.Item>
              )}
            </Descriptions>

            {previewResult.type === 'logs' && (
              <Table
                size="small"
                rowKey={(_, index) => String(index)}
                pagination={false}
                dataSource={previewResult.items || []}
                columns={[
                  { title: t('diagnosis.time'), dataIndex: 'timestamp', width: 180 },
                  { title: t('diagnosis.level'), dataIndex: 'level', width: 90, render: (value: string) => value ? <Tag>{value}</Tag> : '-' },
                  { title: t('diagnosis.service'), dataIndex: 'service', width: 120 },
                  { title: t('diagnosis.instance'), dataIndex: 'instance', width: 140 },
                  { title: t('diagnosis.message'), dataIndex: 'message', render: (value: string) => <Text>{value || '-'}</Text> },
                ]}
              />
            )}

            {previewResult.type === 'metrics' && (
              <Table
                size="small"
                rowKey={(record: any) => record.name || record.query}
                pagination={false}
                dataSource={previewResult.metrics || []}
                columns={[
                  { title: t('diagnosis.name'), dataIndex: 'name', width: 160 },
                  { title: t('diagnosis.finalQuery'), dataIndex: 'query' },
                  { title: t('diagnosis.resultCount'), dataIndex: 'result', width: 120, render: (value: any[]) => value?.length || 0 },
                ]}
              />
            )}

            <div>
              <Text strong>{t('diagnosis.rawPreview')}</Text>
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-black/5 p-3 text-xs">
                {JSON.stringify(previewResult, null, 2)}
              </pre>
            </div>
          </Space>
        )}
      </Modal>

      <Modal
        title={editingDatasource ? t('diagnosis.editDatasource') : t('diagnosis.addDatasource')}
        open={datasourceModalOpen}
        onCancel={() => setDatasourceModalOpen(false)}
        onOk={() => datasourceForm.submit()}
        confirmLoading={datasourceMutation.isPending}
      >
        <Form form={datasourceForm} layout="vertical" onFinish={(values) => {
          try {
            datasourceMutation.mutate({
              ...values,
              type: values.provider,
              query_config: parseJsonObject(values.query_config),
              field_mapping: parseJsonObject(values.field_mapping),
              response_mapping: parseJsonObject(values.response_mapping),
            });
          } catch (err: any) {
            message.error(err.message);
          }
        }}>
          <Form.Item name="name" label={t('diagnosis.datasourceName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Space className="w-full" align="start">
            <Form.Item name="kind" label={t('diagnosis.kind')} rules={[{ required: true }]} className="flex-1">
              <Select
                options={[
                  { value: 'metric', label: t('diagnosis.kinds.metric') },
                  { value: 'log', label: t('diagnosis.kinds.log') },
                ]}
                onChange={(value) => {
                  const provider = value === 'metric' ? 'victoriametrics' : 'victorialogs';
                  datasourceForm.setFieldsValue({ provider, type: provider });
                }}
              />
            </Form.Item>
            <Form.Item name="provider" label={t('diagnosis.provider')} rules={[{ required: true }]} className="flex-1">
              <Select
                options={filteredProviderOptions}
                onChange={(value) => {
                  const capability = datasourceCapabilities?.[value as keyof typeof datasourceCapabilities];
                  datasourceForm.setFieldsValue({
                    type: value,
                    kind: capability?.kind || datasourceForm.getFieldValue('kind'),
                  });
                }}
              />
            </Form.Item>
          </Space>
          {selectedDatasourceCapability && (
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message={selectedDatasourceCapability.label}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">{selectedDatasourceCapability.notes}</Text>
                  <Space wrap>
                    <Tag color={selectedDatasourceCapability.supports_metrics ? 'blue' : 'default'}>{t('diagnosis.kinds.metric')}</Tag>
                    <Tag color={selectedDatasourceCapability.supports_logs ? 'green' : 'default'}>{t('diagnosis.kinds.log')}</Tag>
                    <Text type="secondary">
                      {t('diagnosis.supportedAuthTypes')}: {selectedDatasourceCapability.auth_types?.join(', ') || '-'}
                    </Text>
                  </Space>
                  <Button size="small" onClick={() => applyDatasourceCapability(datasourceProvider)}>
                    {t('diagnosis.applyProviderTemplate')}
                  </Button>
                </Space>
              }
            />
          )}
          <Form.Item name="type" hidden><Input /></Form.Item>
          <Form.Item name="base_url" label={t('diagnosis.baseUrl')} rules={[{ required: true }]}>
            <Input placeholder={selectedDatasourceCapability?.default_base_url || 'http://victoriametrics:8428'} />
          </Form.Item>
          <Form.Item name="auth_type" label={t('diagnosis.authType')}><Select options={[{ value: 'none', label: 'None' }, { value: 'bearer', label: 'Bearer Token' }, { value: 'basic', label: 'Basic Auth' }, { value: 'header', label: 'Custom Header' }, { value: 'query', label: 'Query Param' }, { value: 'cloud_signature', label: 'Cloud Signature' }]} /></Form.Item>
          <Form.Item name="username" label={t('diagnosis.username')}><Input /></Form.Item>
          <Form.Item name="password" label={t('diagnosis.password')}><Input.Password placeholder={editingDatasource?.has_password ? t('diagnosis.keepSecret') : undefined} /></Form.Item>
          <Form.Item name="token" label="Token"><TextArea rows={3} placeholder={editingDatasource?.has_token ? t('diagnosis.keepSecret') : undefined} /></Form.Item>
          <Form.Item name="query_config" label={t('diagnosis.queryConfig')}><TextArea rows={4} /></Form.Item>
          <Form.Item name="field_mapping" label={t('diagnosis.fieldMapping')}><TextArea rows={4} /></Form.Item>
          <Form.Item name="response_mapping" label={t('diagnosis.responseMapping')}><TextArea rows={3} /></Form.Item>
          <Form.Item name="timeout_seconds" label={t('diagnosis.timeout')}><InputNumber min={1} max={120} className="w-full" /></Form.Item>
          <Form.Item name="is_default" valuePropName="checked"><Switch /> {t('diagnosis.default')}</Form.Item>
          <Form.Item name="is_active" valuePropName="checked"><Switch /> {t('common.enabled')}</Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingDiagnosisTemplate ? t('diagnosis.editTemplate') : t('diagnosis.addTemplate')}
        open={diagnosisTemplateModalOpen}
        onCancel={() => setDiagnosisTemplateModalOpen(false)}
        onOk={() => diagnosisTemplateForm.submit()}
        confirmLoading={diagnosisTemplateMutation.isPending}
        width={820}
      >
        <Form form={diagnosisTemplateForm} layout="vertical" onValuesChange={syncDiagnosisTemplateContent} onFinish={(values) => {
          try {
            const content = buildDiagnosisTemplateContent(values);
            diagnosisTemplateMutation.mutate({
              name: values.name,
              code: values.code,
              scope: values.scope,
              project: values.scope === 'project' ? values.project : null,
              category: values.category,
              description: values.description,
              is_active: values.is_active,
              content,
            });
          } catch (err: any) {
            message.error(err.message);
          }
        }}>
          <Space className="w-full" align="start">
            <Form.Item name="name" label={t('diagnosis.templateName')} rules={[{ required: true }]} className="flex-1"><Input /></Form.Item>
            <Form.Item name="code" label={t('diagnosis.code')} rules={[{ required: true }]} className="flex-1"><Input disabled={editingDiagnosisTemplate?.is_builtin} /></Form.Item>
          </Space>
          <Space className="w-full" align="start">
            <Form.Item name="scope" label={t('diagnosis.scope')} rules={[{ required: true }]} className="flex-1">
              <Select
                disabled={editingDiagnosisTemplate?.is_builtin}
                options={[
                  { value: 'global', label: t('diagnosis.scopes.global') },
                  { value: 'project', label: t('diagnosis.scopes.project') },
                ]}
              />
            </Form.Item>
            <Form.Item name="project" label={t('diagnosis.project')} className="flex-1">
              <Select options={projectOptions} allowClear disabled={editingDiagnosisTemplate?.is_builtin} />
            </Form.Item>
          </Space>
          <Form.Item name="category" label={t('diagnosis.category')} rules={[{ required: true }]}>
            <Select options={[{ value: 'ci_cd', label: t('diagnosis.categories.ci_cd') }]} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}><TextArea rows={2} /></Form.Item>
          <Form.Item name="target_type" label={t('diagnosis.targetType')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pipeline_run', label: t('diagnosis.targetTypes.pipeline_run') },
                { value: 'ansible_execution', label: t('diagnosis.targetTypes.ansible_execution') },
                { value: 'service_regression', label: t('diagnosis.targetTypes.service_regression') },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('diagnosis.contextCollection')}>
            <Space wrap>
              {templateCollectionKeys.map(key => (
                <Form.Item key={key} name={`collect_${key}`} valuePropName="checked" noStyle>
                  <Switch checkedChildren={t(`diagnosis.collectionOptions.${key}`)} unCheckedChildren={t(`diagnosis.collectionOptions.${key}`)} />
                </Form.Item>
              ))}
            </Space>
          </Form.Item>
          <Form.Item name="log_keywords_text" label={t('diagnosis.logKeywords')}>
            <TextArea rows={3} placeholder={'error\nfailed\ntimeout'} />
          </Form.Item>
          <Form.Item
            name="prompt_template"
            label={t('diagnosis.promptTemplate')}
            rules={[
              { required: true },
              {
                validator: (_, value) => (
                  value?.includes('{diagnosis_context}')
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('diagnosis.promptTemplateRequired')))
                ),
              },
            ]}
          >
            <TextArea rows={6} />
          </Form.Item>
          <Form.Item name="report_schema" label={t('diagnosis.reportSchema')}>
            <TextArea rows={4} />
          </Form.Item>
          <Collapse
            ghost
            items={[
              {
                key: 'advanced-json',
                label: t('diagnosis.advancedJson'),
                children: (
                  <Form.Item name="content" label={t('diagnosis.templateContent')}>
                    <TextArea rows={8} />
                  </Form.Item>
                ),
              },
            ]}
          />
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
              <Descriptions.Item label={t('diagnosis.diagnosisTemplate')}>{selectedRun.template_name || selectedRun.context_snapshot?.template?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.templateSnapshot')}>{selectedRun.context_snapshot?.template?.code || selectedRun.query_params?.template_snapshot?.code || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.service')}>{selectedRun.service_name || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.time')}>{dayjs(selectedRun.diagnosis_time).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label={t('diagnosis.error')}>{selectedRun.error_message || '-'}</Descriptions.Item>
            </Descriptions>
            <Card title={t('diagnosis.structuredReport')}>
              {renderStructuredReport(selectedRun)}
            </Card>
            <Card title={t('diagnosis.aiResult')}>
              {selectedRun.ai_result ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedRun.ai_result}</ReactMarkdown> : <Text type="secondary">{t('common.noData')}</Text>}
            </Card>
            <Card title={t('diagnosis.collectionSummary')}>
              {renderCollectionSummary(selectedRun)}
            </Card>
            {renderCiCdContext(selectedRun) && (
              <Card title={t('diagnosis.ciCdContext')}>
                {renderCiCdContext(selectedRun)}
              </Card>
            )}
            <Card title={t('diagnosis.logHighlights')}>
              {renderLogHighlights(selectedRun)}
            </Card>
            <Card title={t('diagnosis.evidenceIndex')}>
              {renderEvidenceIndex(selectedRun)}
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
