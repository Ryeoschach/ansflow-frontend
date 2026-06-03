import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Card, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
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
  matchObservedServiceForAlert,
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
  const [serviceMatchCandidates, setServiceMatchCandidates] = useState<any[]>([]);
  const [serviceMatchWarnings, setServiceMatchWarnings] = useState<string[]>([]);

  const [diagnosisForm] = Form.useForm();
  const [serviceForm] = Form.useForm();
  const [datasourceForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const datasourceKind = Form.useWatch('kind', datasourceForm);

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
  const metricDatasources = datasourceList.filter(item => item.kind === 'metric' || item.type === 'victoriametrics');
  const logDatasources = datasourceList.filter(item => item.kind === 'log' || item.type === 'victorialogs');
  const filteredProviderOptions = datasourceProviderOptions.filter(item => !datasourceKind || item.kind === datasourceKind);

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

  const projectOptions = useMemo(() => (projects?.data || []).map((item: any) => ({ value: item.id, label: `${item.name} (${item.code})` })), [projects]);
  const renderCollectionSummary = (run: DiagnosisRun) => {
    const summary = run.context_snapshot?.collection_summary || {};
    const warnings = run.context_snapshot?.warnings || [];
    const rows = ['metrics', 'logs', 'log_highlights', 'ansflow_events'].map(key => {
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
              <Select options={filteredProviderOptions} onChange={(value) => datasourceForm.setFieldsValue({ type: value })} />
            </Form.Item>
          </Space>
          <Form.Item name="type" hidden><Input /></Form.Item>
          <Form.Item name="base_url" label={t('diagnosis.baseUrl')} rules={[{ required: true }]}><Input placeholder="http://victoriametrics:8428" /></Form.Item>
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
            <Card title={t('diagnosis.structuredReport')}>
              {renderStructuredReport(selectedRun)}
            </Card>
            <Card title={t('diagnosis.aiResult')}>
              {selectedRun.ai_result ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedRun.ai_result}</ReactMarkdown> : <Text type="secondary">{t('common.noData')}</Text>}
            </Card>
            <Card title={t('diagnosis.collectionSummary')}>
              {renderCollectionSummary(selectedRun)}
            </Card>
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
