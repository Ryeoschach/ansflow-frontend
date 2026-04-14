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
