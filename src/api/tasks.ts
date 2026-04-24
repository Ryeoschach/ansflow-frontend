import request from '../utils/requests';
import { PaginatedResponse } from '../types';

// ========================
// Ansible 任务接口
// ========================

export const getAnsibleTasks = (params?: any): Promise<PaginatedResponse<any>> => request.get('/tasks/', { params }) as any;

export const createAnsibleTask = (data: any): Promise<any> => request.post('/tasks/', data) as any;
export const updateAnsibleTask = (id: number, data: any): Promise<any> => request.patch(`/tasks/${id}/`, data) as any;
export const runAnsibleTask = (id: number): Promise<any> => request.post(`/tasks/${id}/run/`) as any;
export const deleteAnsibleTask = (id: number): Promise<any> => request.delete(`/tasks/${id}/`) as any;

// ========================
// 执行记录接口 (History)
// ========================
export const getExecutions = (params?: any): Promise<PaginatedResponse<any>> => request.get('/executions/', { params }) as any;
export const getExecutionLogs = (id: number): Promise<any[]> => request.get(`/executions/${id}/logs/`) as any;
export const deleteExecutions = (ids: number[]): Promise<any> => request.delete('/executions/batch_delete/', { data: { ids } }) as any;

export const getTaskStatus = (id: number): Promise<any> => request.get(`/tasks/${id}/status/`) as any;
export const terminateExecution = (id: number): Promise<any> => request.post(`/executions/${id}/terminate/`) as any;

// ========================
// 定时调度接口 (Schedule)
// ========================
export const getSchedules = (params?: any): Promise<PaginatedResponse<any>> => request.get('/schedules/', { params }) as any;
export const createSchedule = (data: any): Promise<any> => request.post('/schedules/', data) as any;
export const updateSchedule = (id: number, data: any): Promise<any> => request.patch(`/schedules/${id}/`, data) as any;
export const deleteSchedule = (id: number): Promise<any> => request.delete(`/schedules/${id}/`) as any;
export const toggleSchedule = (id: number): Promise<any> => request.post(`/schedules/${id}/toggle/`) as any;
export const triggerSchedule = (id: number): Promise<any> => request.post(`/schedules/${id}/trigger/`) as any;
