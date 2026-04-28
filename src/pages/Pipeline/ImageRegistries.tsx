import React, { useState } from "react";
import {
    Button,
    Card,
    Table,
    Form,
    Modal,
    Input,
    Popconfirm,
    Space,
    Typography,
    App,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getRegistries, createRegistry, updateRegistry, deleteRegistry } from "../../api/registry";
import { DeleteOutlined, EditOutlined, PlusOutlined, LockOutlined, UserOutlined, GlobalOutlined } from "@ant-design/icons";
import { TableSkeleton } from "../../components/Skeletons";
import useAppStore from '../../store/useAppStore';
import { useBreakpoint } from '@/utils/useBreakpoint';


const { Text } = Typography;

const ImageRegistries: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { token, hasPermission } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [form] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRegistry, setEditingRegistry] = useState<any>(null);

    const { data: regData, isLoading } = useQuery({
        queryKey: ['image-registries'],
        queryFn: () => getRegistries({ page_size: 100 }),
        enabled: !!token && hasPermission('registry:docker:view'),
    });

    const createMutation = useMutation({
        mutationFn: createRegistry,
        onSuccess: () => {
            message.success(t('imageRegistry.createSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['image-registries'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (vars: { id: number, data: any }) => updateRegistry(vars.id, vars.data),
        onSuccess: () => {
            message.success(t('imageRegistry.updateSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['image-registries'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteRegistry,
        onSuccess: () => {
            message.success(t('imageRegistry.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['image-registries'] });
        },
    });

    const handleEdit = (record: any) => {
        setEditingRegistry(record);
        // 严禁回填加密字段（后端通常返回掩码），防止用户误提交掩码
        form.setFieldsValue({ ...record, password: '' });
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingRegistry(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const columns = [
        {
            title: t('imageRegistry.registryName'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: t('imageRegistry.registryUrl'),
            dataIndex: 'url',
            key: 'url',
            ellipsis: true,
        },
        {
            title: t('imageRegistry.defaultNamespace'),
            dataIndex: 'namespace',
            key: 'namespace',
            ellipsis: true,
        },
        {
            title: t('imageRegistry.ownerUsername'),
            dataIndex: 'username',
            key: 'username',
            ellipsis: true,
        },
        {
            title: t('imageRegistry.createTime'),
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: t('imageRegistry.action'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {hasPermission('registry:docker:edit') && (
                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    )}
                    {hasPermission('registry:docker:delete') && (
                    <Popconfirm
                        title={t('imageRegistry.confirmDeleteRegistry')}
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText={t('imageRegistry.confirm')}
                        cancelText={t('imageRegistry.cancel')}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card title={t('imageRegistry.title')} extra={
            hasPermission('registry:docker:add') ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('imageRegistry.addNewRegistry')}</Button>
            ) : null
        }>
            {isLoading ? (
                <TableSkeleton />
            ) : (
                <Table
                    dataSource={(regData as any)?.results || regData?.data || regData as any}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 'max-content' }}
                           
                    pagination={{ pageSize: 10 }}
                />
            )}

            <Modal
                title={editingRegistry ? t('imageRegistry.editRegistry') : t('imageRegistry.addRegistry')}
                open={isModalOpen}
                forceRender
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={isMobile ? '95vw' : 600}
                styles={{ body: { overflowX: 'auto' } }}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
            >
                <Form
                    form={form}
                    layout="vertical"
                    className="mt-4"
                    onFinish={(values) => {
                        if (editingRegistry) {
                            updateMutation.mutate({ id: editingRegistry.id, data: values });
                        } else {
                            createMutation.mutate(values);
                        }
                    }}
                >
                    <Form.Item label={t('imageRegistry.identifierName')} name="name" rules={[{ required: true, message: t('imageRegistry.enterDisplayName') }]}>
                        <Input placeholder={t('imageRegistry.exampleHarborProduction')} />
                    </Form.Item>
                    <Form.Item label={t('imageRegistry.registryUrlLabel')} name="url" rules={[{ required: true, message: t('imageRegistry.enterRegistryUrl') }]}>
                        <Input prefix={<GlobalOutlined />} placeholder={t('imageRegistry.exampleHarborDemo')} />
                    </Form.Item>
                    <Form.Item label={t('imageRegistry.defaultNamespaceOptional')} name="namespace">
                        <Input placeholder={t('imageRegistry.exampleLibrary')} />
                    </Form.Item>

                    <div className="flex flex-col md:flex-row gap-4">
                        <Form.Item label={t('imageRegistry.username')} name="username" className="flex-1" rules={[{ required: true, message: t('imageRegistry.enterUsername') }]}>
                            <Input prefix={<UserOutlined />} />
                        </Form.Item>
                        <Form.Item label={t('imageRegistry.passwordToken')} name="password" className="flex-1" rules={[{ required: !editingRegistry, message: t('imageRegistry.enterAuthKey') }]}>
                            <Input.Password 
                                prefix={<LockOutlined />} 
                                placeholder={editingRegistry ? '******' : t('imageRegistry.enterPasswordOrToken')} 
                            />
                        </Form.Item>
                    </div>

                    <Form.Item label={t('imageRegistry.remarkDescription')} name="description">
                        <Input.TextArea />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ImageRegistries;
