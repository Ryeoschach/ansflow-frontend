import React, { useState } from 'react';
import { Card, Table, Tag, Button, Input, Space, theme, Modal, Form, Select, App as AntdApp } from 'antd';
import { PlusOutlined, SearchOutlined, CodeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TableSkeleton } from '../../../components/Skeletons';
import { getCIEnvironments, createCIEnvironment, updateCIEnvironment, deleteCIEnvironment } from '../../../api/pipeline';
import useAppStore from '../../../store/useAppStore';
import { useTranslation } from 'react-i18next';

interface CIEnvironment {
    id: string | number;
    name: string;
    image: string;
    type: string;
    status: 'READY' | 'PULLING' | 'ERROR';
    description: string;
}

const CIEnvironments: React.FC = () => {
    const { t } = useTranslation();
    const { token: _authToken, hasPermission } = useAppStore();
    const { isDark } = useAppStore();
    const { token: antdToken } = theme.useToken();
    const { message, modal } = AntdApp.useApp();
    const queryClient = useQueryClient();

    const [searchText, setSearchText] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | number | null>(null);
    const [form] = Form.useForm();

    const { data: response, isLoading } = useQuery({
        queryKey: ['ci-environments'],
        queryFn: () => getCIEnvironments(),
        enabled: !!_authToken && hasPermission('pipeline:ci_env:view'),
    });

    // DRF returns paginated object with .results, or direct array
    const environments: CIEnvironment[] = response?.data?.results || response?.data || [];

    const createMutation = useMutation({
        mutationFn: createCIEnvironment,
        onSuccess: () => {
            message.success(t('ciEnv.createSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ci-environments'] });
        },
        onError: () => message.error(t('ciEnv.createFailed'))
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string | number, data: any }) => updateCIEnvironment(id, data),
        onSuccess: () => {
            message.success(t('ciEnv.updateSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ci-environments'] });
        },
        onError: () => message.error(t('ciEnv.updateFailed'))
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCIEnvironment,
        onSuccess: () => {
            message.success(t('ciEnv.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['ci-environments'] });
        },
        onError: () => message.error(t('ciEnv.deleteFailed'))
    });

    const columns = [
        {
            title: t('ciEnv.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold text-[15px]">{text}</span>,
        },
        {
            title: t('ciEnv.image'),
            dataIndex: 'image',
            key: 'image',
            render: (text: string) => (
                <div className="flex items-center gap-2">
                    <CodeOutlined className="text-gray-400" />
                    <span
                        className="font-mono text-xs px-2 py-1 rounded-md transition-all shadow-sm"
                        style={{ backgroundColor: isDark ? '#2a2a2a' : antdToken.colorPrimaryBg }}
                    >
                        {text}
                    </span>
                </div>
            )
        },
        {
            title: t('ciEnv.type'),
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => {
                if (!type) return '-';
                const colorMap: Record<string, string> = {
                    'Frontend': 'blue',
                    'Java': 'orange',
                    'Go': 'cyan',
                    'Python': 'green'
                };
                return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
            }
        },
        {
            title: t('ciEnv.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                if (status === 'READY') return <Tag color="success" className="border-0">{t('ciEnv.statusReady')}</Tag>;
                if (status === 'PULLING') return <Tag color="processing" className="border-0">{t('ciEnv.statusPulling')}</Tag>;
                return <Tag color="error" className="border-0">{t('ciEnv.statusError')}</Tag>;
            }
        },
        {
            title: t('ciEnv.description'),
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (text: string) => <span className="text-gray-500 text-sm">{text || '-'}</span>,
        },
        {
            title: t('ciEnv.action'),
            key: 'action',
            render: (_: any, record: CIEnvironment) => (
                <Space size="middle">
                    {hasPermission('pipeline:ci_env:edit') && (
                    <Button type="text" size="small" icon={<EditOutlined />} className="text-blue-500 hover:text-blue-600" onClick={() => handleEdit(record)} />
                    )}
                    {hasPermission('pipeline:ci_env:delete') && (
                    <Button type="text" size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
                    )}
                </Space>
            )
        }
    ];

    const filteredData = environments.filter(env =>
        (env.name || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (env.type || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (env.image || '').toLowerCase().includes(searchText.toLowerCase())
    );

    const handleCreate = () => {
        setEditingId(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const handleEdit = (record: CIEnvironment) => {
        setEditingId(record.id);
        form.setFieldsValue({
            ...record,
            type: record.type ? [record.type] : [],
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string | number) => {
        modal.confirm({
            title: t('ciEnv.confirmDelete'),
            content: t('ciEnv.confirmDeleteContent'),
            okText: t('common.delete'),
            okType: 'danger',
            cancelText: t('common.cancel'),
            onOk: () => deleteMutation.mutate(id),
        });
    };

    const handleModalOk = () => {
        form.validateFields().then(values => {
            const payload = {
                ...values,
                type: values.type && values.type.length > 0 ? values.type[0] : ''
            };
            if (editingId) {
                updateMutation.mutate({ id: editingId, data: payload });
            } else {
                createMutation.mutate(payload);
            }
        });
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header Area */}
            <div>
                <h2 className="text-2xl font-bold mb-1 tracking-tight">{t('ciEnv.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('ciEnv.subtitle')}</p>
            </div>

            <Card className="shadow-sm border-0 root-card">
                {isLoading ? (
                    <TableSkeleton />
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <Input
                                placeholder={t('ciEnv.searchPlaceholder')}
                                prefix={<SearchOutlined className="text-gray-400" />}
                                className="w-72"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                allowClear
                            />
                            {hasPermission('pipeline:ci_env:add') && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} className="shadow-sm">
                                {t('ciEnv.register')}
                            </Button>
                            )}
                        </div>
                        <Table
                            columns={columns}
                            dataSource={filteredData}
                            rowKey="id"
                            scroll={{ x: 1200 }}
                            pagination={{ pageSize: 10 }}
                            size="middle"
                        />
                    </div>
                )}
            </Card>

            <Modal
                title={editingId ? t('ciEnv.modalTitleEdit') : t('ciEnv.modalTitleCreate')}
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                okText={t('common.save')}
                cancelText={t('common.cancel')}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
            >
                <div className="pt-4">
                    <Form form={form} layout="vertical">
                        <Form.Item label={t('ciEnv.fieldName')} name="name" rules={[{ required: true, message: t('ciEnv.fieldNamePlaceholder') }]}>
                            <Input placeholder={t('ciEnv.fieldNamePlaceholder')} />
                        </Form.Item>
                        <Form.Item
                            label={t('ciEnv.fieldImage')}
                            name="image"
                            rules={[{ required: true, message: t('ciEnv.fieldImageError') }]}
                            extra={<span className="text-xs text-gray-500">{t('ciEnv.fieldImageExtra')}</span>}
                        >
                            <Input placeholder={t('ciEnv.fieldImagePlaceholder')} prefix={<CodeOutlined className="text-gray-400" />} />
                        </Form.Item>
                        <Form.Item label={t('ciEnv.fieldType')} name="type" rules={[{ required: true, message: t('ciEnv.fieldTypeError') }]}>
                            <Select
                                mode="tags"
                                maxCount={1}
                                options={[{ value: 'Frontend', label: 'Frontend' }, { value: 'Java', label: 'Java' }, { value: 'Go', label: 'Go' }, { value: 'Python', label: 'Python' }]}
                                placeholder={t('ciEnv.fieldTypePlaceholder')}
                            />
                        </Form.Item>
                        <Form.Item label={t('ciEnv.fieldDesc')} name="description">
                            <Input.TextArea rows={3} placeholder={t('ciEnv.fieldDescPlaceholder')} />
                        </Form.Item>
                    </Form>
                </div>
            </Modal>
        </div>
    );
};

export default CIEnvironments;
