import React, { useState } from 'react';
import {
    Table,
    Card,
    Button,
    Modal,
    Form,
    Input,
    Space,
    Tooltip,
    Popconfirm,
    Select,
    Tag,
    Divider,
    Typography,
    Empty,
    App,
    Popover,
    theme,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    DatabaseOutlined,
    ArrowRightOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getResourcePools,
    createResourcePool,
    updateResourcePool,
    deleteResourcePool,
    getEnvironments,
    getPlatforms,
    getHosts,
} from '../../api/hosts';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';
import { TableSkeleton } from '../../components/Skeletons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ResourcePoolManagement: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { isDark, token: authToken, hasPermission } = useAppStore();
    const { token: antdToken } = theme.useToken();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPool, setEditingPool] = useState<any>(null);

    const [listFilters, setListFilters] = useState({
        name: '',
        code: '',
        env: undefined as number | undefined,
        platform: undefined as number | undefined,
    });

    const [selectedEnv, setSelectedEnv] = useState<number | null>(null);
    const [selectedPlatform, setSelectedPlatform] = useState<number | null>(null);
    const [selectedHostIds, setSelectedHostIds] = useState<number[]>([]);

    const { data: poolData, isLoading: poolsLoading } = useQuery({
        queryKey: ['ResourcePools', listFilters],
        queryFn: () => getResourcePools({
            page: 1,
            size: 100,
            ...listFilters
        }),
        enabled: !!authToken,
    });

    const { data: envData } = useQuery({
        queryKey: ['environments-all'],
        queryFn: () => getEnvironments({ page: 1, size: 100 }),
        enabled: !!authToken,
    });

    const { data: platformData } = useQuery({
        queryKey: ['platforms-all'],
        queryFn: () => getPlatforms({ page: 1, size: 100 }),
        enabled: !!authToken,
    });

    const { data: hostData, isLoading: hostsLoading } = useQuery({
        queryKey: ['Hosts-Selection', selectedEnv, selectedPlatform],
        queryFn: () => getHosts({
            env: selectedEnv || undefined,
            platform: selectedPlatform || undefined,
            size: 100
        }),
        enabled: !!authToken && isModalOpen && (!!selectedEnv || !!selectedPlatform),
    });

    const environments = envData?.data || [];
    const platforms = platformData?.data || [];
    const availableHosts = hostData?.data || [];

    const allHostsMap = React.useMemo(() => {
        const map = new Map<number, any>();
        availableHosts.forEach((h: any) => map.set(h.id, h));
        if (editingPool?.host_details) {
            editingPool.host_details.forEach((h: any) => map.set(h.id, h));
        }
        return map;
    }, [availableHosts, editingPool]);

    const saveMutation = useMutation({
        mutationFn: (values: any) => {
            const payload = {
                ...values,
                hosts: selectedHostIds
            };
            return editingPool ? updateResourcePool(editingPool.id, payload) : createResourcePool(payload);
        },
        onSuccess: () => {
            message.success(editingPool ? t('resourcePool.poolUpdated') : t('resourcePool.poolCreated'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ResourcePools'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteResourcePool,
        onSuccess: () => {
            message.success(t('resourcePool.poolDeleted'));
            queryClient.invalidateQueries({ queryKey: ['ResourcePools'] });
        }
    });

    const showModal = (pool?: any) => {
        setEditingPool(pool || null);
        setSelectedEnv(null);
        setSelectedPlatform(null);

        if (pool) {
            form.setFieldsValue(pool);
            setSelectedHostIds(pool.hosts || []);
        } else {
            form.resetFields();
            setSelectedHostIds([]);
        }
        setIsModalOpen(true);
    };

    const columns = [
        {
            title: t('resourcePool.poolName'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: t('resourcePool.poolCode'),
            dataIndex: 'code',
            key: 'code',
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: t('resourcePool.hostCount'),
            dataIndex: 'hosts',
            key: 'hostCount',
            render: (hosts: any[], record: any) => {
                const hostList = record.host_details || [];
                const content = (
                    <div className="max-h-60 overflow-auto py-1 whitespace-nowrap">
                        {hostList.length > 0 ? (
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-gray-100 opacity-50">
                                        <th className="text-left pb-1 pr-4">{t('resourcePool.hostname')}</th>
                                        <th className="text-left pb-1">{t('resourcePool.privateIp')}</th>
                                        <th className="text-left pb-1">{t('resourcePool.platform')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hostList.map((h: any) => (
                                        <tr key={h.id} className="hover:bg-gray-50/5 transition-colors">
                                            <td className="py-1.5 pr-4 font-medium">{h.hostname}</td>
                                            <td className="py-1.5 opacity-70 font-mono">{h.private_ip}</td>
                                            <td className="py-1.5 opacity-70">{h.platform_name || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <Text type="secondary" className="text-xs">{t('resourcePool.noHosts')}</Text>
                        )}
                    </div>
                );

                return (
                    <Popover
                        content={content}
                        title={<span className="text-xs font-bold opacity-50 uppercase tracking-widest">{t('resourcePool.hostDetail')}</span>}
                        trigger="hover"
                        placement="right"
                    >
                        <Tag color="cyan" className="cursor-help">
                            {t('resourcePool.hostsCount', { count: hosts?.length || 0 })}
                        </Tag>
                    </Popover>
                );
            }
        },
        {
            title: t('resourcePool.description'),
            dataIndex: 'remark',
            key: 'remark',
        },
        {
            title: t('resourcePool.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title={t('resourcePool.edit')}>
                        <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
                    </Tooltip>
                    <Popconfirm title={t('resourcePool.confirmDelete')} onConfirm={() => deleteMutation.mutate(record.id)}>
                        <Tooltip title={t('resourcePool.delete')}>
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card title={t('resourcePool.title')} className="m-4 shadow-sm" extra={
            (hasPermission('*') || hasPermission('resource:resources:add')) && (
            <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => showModal()}
            >
                {t('resourcePool.createPool')}
            </Button>
            )
        }>
            <div
                className="mb-4 p-4 rounded-lg flex flex-wrap gap-4 items-end border transition-colors"
                style={{
                    backgroundColor: antdToken.colorFillAlter,
                    borderColor: antdToken.colorBorderSecondary,
                }}
            >
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">{t('resourcePool.poolName')}</div>
                    <Input
                        placeholder={t('resourcePool.poolNameSearchPlaceholder')}
                        className="w-40"
                        allowClear
                        value={listFilters.name}
                        onChange={e => setListFilters({ ...listFilters, name: e.target.value })}
                    />
                </div>
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">{t('resourcePool.poolCode')}</div>
                    <Input
                        placeholder={t('resourcePool.poolCodeSearchPlaceholder')}
                        className="w-40"
                        allowClear
                        value={listFilters.code}
                        onChange={e => setListFilters({ ...listFilters, code: e.target.value })}
                    />
                </div>
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">{t('resourcePool.includeEnv')}</div>
                    <Select
                        placeholder={t('resourcePool.allEnv')}
                        className="w-40"
                        allowClear
                        value={listFilters.env}
                        onChange={val => setListFilters({ ...listFilters, env: val })}
                        options={environments.map((e: any) => ({ label: e.name, value: e.id }))}
                    />
                </div>
                <div>
                    <div className="text-xs mb-1 opacity-50 uppercase tracking-tight font-medium">{t('resourcePool.includePlatform')}</div>
                    <Select
                        placeholder={t('resourcePool.allPlatform')}
                        className="w-40"
                        allowClear
                        value={listFilters.platform}
                        onChange={val => setListFilters({ ...listFilters, platform: val })}
                        options={platforms.map((p: any) => ({ label: p.name, value: p.id }))}
                    />
                </div>
                <Button
                    onClick={() => setListFilters({ name: '', code: '', env: undefined, platform: undefined })}
                    type="text"
                    danger
                >
                    {t('resourcePool.reset')}
                </Button>
            </div>

            {poolsLoading ? (
                <TableSkeleton />
            ) : (
            <Table
                dataSource={poolData?.data}
                columns={columns}
                loading={poolsLoading}
                rowKey="id"
                scroll={{ x: 1200 }}
            />
                )}

            <Modal
                title={editingPool ? t('resourcePool.editPool') : t('resourcePool.createPool')}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={saveMutation.isPending}
                width={isMobile ? '95vw' : 900}
                bodyStyle={{ overflowX: 'auto' }}
                style={{ top: 20 }}
            >
                <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item label={t('resourcePool.nameLabel')} name="name" rules={[{ required: true, message: t('resourcePool.nameRequired') }]}>
                            <Input placeholder={t('resourcePool.namePlaceholder')} />
                        </Form.Item>
                        <Form.Item label={t('resourcePool.codeLabel')} name="code" rules={[{ required: true, message: t('resourcePool.codeRequired') }]}>
                            <Input placeholder={t('resourcePool.codePlaceholder')} />
                        </Form.Item>
                    </div>

                    <Divider titlePlacement="left" plain><DatabaseOutlined /> {t('resourcePool.hostArrangement')}</Divider>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div
                            className="flex-1 rounded-xl p-4 transition-all"
                            style={{ backgroundColor: antdToken.colorFillQuaternary }}
                        >
                            <div className="text-[10px] font-bold mb-3 opacity-40 uppercase tracking-widest">{t('resourcePool.step1')}</div>
                            <div className="flex gap-2 mb-4">
                                <Select
                                    placeholder={t('resourcePool.filterEnv')}
                                    className="flex-1"
                                    allowClear
                                    onChange={setSelectedEnv}
                                    options={environments.map((e: any) => ({ label: e.name, value: e.id }))}
                                />
                                <Select
                                    placeholder={t('resourcePool.filterPlatform')}
                                    className="flex-1"
                                    allowClear
                                    onChange={setSelectedPlatform}
                                    options={platforms.map((p: any) => ({ label: p.name, value: p.id }))}
                                />
                            </div>

                            <div
                                className="border rounded-lg h-64 overflow-auto shadow-inner transition-colors"
                                style={{
                                    backgroundColor: antdToken.colorBgContainer,
                                    borderColor: antdToken.colorBorderSecondary
                                }}
                            >
                                <Table
                                    size="small"
                                    showHeader={false}
                                    pagination={false}
                                    loading={hostsLoading}
                                    dataSource={availableHosts.filter(h => !selectedHostIds.includes(h.id))}
                                    rowKey="id"
                                    columns={[
                                        {
                                            title: t('resourcePool.host'),
                                            render: (_, h) => (
                                                <div className="flex justify-between items-center w-full group">
                                                    <div>
                                                        <div className="text-sm font-medium">{h.hostname}</div>
                                                        <div className="text-xs text-gray-400">{h.private_ip}</div>
                                                    </div>
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        icon={<PlusOutlined />}
                                                        onClick={() => setSelectedHostIds([...selectedHostIds, h.id])}
                                                    >
                                                        {t('resourcePool.add')}
                                                    </Button>
                                                </div>
                                            )
                                        }
                                    ]}
                                    locale={{ emptyText: (!selectedEnv && !selectedPlatform) ? t('resourcePool.selectEnvPlatformFirst') : t('resourcePool.noAvailableHosts') }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center">
                            <ArrowRightOutlined className="text-gray-300 text-xl" />
                        </div>

                        <div
                            className="flex-1 rounded-xl p-4 transition-all"
                            style={{ backgroundColor: antdToken.colorPrimaryBg }}
                        >
                            <div
                                className="text-xs font-bold mb-3 uppercase tracking-widest"
                                style={{ color: antdToken.colorPrimary }}
                            >
                                {t('resourcePool.step2')} ({selectedHostIds.length})
                            </div>

                            <div
                                className="border rounded-lg h-78 overflow-auto shadow-inner transition-colors"
                                style={{
                                    backgroundColor: antdToken.colorBgContainer,
                                    borderColor: antdToken.colorBorderSecondary
                                }}
                            >
                                {selectedHostIds.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Empty description={t('resourcePool.noHostsAdded')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-2">
                                        {selectedHostIds.map(id => {
                                            const h = allHostsMap.get(id);
                                            return (
                                                <div
                                                    key={id}
                                                    className="flex justify-between items-center p-2 rounded-md border border-transparent hover:border-blue-300 transition-all shadow-sm mb-2 mx-2 first:mt-2 last:mb-0"
                                                    style={{
                                                        backgroundColor: antdToken.colorBgElevated,
                                                        borderColor: antdToken.colorBorderSecondary
                                                    }}
                                                >
                                                    <div>
                                                        <div className="text-sm font-medium">{h?.hostname || `Unknown (ID: ${id})`}</div>
                                                        <div className="text-[10px] opacity-50 font-mono">{h?.private_ip || '-'}</div>
                                                    </div>
                                                    <Button
                                                        type="text"
                                                        danger
                                                        size="small"
                                                        icon={<CloseCircleOutlined />}
                                                        onClick={() => setSelectedHostIds(selectedHostIds.filter(hid => hid !== id))}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {selectedHostIds.length > 0 && (
                                <div className="mt-2 text-right">
                                    <Button type="link" danger size="small" onClick={() => setSelectedHostIds([])}>{t('resourcePool.clearAll')}</Button>
                                </div>
                            )}
                        </div>
                    </div>

                    <Form.Item label={t('resourcePool.remark')} name="remark" className="mt-4">
                        <Input.TextArea rows={2} placeholder={t('resourcePool.remarkPlaceholder')} />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ResourcePoolManagement;
