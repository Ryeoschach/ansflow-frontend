import request from '../utils/requests';
import { PaginatedResponse } from '../types';
import useAppStore from '../store/useAppStore';

/**
 * 系统备份与恢复 API
 */

export interface BackupFile {
  filename: string;
  url: string;
  size: number;
  created_at: string;
}

export interface CreateBackupResponse {
  success: boolean;
  filename: string;
  url: string;
  size: number;
  record_count: Record<string, number>;
  created_at: string;
  error?: string;
}

export const getBackupList = (): Promise<BackupFile[]> =>
  request.get('/system/backup/index/') as any;

export const createBackup = (): Promise<CreateBackupResponse> =>
  request.get('/system/backup/generate/') as any;

export const restoreBackup = (filename: string): Promise<any> =>
  request.post('/system/backup/restore/', { filename }) as any;

export const uploadAndRestoreBackup = (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/system/backup/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }) as any;
};

export const downloadBackupFile = async (filename: string): Promise<void> => {
  const token = useAppStore.getState().token;
  const response = await fetch(`/api/v1/system/backup/download/?filename=${encodeURIComponent(filename)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Download failed');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const deleteBackupFiles = (filenames: string[]): Promise<any> =>
  request.post('/system/backup/delete/', { filenames }) as any;
