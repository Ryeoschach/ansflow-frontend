import React, { useState } from 'react';
import {
    Table,
    Card,
    Button,
    Modal,
    Form,
    Input,
    Select,
    Tag,
    Space,
    Typography,
    App, Tooltip,
} from 'antd';
import {
    PlusOutlined,
    PlayCircleOutlined,
    EditOutlined,
    PlaySquareOutlined,
    CopyOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnsibleTasks, createAnsibleTask, updateAnsibleTask, runAnsibleTask, deleteAnsibleTask } from '../../api/tasks';
import { getResourcePools } from '../../api/hosts';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';
import { useNavigate } from 'react-router-dom';
import { TableSkeleton } from '../../components/Skeletons';


const { Text } = Typography;

const TaskCenter: React.FC = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { message } = App.useApp();
    const { token, hasPermission } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);

    // 1. 获取任务模板列表
    const { data: taskData, isLoading: listLoading } = useQuery({
        queryKey: ['ansible-tasks'],
        queryFn: () => getAnsibleTasks({ page: 1, size: 50 }),
        enabled: !!token,
    });

    // 2. 获取资源池列表
    const { data: poolData } = useQuery({
        queryKey: ['resource-pools-all'],
        queryFn: () => getResourcePools({ page: 1, size: 100 }),
        enabled: !!token && isCreateModalOpen,
    });

    // 3. 保存 (创建/更新)
    const saveMutation = useMutation({
        mutationFn: (values: any) => editingTask ? updateAnsibleTask(editingTask.id, values) : createAnsibleTask(values),
        onSuccess: () => {
            message.success(editingTask ? "模板更新成功" : "任务模板创建成功");
            setIsCreateModalOpen(false);
            setEditingTask(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
        },
    });

    // 4. 触发运行
    const runMutation = useMutation({
        mutationFn: runAnsibleTask,
        onSuccess: () => {
            message.success("任务已触发执行，正在跳转到历史记录...");
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
            // 跳转到执行记录页面
            navigate('/v1/task/executions');
        },
    });

    // 5. 删除模板
    const deleteMutation = useMutation({
        mutationFn: deleteAnsibleTask,
        onSuccess: () => {
            message.success("模板已删除");
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
        }
    });

    const handleEdit = (record: number) => {
        setEditingTask(record);
        form.setFieldsValue(record);
        setIsCreateModalOpen(true);
    }

    const columns = [
        {
            title: '模板名称',
            dataIndex: 'name',
            key: 'name',
            render: (val: string) => <Text strong>{val}</Text>
        },
        {
            title: '类型',
            dataIndex: 'task_type',
            key: 'task_type',
            render: (val: string) => val === 'cmd' ? <Tag color="blue">命令模式</Tag> : <Tag color="purple">剧本模式</Tag>
        },
        {
            title: '目标资源池',
            dataIndex: 'resource_pool_name',
            key: 'resource_pool_name',
        },
        {
            title: '最近状态',
            dataIndex: 'last_execution_status',
            key: 'last_execution_status',
            render: (val: string) => {
                if (!val) return <Tag>从未运行</Tag>;
                const colorMap: any = { 'success': 'success', 'failed': 'error', 'running': 'processing' };
                return <Tag color={colorMap[val] || 'default'}>{val.toUpperCase()}</Tag>;
            }
        },
        {
            title: '创建者',
            dataIndex: 'creator_name',
            key: 'creator_name',
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {hasPermission('tasks:ansible_tasks:run') && (
                        <Tooltip title="运行">
                            <Button
                                type="link"
                                size="small"
                                icon={<PlaySquareOutlined />}
                                onClick={() => runMutation.mutate(record.id)}
                                loading={runMutation.isPending && runMutation.variables === record.id}
                            >
                                立即运行
                            </Button>
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_tasks:edit') && (
                        <Tooltip title="编辑">
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                                编辑
                            </Button>
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_tasks:add') && (
                        <Tooltip title="克隆">
                            <Button 
                                type="link" 
                                size="small" 
                                icon={<CopyOutlined />}
                                onClick={() => {
                                    setEditingTask(null);
                                    form.setFieldsValue({ ...record, name: `${record.name} (复制)` });
                                    setIsCreateModalOpen(true);
                                }}
                            >
                                克隆
                            </Button>
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_tasks:delete') && (
                        <Tooltip title="删除">
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => deleteMutation.mutate(record.id)}
                            />
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ];

    return (
        <Card 
            title={
                <Space>
                    <PlayCircleOutlined className="text-blue-500" />
                    <span>Ansible 任务模板管理</span>
                </Space>
            }
            extra={
                <Space>
                    {/*<Button onClick={() => navigate('/v1/task/executions')}>查看执行历史</Button>*/}
                    {(hasPermission('*') || hasPermission('tasks:ansible_tasks:add')) && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>创建新模板</Button>
                    )}
                </Space>
            }
        >
            {listLoading ? (
                <TableSkeleton /> // 加载时显示骨架
            ) : (
            <Table 
                dataSource={taskData?.data}
                columns={columns}
                rowKey="id"
                loading={listLoading}
                scroll={{ x: 1200 }}
            />
                )}
            <Modal
                title={editingTask ? "编辑模板" : "创建任务模板"}
                open={isCreateModalOpen}
                onCancel={() => { setIsCreateModalOpen(false); setEditingTask(null); }}
                onOk={() => form.submit()}
                width={isMobile ? '95vw' : 800}
                bodyStyle={{ overflowX: 'auto' }}
                confirmLoading={saveMutation.isPending}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    initialValues={{ task_type: 'cmd' }}
                    onFinish={saveMutation.mutate}
                >
                    <Form.Item label="模板名称" name="name" rules={[{ required: true }]}>
                        <Input placeholder="任务名称摘要" />
                    </Form.Item>
                    <div className="flex flex-col md:flex-row gap-4">
                        <Form.Item label="类型" name="task_type" className="flex-1">
                            <Select options={[{label: 'Ad-hoc (Shell)', value: 'cmd'}, {label: 'Playbook', value: 'playbook'}]} />
                        </Form.Item>
                        <Form.Item label="目标资源池" name="resource_pool" className="flex-1">
                            <Select options={poolData?.data?.map((p: any) => ({ label: p.name, value: p.id }))} />
                        </Form.Item>
                        <Form.Item label="超时(秒)" name="timeout" className="w-full md:w-32" initialValue={3600}>
                            <Input type="number" placeholder="3600" />
                        </Form.Item>
                    </div>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.task_type !== curr.task_type}>
                        {() => (
                            <Form.Item label="内容" name="content" rules={[{ required: true }]}>
                                <Input.TextArea rows={10} className="font-mono text-xs" />
                            </Form.Item>
                        )}
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default TaskCenter;
