import React, { useState, useEffect } from 'react';
import {
    Table,
    Card,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Tag,
    Space,
    Typography,
    App, Tooltip,
    Collapse,
    Descriptions,
    Segmented,
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
    RocketOutlined,
    ShareAltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnsibleTasks, createAnsibleTask, updateAnsibleTask, runAnsibleTask, deleteAnsibleTask, promoteAnsibleTask } from '../../api/tasks';
import { getResourcePools } from '../../api/hosts';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { TableSkeleton } from '../../components/Skeletons';
import { useTranslation } from 'react-i18next';
import ShareAssetModal from '../../components/ShareAssetModal';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';


const { Text } = Typography;

const TaskCenter: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { message } = App.useApp();
    const { token, hasPermission, currentProject } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [sharingTask, setSharingTask] = useState<any>(null);
    const [contentValue, setContentValue] = useState('');
    const [extraVars, setExtraVars] = useState<Array<{ key: string; value: string }>>([]);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewRecord, setPreviewRecord] = useState<any>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [createType, setCreateType] = useState<'manual' | 'ai'>('manual');
    const [promoteModalVisible, setPromoteModalVisible] = useState(false);
    const [promotingRecord, setPromotingRecord] = useState<any>(null);
    const [promoteForm] = Form.useForm();
    const isDark = document.documentElement.classList.contains('dark');

    // 1. 获取任务模板列表
    const { data: taskData, isLoading: listLoading } = useQuery({
        queryKey: ['ansible-tasks', page, pageSize, createType],
        queryFn: () => getAnsibleTasks({ page, size: pageSize, create_type: createType }),
        enabled: !!token,
    });

    useEffect(() => {
        setPage(1);
    }, [createType]);

    useEffect(() => {
        const editTaskId = searchParams.get('edit_task_id');
        if (editTaskId && taskData?.data) {
            const task = taskData.data.find((t: any) => t.id === Number(editTaskId));
            if (task) {
                handleEdit(task);
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('edit_task_id');
                navigate(`/v1/task/ansible?${newParams.toString()}`, { replace: true });
            }
        }
    }, [searchParams, taskData]);

    const { data: poolData } = useQuery({
        queryKey: ['resource-pools-all'],
        queryFn: () => getResourcePools({ page: 1, size: 100 }),
        enabled: !!token && isCreateModalOpen,
    });

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

    const runMutation = useMutation({
        mutationFn: runAnsibleTask,
        onSuccess: () => {
            message.success(t('taskCenter.runTriggered'));
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
            navigate('/v1/task/executions');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAnsibleTask,
        onSuccess: () => {
            message.success(t('taskCenter.templateDeleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
        }
    });

    const promoteMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name?: string } }) => promoteAnsibleTask(id, data),
        onSuccess: () => {
            message.success(t('taskCenter.promoteSuccess'));
            setPromoteModalVisible(false);
            setPromotingRecord(null);
            promoteForm.resetFields();
            queryClient.invalidateQueries({ queryKey: ['ansible-tasks'] });
        },
        onError: (err: any) => message.error(`${t('common.error')}: ${err.message}`)
    });

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
                    className="cursor-pointer hover:underline transition-all duration-200"
                    style={{ color: 'var(--ans-primary)' }}
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
            render: (val: string) => val === 'cmd' ? <Tag color="processing">{t('taskCenter.taskTypeCmd')}</Tag> : <Tag color="warning">{t('taskCenter.taskTypePlaybook')}</Tag>
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
                <Space size={0}>
                    {createType === 'manual' ? (
                        hasPermission('tasks:ansible_tasks:run') && (
                            <Tooltip title={t('taskCenter.runNow')}>
                                <Button
                                    type="link"
                                    size="small"
                                    icon={<PlaySquareOutlined />}
                                    style={{ color: 'var(--ans-primary)' }}
                                    onClick={() => { setPreviewRecord(record); setPreviewModalOpen(true); }}
                                    loading={runMutation.isPending && runMutation.variables === record.id}
                                >
                                    {t('taskCenter.runNow')}
                                </Button>
                            </Tooltip>
                        )
                    ) : (
                        hasPermission('tasks:ansible_tasks:edit') && (
                            <Tooltip title={t('taskCenter.promote')}>
                                <Button
                                    type="link"
                                    size="small"
                                    icon={<RocketOutlined />}
                                    style={{ color: 'var(--ans-success, #52c41a)' }}
                                    onClick={() => {
                                        setPromotingRecord(record);
                                        promoteForm.setFieldsValue({
                                            name: record.name.replace(/^AI_Auto_Task_/, ''),
                                            content: record.content,
                                        });
                                        setPromoteModalVisible(true);
                                    }}
                                >
                                    {t('taskCenter.promote')}
                                </Button>
                            </Tooltip>
                        )
                    )}
                    {(hasPermission('*') || hasPermission('tasks:ansible_tasks:edit')) && (
                        <Tooltip title={t('assetShare.crossProjectGrant')}>
                            <Button
                                type="link"
                                size="small"
                                icon={<ShareAltOutlined style={{ color: '#1677ff' }} />}
                                onClick={() => setSharingTask(record)}
                            />
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_tasks:edit') && (
                        <Tooltip title={t('common.edit')}>
                            <Button 
                                type="link" 
                                size="small" 
                                icon={<EditOutlined />} 
                                style={{ color: 'var(--ans-primary)' }}
                                onClick={() => handleEdit(record)}
                            >
                                {t('common.edit')}
                            </Button>
                        </Tooltip>
                    )}
                    {createType === 'manual' && hasPermission('tasks:ansible_tasks:add') && (
                        <Tooltip title={t('taskCenter.clone')}>
                            <Button
                                type="link"
                                size="small"
                                icon={<CopyOutlined />}
                                style={{ color: 'var(--ans-primary)' }}
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
                                style={{ color: 'var(--ans-error)' }}
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
            className="ans-card"
            title={
                <Space size="middle">
                    <PlayCircleOutlined style={{ color: 'var(--ans-primary)' }} />
                    <span className="font-bold tracking-tight text-ans-text-primary">{t('taskCenter.title')}</span>
                    <Link 
                        to="/v1/task/schedules" 
                        className="text-xs transition-all duration-300 opacity-60 hover:opacity-100 flex items-center gap-1 font-semibold"
                        style={{ color: 'var(--ans-text-primary)' }}
                    >
                        <ClockCircleOutlined style={{ fontSize: 12 }} /> {t('schedule.title')}
                    </Link>
                    <Segmented
                        value={createType}
                        onChange={(val) => setCreateType(val as 'manual' | 'ai')}
                        options={[
                            { label: t('taskCenter.manualTemplates'), value: 'manual' },
                            { label: t('taskCenter.aiDrafts'), value: 'ai' }
                        ]}
                        className="bg-ans-bg-layout/20 p-0.5 rounded-ans-md ml-4 text-xs font-normal"
                    />
                </Space>
            }
            extra={
                createType === 'manual' ? (
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
                ) : null
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
                rowSelection={createType === 'manual' && hasPermission('tasks:ansible_tasks:run') ? {
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                } : undefined}
                pagination={{
                    total: taskData?.total,
                    current: page,
                    pageSize: pageSize,
                    showSizeChanger: true,
                    showTotal: (total) => t('common.total', { total }),
                    onChange: (p, s) => {
                        setPage(p);
                        setPageSize(s);
                    }
                }}
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
                        <Form.Item label={t('taskCenter.forks')} name="forks" className="w-full md:w-32" initialValue={5}>
                            <InputNumber min={1} max={100} className="w-full" />
                        </Form.Item>
                        <Form.Item label={t('taskCenter.fieldTimeout')} name="timeout" className="w-full md:w-32" initialValue={3600}>
                            <Input type="number" placeholder="3600" />
                        </Form.Item>
                    </div>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.task_type !== curr.task_type}>
                        {() => (
                            <Form.Item label={t('taskCenter.fieldContent')} name="content" rules={[{ required: true }]}>
                                <div 
                                    className="border border-solid rounded-ans-md overflow-hidden transition-all duration-300"
                                    style={{ borderColor: 'var(--ans-border)' }}
                                >
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
                        ghost
                        className="mb-4 bg-ans-bg-layout/30 rounded-ans-md"
                        items={[{
                            key: '1',
                            label: <span className="text-xs font-medium opacity-70">{t('taskCenter.extraVars')}</span>,
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
                        <pre 
                            className="whitespace-pre-wrap text-[11px] p-4 rounded-ans-md max-h-40 overflow-auto border border-solid custom-scrollbar"
                            style={{ 
                                backgroundColor: 'color-mix(in srgb, var(--ans-bg-layout), transparent 50%)',
                                color: 'var(--ans-text-primary)',
                                borderColor: 'var(--ans-border)'
                            }}
                        >
                            {previewRecord?.content}
                        </pre>
                    </Descriptions.Item>
                    {previewRecord?.extra_vars && Object.keys(previewRecord.extra_vars).length > 0 && (
                        <Descriptions.Item label={t('taskCenter.extraVars')} span={2}>
                            <pre 
                                className="whitespace-pre-wrap text-[11px] p-4 rounded-ans-md max-h-32 overflow-auto border border-solid custom-scrollbar"
                                style={{ 
                                    backgroundColor: 'color-mix(in srgb, var(--ans-bg-layout), transparent 50%)',
                                    color: 'var(--ans-text-primary)',
                                    borderColor: 'var(--ans-border)'
                                }}
                            >
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
            <Modal
                title={t('taskCenter.promoteTitle')}
                open={promoteModalVisible}
                onCancel={() => {
                    setPromoteModalVisible(false);
                    setPromotingRecord(null);
                    promoteForm.resetFields();
                }}
                onOk={() => promoteForm.submit()}
                confirmLoading={promoteMutation.isPending}
            >
                <Form
                    form={promoteForm}
                    layout="vertical"
                    onFinish={(values) => {
                        if (promotingRecord) {
                            promoteMutation.mutate({ id: promotingRecord.id, data: values });
                        }
                    }}
                    className="mt-4"
                >
                    <Form.Item
                        label={t('taskCenter.promoteName')}
                        name="name"
                        rules={[{ required: true, message: t('taskCenter.promoteNamePlaceholder') }]}
                    >
                        <Input placeholder={t('taskCenter.promoteNamePlaceholder')} />
                    </Form.Item>
                    <Form.Item
                        label={t('taskCenter.promoteContent')}
                        name="content"
                        rules={[{ required: true, message: t('taskCenter.promoteContentPlaceholder') }]}
                    >
                        <Input.TextArea
                            autoSize={{ minRows: 6, maxRows: 15 }}
                            style={{
                                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace',
                                fontSize: '13px',
                                backgroundColor: '#141414',
                                color: '#d9d9d9',
                                border: '1px solid #434343',
                            }}
                        />
                    </Form.Item>
                </Form>
            </Modal>
            {sharingTask && currentProject && (
                <ShareAssetModal
                    open={!!sharingTask}
                    onClose={() => setSharingTask(null)}
                    assetType="ansible_task"
                    assetId={sharingTask.id}
                    assetName={sharingTask.name}
                    fromProjectId={currentProject.id}
                />
            )}
        </Card>
    );
};

export default TaskCenter;
