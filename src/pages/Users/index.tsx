import React, { useEffect, useState } from 'react';
import {
    Table, Card, Input, Button, Space, Tag, Typography,
    Modal, Form, Select, App, Tooltip
} from 'antd';
import { UserAddOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, SafetyCertificateOutlined, LockOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, deleteUser, assignRoles, resetUserPassword } from '../../api/user';
import { getRoles } from '../../api/rbac';
import useAppStore from '../../store/useAppStore';
import dayjs from 'dayjs';
import { ColumnType } from 'antd/es/table';
import { PaginatedResponse, User } from '../../types';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

const UserManagement: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const { hasPermission, token } = useAppStore();

    const [params, setParams] = useState({
        page: 1,
        size: 10,
        search: ''
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [form] = Form.useForm();
    const [roleForm] = Form.useForm();
    const [passwordForm] = Form.useForm();

    const [inputValue, setInputValue] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setParams(prev => ({ ...prev, search: inputValue, page: 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue]);

    const { data, isLoading } = useQuery<PaginatedResponse<User>>({
        queryKey: ['users', params],
        queryFn: () => getUsers(params.page, params.size, params.search),
        enabled: !!token && (hasPermission('rbac:user:view') || hasPermission('*')),
    });

    const { data: allRoles } = useQuery({
        queryKey: ['roles'],
        queryFn: () => getRoles(),
        enabled: !!token && (hasPermission('rbac:user:edit') || hasPermission('*')),
    });

    const saveMutation = useMutation({
        mutationFn: (values: any) => {
            if (editingUser) {
                return updateUser(editingUser.id, values);
            }
            return createUser(values);
        },
        onSuccess: () => {
            message.success(editingUser ? t('user.userUpdated') : t('user.userCreated'));
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            setEditingUser(null);
            form.resetFields();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            message.success(t('user.userDeleted'));
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const assignRolesMutation = useMutation({
        mutationFn: (roleIds: number[]) => assignRoles(editingUser.id, roleIds),
        onSuccess: () => {
            message.success(t('user.roleAssigned'));
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsRoleModalOpen(false);
            setEditingUser(null);
        },
    });

    const resetPasswordMutation = useMutation({
        mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
            resetUserPassword(id, newPassword),
        onSuccess: () => {
            message.success(t('user.passwordResetSuccess'));
            setIsPasswordModalOpen(false);
            passwordForm.resetFields();
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || t('user.passwordResetFailed'));
        },
    });

    const handleEdit = (record: User) => {
        setEditingUser(record);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleDelete = (id: number) => {
        modal.confirm({
            title: t('user.confirmDelete'),
            content: t('user.confirmDeleteContent'),
            onOk: () => deleteMutation.mutate(id),
        });
    };

    const handleAssignRoles = (record: User) => {
        setEditingUser(record);
        roleForm.setFieldsValue({ role_ids: (record as any).roles || [] });
        setIsRoleModalOpen(true);
    };

    const handleResetPassword = (record: User) => {
        setEditingUser(record);
        passwordForm.resetFields();
        setIsPasswordModalOpen(true);
    };

    const columns: ColumnType<User>[] = [
        { title: t('user.username'), dataIndex: 'username', key: 'username', width: 150, ellipsis: true },
        { title: t('user.email'), dataIndex: 'email', key: 'email', width: 200, ellipsis: true },
        {
            title: t('user.role'),
            dataIndex: 'roles_info',
            key: 'roles_info',
            render: (roles: any[]) => (
                <Space wrap>
                    {roles?.map(role => <Tag color="blue" key={role.id}>{role.name}</Tag>)}
                    {(!roles || roles.length === 0) && <span className="text-gray-400">{t('user.unassigned')}</span>}
                </Space>
            )
        },
        {
            title: t('user.admin'),
            dataIndex: 'is_staff',
            key: 'is_staff',
            render: (isStaff: boolean) => (
                <Tag color={isStaff ? 'red' : 'default'}>{isStaff ? t('user.isAdmin') : t('user.notAdmin')}</Tag>
            ),
        },
        {
            title: t('user.status'),
            dataIndex: 'is_active',
            key: 'is_active',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'error'}>{isActive ? t('user.statusActive') : t('user.statusDisabled')}</Tag>
            ),
        },
        {
            title: t('user.createTime'),
            dataIndex: 'date_joined',
            key: 'date_joined',
            render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: t('user.action'),
            key: 'action',
            render: (_: any, record: User) => (
                <Space size="middle">
                    {hasPermission('rbac:user:edit') && (
                        <Tooltip title={t('user.edit')}>
                            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                        </Tooltip>
                    )}
                    {hasPermission('rbac:user:edit') && (
                        <Tooltip title={t('user.assignRole')}>
                            <Button type="text" icon={<SafetyCertificateOutlined />} onClick={() => handleAssignRoles(record)} />
                        </Tooltip>
                    )}
                    {hasPermission('rbac:user:delete') && (
                        <Tooltip title={t('user.delete')}>
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
                        </Tooltip>
                    )}
                    {hasPermission('rbac:user:edit') && (
                        <Tooltip title={t('user.resetPassword')}>
                            <Button type="text" icon={<LockOutlined />} onClick={() => handleResetPassword(record)} />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <Title level={4}>{t('user.title')}</Title>
                {(hasPermission('rbac:user:add') || hasPermission('*')) && (
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => {
                            setEditingUser(null);
                            form.resetFields();
                            setIsModalOpen(true);
                        }}
                    >{t('user.addUser')}</Button>
                )}
            </div>

            <Card className="shadow-sm">
                <div className="mb-4 flex justify-between">
                    <Space>
                        <Input
                            placeholder={t('user.searchPlaceholder')}
                            prefix={<SearchOutlined />}
                            className="w-64"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                        <Button icon={<ReloadOutlined />} onClick={() => setInputValue('')}>{t('user.reset')}</Button>
                    </Space>
                </div>

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
            </Card>

            <Modal
                title={editingUser ? t('user.editUser') : t('user.createUser')}
                open={isModalOpen}
                onOk={() => form.submit()}
                onCancel={() => setIsModalOpen(false)}
                confirmLoading={saveMutation.isPending}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={(values) => saveMutation.mutate(values)}
                    className="mt-4"
                >
                    <Form.Item label={t('user.username')} name="username" rules={[{ required: true, message: t('user.usernameRequired') }]}>
                        <Input placeholder={t('user.username')} disabled={!!editingUser} />
                    </Form.Item>
                    <Form.Item label={t('user.email')} name="email" rules={[{ required: true, type: 'email', message: t('user.emailRequired') }]}>
                        <Input placeholder="example@ansflow.com" />
                    </Form.Item>
                    {!editingUser && (
                        <Form.Item label={t('user.passwordLabel')} name="password" rules={[{ required: true, min: 6, message: t('user.passwordRequired') }]}>
                            <Input.Password placeholder={t('user.passwordRequired')} />
                        </Form.Item>
                    )}
                    <Form.Item label={t('user.status')} name="is_active" valuePropName="checked" initialValue={true}>
                        <Select options={[
                            { label: t('user.statusActive'), value: true },
                            { label: t('user.statusDisabled'), value: false },
                        ]} />
                    </Form.Item>
                    <Form.Item label={t('user.admin')} name="is_staff" valuePropName="checked" initialValue={false}>
                        <Select options={[
                            { label: t('user.isAdmin'), value: true },
                            { label: t('user.notAdmin'), value: false },
                        ]} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`${t('user.assignRoleTitle')} - ${editingUser?.username}`}
                open={isRoleModalOpen}
                onOk={() => roleForm.submit()}
                onCancel={() => setIsRoleModalOpen(false)}
                confirmLoading={assignRolesMutation.isPending}
            >
                <Form
                    form={roleForm}
                    layout="vertical"
                    onFinish={(values) => assignRolesMutation.mutate(values.role_ids)}
                    className="mt-4"
                >
                    <Form.Item label={t('user.selectRole')} name="role_ids">
                        <Select
                            mode="multiple"
                            placeholder={t('user.selectRolePlaceholder')}
                            style={{ width: '100%' }}
                            options={allRoles?.data?.map((r: any) => ({ label: r.name, value: r.id }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`${t('user.resetPasswordTitle')} - ${editingUser?.username}`}
                open={isPasswordModalOpen}
                onOk={() => passwordForm.submit()}
                onCancel={() => setIsPasswordModalOpen(false)}
                confirmLoading={resetPasswordMutation.isPending}
            >
                <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={(values) => resetPasswordMutation.mutate({ id: editingUser.id, newPassword: values.new_password })}
                    className="mt-4"
                >
                    <Form.Item
                        label={t('user.newPassword')}
                        name="new_password"
                        rules={[
                            { required: true, message: t('user.passwordRequired') },
                            { min: 6, message: t('user.passwordMinLength') },
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder={t('user.newPassword')} />
                    </Form.Item>
                    <Form.Item
                        label={t('user.confirmPassword')}
                        name="confirm_password"
                        dependencies={['new_password']}
                        rules={[
                            { required: true, message: t('user.confirmPasswordRequired') },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('new_password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error(t('user.passwordMismatch')));
                                },
                            }),
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder={t('user.confirmPassword')} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserManagement;
