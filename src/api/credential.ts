import request from '../utils/requests';



export const getCredentials = (params?: any): Promise<any> =>
  request.get('/ssh_credentials/', { params }) as any;

export const createCredential = (data: any): Promise<any> =>
  request.post('/ssh_credentials/', data) as any;

export const updateCredential = (id: number, data: any): Promise<any> =>
  request.patch(`/ssh_credentials/${id}/`, data) as any;

export const deleteCredential = (id: number): Promise<any> =>
  request.delete(`/ssh_credentials/${id}/`) as any;
