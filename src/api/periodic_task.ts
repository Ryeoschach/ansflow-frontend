import request from '@/utils/requests';

const BASE_URL = '/system/periodic-tasks/';

export const getPeriodicTasks = (params?: any) => {
  return request.get(BASE_URL, { params });
};

export const createPeriodicTask = (data: any) => {
  return request.post(BASE_URL, data);
};

export const updatePeriodicTask = (id: number, data: any) => {
  return request.put(`${BASE_URL}${id}/`, data);
};

export const partialUpdatePeriodicTask = (id: number, data: any) => {
  return request.patch(`${BASE_URL}${id}/`, data);
};

export const updatePeriodicTaskSchedule = (id: number, data: any) => {
  return request.put(`${BASE_URL}${id}/update_schedule/`, data);
};

