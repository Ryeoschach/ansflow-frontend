import request from '../utils/requests';
import { PaginatedResponse } from '../types';

export interface AlertEvent {
  id: number;
  alert_name: string;
  severity: string;
  status: 'firing' | 'resolved';
  source: string;
  fingerprint: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  healing_status: 'none' | 'analyzing' | 'suggested' | 'awaiting_approval' | 'executing' | 'success' | 'failed' | 'ignored';
  ai_analysis: string | null;
  is_exported: boolean;
  suggested_pipeline: number | null;
  suggested_pipeline_name?: string;
  latest_run_id: number | null;
  create_time: string;
  update_time: string;
}

export interface SelfHealingPolicy {
  id: number;
  name: string;
  alert_match_rule: Record<string, string>;
  pipeline: number;
  pipeline_name?: string;
  is_auto_execute: boolean;
  is_active: boolean;
  create_time: string;
  update_time: string;
}

export type ObservabilityDataSourceProvider = 'victoriametrics' | 'victorialogs' | 'elasticsearch' | 'loki' | 'aliyun_sls' | 'tencent_cls' | 'generic_http';

export interface ObservabilityDataSource {
  id: number;
  name: string;
  kind: 'metric' | 'log' | 'trace';
  provider: ObservabilityDataSourceProvider;
  type: ObservabilityDataSourceProvider;
  base_url: string;
  auth_type: 'none' | 'bearer' | 'basic' | 'header' | 'query' | 'cloud_signature';
  username?: string | null;
  has_password?: boolean;
  has_token?: boolean;
  query_config?: Record<string, any>;
  field_mapping?: Record<string, any>;
  response_mapping?: Record<string, any>;
  is_default: boolean;
  is_active: boolean;
  timeout_seconds: number;
  remark?: string | null;
  create_time: string;
  update_time: string;
}

export interface ObservabilityDataSourceCapability {
  label: string;
  kind: 'metric' | 'log' | 'trace';
  supports_metrics: boolean;
  supports_logs: boolean;
  auth_types: string[];
  default_base_url?: string;
  query_config: Record<string, any>;
  field_mapping: Record<string, any>;
  response_mapping: Record<string, any>;
  notes?: string;
}

export interface ObservedService {
  id: number;
  name: string;
  code: string;
  project: number;
  project_name?: string;
  environment?: number | null;
  environment_name?: string;
  resource_pool?: number | null;
  resource_pool_name?: string;
  hosts?: number[];
  k8s_cluster?: number | null;
  k8s_cluster_name?: string;
  namespace?: string | null;
  metric_datasource?: number | null;
  metric_datasource_name?: string;
  log_datasource?: number | null;
  log_datasource_name?: string;
  metric_label_selector: Record<string, string>;
  log_label_selector: Record<string, string>;
  metric_queries: any[];
  log_query?: string | null;
  is_active: boolean;
  create_time: string;
  update_time: string;
}

export interface AlertServiceMatchCandidate {
  id: number;
  name: string;
  code: string;
  project: number;
  project_name?: string;
  score: number;
  reasons: string[];
}

export interface AlertServiceMatchResult {
  best_match: AlertServiceMatchCandidate | null;
  candidates: AlertServiceMatchCandidate[];
  threshold: number;
  warnings: string[];
}

export interface DiagnosisRun {
  id: number;
  title: string;
  project?: number | null;
  project_name?: string;
  service?: number | null;
  service_name?: string;
  alert?: number | null;
  alert_name?: string;
  trigger_type: 'manual' | 'alert' | 'retry';
  status: 'pending' | 'running' | 'success' | 'failed';
  diagnosis_time: string;
  window_minutes: number;
  query_params: Record<string, any>;
  context_snapshot: Record<string, any>;
  ai_result?: string | null;
  error_message?: string | null;
  created_by_username?: string;
  create_time: string;
  update_time: string;
}

export interface AlertRuleTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  variables: Record<string, string>;
}

// 获取告警列表
export const getAlertEvents = (params?: any): Promise<PaginatedResponse<AlertEvent>> =>
  request.get('/sre/alerts/', { params }) as any;

export const bulkDeleteAlerts = (ids: number[]): Promise<any> =>
  request.post('/sre/alerts/bulk-destroy/', { ids });

// 获取单个告警详情
export const getAlertEvent = (id: number): Promise<AlertEvent> =>
  request.get(`/sre/alerts/${id}/`) as any;

// 忽略告警
export const ignoreAlert = (id: number): Promise<any> =>
  request.patch(`/sre/alerts/${id}/`, { healing_status: 'ignored' }) as any;

// 导出告警诊断到知识库
export const exportAlertToKnowledge = (id: number): Promise<any> =>
  request.post(`/sre/alerts/${id}/export-to-knowledge/`);

// 触发自愈流水线
export const triggerAlertHealing = (id: number): Promise<any> =>
  request.post(`/sre/alerts/${id}/trigger-healing/`);

