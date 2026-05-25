import request from '../utils/requests';
import { PaginatedResponse } from '../types';

// ========================
// 合规框架 (Compliance Frameworks) 接口
// ========================
export const getComplianceFrameworks = (params?: Record<string, any>): Promise<PaginatedResponse<any>> => 
    request.get('/compliance/frameworks/', { params });

export const createComplianceFramework = (data: any) => 
    request.post('/compliance/frameworks/', data);

export const updateComplianceFramework = (id: number, data: any) => 
    request.patch(`/compliance/frameworks/${id}/`, data);

export const deleteComplianceFramework = (id: number) => 
    request.delete(`/compliance/frameworks/${id}/`);

// ========================
// 合规条款 (Compliance Clauses) 接口
// ========================
export const getComplianceClauses = (params?: Record<string, any>): Promise<PaginatedResponse<any>> => 
    request.get('/compliance/clauses/', { params });

export const createComplianceClause = (data: any) => 
    request.post('/compliance/clauses/', data);

export const updateComplianceClause = (id: number, data: any) => 
    request.patch(`/compliance/clauses/${id}/`, data);

export const deleteComplianceClause = (id: number) => 
    request.delete(`/compliance/clauses/${id}/`);

export const checkComplianceClauseManual = (id: number) => 
    request.post(`/compliance/clauses/${id}/trigger_check/`);

// ========================
// 条款与基线映射 (Compliance Mappings) 接口
// ========================
export const getComplianceMappings = (params?: Record<string, any>): Promise<PaginatedResponse<any>> => 
    request.get('/compliance/mappings/', { params });

export const createComplianceMapping = (data: { clause: number; baseline: number }) => 
    request.post('/compliance/mappings/', data);

export const deleteComplianceMapping = (id: number) => 
    request.delete(`/compliance/mappings/${id}/`);
