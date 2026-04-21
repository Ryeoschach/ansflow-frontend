import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Card, App, Typography, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPermissions, createPermission, updatePermission, deletePermission } from '../../api/rbac';
import useAppStore from '../../store/useAppStore';
import { PaginatedResponse, Permission } from '../../types';

const { Title } = Typography;

const PermissionManagement: React.FC = () => {
    const { t } = useTranslation();
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    const { hasPermission } = useAppStore();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingPermission, setEditingPermission] = useState<any>(null);
    const [form] = Form.useForm();

    // 统一管理分页与搜索参数
    const [params, setParams] = useState({
        page: 1,
        size: 10,
        search: ''
    });

    const { data: permissions, isLoading } = useQuery<PaginatedResponse<Permission>>({
        queryKey: ['permissions', params],
        queryFn: () => getPermissions(params),
        enabled: hasPermission('*') || hasPermission('rbac:permission:view') || hasPermission('rbac:permission:list')
    });

    const mutation = useMutation({
        mutationFn: (values: any) => editingPermission ? updatePermission(editingPermission.id, values) : createPermission(values),
        onSuccess: () => {
            message.success(editingPermission ? t('permission.updateSuccess') : t('permission.createSuccess'));
            setIsModalVisible(false);
            setEditingPermission(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['permissions'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deletePermission,
        onSuccess: () => {
            message.success(t('permission.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['permissions'] });
        },
    });

    const handleAdd = () => {
        setEditingPermission(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const columns = [
        { title: t('permission.columnName'), dataIndex: 'name', key: 'name', width: 180, ellipsis: true },
        { title: t('permission.columnCode'), dataIndex: 'code', key: 'code', width: 250, ellipsis: true, render: (code: string) => <Typography.Text code>{code}</Typography.Text> },
        { title: t('permission.columnDesc'), dataIndex: 'desc', key: 'desc', width: 200, ellipsis: true },
        {
            title: t('permission.columnAction'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {(hasPermission('*') || hasPermission('rbac:permission:edit')) && (
                        <Tooltip title={t('permission.edit')}>
                            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditingPermission(record); form.setFieldsValue(record); setIsModalVisible(true); }} />
                        </Tooltip>
                    )}
                    {(hasPermission('*') || hasPermission('rbac:permission:delete')) && (
                        <Tooltip title={t('permission.delete')}>
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => {
                                modal.confirm({
                                    title: t('permission.deleteConfirmTitle'),
                                    content: t('permission.deleteConfirmContent'),
                                    onOk: () => deleteMutation.mutate(record.id),
                                });
                            }} />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <Title level={4}>{t('permission.title')}</Title>
                {(hasPermission('*') || hasPermission('rbac:permission:create') || hasPermission('rbac:permission:add')) && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>{t('permission.addPermission')}</Button>
                )}
            </div>

            <Card className="shadow-sm">
                <Table
                    dataSource={permissions?.data}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 'max-content' }}
                           
                    pagination={{
                        total: permissions?.total,
                        current: params.page,
                        pageSize: params.size,
                        showSizeChanger: true,
                        onChange: (p, s) => setParams({ ...params, page: p, size: s }),
                    }}
                />
            </Card>

            <Modal title={editingPermission ? t('permission.editPermission') : t('permission.createPermission')} open={isModalVisible} onOk={() => form.submit()} onCancel={() => setIsModalVisible(false)} confirmLoading={mutation.isPending}>
                <Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)}>
                    <Form.Item label={t('permission.permissionName')} name="name" rules={[{ required: true, message: t('permission.permissionNameRequired') }]}><Input /></Form.Item>
                    <Form.Item
                        label={
                            <span>
                                {t('permission.permissionCode')}&nbsp;
                                <Tooltip title={
                                    <div>
                                        <p><strong>{t('permission.codeNamingTitle')}：</strong> {t('permission.codeNamingResource')}</p>
                                        <p><strong>{t('permission.codeNamingCommon')}</strong></p>
                                        <ul>
                                            <li><code>list</code> 或 <code>view</code>: {t('permission.codeNamingListView')}</li>
                                            <li><code>create</code> 或 <code>add</code>: {t('permission.codeNamingCreateAdd')}</li>
                                            <li><code>update</code> 或 <code>edit</code>: {t('permission.codeNamingUpdateEdit')}</li>
                                            <li><code>destroy</code> 或 <code>delete</code>: {t('permission.codeNamingDestroyDelete')}</li>
                                        </ul>
                                        <p><strong>{t('permission.codeNamingExample')}</strong> <code>user:list</code>, <code>rbac:menu:create</code></p>
                                        <p><strong>{t('permission.codeNamingWildcard')}</strong> <code>*</code> {t('permission.codeNamingWildcardDesc')}</p>
                                    </div>
                                }>
                                    <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,0.45)', cursor: 'help' }} />
                                </Tooltip>
                            </span>
                        }
                        name="code"
                        rules={[{ required: true, message: t('permission.permissionCodeRequired') }]}
                    >
                        <Input placeholder={t('permission.permissionCodePlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('permission.description')} name="desc"><Input.TextArea /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PermissionManagement;
