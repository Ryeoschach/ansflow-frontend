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
