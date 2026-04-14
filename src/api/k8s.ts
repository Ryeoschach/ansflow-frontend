import request from '../utils/requests';
import {K8sResource, PaginatedResponse} from '../types';

// ========================
// k8s集群 接口
// ========================
// 获取集群列表
export const getK8sClusters = (params?: any): Promise<PaginatedResponse<K8sResource>> =>
    request.get<PaginatedResponse<K8sResource>>('/k8s/', { params }) as any;
// 创建集群
export const createK8sCluster = (data: Partial<K8sResource>): Promise<K8sResource> =>
    request.post<K8sResource>('/k8s/', data) as any;
// 验证连接
export const verifyK8sCluster = (id: number): Promise<{ msg: string; version: string }> =>
    request.post<{ msg: string; version: string }>(`/k8s/${id}/verify/`) as any;
// 删除集群
export const deleteK8sCluster = (id: number): Promise<any> =>
    request.delete(`/k8s/${id}/`) as any;

// ========================
// k8s资源 接口
// ========================
// 获取节点列表
export const getK8sNodes = (clusterId: number): Promise<any[]> =>
    request.get<any[]>(`/k8s/${clusterId}/nodes_list/`) as any;

// 获取命名空间列表
export const getK8sNamespaces = (clusterId: number): Promise<string[]> =>
    request.get<string[]>(`/k8s/${clusterId}/namespaces_list/`) as any;

// 获取 Pod 列表
export const getK8sPods = (clusterId: number, params?: { namespace?: string }): Promise<any[]> =>
    request.get<any[]>(`/k8s/${clusterId}/pods_list/`, { params }) as any;

// 获取 Deployment 列表
export const getK8sDeployments = (clusterId: number, params?: { namespace?: string }): Promise<any[]> =>
    request.get<any[]>(`/k8s/${clusterId}/deployments_list/`, { params }) as any;

// 获取 Service 列表
export const getK8sServices = (clusterId: number, params?: { namespace?: string }): Promise<any[]> =>
    request.get<any[]>(`/k8s/${clusterId}/services_list/`, { params }) as any;

// 获取 Pod 日志
export const getK8sPodLogs = (clusterId: number, params: { namespace: string; pod_name: string; container?: string; tail_lines?: number }) =>
    request.get<{ logs: string }>(`/k8s/${clusterId}/pod_logs_list/`, { params });

// 扩缩容 Deployment
export const scaleK8sDeployment = (clusterId: number, data: { namespace: string; name: string; replicas: number }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/scale_deployment/`, data);

// 重启 Deployment
export const restartK8sDeployment = (clusterId: number, data: { namespace: string; name: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/restart_deployment/`, data);

// 获取资源 YAML
export const getK8sYaml = (clusterId: number, params: { type: string; name: string; namespace?: string }) =>
    request.get<{ yaml: string }>(`/k8s/${clusterId}/yaml_list/`, { params });

// 更新资源 YAML
export const updateK8sYaml = (clusterId: number, data: { yaml: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/update_yaml/`, data);

// 执行 Pod 命令
export const execK8sPodCommand = (clusterId: number, data: { namespace: string; pod_name: string; container?: string; command: string }) =>
    request.post<{ output: string }>(`/k8s/${clusterId}/pod_exec/`, data);

// 删除 Pod
export const deleteK8sPod = (clusterId: number, data: { namespace: string; name: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/delete_pod/`, data);

// 获取 Helm 列表
export const getHelmList = (clusterId: number, params?: { namespace?: string }) =>
    request.get<any[]>(`/k8s/${clusterId}/helm_list/`, { params });

// 发布/安装 Helm Chart
export const installHelmChart = (clusterId: number, data: { name: string; chart: string; namespace?: string }) =>
    request.post<{ msg: string; output: string }>(`/k8s/${clusterId}/helm_install/`, data);

// 升级/更新 Helm Chart
export const upgradeHelmChart = (clusterId: number, data: { name: string; chart?: string; namespace?: string; force?: boolean; values?: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/helm_upgrade/`, data);

// 删除 Helm Chart
export const uninstallHelmChart = (clusterId: number, data: { name: string; namespace?: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/helm_uninstall/`, data);

// 获取 Helm 历史
export const getHelmHistory = (clusterId: number, params: { name: string; namespace?: string }) =>
    request.get<any[]>(`/k8s/${clusterId}/helm_history/`, { params });

// 获取 Helm Values
export const getHelmValues = (clusterId: number, params: { name: string; namespace?: string; all?: boolean }) =>
    request.get<{ values: any; yaml: string }>(`/k8s/${clusterId}/helm_get_values/`, { params });

// 回退 Helm Chart
export const rollbackHelmChart = (clusterId: number, data: { name: string; revision: number; namespace?: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/helm_rollback/`, data);

// 重启 Helm Release (rollout)
export const restartHelmChart = (clusterId: number, data: { name: string; namespace?: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/helm_restart/`, data);

// 停止 Helm Release (scale to 0)
export const stopHelmChart = (clusterId: number, data: { name: string; namespace?: string }) =>
    request.post<{ msg: string }>(`/k8s/${clusterId}/helm_stop/`, data);

// 获取已上传的 Local Charts
export const getHelmLocalCharts = (): Promise<any[]> =>
    request.get<any[]>('/k8s/helm_list_local_charts/') as any;