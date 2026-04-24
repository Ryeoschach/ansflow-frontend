import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Table,
    Card,
    Button,
    Tag,
    Space,
    Typography,
    App,
    Drawer,
    Input,
    Select,
    DatePicker,
} from 'antd';
import {
    SyncOutlined,
    UnorderedListOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    LoadingOutlined,
    SearchOutlined,
    HistoryOutlined,
    StopOutlined,
    FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getExecutions, getExecutionLogs, terminateExecution } from '../../api/tasks';
import useAppStore from '../../store/useAppStore';
import { LogSkeleton } from '../../components/Skeletons';


const { Text } = Typography;

const ExecutionHistory: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const { message, modal } = App.useApp();
    const { token, hasPermission } = useAppStore();
    const [logDrawerVisible, setLogDrawerVisible] = useState(false);
    const [activeExecutionId, setActiveExecutionId] = useState<number | null>(null);
    const [drawerWidth, setDrawerWidth] = useState(800);

    // 筛选状态
    const [params, setParams] = useState<any>({ page: 1, size: 20 });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [filterForm, setFilterForm] = useState<any>({});
    
    // 处理从 dashboard 等页面跳转过来的 ID 参数
    useEffect(() => {
        const jumpId = searchParams.get('id');
        if (jumpId && !activeExecutionId && !logDrawerVisible) {
            const numericId = Number(jumpId);
            if (!isNaN(numericId)) {
                setActiveExecutionId(numericId);
                setLogDrawerVisible(true);
            }
        }
    }, [searchParams, activeExecutionId, logDrawerVisible]);

    // 1. 获取执行记录
    const { data: executionData, isLoading: listLoading } = useQuery({
        queryKey: ['ansible-executions', params],
        queryFn: () => getExecutions(params),
        enabled: !!token,
        refetchInterval: (query: any) => {
            const hasRunning = query.state.data?.data?.some((e: any) => e.status === 'running' || e.status === 'pending');
            return hasRunning ? 5000 : false;
        }
    });

    // 2. 获取日志
    const { data: logs, isLoading: logsLoading } = useQuery({
        queryKey: ['execution-logs', activeExecutionId],
        queryFn: () => getExecutionLogs(activeExecutionId!),
        enabled: !!token && !!activeExecutionId && logDrawerVisible,
    });

    const terminateMutation = useMutation({
        mutationFn: terminateExecution,
        onSuccess: () => {
            message.success(t('executionHistory.terminateInstructionSent'));
            queryClient.invalidateQueries({ queryKey: ['ansible-executions'] });
        },
        onError: (err: any) => {
            message.error(err.response?.data?.error || t('executionHistory.terminateFailed'));
        }
    });

    const statusMap: any = {
        'pending': { color: 'default', text: t('executionHistory.pending'), icon: <SyncOutlined spin /> },
        'running': { color: 'processing', text: t('executionHistory.running'), icon: <LoadingOutlined /> },
        'success': { color: 'success', text: t('executionHistory.success'), icon: <CheckCircleOutlined /> },
        'failed': { color: 'error', text: t('executionHistory.failed'), icon: <CloseCircleOutlined /> },
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = drawerWidth;
        const onMouseMove = (moveEvent: MouseEvent) => {
            const offset = startX - moveEvent.clientX;
            setDrawerWidth(Math.max(400, Math.min(window.innerWidth - 100, startWidth + offset)));
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const columns = [
        {
            title: t('executionHistory.executionId'),
            dataIndex: 'id',
            key: 'id',
        },
        {
            title: t('executionHistory.taskTemplate'),
            dataIndex: 'task_name',
            key: 'task_name',
            ellipsis: true,
            render: (text: string) => <Text>{text}</Text>
        },
        {
            title: t('executionHistory.targetResourcePool'),
            dataIndex: 'resource_pool_name',
            key: 'resource_pool_name',
            ellipsis: true,
        },
        {
            title: t('executionHistory.status'),
            dataIndex: 'status',
            key: 'status',
            render: (val: string) => {
                const s = statusMap[val] || { color: 'default', text: val };
                return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
            }
        },
        {
            title: t('executionHistory.executor'),
            dataIndex: 'executor_name',
            key: 'executor_name',
            render: (val: string) => <Tag color="orange">{val || t('executionHistory.system')}</Tag>
        },
        {
            title: t('executionHistory.createTime'),
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => val ? new Date(val).toLocaleString() : '-'
        },
        {
            title: t('executionHistory.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {hasPermission('tasks:ansible_executions:view') && (
                        <Button
                            type="link"
                            size="small"
                            icon={<UnorderedListOutlined />}
                            onClick={() => {
                                setActiveExecutionId(record.id);
                                setLogDrawerVisible(true);
                            }}
                        >
                            {t('executionHistory.logs')}
                        </Button>
                    )}
                    {(record.status === 'running' || record.status === 'pending') && (
                        <Button
                            type="link"
                            size="small"
                            danger
                            icon={<StopOutlined />}
                            onClick={() => {
                                modal.confirm({
                                    title: t('executionHistory.confirmStopTask'),
                                    content: t('executionHistory.forceStopKillProcess'),
                                    onOk: () => terminateMutation.mutate(record.id),
                                    okText: t('executionHistory.forceStop'),
                                    cancelText: t('executionHistory.cancel'),
                                    okButtonProps: { danger: true }
                                });
                            }}
                            loading={terminateMutation.isPending && terminateMutation.variables === record.id}
                        >
                            {t('executionHistory.stop')}
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <Card
            title={
                <Space>
                    <HistoryOutlined className="text-amber-500" />
                    <span>{t('executionHistory.title')}</span>
                </Space>
            }
        >
            <div className="mb-4 flex flex-wrap gap-4 items-end">
                <Input
                    prefix={<SearchOutlined />}
                    placeholder={t('executionHistory.searchByTaskName')}
                    style={{ width: 200 }}
                    onPressEnter={(e: any) => setParams({ ...params, task_name: e.target.value })}
                    allowClear
                />
                <Select
                    allowClear
                    placeholder={t('executionHistory.executionStatus')}
                    style={{ width: 120 }}
                    options={[
                        { label: t('executionHistory.success'), value: 'success' },
                        { label: t('executionHistory.failed'), value: 'failed' },
                        { label: t('executionHistory.running'), value: 'running' },
                        { label: t('executionHistory.pending'), value: 'pending' },
                    ]}
                    onChange={(val) => setParams({ ...params, status: val })}
                />
                <Button
                    icon={<FilterOutlined />}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    type={showAdvanced ? 'primary' : 'default'}
                >
                    {t('executionHistory.advancedFilter')}
                </Button>
                {showAdvanced && (
                    <>
                        <DatePicker.RangePicker
                            onChange={(dates) => {
                                if (dates && dates[0] && dates[1]) {
                                    setParams({
                                        ...params,
                                        start_time: dates[0].startOf('day').toISOString(),
                                        end_time: dates[1].endOf('day').toISOString(),
                                    });
                                } else {
                                    const { start_time, end_time, ...rest } = params;
                                    setParams(rest);
                                }
                            }}
                            style={{ width: 280 }}
                        />
                        <Input
                            placeholder={t('executionHistory.searchByExecutor')}
                            style={{ width: 150 }}
                            onPressEnter={(e: any) => setParams({ ...params, executor_name: e.target.value })}
                            allowClear
                        />
                        <Button
                            onClick={() => setParams({ page: 1, size: 20 })}
                            icon={<SyncOutlined />}
                        >
                            {t('common.reset')}
                        </Button>
                    </>
                )}
            </div>

            <Table
                dataSource={executionData?.data}
                columns={columns}
                rowKey="id"
                loading={listLoading}
                scroll={{ x: 'max-content' }}
               
                pagination={{
                    total: executionData?.total,
                    pageSize: params.size,
                    current: params.page,
                    onChange: (page) => setParams({ ...params, page })
                }}
            />

            <Drawer
                title={t('executionHistory.logDetails', { id: activeExecutionId })}
                placement="right"
                size={drawerWidth}
                onClose={() => {
                    setLogDrawerVisible(false);
                    // 关闭抽屉时清除 URL 参数，防止刷新重复打开或返回逻辑异常
                    if (searchParams.has('id')) {
                        searchParams.delete('id');
                        setSearchParams(searchParams, { replace: true });
                    }
                }}
                open={logDrawerVisible}
                styles={{ body: { position: 'relative', padding: '12px' } }}
            >
                <div
                    className="absolute left-0 top-0 bottom-0 w-1 cursor-w-resize hover:bg-blue-400 bg-transparent z-1001"
                    onMouseDown={handleMouseDown}
                />
                <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-auto h-full shadow-inner">
                    {logsLoading ? (
                        <LogSkeleton />
                        // <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                        //     <LoadingOutlined style={{ fontSize: 24 }} />
                        //     <span>正在拉取实时日志...</span>
                        // </div>
                    ) : logs && logs.length > 0 ? (
                        logs.map((log: any, idx: number) => (
                            <div key={idx} className="mb-4 border-b border-slate-700 pb-2 last:border-0">
                                <div className="text-amber-400 mb-1 flex justify-between">
                                    <span>[HOST: {log.host}]</span>
                                    <span className="opacity-40">{new Date(log.create_time).toLocaleTimeString()}</span>
                                </div>
                                <pre className="whitespace-pre-wrap pl-2 border-l-2 border-slate-600 m-0 text-slate-300">
                                    {log.output}
                                </pre>
                            </div>
                        ))
                    ) : (
                        <div className="text-slate-500 italic flex flex-col items-center justify-center h-full gap-2">
                            <SyncOutlined />
                            <span>{t('executionHistory.noLogsOutputWaitTask')}</span>
                        </div>
                    )}
                </div>
            </Drawer>
        </Card>
    );
};

export default ExecutionHistory;
