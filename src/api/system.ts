import request from '../utils/requests';

export interface HealthComponent {
    name: string;
    label: string;
    icon: string;
    status: 'healthy' | 'warning' | 'unhealthy';
    latency?: string;
    message?: string;
    [key: string]: any;
}

export interface HealthStatusResponse {
    status: 'healthy' | 'warning' | 'critical';
    components: HealthComponent[];
    timestamp: string;
    version?: string;
}

export const getSystemHealth = (): Promise<HealthStatusResponse> =>
    request.get<HealthStatusResponse>('/system/health/status/') as any;


export interface DashboardSummary {
    metrics: {
        totalHosts: number;
        onlineHosts: number;
        totalResourcePools: number;
        dailyTaskRuns: number;
        dailyFailedTasks: number;
    };
    taskTrend: {
        time: string;
        success: number;
        failed: number;
    }[];
    recentTasks: {
        id: string;
        raw_id: number;
        type: 'ansible' | 'pipeline';
        name: string;
        status: string;
        time: string;
        time_label: string;
        user: string;
    }[];
}

export const getDashboardSummary = (): Promise<DashboardSummary> =>
    request.get<DashboardSummary>('/system/dashboard/summary/') as any;

// 审计足迹日志接口
export const getAuditLogs = (params?: any): Promise<any> => request.get('/audit-logs/', { params });

export interface CeleryWorker {
    worker: string;
    status: 'online' | 'offline';
    active_count: number;
    scheduled_count: number;
    reserved_count: number;
    concurrency: number;
    broker_transport: string;
    rusage: any;
}

export interface CeleryStatsResponse {
    workers: CeleryWorker[];
    queues: { name: string; length: number }[];
    beat?: {
        status: 'online' | 'offline';
        last_run: string;
    };
    timestamp: string;
}

export const getCeleryStats = (): Promise<CeleryStatsResponse> =>
    request.get<CeleryStatsResponse>('/system/health/celery_stats/') as any;
