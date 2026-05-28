import request from '@/utils/requests';

export const getPulseStats = () => {
  return request.get('/pulse/workers/stats/');
};

export const getWorkerNodes = (params?: any) => {
  return request.get('/pulse/workers/', { params });
};

export const getTaskPulseList = (params?: any) => {
  return request.get('/pulse/tasks/', { params });
};

export const getPulseThroughput = (): Promise<any[]> => {
  return request.get('/pulse/tasks/throughput/') as any;
};

export const revokeTaskPulse = (id: number) => {
  return request.post(`/pulse/tasks/${id}/revoke/`);
};

export const deleteWorkerNode = (id: number) => {
  return request.delete(`/pulse/workers/${id}/`);
};
