import request from '../utils/requests';

// ========================
// 审批功能 接口
// ========================

// 定义接口类型
export interface ApprovalTicket {
    id: number;
    title: string;
    status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'finished' | 'failed';
    submitter_name: string;
    approver_name: string | null;
    resource_type: string;
    target_id: string | null;
    payload: any;
    url_path: string;
    method: string;
    remark: string | null;
    create_time: string;
    audit_time: string | null;
}

export const getApprovalTickets = (params?: any): Promise<any> => {
    return request.get('/approval_tickets/', { params });
};

export const approveTicket = (id: number): Promise<any> => {
    return request.post(`/approval_tickets/${id}/approve/`);
};

export const rejectTicket = (id: number, remark: string): Promise<any> => {
    return request.post(`/approval_tickets/${id}/reject/`, { remark });
};
