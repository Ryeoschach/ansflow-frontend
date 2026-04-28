import request from '../utils/requests';
import { PaginatedResponse } from '../types';

// ========================
// 审批功能 接口
// ========================

export interface ApprovalTicket {
    id: number;
    title: string;
    status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'finished' | 'failed';
    submitter_name: string;
    submitter: number;
    resource_type: string;
    target_id: string | null;
    payload: any;
    url_path: string;
    method: string;
    create_time: string;
    current_step_order: number;
    template: number | null;
    template_name: string | null;
    progresses: TicketProgress[];
}

export interface TicketProgress {
    id: number;
    step_name: string;
    step_order: number;
    approver_name: string | null;
    status: 'approved' | 'rejected';
    remark: string | null;
    create_time: string;
}

export interface ApprovalTemplate {
    id: number;
    name: string;
    description: string;
    is_active: boolean;
    steps: ApprovalStep[];
    create_time: string;
    update_time: string;
}

export interface ApprovalStep {
    id: number;
    template: number;
    order: number;
    name: string;
    approver_roles: number[];
    approver_roles_names: string[];
    approver_users: number[];
    approver_users_names: string[];
    mode: 'any' | 'all';
}

export interface ApprovalPolicy {
    id: number;
    name: string;
    resource_type: string;
    environment: string | null;
    template: number | null;
    template_name: string | null;
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

// 模板接口
export const getApprovalTemplates = (params?: any): Promise<PaginatedResponse<ApprovalTemplate>> =>
    request.get('/approval/templates/', { params }) as any;

export const createApprovalTemplate = (data: any): Promise<any> =>
    request.post('/approval/templates/', data) as any;

export const updateApprovalTemplate = (id: number, data: any): Promise<any> =>
    request.patch(`/approval/templates/${id}/`, data) as any;

export const deleteApprovalTemplate = (id: number): Promise<any> =>
    request.delete(`/approval/templates/${id}/`) as any;

// 策略接口
export const getApprovalPolicies = (params?: any): Promise<PaginatedResponse<ApprovalPolicy>> =>
    request.get('/approval/policies/', { params }) as any;

export const createApprovalPolicy = (data: any): Promise<any> =>
    request.post('/approval/policies/', data) as any;

export const updateApprovalPolicy = (id: number, data: any): Promise<any> =>
    request.patch(`/approval/policies/${id}/`, data) as any;

export const deleteApprovalPolicy = (id: number): Promise<any> =>
    request.delete(`/approval/policies/${id}/`) as any;
