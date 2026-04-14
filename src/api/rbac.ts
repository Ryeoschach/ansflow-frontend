import request from '../utils/requests';
import { PaginatedResponse, Permission } from '../types';

/**
 * 权限/RBAC 相关接口
 */

/**
 * 获取当前登录用户授权的菜单 tree
 */
export const getMyMenus = (): Promise<any[]> => {
    return request.get('/account/menus/');
};


// 获取所有菜单树
export const getAllMenus = (): Promise<any[]> => request.get('/system/menus/');

// 更新角色的菜单/权限关联
export const updateRolePermissions = (roleId: number, data: { menus: number[] }) => {
    return request.patch(`/roles/${roleId}/`, data);
};

// --- 权限 (Permissions) ---
export const getPermissions = (params?: any): Promise<PaginatedResponse<Permission>> => request.get('/system/permissions/', { params });
export const createPermission = (data: any) => request.post('/system/permissions/', data);
export const updatePermission = (id: number, data: any) => request.patch(`/system/permissions/${id}/`, data);
export const deletePermission = (id: number) => request.delete(`/system/permissions/${id}/`);

// --- 角色 (Roles) ---
export const getRoles = (params?: any): Promise<PaginatedResponse<any>> => request.get('/roles/', { params });
export const createRole = (data: any) => request.post('/roles/', data);
export const updateRole = (id: number, data: any) => request.patch(`/roles/${id}/`, data);
export const deleteRole = (id: number) => request.delete(`/roles/${id}/`);

// --- 菜单 (Menus) ---
export const getMenus = (params?: any): Promise<any[]> => request.get('/system/menus/', { params });
export const createMenu = (data: any) => request.post('/system/menus/', data);
export const updateMenu = (id: number, data: any) => request.patch(`/system/menus/${id}/`, data);
export const deleteMenu = (id: number) => request.delete(`/system/menus/${id}/`);


// 更新角色的数据范围 (Data Scope) 策略
export const updateRoleDataPolicies = (id: number, data: Record<string, any[]>) => {
    return request.post(`/roles/${id}/update_data_policies/`, data);
};


