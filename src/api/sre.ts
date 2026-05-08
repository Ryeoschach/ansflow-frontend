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
  healing_status: 'none' | 'analyzing' | 'suggested' | 'executing' | 'success' | 'failed' | 'ignored';
  ai_analysis: string | null;
  suggested_pipeline: number | null;
  suggested_pipeline_name?: string;
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

// 获取单个告警详情
export const getAlertEvent = (id: number): Promise<AlertEvent> =>
  request.get(`/sre/alerts/${id}/`) as any;

// 忽略告警
export const ignoreAlert = (id: number): Promise<any> =>
  request.patch(`/sre/alerts/${id}/`, { healing_status: 'ignored' }) as any;

// 获取自愈策略
export const getHealingPolicies = (params?: any): Promise<PaginatedResponse<SelfHealingPolicy>> =>
  request.get('/sre/policies/', { params }) as any;

// 创建自愈策略
export const createHealingPolicy = (data: Partial<SelfHealingPolicy>): Promise<any> =>
  request.post('/sre/policies/', data) as any;