// 失败重诊
export const reDiagnoseAlert = (id: number): Promise<any> =>
  request.post(`/sre/alerts/${id}/re-diagnose/`);

// 获取自愈策略
export const getHealingPolicies = (params?: any): Promise<PaginatedResponse<SelfHealingPolicy>> =>
  request.get('/sre/policies/', { params }) as any;

// 创建自愈策略
export const createHealingPolicy = (data: Partial<SelfHealingPolicy>): Promise<SelfHealingPolicy> =>
  request.post('/sre/policies/', data) as any;

// 更新自愈策略
export const updateHealingPolicy = (id: number, data: Partial<SelfHealingPolicy>): Promise<SelfHealingPolicy> =>
  request.patch(`/sre/policies/${id}/`, data) as any;

// 删除自愈策略
export const deleteHealingPolicy = (id: number): Promise<any> =>
  request.delete(`/sre/policies/${id}/`) as any;

export const bulkDeletePolicies = (ids: number[]): Promise<any> =>
  request.post('/sre/policies/bulk-destroy/', { ids });

// 绑定建议自愈流水线到告警
export const bindHealingPipeline = (alertId: number, data: { pipeline_id: number; make_policy?: boolean }): Promise<any> =>
  request.post(`/sre/alerts/${alertId}/bind-healing-pipeline/`, data);

// AIGC 生成流水线
export const generatePipeline = (prompt: string): Promise<any> =>
  request.post('/ai/chat-histories/generate-pipeline/', { prompt }) as any;

// 获取告警统计报表
export const getAlertReport = (params?: { start_time?: string; end_time?: string }): Promise<any> =>
  request.get('/sre/alerts/report/', { params }) as any;

// 导出告警统计报表为 CSV (异步触发)
export const exportAlertReport = (params?: { start_time?: string; end_time?: string }): Promise<{ message: string }> =>
  request.post('/sre/alerts/export-report/', params) as any;

export const getObservabilityDataSources = (params?: any): Promise<PaginatedResponse<ObservabilityDataSource>> =>
  request.get('/sre/observability-datasources/', { params }) as any;

export const getObservabilityDataSourceCapabilities = (): Promise<Record<ObservabilityDataSourceProvider, ObservabilityDataSourceCapability>> =>
  request.get('/sre/observability-datasources/capabilities/') as any;

export const createObservabilityDataSource = (data: Partial<ObservabilityDataSource> & Record<string, any>): Promise<ObservabilityDataSource> =>
  request.post('/sre/observability-datasources/', data) as any;

export const updateObservabilityDataSource = (id: number, data: Partial<ObservabilityDataSource> & Record<string, any>): Promise<ObservabilityDataSource> =>
  request.patch(`/sre/observability-datasources/${id}/`, data) as any;

export const deleteObservabilityDataSource = (id: number): Promise<any> =>
  request.delete(`/sre/observability-datasources/${id}/`);

export const testObservabilityDataSource = (id: number): Promise<{ ok: boolean; status_code?: number; error?: string }> =>
  request.post(`/sre/observability-datasources/${id}/test-connection/`) as any;

export const getObservedServices = (params?: any): Promise<PaginatedResponse<ObservedService>> =>
  request.get('/sre/observed-services/', { params }) as any;

export const createObservedService = (data: Partial<ObservedService>): Promise<ObservedService> =>
  request.post('/sre/observed-services/', data) as any;

export const updateObservedService = (id: number, data: Partial<ObservedService>): Promise<ObservedService> =>
  request.patch(`/sre/observed-services/${id}/`, data) as any;

export const deleteObservedService = (id: number): Promise<any> =>
  request.delete(`/sre/observed-services/${id}/`);

export const matchObservedServiceForAlert = (params: { alert_id: number; project?: number | null }): Promise<AlertServiceMatchResult> =>
  request.get('/sre/observed-services/match-alert/', { params }) as any;

export const previewObservedServiceLogs = (id: number, data?: Record<string, any>): Promise<any> =>
  request.post(`/sre/observed-services/${id}/preview-logs/`, data || {}) as any;

export const previewObservedServiceMetrics = (id: number, data?: Record<string, any>): Promise<any> =>
  request.post(`/sre/observed-services/${id}/preview-metrics/`, data || {}) as any;

export const getDiagnosisRuns = (params?: any): Promise<PaginatedResponse<DiagnosisRun>> =>
  request.get('/sre/diagnosis-runs/', { params }) as any;

export const createDiagnosisRun = (data: Partial<DiagnosisRun>): Promise<DiagnosisRun> =>
  request.post('/sre/diagnosis-runs/', data) as any;

export const retryDiagnosisRun = (id: number): Promise<any> =>
  request.post(`/sre/diagnosis-runs/${id}/retry/`);

export const getAlertRuleTemplates = (): Promise<AlertRuleTemplate[]> =>
  request.get('/sre/alert-rule-templates/') as any;

export const renderAlertRuleTemplate = (template_id: string, variables: Record<string, string>): Promise<any> =>
  request.post('/sre/alert-rule-templates/render/', { template_id, variables }) as any;
