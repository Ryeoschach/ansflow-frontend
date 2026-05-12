import request from '../utils/requests';
import { PaginatedResponse } from '../types';

// ========================
// 审批功能 接口
// ========================

export interface ApprovalTicket {
    id: number;
    title: string;
    status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'finished' | 'failed';
    status_display: string;
    submitter_name: string;
    submitter: number;
    approver_name: string | null;
    approver: number | null;
    resource_type: string;
    target_id: string | null;
    payload: any;
    url_path: string;
    method: string;
    remark: string | null;
    create_time: string;
    audit_time: string | null;
}

export interface ApprovalResource {
    id: number;
    code: string;
    name: string;
    icon: string;
    description: string;
    is_active: boolean;
    is_system: boolean;
}

export interface ResourceTemplate extends Partial<ApprovalResource> {}

export interface ApprovalPolicy {
    id: number;
    name: string;
    resource_type: string;
    environment: string | null;
    approver_roles: number[];
    approver_roles_detail?: any[];
    is_active: boolean;
    create_time: string;
}

// 工单接口
export const getApprovalTickets = (params?: any): Promise<PaginatedResponse<ApprovalTicket>> =>
    request.get('/approval_tickets/', { params }) as any;

export const approveTicket = (id: number): Promise<any> =>
    request.post(`/approval_tickets/${id}/approve/`);

export const rejectTicket = (id: number, remark: string): Promise<any> =>
    request.post(`/approval_tickets/${id}/reject/`, { remark });

// 资源管理接口 (拦截点管理)
export const getApprovalResources = (params?: any): Promise<ApprovalResource[]> =>
    request.get('/approval_resources/', { params }) as any;

export const updateApprovalResource = (id: number, data: Partial<ApprovalResource>): Promise<any> =>
    request.patch(`/approval_resources/${id}/`, data) as any;

export const deleteApprovalResource = (id: number): Promise<any> =>
    request.delete(`/approval_resources/${id}/`) as any;

// 保持兼容性的旧接口导出
export const getApprovalTemplates = (): Promise<ResourceTemplate[]> =>
    getApprovalResources({ active_only: 'true' }) as any;

// 策略接口
export const getApprovalPolicies = (params?: any): Promise<PaginatedResponse<ApprovalPolicy>> =>
    request.get('/approval_policies/', { params }) as any;

export const createApprovalPolicy = (data: any): Promise<any> =>
    request.post('/approval_policies/', data) as any;

export const updateApprovalPolicy = (id: number, data: any): Promise<any> =>
    request.patch(`/approval_policies/${id}/`, data) as any;

export const deleteApprovalPolicy = (id: number): Promise<any> =>
    request.delete(`/approval_policies/${id}/`) as any;
