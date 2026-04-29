import type { User, PaginatedResponse } from '../types';
import request from '../utils/requests';

export const getUsers = (params?: any): Promise<PaginatedResponse<User>> => {
    return request.get('/users/', { params });
};

export const createUser = (data: any) => {
    return request.post('/users/', data);
};

export const updateUser = (id: number, data: any) => {
    return request.patch(`/users/${id}/`, data);
};

export const deleteUser = (id: number) => {
    return request.delete(`/users/${id}/`);
};

export const assignRoles = (id: number, roleIds: number[]) => {
    return request.post(`/users/${id}/assign_roles/`, { role_ids: roleIds });
};

export const resetUserPassword = (id: number, newPassword: string) => {
    return request.post(`/users/${id}/reset_password/`, { new_password: newPassword });
};

export const getMe = () => {
    return request.get('/account/me/');
};