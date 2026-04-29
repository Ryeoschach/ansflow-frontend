import React, { useState, useEffect } from 'react';
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
    Collapse,
    Descriptions,
} from 'antd';
import {
    PlusOutlined,
    PlayCircleOutlined,
    EditOutlined,
    PlaySquareOutlined,
    CopyOutlined,
    DeleteOutlined,
    MinusCircleOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnsibleTasks, createAnsibleTask, updateAnsibleTask, runAnsibleTask, deleteAnsibleTask } from '../../api/tasks';
import { getResourcePools } from '../../api/hosts';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { TableSkeleton } from '../../components/Skeletons';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';


const { Text } = Typography;

const TaskCenter: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { message } = App.useApp();
    const { token, hasPermission } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [contentValue, setContentValue] = useState('');
    const [extraVars, setExtraVars] = useState<Array<{ key: string; value: string }>>([]);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<any>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const isDark = document.documentElement.classList.contains('dark');

    // 1. 获取任务模板列表
    const { data: taskData, isLoading: listLoading } = useQuery({
        queryKey: ['ansible-tasks'],
        queryFn: () => getAnsibleTasks({ page: 1, size: 50 }),
        enabled: !!token,
    });

    // 处理从历史页面跳转过来带 edit_task_id 参数（需要在 taskData 定义之后）
    useEffect(() => {
        const editTaskId = searchParams.get('edit_task_id');
        if (editTaskId && taskData?.data) {
            const task = taskData.data.find((t: any) => t.id === Number(editTaskId));
            if (task) {
                handleEdit(task);
                // 清除 URL 参数防止刷新后重复打开
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('edit_task_id');
                navigate(`/v1/task/ansible?${newParams.toString()}`, { replace: true });
            }
        }
    }, [searchParams, taskData]);

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
            setContentValue('');
            setExtraVars([]);
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

    // 6. 批量运行
    const batchRunMutation = useMutation({
        mutationFn: (ids: number[]) => Promise.all(ids.map(id => runAnsibleTask(id))),
        onSuccess: () => {
            message.success(t('taskCenter.batchRunTriggered'));
            setSelectedRowKeys([]);
            setBatchModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
            navigate('/v1/task/executions');
        },
    });

    const handleEdit = (record: any) => {
        setEditingTask(record);
        setContentValue(record.content || '');
        const parsed = parseExtraVars(record.extra_vars);
        setExtraVars(parsed);
        form.setFieldsValue({ ...record, extra_vars: record.extra_vars || '{}' });
        setIsCreateModalOpen(true);
    }

    const handleContentChange = (value: string) => {
        setContentValue(value);
        form.setFieldValue('content', value);
    };

    const handleAddExtraVar = () => {
        setExtraVars([...extraVars, { key: '', value: '' }]);
    };

    const handleRemoveExtraVar = (index: number) => {
        setExtraVars(extraVars.filter((_, i) => i !== index));
    };

    const handleExtraVarChange = (index: number, field: 'key' | 'value', val: string) => {
        const updated = [...extraVars];
        updated[index][field] = val;
        setExtraVars(updated);
        // Sync to form as JSON string
        const obj: Record<string, string> = {};
        updated.forEach(item => {
            if (item.key.trim()) {
                obj[item.key.trim()] = item.value;
            }
        });
        form.setFieldValue('extra_vars', JSON.stringify(obj));
    };

    const parseExtraVars = (extraVarsStr: string): Array<{ key: string; value: string }> => {
        if (!extraVarsStr) return [];
        try {
            const parsed = JSON.parse(extraVarsStr);
            return Object.entries(parsed).map(([key, value]) => ({ key, value: String(value) }));
        } catch {
            return [];
        }
    };

    const columns = [
        {
            title: t('taskCenter.fieldName'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (val: string, record: any) => (
                <Text
                    strong
                    className="cursor-pointer hover:underline"
                    onClick={() => handleEdit(record)}
                >
                    {val}
                </Text>
            )
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
            ellipsis: true,
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
            ellipsis: true,
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
                                onClick={() => { setPreviewRecord(record); setPreviewModalOpen(true); }}
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
                                    setContentValue(record.content || '');
                                    const parsed = parseExtraVars(record.extra_vars);
                                    setExtraVars(parsed);
                                    form.setFieldsValue({ ...record, name: `${record.name} (copy)`, extra_vars: record.extra_vars || '{}' });
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
                    <Link to="/v1/task/schedules" className="text-sm text-gray-500 hover:text-blue-500">
                        <ClockCircleOutlined /> {t('schedule.title')}
                    </Link>
                </Space>
            }
            extra={
                <Space>
                    {hasPermission('tasks:ansible_tasks:run') && selectedRowKeys.length > 0 && (
                        <Button icon={<PlaySquareOutlined />} onClick={() => setBatchModalOpen(true)}>
                            {t('taskCenter.batchRun')} ({selectedRowKeys.length})
                        </Button>
                    )}
                    {(hasPermission('*') || hasPermission('tasks:ansible_tasks:add')) && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEditingTask(null); setContentValue(''); setExtraVars([]); form.setFieldValue('extra_vars', '{}'); setIsCreateModalOpen(true); }}>{t('taskCenter.createNewTemplate')}</Button>
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
                scroll={{ x: 'max-content' }}
                rowSelection={hasPermission('tasks:ansible_tasks:run') ? {
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                } : undefined}
            />
                )}
            <Modal
                title={editingTask ? t('taskCenter.modalTitleEdit') : t('taskCenter.modalTitleCreate')}
                open={isCreateModalOpen}
                onCancel={() => { setIsCreateModalOpen(false); setEditingTask(null); setContentValue(''); setExtraVars([]); form.setFieldValue('extra_vars', '{}'); }}
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
                                <div className="border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                                    <CodeMirror
                                        value={contentValue}
                                        height="300px"
                                        theme={isDark ? 'dark' : 'light'}
                                        extensions={[yaml()]}
                                        onChange={handleContentChange}
                                        className="text-sm"
                                    />
                                </div>
                            </Form.Item>
                        )}
                    </Form.Item>
                    <Form.Item name="extra_vars" hidden noStyle />
                    <Collapse
                        className="mb-4"
                        items={[{
                            key: '1',
                            label: t('taskCenter.extraVars'),
                            children: (
                                <div className="space-y-2">
                                    {extraVars.map((item, index) => (
                                        <div key={index} className="flex gap-2 items-center">
                                            <Input
                                                placeholder="Key"
                                                value={item.key}
                                                onChange={(e) => handleExtraVarChange(index, 'key', e.target.value)}
                                                className="flex-1"
                                            />
                                            <Input
                                                placeholder="Value"
                                                value={item.value}
                                                onChange={(e) => handleExtraVarChange(index, 'value', e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                type="link"
                                                danger
                                                size="small"
                                                icon={<MinusCircleOutlined />}
                                                onClick={() => handleRemoveExtraVar(index)}
                                            />
                                        </div>
                                    ))}
                                    <Button
                                        type="dashed"
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={handleAddExtraVar}
                                        className="w-full"
                                    >
                                        {t('taskCenter.addExtraVar')}
                                    </Button>
                                </div>
                            ),
                        }]}
                    />
                </Form>
            </Modal>
            <Modal
                title={t('taskCenter.previewTitle')}
                open={previewModalOpen}
                onCancel={() => setPreviewModalOpen(false)}
                onOk={() => { setPreviewModalOpen(false); runMutation.mutate(previewRecord.id); }}
                okText={t('taskCenter.confirmRun')}
                cancelText={t('common.cancel')}
            >
                <Descriptions column={2} bordered size="small" className="mt-4">
                    <Descriptions.Item label={t('taskCenter.fieldName')}>{previewRecord?.name}</Descriptions.Item>
                    <Descriptions.Item label={t('taskCenter.fieldType')}>
                        {previewRecord?.task_type === 'cmd' ? t('taskCenter.taskTypeCmd') : t('taskCenter.taskTypePlaybook')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('taskCenter.fieldResourcePool')}>{previewRecord?.resource_pool_name}</Descriptions.Item>
                    <Descriptions.Item label={t('taskCenter.fieldTimeout')}>{previewRecord?.timeout}s</Descriptions.Item>
                    <Descriptions.Item label={t('taskCenter.fieldContent')} span={2}>
                        <pre className="whitespace-pre-wrap text-xs p-2 rounded max-h-40 overflow-auto !bg-gray-50 !text-gray-800">{previewRecord?.content}</pre>
                    </Descriptions.Item>
                    {previewRecord?.extra_vars && Object.keys(previewRecord.extra_vars).length > 0 && (
                        <Descriptions.Item label={t('taskCenter.extraVars')} span={2}>
                            <pre className="whitespace-pre-wrap text-xs p-2 rounded max-h-32 overflow-auto !bg-gray-50 !text-gray-800">
                                {JSON.stringify(previewRecord.extra_vars, null, 2)}
                            </pre>
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Modal>
            <Modal
                title={t('taskCenter.batchRunConfirm')}
                open={batchModalOpen}
                onCancel={() => setBatchModalOpen(false)}
                onOk={() => batchRunMutation.mutate(selectedRowKeys as number[])}
                okText={t('taskCenter.confirmRun')}
                cancelText={t('common.cancel')}
                confirmLoading={batchRunMutation.isPending}
            >
                <p className="mb-4">{t('taskCenter.batchRunTip', { count: selectedRowKeys.length })}</p>
                <div className="max-h-60 overflow-auto">
                    {taskData?.data
                        ?.filter((t: any) => Array.isArray(selectedRowKeys) && selectedRowKeys.includes(t.id))
                        .map((task: any) => (
                            <Tag key={task.id} className="mb-1 block">{task.name}</Tag>
                        ))}
                </div>
            </Modal>
        </Card>
    );
};

export default TaskCenter;
