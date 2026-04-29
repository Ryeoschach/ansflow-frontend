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

export interface ResourceTemplate {
    code: string;
    name: string;
    icon: string;
}

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

// 资源模版接口 (拦截点)
export const getApprovalTemplates = (): Promise<ResourceTemplate[]> =>
    request.get('/approval_templates/') as any;

// 保持兼容性的占位符 (防止前端其他引用报错)
export const createApprovalTemplate = (data: any) => Promise.reject("Not implemented: Use policies instead");
export const updateApprovalTemplate = (id: number, data: any) => Promise.reject("Not implemented");
export const deleteApprovalTemplate = (id: number) => Promise.reject("Not implemented");

// 策略接口
export const getApprovalPolicies = (params?: any): Promise<PaginatedResponse<ApprovalPolicy>> =>
    request.get('/approval_policies/', { params }) as any;

export const createApprovalPolicy = (data: any): Promise<any> =>
    request.post('/approval_policies/', data) as any;

export const updateApprovalPolicy = (id: number, data: any): Promise<any> =>
    request.patch(`/approval_policies/${id}/`, data) as any;

export const deleteApprovalPolicy = (id: number): Promise<any> =>
    request.delete(`/approval_policies/${id}/`) as any;
