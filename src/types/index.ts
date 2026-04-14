// 定义用户数据类型
export interface User {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
    is_active: boolean;
    date_joined: string;
    roles?: number[];
    roles_info?: any[];
}

export interface PaginatedResponse<T> {
    code: number;
    message: string;
    data: T[];
    total: number;
    page: number;
    size: number;
}

export interface Permission {
    id: number;
    name: string;
    code: string;
    desc: string;
}

export interface K8sResource {
    id: number;
    name: string;
    auth_type: string;
    api_server: string;
    status: string;
    version: string;
    remark: string;
}

export interface Platform {
    id: number;
    name: string;
    type: string;
}

export interface Environments {
    id: number;
    name: string;
    code: string;
    remark: string;
}

export interface Pipelines {
    id: number;
    name: string;
    desc: string;
    creator: number;
    creator_name: string;
    is_active: boolean;
}