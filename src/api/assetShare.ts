import request from '../utils/requests';

// ============================================================
// 跨项目资产授权 (ProjectAssetShare) API
// ============================================================

export type AssetType =
  | 'host'
  | 'ssh_credential'
  | 'credential'
  | 'pipeline'
  | 'ansible_task'
  | 'k8s_cluster'
  | 'resource_pool'
  | 'self_healing_policy';

export type SharePermission = 'read' | 'use' | 'full';

export interface AssetShare {
  id: number;
  from_project: number;
  from_project_name: string;
  to_project: number;
  to_project_name: string;
  asset_type: AssetType;
  asset_type_label: string;
  asset_id: number;
  permission: SharePermission;
  permission_label: string;
  shared_by: number | null;
  shared_by_name: string | null;
  create_time: string;
}

export interface CreateSharePayload {
  from_project: number;
  to_project: number;
  asset_type: AssetType;
  asset_id: number;
  permission?: SharePermission;
}

/** 列出当前项目相关的所有授权（包含 shared_in 和 shared_out） */
export const getAssetShares = (): Promise<AssetShare[]> =>
  request.get('/asset-shares/');

/** 列出当前项目收到的授权（其他项目授权给我的资产） */
export const getSharedIn = (): Promise<AssetShare[]> =>
  request.get('/asset-shares/shared_in/');

/** 列出当前项目发出的授权（我授权给其他项目的资产） */
export const getSharedOut = (): Promise<AssetShare[]> =>
  request.get('/asset-shares/shared_out/');

/** 创建一条授权记录 */
export const createAssetShare = (data: CreateSharePayload): Promise<AssetShare> =>
  request.post('/asset-shares/', data);

/** 删除单条授权 */
export const deleteAssetShare = (id: number) =>
  request.delete(`/asset-shares/${id}/`);

/** 批量撤销授权 */
export const revokeAssetShares = (ids: number[]) =>
  request.post('/asset-shares/revoke/', { ids });
