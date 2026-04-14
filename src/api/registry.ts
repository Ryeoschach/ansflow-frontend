import request from '../utils/requests';
import { PaginatedResponse } from '../types';


export const getRegistries = (params?: any): Promise<PaginatedResponse<any>> => request.get('/image_registries/', { params })

export const createRegistry = (data: any): Promise<PaginatedResponse<any>> => request.post('/image_registries/', data);

export const updateRegistry =  (id: number, data: any): Promise<PaginatedResponse<any>> => request.put(`/image_registries/${id}/`, data);

export const deleteRegistry = (id: number): Promise<PaginatedResponse<any>> => request.delete(`/image_registries/${id}/`);
