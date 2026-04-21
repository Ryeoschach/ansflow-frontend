import request from '../utils/requests';
import { PaginatedResponse, Pipelines } from '../types';

// 获取所有流水线模板
export const getPipelines = (params?: any): Promise<PaginatedResponse<Pipelines>> =>
  request.get('/pipelines/', { params }) as any;

// 获取单个流水线模板
export const getPipeline = (id: number): Promise<any> =>
  request.get(`/pipelines/${id}/`) as any;

// 创建流水线模板
export const createPipeline = (data: { name: string; desc?: string; graph_data: any }): Promise<any> =>
  request.post('/pipelines/', data) as any;

// 更新流水线模板
export const updatePipeline = (id: number, data: any): Promise<any> =>
  request.patch(`/pipelines/${id}/`, data) as any;

// 删除单个流水线模板
export const deletePipeline = (id: number): Promise<any> =>
  request.delete(`/pipelines/${id}/`) as any;

// 手动触发并执行流水线
export const executePipeline = (id: number | string): Promise<any> =>
  request.post(`/pipelines/${id}/execute/`) as any;

// --- 运行记录相关 ---

// 获取流水线运行历史列表
export const getPipelineRuns = (params?: any): Promise<any> =>
  request.get('/pipeline_runs/', { params }) as any;

// 获取单次流水线执行详情 (包含各个节点)
export const getPipelineRunDetail = (id: number | string): Promise<any> =>
  request.get(`/pipeline_runs/${id}/`) as any;

// 停止/取消运行中的流水线
export const stopPipelineRun = (id: number | string): Promise<any> =>
  request.post(`/pipeline_runs/${id}/stop/`) as any;

// 从指定节点重试流水线
export const retryPipelineRun = (runId: number | string, startNodeId: string): Promise<any> =>
  request.post(`/pipeline_runs/${runId}/retry/`, { start_node_id: startNodeId }) as any;

// --- CI Environments (构建镜像管理) ---

// 获取所有 CI 环境
export const getCIEnvironments = (params?: any): Promise<any> =>
  request.get('/ci_environments/', { params }) as any;

// 创建 CI 环境
export const createCIEnvironment = (data: any): Promise<any> =>
  request.post('/ci_environments/', data) as any;

// 更新 CI 环境
export const updateCIEnvironment = (id: number | string, data: any): Promise<any> =>
  request.put(`/ci_environments/${id}/`, data) as any;

// 删除 CI 环境
export const deleteCIEnvironment = (id: number | string): Promise<any> =>
  request.delete(`/ci_environments/${id}/`) as any;

// --- Pipeline Webhooks ---

export interface PipelineWebhook {
  id: number;
  pipeline: number;
  pipeline_name: string;
  name: string;
  event_type: string;
  repository_url: string | null;
  branch_filter: string | null;
  secret_key: string | null;
  is_active: boolean;
  description: string | null;
  last_trigger_time: string | null;
  trigger_count: number;
  webhook_url: string;
  create_time: string;
  update_time: string;
}

export const getPipelineWebhooks = (params?: any): Promise<PaginatedResponse<PipelineWebhook>> =>
  request.get('/pipeline/webhooks/', { params }) as any;

export const getPipelineWebhook = (id: number): Promise<PipelineWebhook> =>
  request.get(`/pipeline/webhooks/${id}/`) as any;

export const createPipelineWebhook = (data: Partial<PipelineWebhook>): Promise<any> =>
  request.post('/pipeline/webhooks/', data) as any;

export const updatePipelineWebhook = (id: number, data: Partial<PipelineWebhook>): Promise<any> =>
  request.put(`/pipeline/webhooks/${id}/`, data) as any;

export const deletePipelineWebhook = (id: number): Promise<any> =>
  request.delete(`/pipeline/webhooks/${id}/`) as any;

export const triggerPipelineWebhook = (id: number, secret?: string): Promise<any> =>
  request.post(`/pipeline/webhooks/${id}/trigger/`, { secret }) as any;

// --- Pipeline Versions ---

export interface PipelineVersion {
  id: number;
  pipeline: number;
  pipeline_name: string;
  version_number: number;
  name: string;
  desc: string | null;
  graph_data: any;
  creator: number | null;
  creator_name: string | null;
  change_summary: string | null;
  is_current: boolean;
  create_time: string;
  update_time: string;
}

export const getPipelineVersions = (params?: any): Promise<PaginatedResponse<PipelineVersion>> =>
  request.get('/pipeline/versions/', { params }) as any;

export const getPipelineVersion = (id: number): Promise<PipelineVersion> =>
  request.get(`/pipeline/versions/${id}/`) as any;

export const rollbackPipeline = (pipelineId: number, versionId: number): Promise<any> =>
  request.post(`/pipelines/${pipelineId}/rollback/`, { version_id: versionId }) as any;
