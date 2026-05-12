import request from '../utils/requests';
import { PaginatedResponse } from '../types';

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
  collection_name: string;
  create_time: string;
  update_time: string;
}

export interface ChatHistory {
  id: number;
  user_id: string;
  session_id: string;
  title: string;
  history_type: 'chat' | 'diagnose';
  personality: string;
  create_time: string;
  update_time: string;
}

export interface ChatMessage {
  id: number;
  history: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_exported?: boolean;
  create_time: string;
}

export interface AIProvider {
  id: number;
  name: string;
  provider_type: string;
  base_url: string;
  api_key?: string;
  is_active: boolean;
  create_time: string;
}

export interface AIModel {
  id: number;
  provider: number;
  provider_name: string;
  name: string;
  display_name: string;
  model_type: 'llm' | 'embedding';
  is_active: boolean;
}

export interface AIConfig {
  id: number;
  name: string;
  default_llm: number | null;
  default_embedding: number | null;
}

export interface KnowledgeDocument {
  id: number;
  kb: number;
  title: string;
  content: string;
  source_type: 'manual' | 'file' | 'ai_export';
  status: 'pending' | 'processing' | 'ready' | 'error';
  chunk_count: number;
  metadata: any;
  create_time: string;
}

export interface DocumentChunk {
  index: number;
  content: string;
  length: number;
}

// 知识库
export const getKnowledgeBases = (params?: Record<string, any>): Promise<PaginatedResponse<KnowledgeBase>> =>
  request.get('/ai/knowledge-bases/', { params }) as any;

export const createKnowledgeBase = (data: Partial<KnowledgeBase>): Promise<KnowledgeBase> =>
  request.post('/ai/knowledge-bases/', data) as any;

export const updateKnowledgeBase = (id: number, data: Partial<KnowledgeBase>): Promise<KnowledgeBase> =>
  request.patch(`/ai/knowledge-bases/${id}/`, data) as any;

export const reindexKnowledgeBase = (id: number): Promise<any> =>
  request.post(`/ai/knowledge-bases/${id}/reindex/`);

// 知识文档
export const getKnowledgeDocuments = (params?: { kb?: number }): Promise<PaginatedResponse<KnowledgeDocument>> =>
  request.get('/ai/documents/', { params }) as any;

export const deleteKnowledgeDocument = (id: number): Promise<void> =>
  request.delete(`/ai/documents/${id}/`) as any;

export const uploadKnowledgeDocument = (kbId: number, file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('kb', kbId.toString());
  formData.append('file', file);
  formData.append('title', file.name);
  return request.post('/ai/documents/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }) as any;
};

export const getDocumentChunks = (id: number): Promise<DocumentChunk[]> =>
  request.get(`/ai/documents/${id}/chunks/`) as any;

// 对话历史
export const getChatHistories = (params?: Record<string, any>): Promise<PaginatedResponse<ChatHistory>> =>
  request.get('/ai/chat-histories/', { params }) as any;

export const createChatHistory = (data: { 
  user_id: string; 
  session_id: string; 
  title?: string; 
  personality?: string;
  history_type?: 'chat' | 'diagnose';
}): Promise<ChatHistory> =>
  request.post('/ai/chat-histories/', data) as any;

export const getChatMessages = (historyId: number): Promise<ChatMessage[]> =>
  request.get(`/ai/chat-histories/${historyId}/messages/`) as any;

// 供应商管理
export const getAIProviders = (): Promise<PaginatedResponse<AIProvider>> =>
  request.get('/ai/providers/') as any;

export const createAIProvider = (data: Partial<AIProvider>): Promise<AIProvider> =>
  request.post('/ai/providers/', data) as any;

export const updateAIProvider = (id: number, data: Partial<AIProvider>): Promise<AIProvider> =>
  request.patch(`/ai/providers/${id}/`, data) as any;

export const deleteAIProvider = (id: number): Promise<void> =>
  request.delete(`/ai/providers/${id}/`) as any;

export const syncAIProviderModels = (id: number): Promise<any> =>
  request.post(`/ai/providers/${id}/sync_models/`);

// 模型管理
export const getAIModels = (params?: { model_type?: string }): Promise<PaginatedResponse<AIModel>> =>
  request.get('/ai/models/', { params }) as any;

export const createAIModel = (data: Partial<AIModel>): Promise<AIModel> =>
  request.post('/ai/models/', data) as any;

export const updateAIModel = (id: number, data: Partial<AIModel>): Promise<AIModel> =>
  request.patch(`/ai/models/${id}/`, data) as any;

export const deleteAIModel = (id: number): Promise<void> =>
  request.delete(`/ai/models/${id}/`) as any;

// 配置管理
export const getCurrentAIConfig = (): Promise<AIConfig> =>
  request.get('/ai/configs/current/') as any;

export const updateAIConfig = (id: number, data: Partial<AIConfig>): Promise<AIConfig> =>
  request.patch(`/ai/configs/${id}/`, data) as any;

// 将消息保存到知识库
export const saveMessageToKnowledge = (historyId: number, messageId: number): Promise<any> =>
  request.post(`/ai/chat-histories/${historyId}/save-to-knowledge/`, { message_id: messageId });

// AIGC 生成流水线
export const generatePipeline = (prompt: string, llmId?: number): Promise<any> =>
  request.post('/ai/chat-histories/generate-pipeline/', { prompt, llm_id: llmId }, { timeout: 60000 }) as any;

// AIGC 修正流水线
export const refinePipeline = (data: { 
  prompt: string; 
  nodes: any[]; 
  edges: any[]; 
  llm_id?: number 
}): Promise<any> =>
  request.post('/ai/chat-histories/refine-pipeline/', data, { timeout: 60000 }) as any;

// AIGC 建议节点参数
export const suggestNodeParams = (data: {
  type: string;
  data: any;
  context: any[];
  llm_id?: number;
}): Promise<any> =>
  request.post('/ai/chat-histories/suggest-node-params/', data, { timeout: 60000 }) as any;

// AI 模拟说明
export const explainPipeline = (data: {
  nodes: any[];
  edges: any[];
  llm_id?: number;
}): Promise<{ explanation: string }> =>
  request.post('/ai/chat-histories/explain-pipeline/', data, { timeout: 60000 }) as any;

// 诊断接口的 URL (主要用于 fetch 拼接)
export const DIAGNOSE_URL = '/api/v1/ai/chat-histories/';
export const CHAT_URL_PREFIX = '/api/v1/ai/chat-histories/';
