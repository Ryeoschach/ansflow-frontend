import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '../../../api/system';

export const useDashboardData = () => {
    return useQuery({
        queryKey: ['dashboard', 'summary'],
        queryFn: getDashboardSummary,
        refetchInterval: 60000, // 每 1 分钟自动刷新一次数据
    });
};
