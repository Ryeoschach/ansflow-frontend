import React, { useState } from 'react';
import { Card, Table, Switch, Button, Space, message, Tag, Modal, Form, Input, Select, InputNumber } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPeriodicTasks, partialUpdatePeriodicTask, updatePeriodicTaskSchedule } from '@/api/periodic_task';
import { SyncOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import useAppStore from '@/store/useAppStore';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

const PeriodicTask: React.FC = () => {
    const queryClient = useQueryClient();
    const { hasPermission } = useAppStore();
    const { t } = useTranslation();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [form] = Form.useForm();
    const [scheduleType, setScheduleType] = useState('interval');

    const { data: tasks, isLoading } = useQuery({
        queryKey: ['periodicTasks', page, pageSize],
        queryFn: () => getPeriodicTasks({ page, page_size: pageSize }),
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, enabled }: { id: number, enabled: boolean }) => partialUpdatePeriodicTask(id, { enabled }),
        onSuccess: () => {
            message.success(t('periodicTask.updateStatusSuccess'));
            queryClient.invalidateQueries({ queryKey: ['periodicTasks'] });
        },
        onError: () => {
            message.error(t('periodicTask.updateStatusFailed'));
        }
    });

    const updateScheduleMutation = useMutation({
        mutationFn: (data: any) => updatePeriodicTaskSchedule(editingTask.id, data),
        onSuccess: () => {
            message.success(t('periodicTask.updateScheduleSuccess'));
            setIsModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['periodicTasks'] });
        },
        onError: () => {
            message.error(t('periodicTask.updateScheduleFailed'));
        }
    });

    const handleEdit = (record: any) => {
        setEditingTask(record);
        let type = 'interval';
        let initialValues: any = {
            schedule_type: 'interval',
            args: record.args || '[]',
            kwargs: record.kwargs || '{}',
        };

        if (record.crontab_detail) {
            type = 'crontab';
            initialValues = {
                ...initialValues,
                schedule_type: 'crontab',
                crontab_minute: record.crontab_detail.minute,
                crontab_hour: record.crontab_detail.hour,
                crontab_day_of_week: record.crontab_detail.day_of_week,
                crontab_day_of_month: record.crontab_detail.day_of_month,
                crontab_month_of_year: record.crontab_detail.month_of_year,
            };
        } else if (record.interval_detail) {
            initialValues = {
                ...initialValues,
                schedule_type: 'interval',
                interval_every: record.interval_detail.every,
                interval_period: record.interval_detail.period,
            };
        } else {
            // 默认值
            initialValues = {
                ...initialValues,
                interval_every: 60,
                interval_period: 'seconds',
            };
        }

        setScheduleType(type);
        form.setFieldsValue(initialValues);
        setIsModalVisible(true);
    };

    const handleModalOk = () => {
        form.validateFields().then(values => {
            const payload: any = {
                args: values.args,
                kwargs: values.kwargs,
                schedule_type: values.schedule_type
            };

            if (values.schedule_type === 'interval') {
                payload.every = values.interval_every;
                payload.period = values.interval_period;
            } else {
                payload.crontab = {
                    minute: values.crontab_minute,
                    hour: values.crontab_hour,
                    day_of_week: values.crontab_day_of_week,
                    day_of_month: values.crontab_day_of_month,
                    month_of_year: values.crontab_month_of_year,
                };
            }
            updateScheduleMutation.mutate(payload);
        });
    };

    const columns = [
        {
            title: t('periodicTask.taskName'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('periodicTask.taskMethod'),
            dataIndex: 'task',
            key: 'task',
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: t('periodicTask.scheduleRule'),
            key: 'schedule',
            render: (_: any, record: any) => {
                if (record.interval_detail) {
                    return t('periodicTask.every', { every: record.interval_detail.every, period: record.interval_detail.period });
                }
                if (record.crontab_detail) {
                    return `${record.crontab_detail.minute} ${record.crontab_detail.hour} ${record.crontab_detail.day_of_week} ${record.crontab_detail.day_of_month} ${record.crontab_detail.month_of_year}`;
                }
                return '-';
            }
        },
        {
            title: t('periodicTask.enabledStatus'),
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled: boolean, record: any) => (
                <Switch 
                    checked={enabled} 
                    disabled={!hasPermission('system:periodic_tasks:edit')}
                    onChange={(checked) => toggleStatusMutation.mutate({ id: record.id, enabled: checked })}
                />
            )
        },
        {
            title: t('periodicTask.lastRunTime'),
            dataIndex: 'last_run_at',
            key: 'last_run_at',
            render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'
        },
        {
            title: t('common.actions'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {hasPermission('system:periodic_tasks:edit') && (
                        <Button 
                            type="link" 
                            size="small" 
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        >
                            {t('periodicTask.configure')}
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    const getListData = (data: any) => {
        if (!data) return [];
        if (data.total !== undefined && Array.isArray(data.data)) return data.data;
        if (data.data !== undefined && Array.isArray(data.data)) return data.data;
        if (Array.isArray(data)) return data;
        if (data.results !== undefined && Array.isArray(data.results)) return data.results;
        return [];
    };

    const getCount = (data: any) => {
        if (!data) return 0;
        if (typeof data.total === 'number') return data.total;
        if (data.data && typeof data.data.total === 'number') return data.data.total;
        if (typeof data.count === 'number') return data.count;
        return getListData(data).length;
    };

    const taskList = getListData(tasks);
    const totalCount = getCount(tasks);

    return (
        <div className="p-6">
            <Card 
                title={t('periodicTask.title')}
                extra={
                    <Button icon={<SyncOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['periodicTasks'] })}>
                        {t('common.refresh')}
                    </Button>
                }
            >
                <Table
                    columns={columns}
                    dataSource={taskList}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{
                        current: page,
                        pageSize: pageSize,
                        total: totalCount,
                        showSizeChanger: true,
                        onChange: (p, s) => {
                            setPage(p);
                            setPageSize(s);
                        }
                    }}
                />
            </Card>

            <Modal
                title={t('periodicTask.configTask', { name: editingTask?.name })}
                open={isModalVisible}
                onOk={handleModalOk}
                onCancel={() => setIsModalVisible(false)}
                confirmLoading={updateScheduleMutation.isPending}
                width={600}
                destroyOnClose
            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item label={t('periodicTask.args')} name="args" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} placeholder={t('periodicTask.argsPlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('periodicTask.kwargs')} name="kwargs" rules={[{ required: true }]}>
                        <Input.TextArea rows={2} placeholder={t('periodicTask.kwargsPlaceholder')} />
                    </Form.Item>
                    
                    <Form.Item label={t('periodicTask.scheduleType')} name="schedule_type">
                        <Select onChange={(val) => setScheduleType(val)}>
                            <Option value="interval">{t('periodicTask.interval')}</Option>
                            <Option value="crontab">{t('periodicTask.crontab')}</Option>
                        </Select>
                    </Form.Item>

                    {scheduleType === 'interval' && (
                        <div className="flex gap-4">
                            <Form.Item label={t('periodicTask.intervalValue')} name="interval_every" className="flex-1" rules={[{ required: true }]}>
                                <InputNumber min={1} className="w-full" />
                            </Form.Item>
                            <Form.Item label={t('periodicTask.timeUnit')} name="interval_period" className="flex-1" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="seconds">{t('periodicTask.seconds')}</Option>
                                    <Option value="minutes">{t('periodicTask.minutes')}</Option>
                                    <Option value="hours">{t('periodicTask.hours')}</Option>
                                    <Option value="days">{t('periodicTask.days')}</Option>
                                </Select>
                            </Form.Item>
                        </div>
                    )}

                    {scheduleType === 'crontab' && (
                        <div className="grid grid-cols-5 gap-2">
                            <Form.Item label={t('periodicTask.minute')} name="crontab_minute" rules={[{ required: true }]}>
                                <Input placeholder="*" />
                            </Form.Item>
                            <Form.Item label={t('periodicTask.hour')} name="crontab_hour" rules={[{ required: true }]}>
                                <Input placeholder="*" />
                            </Form.Item>
                            <Form.Item label={t('periodicTask.day')} name="crontab_day_of_month" rules={[{ required: true }]}>
                                <Input placeholder="*" />
                            </Form.Item>
                            <Form.Item label={t('periodicTask.month')} name="crontab_month_of_year" rules={[{ required: true }]}>
                                <Input placeholder="*" />
                            </Form.Item>
                            <Form.Item label={t('periodicTask.week')} name="crontab_day_of_week" rules={[{ required: true }]}>
                                <Input placeholder="*" />
                            </Form.Item>
                        </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                        {t('periodicTask.cronTip')}
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default PeriodicTask;
