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
  create_time: string;
  update_time: string;
}

export interface ChatMessage {
  id: number;
  history: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  create_time: string;
}

// 获取所有知识库
export const getKnowledgeBases = (params?: Record<string, any>): Promise<PaginatedResponse<KnowledgeBase>> =>
  request.get('/ai/knowledge-bases/', { params }) as any;

// 获取对话历史
export const getChatHistories = (params?: Record<string, any>): Promise<PaginatedResponse<ChatHistory>> =>
  request.get('/ai/chat-histories/', { params }) as any;

// 创建新的对话会话
export const createChatHistory = (data: { user_id: string; session_id: string; title?: string }): Promise<ChatHistory> =>
  request.post('/ai/chat-histories/', data) as any;

// 获取对话详情
export const getChatMessages = (historyId: number): Promise<ChatMessage[]> =>
  request.get(`/ai/chat-histories/${historyId}/messages/`) as any;

// AIGC 生成流水线
export const generatePipeline = (prompt: string): Promise<any> =>
  request.post('/ai/chat-histories/generate-pipeline/', { prompt }) as any;

// 诊断接口的 URL (主要用于 fetch 拼接)
export const DIAGNOSE_URL = '/api/v1/ai/chat-histories/diagnose/';
export const CHAT_URL_PREFIX = '/api/v1/ai/chat-histories/';
