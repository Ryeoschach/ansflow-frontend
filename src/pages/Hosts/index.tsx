import React, { useState } from 'react';
import { Table, Card, Button, Modal, Form, Input, Space, Tooltip, Popconfirm, Select, InputNumber, Tag, App } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, DesktopOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {getHosts, createHost, updateHost, deleteHost, getEnvironments, getPlatforms, getCredentials} from '../../api/hosts.ts';
import useAppStore from '../../store/useAppStore';
import {TableSkeleton} from "../../components/Skeletons";
import { useBreakpoint } from '@/utils/useBreakpoint';
import { useTranslation } from 'react-i18next';

const HostManagement: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { hasPermission } = useAppStore();
    const { token } = useAppStore.getState();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingHost, setEditingHost] = useState<any>(null);

    // 分页与筛选参数
    const [params, setParams] = useState({ page: 1, size: 10, search: '' });

    // 获取主机列表
    const { data, isLoading } = useQuery({
        queryKey: ['Hosts', params],
        queryFn: () => getHosts(params),
        enabled: !!token,
    });

    // 获取所有环境 (用于下拉选择和表格渲染)
    const { data: envData } = useQuery({
        queryKey: ['environments'],
        queryFn: () => getEnvironments(params), // 获取全量环境
        enabled: !!token,
    });

    // 获取所属平台
    const { data: platformData } = useQuery({
        queryKey: ['platforms', params],
        queryFn: () => getPlatforms(params),
        enabled: !!token,
    });

    // 获取凭据列表
    const { data: credData } = useQuery({
        queryKey: ['ssh-credentials-all'],
        queryFn: () => getCredentials({ page: 1, size: 100 }),
        enabled: !!token,
    });

    // 获取环境列表数据供 Select 组件使用
    const environments = envData?.data || [];
    const platforms = platformData?.data || [];

    // 增删改 Mutations
    const saveMutation = useMutation({
        mutationFn: (values: any) => editingHost ? updateHost(editingHost.id, values) : createHost(values),
        onSuccess: () => {
            message.success(editingHost ? t('host.hostUpdated') : t('host.hostCreated'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['Hosts'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteHost,
        onSuccess: () => {
            message.success(t('host.hostDeleted'));
            queryClient.invalidateQueries({ queryKey: ['Hosts'] });
        }
    });

    // 状态映射字典
    const statusMap: Record<number, { text: string; color: string }> = {
        0: { text: t('host.statusOffline'), color: 'default' },
        1: { text: t('host.statusOnline'), color: 'success' },
        2: { text: t('host.statusError'), color: 'error' },
        3: { text: t('host.statusStandby'), color: 'processing' },
    };

    const columns = [
        {
            title: t('host.hostname'),
            dataIndex: 'hostname',
            key: 'hostname',
            ellipsis: true,
            render: (text: string) => <span className="font-semibold"><DesktopOutlined className="mr-2 opacity-50"/>{text}</span>
        },
        {
            title: t('host.environment'),
            dataIndex: 'env',
            key: 'env',
            render: (envId: number) => {
                const env = environments.find((e: any) => e.id === envId);
                return <Tag color="blue">{env?.name || `ID:${envId}`}</Tag>;
            }
        },
        {
            title: t('host.platform'),
            dataIndex: 'platform',
            key: 'platform',
            render: (platformId: number) => {
                if (!platformId) return <Tag color="default">{t('host.unclassified')}</Tag>;

                const p = platforms.find((p: any) => p.id === platformId);
                return <Tag color="cyan">{p?.name || `ID:${platformId}`}</Tag>;
            }
        },
        {
            title: t('host.ipAddress'),
            key: 'ip',
            render: (_: any, record: any) => (
                <div className="flex flex-col text-xs">
                    {record.private_ip && <span className="text-gray-500">{t('host.privateIp')}: {record.private_ip}</span>}
                    {record.ip_address && <span className="text-blue-500">{t('host.publicIp')}: {record.ip_address}</span>}
                </div>
            )
        },
        {
            title: t('host.openPorts'),
            key: 'ports',
            dataIndex: 'ports',
        },
        {
            title: t('host.config'),
            key: 'specs',
            render: (_: any, record: any) => (
                <span className="text-xs text-gray-500">
                    {record.cpu}C / {record.memory}G / {record.disk}G
                </span>
            )
        },
        {
            title: t('host.os'),
            dataIndex: 'os_type',
            key: 'os_type',
        },
        {
            title: t('host.statusLabel'),
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => {
                const s = statusMap[status] || statusMap[0];
                return <Tag color={s.color}>{s.text}</Tag>;
            }
        },
        {
            title: t('host.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title={t('host.edit')}>
                        <Button type="text" icon={<EditOutlined />} onClick={() => {
                            setEditingHost(record);
                            form.setFieldsValue(record);
                            setIsModalOpen(true);
                        }} />
                    </Tooltip>
                    <Popconfirm title={t('host.confirmDelete')} onConfirm={() => deleteMutation.mutate(record.id)}>
                        <Tooltip title={t('host.delete')}>
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card title={t('host.title')} className="m-4 shadow-sm" extra={
            (hasPermission('*') || hasPermission('resource:hosts:add')) && (
            <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                    setEditingHost(null);
                    form.resetFields();
                    form.setFieldsValue({ status: 1, cpu: 2, memory: 4, disk: 50, os_type: 'Linux' });
                    setIsModalOpen(true);
                }}
            >
                {t('host.enterHost')}
            </Button>
            )
        }>
            {isLoading ? (
                <TableSkeleton /> // 加载时显示骨架
            ) : (
            <Table
                dataSource={data?.data}
                columns={columns}
                loading={isLoading}
                rowKey="id"
                scroll={{ x: 'max-content' }}
               
                pagination={{
                    total: data?.total,
                    current: params.page,
                    pageSize: params.size,
                    showSizeChanger: true,
                    onChange: (p, s) => setParams({ ...params, page: p, size: s }),
                }}
            />
                )}

            <Modal
                title={editingHost ? t('host.editHost') : t('host.createHost')}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={saveMutation.isPending}
                width={isMobile ? '95vw' : 600}
                bodyStyle={{ overflowX: 'auto' }}
                className={isMobile ? '!top-4' : ''}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    onFinish={(values) => saveMutation.mutate(values)}
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item label={t('host.hostname')} name="hostname" rules={[{ required: true, message: t('host.hostname') + t('common.required') }]}>
                            <Input placeholder={t('host.hostnamePlaceholder')} />
                        </Form.Item>
                        <Form.Item label={t('host.environment')} name="env" rules={[{ required: true, message: t('host.envRequired') }]}>
                            <Select placeholder={t('host.envPlaceholder')} options={environments.map((e: any) => ({ label: e.name, value: e.id }))} />
                        </Form.Item>
                        <Form.Item label={t('host.platform')} name="platform">
                            <Select placeholder={t('host.platformPlaceholder')} options={platforms.map((p: any) => ({ label: p.name, value: p.id }))} allowClear/>
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Form.Item label={t('host.privateIpLabel')} name="private_ip">
                            <Input placeholder={t('host.privateIpPlaceholder')} />
                        </Form.Item>
                        <Form.Item label={t('host.publicIpLabel')} name="ip_address">
                            <Input placeholder={t('host.publicIpPlaceholder')} />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item label={t('host.cpuLabel')} name="cpu">
                            <InputNumber className="w-full" min={1} />
                        </Form.Item>
                        <Form.Item label={t('host.memoryLabel')} name="memory">
                            <InputNumber className="w-full" min={1} />
                        </Form.Item>
                        <Form.Item label={t('host.diskLabel')} name="disk">
                            <InputNumber className="w-full" min={1} />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Form.Item label={t('host.osLabel')} name="os_type">
                            <Input placeholder={t('host.osPlaceholder')} />
                        </Form.Item>
                        <Form.Item label={t('host.portsLabel')} name="ports">
                            <Input placeholder={t('host.portsPlaceholder')} />
                        </Form.Item>
                        <Form.Item label={t('host.statusLabel')} name="status">
                            <Select options={[
                                { label: t('host.statusOnline'), value: 1 },
                                { label: t('host.statusOffline'), value: 0 },
                                { label: t('host.statusError'), value: 2 },
                                { label: t('host.statusStandby'), value: 3 },
                            ]} />
                        </Form.Item>
                    </div>

                    <Form.Item label={t('host.credentialLabel')} name="credential" help={t('host.credentialHelp')}>
                        <Select
                            placeholder={t('host.credentialPlaceholder')}
                            options={credData?.data?.map((c: any) => ({ label: c.name, value: c.id }))}
                            allowClear
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default HostManagement;
