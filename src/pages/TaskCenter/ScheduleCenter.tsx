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
    App,
    Tooltip,
    Popconfirm,
    Switch,
} from 'antd';
import {
    PlusOutlined,
    ClockCircleOutlined,
    EditOutlined,
    DeleteOutlined,
    PlayCircleOutlined,
    PauseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, toggleSchedule, triggerSchedule } from '../../api/tasks';
import { getAnsibleTasks } from '../../api/tasks';
import useAppStore from '../../store/useAppStore';
import { TableSkeleton } from '../../components/Skeletons';

const { Text } = Typography;

const ScheduleCenter: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { token, hasPermission } = useAppStore();
    const [form] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<any>(null);
    const [scheduleType, setScheduleType] = useState('cron');

    // 获取调度列表
    const { data: scheduleData, isLoading } = useQuery({
        queryKey: ['ansible-schedules'],
        queryFn: () => getSchedules(),
        enabled: !!token,
    });

    // 获取任务模板列表（用于下拉选择）
    const { data: taskData } = useQuery({
        queryKey: ['ansible-tasks'],
        queryFn: () => getAnsibleTasks({ page: 1, size: 100 }),
        enabled: !!token,
    });

    // 创建/更新调度
    const saveMutation = useMutation({
        mutationFn: (values: any) => {
            if (editingSchedule) {
                return updateSchedule(editingSchedule.id, values);
            }
            return createSchedule(values);
        },
        onSuccess: () => {
            message.success(editingSchedule ? t('schedule.updateSuccess') : t('schedule.createSuccess'));
            setIsModalOpen(false);
            setEditingSchedule(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['ansible-schedules'] });
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.error || t('common.error'));
        },
    });

    // 删除调度
    const deleteMutation = useMutation({
        mutationFn: deleteSchedule,
        onSuccess: () => {
            message.success(t('schedule.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['ansible-schedules'] });
        },
    });

    // 启停切换
    const toggleMutation = useMutation({
        mutationFn: ({ id }: { id: number }) => toggleSchedule(id),
        onSuccess: (res: any) => {
            message.success(res.is_enabled ? t('schedule.toggleEnabled') : t('schedule.toggleDisabled'));
            queryClient.invalidateQueries({ queryKey: ['ansible-schedules'] });
        },
    });

    // 手动触发
    const triggerMutation = useMutation({
        mutationFn: triggerSchedule,
        onSuccess: (res: any) => {
            message.success(t('schedule.triggered'));
            queryClient.invalidateQueries({ queryKey: ['ansible-executions'] });
        },
    });

    const handleEdit = (record: any) => {
        setEditingSchedule(record);
        setScheduleType(record.schedule_type || 'cron');
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const columns = [
        {
            title: t('schedule.name'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (val: string) => <Text strong>{val}</Text>,
        },
        {
            title: t('schedule.taskName'),
            dataIndex: 'task_name',
            key: 'task_name',
            ellipsis: true,
        },
        {
            title: t('schedule.scheduleType'),
            dataIndex: 'schedule_type',
            key: 'schedule_type',
            render: (val: string) => (
                <Tag color={val === 'interval' ? 'blue' : 'purple'}>
                    {val === 'interval' ? t('schedule.interval') : t('schedule.cron')}
                </Tag>
            ),
        },
        {
            title: t('schedule.expression'),
            key: 'expression',
            render: (_: any, record: any) => {
                if (record.schedule_type === 'interval') {
                    return `${record.interval_value} ${t(`schedule.${record.interval_unit}`)}`;
                }
                return <Tag>{record.cron_expression}</Tag>;
            },
        },
        {
            title: t('schedule.nextRunTime'),
            dataIndex: 'next_run_time',
            key: 'next_run_time',
            render: (val: string) => val ? new Date(val).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '-',
        },
        {
            title: t('schedule.status'),
            dataIndex: 'is_enabled',
            key: 'is_enabled',
            render: (val: boolean, record: any) => (
                <Switch
                    checked={val}
                    onChange={() => toggleMutation.mutate({ id: record.id })}
                    checkedChildren={<PlayCircleOutlined />}
                    unCheckedChildren={<PauseCircleOutlined />}
                    loading={toggleMutation.isPending && toggleMutation.variables?.id === record.id}
                />
            ),
        },
        {
            title: t('schedule.creator'),
            dataIndex: 'creator_name',
            key: 'creator_name',
            ellipsis: true,
        },
        {
            title: t('common.actions'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Tooltip title={t('schedule.triggerNow')}>
                        <Button
                            type="link"
                            size="small"
                            icon={<PlayCircleOutlined />}
                            onClick={() => triggerMutation.mutate(record.id)}
                            loading={triggerMutation.isPending && triggerMutation.variables === record.id}
                        />
                    </Tooltip>
                    {hasPermission('tasks:ansible_schedules:edit') && (
                        <Tooltip title={t('common.edit')}>
                            <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}
                            />
                        </Tooltip>
                    )}
                    {hasPermission('tasks:ansible_schedules:delete') && (
                        <Popconfirm
                            title={t('schedule.confirmDelete')}
                            onConfirm={() => deleteMutation.mutate(record.id)}
                        >
                            <Tooltip title={t('common.delete')}>
                                <Button
                                    type="link"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={
                <Space>
                    <ClockCircleOutlined className="text-green-500" />
                    <span>{t('schedule.title')}</span>
                </Space>
            }
            extra={
                <Space>
                    {hasPermission('tasks:ansible_schedules:add') && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => { setEditingSchedule(null); setScheduleType('cron'); form.resetFields(); setIsModalOpen(true); }}
                        >
                            {t('schedule.createSchedule')}
                        </Button>
                    )}
                </Space>
            }
        >
            {isLoading ? (
                <TableSkeleton />
            ) : (
                <Table
                    dataSource={scheduleData?.data}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        total: scheduleData?.total,
                        pageSize: 20,
                    }}
                />
            )}

            <Modal
                title={editingSchedule ? t('schedule.editSchedule') : t('schedule.createSchedule')}
                open={isModalOpen}
                onCancel={() => { setIsModalOpen(false); setEditingSchedule(null); form.resetFields(); }}
                onOk={() => form.submit()}
                confirmLoading={saveMutation.isPending}
                width={500}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    onFinish={(values) => saveMutation.mutate(values)}
                >
                    <Form.Item label={t('schedule.name')} name="name" rules={[{ required: true }]}>
                        <Input placeholder={t('schedule.namePlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('schedule.task')} name="task" rules={[{ required: true }]}>
                        <Select
                            placeholder={t('schedule.selectTask')}
                            options={taskData?.data?.map((t: any) => ({ label: t.name, value: t.id }))}
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </Form.Item>
                    <Form.Item label={t('schedule.scheduleType')} name="schedule_type" initialValue="cron">
                        <Select
                            options={[
                                { label: t('schedule.cron'), value: 'cron' },
                                { label: t('schedule.interval'), value: 'interval' },
                            ]}
                            onChange={(val) => setScheduleType(val)}
                        />
                    </Form.Item>
                    {scheduleType === 'cron' ? (
                        <Form.Item
                            label={t('schedule.cronExpression')}
                            name="cron_expression"
                            initialValue="0 3 * * *"
                            rules={[{ required: true }]}
                            extra={t('schedule.cronHelp')}
                        >
                            <Input placeholder="0 3 * * *" />
                        </Form.Item>
                    ) : (
                        <Space>
                            <Form.Item
                                label={t('schedule.intervalValue')}
                                name="interval_value"
                                initialValue={1}
                                rules={[{ required: true }]}
                            >
                                <Input type="number" min={1} style={{ width: 100 }} />
                            </Form.Item>
                            <Form.Item
                                label={t('schedule.intervalUnit')}
                                name="interval_unit"
                                initialValue="hours"
                                rules={[{ required: true }]}
                            >
                                <Select
                                    style={{ width: 120 }}
                                    options={[
                                        { label: t('schedule.minutes'), value: 'minutes' },
                                        { label: t('schedule.hours'), value: 'hours' },
                                        { label: t('schedule.days'), value: 'days' },
                                    ]}
                                />
                            </Form.Item>
                        </Space>
                    )}
                    <Form.Item label={t('schedule.isEnabled')} name="is_enabled" valuePropName="checked" initialValue={true}>
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ScheduleCenter;
