import React, { useState } from "react";
import {Button, Card, Table, Form, Modal, Input, Select, Tag, Popconfirm, Space, Tooltip, Divider, App} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {createPlatform, deletePlatform, getPlatforms, updatePlatform, verifyPlatform, syncPlatformAssets, getCredentials} from "../../api/hosts.ts";
import useAppStore from "../../store/useAppStore.ts";
import {DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, CloudDownloadOutlined} from "@ant-design/icons";
import {TableSkeleton} from "../../components/Skeletons";
import { useTranslation } from 'react-i18next';

const PlatformManagement: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { token, hasPermission } = useAppStore();
    const {message} = App.useApp()
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [params, setParams] = useState({
        page: 1,
        size: 10,
        search: ''
    });
    const [form] = Form.useForm();

    const { data, isLoading } = useQuery({
        queryKey: ['platforms', params],
        queryFn: () => getPlatforms(params),
        enabled: !!token,
    });

    const saveMutation = useMutation({
        mutationFn: (values) => editingRecord ? updatePlatform(editingRecord.id, values) : createPlatform(values),
        onSuccess: () => {
            message.success(editingRecord ? t('platform.platformUpdated') : t('platform.platformCreated'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
        }
    })

    const deleteMutation = useMutation({
        mutationFn: deletePlatform,
        onSuccess: () => {
            message.success(t('platform.platformDeleted'));
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
        }
    })

    const verifyMutation = useMutation({
        mutationFn: verifyPlatform,
        onSuccess: (res: any) => {
            const status = res.connectivity_status;
            if (status === 1) {
                message.success(t('platform.platformConnected'));
            } else {
                message.error(`${t('platform.platformConnectError')}: ${res.error_message || 'Unknown error'}`);
            }
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
        },
        onError: (err: any) => {
            message.error(`${t('platform.verifyFailed')}: ${err.message}`);
        }
    })

    const syncMutation = useMutation({
        mutationFn: syncPlatformAssets,
        onSuccess: (res: any) => {
            message.success(res.message || t('platform.assetSyncStarted'));
            queryClient.invalidateQueries({ queryKey: ['platforms'] });
            queryClient.invalidateQueries({ queryKey: ['hosts'] });
        },
        onError: (err: any) => {
            message.error(`${t('platform.assetSyncFailed')}: ${err.message}`);
        }
    })

    const { data: credData } = useQuery({
        queryKey: ['ssh-credentials-all'],
        queryFn: () => getCredentials({ page: 1, size: 100 }),
        enabled: !!token,
    });

    const typeMap: Record<string, { text: string, color: string }> = {
        'aliyun': { text: t('platform.typeAliyun'), color: 'orange' },
        'tencent': { text: t('platform.typeTencent'), color: 'blue' },
        'aws': { text: t('platform.typeAWS'), color: 'gold' },
        'vmware': { text: 'VMware', color: 'cyan' },
        'k8s': { text: 'Kubernetes', color: 'purple' },
        'physical': { text: t('platform.typePhysical'), color: 'default' },
        'other': { text: t('platform.typeOther'), color: 'default' },
    };

    const columns = [
        {
            title: t('platform.platformName'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: t('platform.platformType'),
            dataIndex: 'type',
            key: 'type',
            render: (val: string) => {
                const mappedInfo = typeMap[val] || typeMap['other'];
                return <Tag color={mappedInfo.color}>{mappedInfo.text}</Tag>;
            }
        },
        {
            title: t('platform.platformDesc'),
            dataIndex: 'remark',
            key: 'remark',
            render: (text: string) => <span className="font-semibold">{text}</span>
        },
        {
            title: t('platform.connectivity'),
            dataIndex: 'connectivity_status',
            key: 'connectivity',
            render: (val: number, record: any) => {
                const statusMap: any = {
                    0: { color: 'default', text: t('platform.notVerified'), icon: <ExclamationCircleOutlined /> },
                    1: { color: 'success', text: t('platform.normal'), icon: <CheckCircleOutlined /> },
                    2: { color: 'error', text: t('platform.abnormal'), icon: <CloseCircleOutlined /> },
                };
                const info = statusMap[val] || statusMap[0];
                return (
                    <Tooltip title={val === 2 ? record.error_message : (record.last_verified_at ? `${t('platform.lastVerified')}: ${new Date(record.last_verified_at).toLocaleString()}` : t('platform.notYetVerified'))}>
                        <Tag color={info.color} icon={info.icon} className="cursor-help">
                            {info.text}
                        </Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: t('platform.status'),
            dataIndex: 'status',
            key: 'status',
            render: (val: boolean) => (
                <Tag color={val ? 'success' : 'error'}>
                    {val ? t('platform.statusEnabled') : t('platform.statusDisabled')}
                </Tag>
            )
        },
        {
            title: t('platform.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {(hasPermission('*') || hasPermission('resource:platforms:sync')) && (
                        <Tooltip title={t('platform.syncAssets')}>
                             <Button
                                type="text"
                                icon={<CloudDownloadOutlined />}
                                loading={syncMutation.isPending && syncMutation.variables === record.id}
                                onClick={() => syncMutation.mutate(record.id)}
                            />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:platforms:verify')) && (
                        <Tooltip title={t('platform.verifyConnectivity')}>
                             <Button
                                type="text"
                                icon={<SyncOutlined spin={verifyMutation.isPending && verifyMutation.variables === record.id} />}
                                loading={verifyMutation.isPending && verifyMutation.variables === record.id}
                                onClick={() => verifyMutation.mutate(record.id)}
                            />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:platforms:edit')) && (
                        <Tooltip title={t('platform.edit')}>
                            <Button type="text" icon={<EditOutlined />} onClick={() => {
                                setEditingRecord(record);
                                form.setFieldsValue(record);
                                setIsModalOpen(true);
                            }} />
                        </Tooltip>
                    )}

                    {(hasPermission('*') || hasPermission('resource:platforms:delete')) && (
                        <Popconfirm title={t('platform.confirmDelete')} onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title={t('platform.delete')}>
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card title={t('platform.title')} className="m-4 shadow-sm" extra={
            (hasPermission('*') || hasPermission('resource:platforms:add')) && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    setEditingRecord(null);
                    form.resetFields();
                    form.setFieldsValue({ type: 'aliyun' })
                    setIsModalOpen(true);
                }}>
                    {t('platform.addPlatform')}
                </Button>
            )
        }>
            {isLoading ? (
                <TableSkeleton />
            ) : (
            <Table
                dataSource={data?.data}
                columns={columns}
                rowKey="id"
                scroll={{ x: 1200 }}
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
                title={editingRecord ? t('platform.editPlatform') : t('platform.createPlatform')}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={saveMutation.isPending}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    onFinish={(values) => saveMutation.mutate(values)}
                >
                    <Form.Item label={t('platform.platformName')} name="name" rules={[{ required: true, message: t('platform.nameRequired') }]}>
                        <Input placeholder={t('platform.namePlaceholder')} />
                    </Form.Item>

                    <Form.Item label={t('platform.platformType')} name="type" rules={[{ required: true, message: t('platform.typeRequired') }]}>
                        <Select options={Object.entries(typeMap).map(([key, val]) => ({
                            label: val.text, value: key
                        }))} />
                    </Form.Item>

                    <Divider plain style={{ margin: '12px 0' }}>{t('platform.connectionConfig')}</Divider>

                    <Form.Item label={t('platform.accessKey')} name="access_key">
                        <Input placeholder="AK / Username" />
                    </Form.Item>

                    <Form.Item label={t('platform.secretKey')} name="secret_key">
                        <Input.Password placeholder="SK / Password" />
                    </Form.Item>

                    <Form.Item label={t('platform.apiEndpoint')} name="api_endpoint">
                        <Input placeholder={t('platform.apiEndpoint')} />
                    </Form.Item>

                    <Form.Item label={t('platform.defaultCredential')} name="default_credential">
                        <Select
                            placeholder={t('platform.defaultCredentialPlaceholder')}
                            options={credData?.data?.map((c: any) => ({ label: c.name, value: c.id }))}
                            allowClear
                        />
                    </Form.Item>

                    <Form.Item label={t('platform.status')} name="status" valuePropName="checked" initialValue={true}>
                        <Select options={[
                            { label: t('platform.statusEnabled'), value: true },
                            { label: t('platform.statusDisabled'), value: false },
                        ]} />
                    </Form.Item>

                    <Form.Item label={t('platform.remark')} name="remark">
                        <Input.TextArea placeholder={t('platform.remarkPlaceholder')} rows={2} />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    )
}

export default PlatformManagement
