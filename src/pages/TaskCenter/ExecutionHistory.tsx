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
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExecutions, getExecutionLogs, terminateExecution } from '../../api/tasks';
import useAppStore from '../../store/useAppStore';
import { LogSkeleton } from '../../components/Skeletons';


const { Text } = Typography;

const ExecutionHistory: React.FC = () => {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const { message, modal } = App.useApp();
    const { token, hasPermission } = useAppStore();
    const [logDrawerVisible, setLogDrawerVisible] = useState(false);
    const [activeExecutionId, setActiveExecutionId] = useState<number | null>(null);
    const [drawerWidth, setDrawerWidth] = useState(800);

    // 筛选状态
    const [params, setParams] = useState<any>({ page: 1, size: 20 });
    
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
            message.success("终止指令已发送");
            queryClient.invalidateQueries({ queryKey: ['ansible-executions'] });
        },
        onError: (err: any) => {
            message.error(err.response?.data?.error || "终止失败");
        }
    });

    const statusMap: any = {
        'pending': { color: 'default', text: '排队中', icon: <SyncOutlined spin /> },
        'running': { color: 'processing', text: '执行中', icon: <LoadingOutlined /> },
        'success': { color: 'success', text: '成功', icon: <CheckCircleOutlined /> },
        'failed': { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
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
            title: '执行 ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
        },
        {
            title: '任务模板',
            dataIndex: 'task_name',
            key: 'task_name',
            render: (text: string) => <Text>{text}</Text>
        },
        {
            title: '目标资源池',
            dataIndex: 'resource_pool_name',
            key: 'resource_pool_name',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (val: string) => {
                const s = statusMap[val] || { color: 'default', text: val };
                return <Tag color={s.color} icon={s.icon}>{s.text}</Tag>;
            }
        },
        {
            title: '执行者',
            dataIndex: 'executor_name',
            key: 'executor_name',
            render: (val: string) => <Tag color="orange">{val || '系统'}</Tag>
        },
        {
            title: '创建时间',
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => val ? new Date(val).toLocaleString() : '-'
        },
        {
            title: '操作',
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
                            日志
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
                                    title: '确认停止任务？',
                                    content: '强制停止将杀死正在执行的远程进程。',
                                    onOk: () => terminateMutation.mutate(record.id),
                                    okText: '强制停止',
                                    cancelText: '取消',
                                    okButtonProps: { danger: true }
                                });
                            }}
                            loading={terminateMutation.isPending && terminateMutation.variables === record.id}
                        >
                            停止
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
                    <span>执行历史审计</span>
                </Space>
            }
        >
            <div className="mb-4 flex gap-4">
                <Input
                    prefix={<SearchOutlined />}
                    placeholder="任务名关键字"
                    style={{ width: 200 }}
                    onPressEnter={(e: any) => setParams({ ...params, task_name: e.target.value })}
                />
                <Select
                    allowClear
                    placeholder="执行状态"
                    style={{ width: 120 }}
                    options={[
                        { label: '成功', value: 'success' },
                        { label: '失败', value: 'failed' },
                        { label: '运行中', value: 'running' },
                    ]}
                    onChange={(val) => setParams({ ...params, status: val })}
                />
            </div>

            <Table
                dataSource={executionData?.data}
                columns={columns}
                rowKey="id"
                loading={listLoading}
                pagination={{
                    total: executionData?.total,
                    pageSize: params.size,
                    current: params.page,
                    onChange: (page) => setParams({ ...params, page })
                }}
            />

            <Drawer
                title={`日志详情 [#${activeExecutionId}]`}
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
                            <span>暂无日志输出，请等待任务开始...</span>
                        </div>
                    )}
                </div>
            </Drawer>
        </Card>
    );
};

export default ExecutionHistory;
