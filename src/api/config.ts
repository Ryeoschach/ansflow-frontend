import request from '../utils/requests';
import { PaginatedResponse } from '../types';

/**
 * 配置中心 API
 */

// ============== ConfigCategory (配置分类) ==============

export interface ConfigCategory {
  id: number;
  name: string;
  label: string;
  description: string;
  item_count: number;
  create_time: string;
  update_time: string;
}

export interface ConfigCategoryDetail extends ConfigCategory {
  items: ConfigItem[];
}

export const getCategories = (params?: any): Promise<PaginatedResponse<ConfigCategory>> =>
  request.get('/config/categories/', { params }) as any;

export const getCategory = (id: number): Promise<any> =>
  request.get(`/config/categories/${id}/`) as any;

export const createCategory = (data: { name: string; label: string; description?: string }): Promise<any> =>
  request.post('/config/categories/', data) as any;

export const updateCategory = (id: number, data: { name?: string; label?: string; description?: string }): Promise<any> =>
  request.patch(`/config/categories/${id}/`, data) as any;

export const deleteCategory = (id: number): Promise<any> =>
  request.delete(`/config/categories/${id}/`) as any;

// ============== ConfigItem (配置项) ==============

export interface ConfigItem {
  id: number;
  category: number;
  key: string;
  value: any;
  value_type: 'string' | 'int' | 'float' | 'bool' | 'json';
  is_encrypted: boolean;
  is_active: boolean;
  description: string;
  value_display: string;
  create_time: string;
  update_time: string;
}

export interface ConfigItemCreate {
  category: number;
  key: string;
  value: any;
  value_type: string;
  is_encrypted?: boolean;
  description?: string;
}

export const getConfigItems = (params?: any): Promise<PaginatedResponse<ConfigItem>> =>
  request.get('/config/items/', { params }) as any;

export const getConfigItem = (id: number): Promise<any> =>
  request.get(`/config/items/${id}/`) as any;

export const createConfigItem = (data: ConfigItemCreate): Promise<any> =>
  request.post('/config/items/', data) as any;

export const updateConfigItem = (id: number, data: { value?: any; description?: string }): Promise<any> =>
  request.patch(`/config/items/${id}/`, data) as any;

export const deleteConfigItem = (id: number): Promise<any> =>
  request.delete(`/config/items/${id}/`) as any;

export const getConfigItemsByCategory = (name: string): Promise<any> =>
  request.get('/config/items/by_category/', { params: { name } }) as any;

export const validateConfigItemValue = (id: number, value: any): Promise<{ valid: boolean; error?: string }> =>
  request.post(`/config/items/${id}/validate_value/`, { value }) as any;

export const rollbackConfigItem = (id: number, data: { change_log_id: number; reason: string }): Promise<any> =>
  request.post(`/config/items/${id}/rollback/`, data) as any;

// ============== ConfigChangeLog (变更日志) ==============

export interface ConfigChangeLog {
  id: number;
  item: number;
  item_key: string;
  item_category: string;
  action: 'create' | 'update' | 'delete' | 'rollback';
  old_value: any;
  new_value: any;
  old_value_display: string;
  new_value_display: string;
  operator: number;
  operator_username: string;
  ip_address: string;
  reason: string;
  create_time: string;
}

export const getChangeLogs = (params?: any): Promise<PaginatedResponse<ConfigChangeLog>> =>
  request.get('/config/change-logs/', { params }) as any;
