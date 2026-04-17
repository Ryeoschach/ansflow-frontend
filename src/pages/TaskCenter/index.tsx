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
import { useTranslation } from 'react-i18next';


const { Text } = Typography;

const TaskCenter: React.FC = () => {
    const { t } = useTranslation();
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
            message.success(editingTask ? t('taskCenter.updateSuccess') : t('taskCenter.createSuccess'));
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
            message.success(t('taskCenter.runTriggered'));
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
            navigate('/v1/task/executions');
        },
    });

    // 5. 删除模板
    const deleteMutation = useMutation({
        mutationFn: deleteAnsibleTask,
        onSuccess: () => {
            message.success(t('taskCenter.templateDeleteSuccess'));
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
            title: t('taskCenter.fieldName'),
            dataIndex: 'name',
            key: 'name',
            render: (val: string) => <Text strong>{val}</Text>
        },
        {
            title: t('taskCenter.fieldType'),
            dataIndex: 'task_type',
            key: 'task_type',
            render: (val: string) => val === 'cmd' ? <Tag color="blue">{t('taskCenter.taskTypeCmd')}</Tag> : <Tag color="purple">{t('taskCenter.taskTypePlaybook')}</Tag>
        },
        {
            title: t('taskCenter.fieldResourcePool'),
            dataIndex: 'resource_pool_name',
            key: 'resource_pool_name',
        },
        {
            title: t('taskCenter.status'),
            dataIndex: 'last_execution_status',
            key: 'last_execution_status',
            render: (val: string) => {
                if (!val) return <Tag>{t('taskCenter.neverRun')}</Tag>;
                const colorMap: any = { 'success': 'success', 'failed': 'error', 'running': 'processing' };
                return <Tag color={colorMap[val] || 'default'}>{val.toUpperCase()}</Tag>;
            }
        },
        {
            title: t('taskCenter.triggerUser'),
            dataIndex: 'creator_name',
            key: 'creator_name',
        },
        {
            title: t('taskCenter.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {hasPermission('tasks:ansible_tasks:run') && (
                        <Tooltip title={t('taskCenter.runNow')}>
                            <Button
                                type="link"
                                size="small"
                                icon={<PlaySquareOutlined />}
                                onClick={() => runMutation.mutate(record.id)}
                                loading={runMutation.isPending && runMutation.variables === record.id}
                            >
                                {t('taskCenter.runNow')}
                            </Button>
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_tasks:edit') && (
                        <Tooltip title={t('common.edit')}>
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                                {t('common.edit')}
                            </Button>
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_tasks:add') && (
                        <Tooltip title={t('taskCenter.clone')}>
                            <Button
                                type="link"
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => {
                                    setEditingTask(null);
                                    form.setFieldsValue({ ...record, name: `${record.name} (copy)` });
                                    setIsCreateModalOpen(true);
                                }}
                            >
                                {t('taskCenter.clone')}
                            </Button>
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_tasks:delete') && (
                        <Tooltip title={t('common.delete')}>
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
                    <span>{t('taskCenter.title')}</span>
                </Space>
            }
            extra={
                <Space>
                    {(hasPermission('*') || hasPermission('tasks:ansible_tasks:add')) && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>{t('taskCenter.createNewTemplate')}</Button>
                    )}
                </Space>
            }
        >
            {listLoading ? (
                <TableSkeleton />
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
                title={editingTask ? t('taskCenter.modalTitleEdit') : t('taskCenter.modalTitleCreate')}
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
                    <Form.Item label={t('taskCenter.fieldName')} name="name" rules={[{ required: true }]}>
                        <Input placeholder={t('taskCenter.fieldName')} />
                    </Form.Item>
                    <div className="flex flex-col md:flex-row gap-4">
                        <Form.Item label={t('taskCenter.fieldType')} name="task_type" className="flex-1">
                            <Select options={[{label: 'Ad-hoc (Shell)', value: 'cmd'}, {label: 'Playbook', value: 'playbook'}]} />
                        </Form.Item>
                        <Form.Item label={t('taskCenter.fieldResourcePool')} name="resource_pool" className="flex-1">
                            <Select options={poolData?.data?.map((p: any) => ({ label: p.name, value: p.id }))} />
                        </Form.Item>
                        <Form.Item label={t('taskCenter.fieldTimeout')} name="timeout" className="w-full md:w-32" initialValue={3600}>
                            <Input type="number" placeholder="3600" />
                        </Form.Item>
                    </div>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.task_type !== curr.task_type}>
                        {() => (
                            <Form.Item label={t('taskCenter.fieldContent')} name="content" rules={[{ required: true }]}>
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
