import request from '../utils/requests';
import { PaginatedResponse } from '../types';

// ========================
// 主机 (Hosts) 接口
// ========================
export const getHosts = (params?: any): Promise<PaginatedResponse<any>> => request.get('/hosts/', { params });
export const createHost = (data: any) => request.post('/hosts/', data);
export const updateHost = (id: number, data: any) => request.patch(`/hosts/${id}/`, data);
export const deleteHost = (id: number) => request.delete(`/hosts/${id}/`);

// ========================
// 环境 (Environments) 接口
// ========================
export const getEnvironments = (params?: any): Promise<PaginatedResponse<any>> => request.get('/environments/', { params });
export const createEnvironment = (data: any) => request.post('/environments/', data);
export const updateEnvironment = (id: number, data: any) => request.patch(`/environments/${id}/`, data);
export const deleteEnvironment = (id: number) => request.delete(`/environments/${id}/`);


// ========================
// 平台 (Platforms) 接口
// ========================
export const getPlatforms = (params?: any): Promise<PaginatedResponse<any>> => request.get('/platforms/', { params });
export const createPlatform = (data: any) => request.post('/platforms/', data);
export const updatePlatform = (id: number, data: any) => request.patch(`/platforms/${id}/`, data);
export const deletePlatform = (id: number) => request.delete(`/platforms/${id}/`);
export const verifyPlatform = (id: number) => request.post(`/platforms/${id}/verify_connectivity/`);
export const syncPlatformAssets = (id: number) => request.post(`/platforms/${id}/sync_assets/`);

// ========================
// SSH 凭据接口
// ========================

/**
 * 后端 SshCredential 模型字段与前端表单字段一致:
 * - auth_type: 'password' | 'key' (两者一致)
 * - password / private_key / passphrase (字段名一致)
 * 只需处理 remark <-> description 的映射
 */

/** 将前端表单数据转换为后端 API 格式 */
const toCredentialData = (data: any) => {
    const { remark, ...rest } = data;
    return { ...rest, description: remark };
};

/** 将后端响应转换为前端格式 */
const fromCredentialData = (item: any) => ({
    ...item,
    remark: item.description,
});

export const getCredentials = (params?: any) =>
    request.get('/ssh_credentials/', { params }).then((res: any) => ({
        ...res,
        data: res.data?.map(fromCredentialData),
    }));

export const createCredential = (data: any) =>
    request.post('/ssh_credentials/', toCredentialData(data));

export const updateCredential = (id: number, data: any) =>
    request.patch(`/ssh_credentials/${id}/`, toCredentialData(data));

export const deleteCredential = (id: number) => request.delete(`/ssh_credentials/${id}/`);
export const verifyCredential = (id: number, data: { host: string; port?: number }) =>
    request.post(`/ssh_credentials/${id}/verify/`, data);


// ========================
// 资源池 (Resource Pools) 接口
// ========================
export const getResourcePools = (params?: any): Promise<PaginatedResponse<any>> => request.get('/resource_pools/', { params });
export const createResourcePool = (data: any) => request.post('/resource_pools/', data);
export const updateResourcePool = (id: number, data: any) => request.patch(`/resource_pools/${id}/`, data);
export const deleteResourcePool = (id: number) => request.delete(`/resource_pools/${id}/`);
