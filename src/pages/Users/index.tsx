import React, { useEffect, useState } from 'react';
import {
    Table, Card, Input, Button, Space, Tag, Typography,
    Modal, Form, Select, App, Tooltip
} from 'antd';
import { UserAddOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, deleteUser, assignRoles } from '../../api/user';
import { getRoles } from '../../api/rbac';
import useAppStore from '../../store/useAppStore';
import dayjs from 'dayjs';
import { ColumnType } from 'antd/es/table';
import { PaginatedResponse, User } from '../../types';

const { Title } = Typography;

const UserManagement: React.FC = () => {
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const { hasPermission, token } = useAppStore();
    
    // 统一管理分页与搜索参数
    const [params, setParams] = useState({
        page: 1,
        size: 10,
        search: ''
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [form] = Form.useForm();
    const [roleForm] = Form.useForm();

    // 节流搜索：当搜索框输入变化时，延迟更新 params.search 并回到第一页
    const [inputValue, setInputValue] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setParams(prev => ({ ...prev, search: inputValue, page: 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [inputValue]);

    // 获取用户列表
    const { data, isLoading } = useQuery<PaginatedResponse<User>>({
        queryKey: ['users', params],
        queryFn: () => getUsers(params.page, params.size, params.search),
        // 只有拥有查看权限才发起请求
        enabled: !!token && (hasPermission('rbac:user:view') || hasPermission('*')),
    });

    // 获取所有角色（用于下拉选择）
    const { data: allRoles } = useQuery({
        queryKey: ['roles'],
        queryFn: () => getRoles(),
        enabled: !!token && (hasPermission('rbac:user:edit') || hasPermission('*')),
    });

    // 创建/更新用户
    const saveMutation = useMutation({
        mutationFn: (values: any) => {
            if (editingUser) {
                return updateUser(editingUser.id, values);
            }
            return createUser(values);
        },
        onSuccess: () => {
            message.success(editingUser ? '用户更新成功' : '用户创建成功');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            setEditingUser(null);
            form.resetFields();
        },
    });

    // 删除用户
    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            message.success('用户删除成功');
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    // 分配角色
    const assignRolesMutation = useMutation({
        mutationFn: (roleIds: number[]) => assignRoles(editingUser.id, roleIds),
        onSuccess: () => {
            message.success('角色分配成功');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsRoleModalOpen(false);
            setEditingUser(null);
        },
    });

    const handleEdit = (record: User) => {
        setEditingUser(record);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleDelete = (id: number) => {
        modal.confirm({
            title: '确定删除该用户吗？',
            content: '删除后将无法恢复。',
            onOk: () => deleteMutation.mutate(id),
        });
    };

    const handleAssignRoles = (record: User) => {
        setEditingUser(record);
        roleForm.setFieldsValue({ role_ids: (record as any).roles || [] });
        setIsRoleModalOpen(true);
    };

    const columns: ColumnType<User>[] = [
        { title: '用户名', dataIndex: 'username', key: 'username' },
        { title: '邮箱', dataIndex: 'email', key: 'email' },
        {
            title: '所属角色',
            dataIndex: 'roles_info',
            key: 'roles_info',
            render: (roles: any[]) => (
                <Space wrap>
                    {roles?.map(role => <Tag color="blue" key={role.id}>{role.name}</Tag>)}
                    {(!roles || roles.length === 0) && <span className="text-gray-400">未分配</span>}
                </Space>
            )
        },
        {
            title: '管理员',
            dataIndex: 'is_staff',
            key: 'is_staff',
            render: (isStaff: boolean) => (
                <Tag color={isStaff ? 'red' : 'default'}>{isStaff ? '是' : '否'}</Tag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'is_active',
            key: 'is_active',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'error'}>{isActive ? '正常' : '禁用'}</Tag>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'date_joined',
            key: 'date_joined',
            render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_: any, record: User) => (
                <Space size="middle">
                    {hasPermission('rbac:user:edit') && (
                        <Tooltip title="编辑">
                            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                        </Tooltip>
                    )}
                    {/*{hasPermission('user:assign_role') && (*/}
                    {hasPermission('rbac:user:edit') && (
                        <Tooltip title="角色分配">
                            <Button type="text" icon={<SafetyCertificateOutlined />} onClick={() => handleAssignRoles(record)} />
                        </Tooltip>
                    )}
                    {hasPermission('rbac:user:delete') && (
                        <Tooltip title="删除">
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <Title level={4}>用户管理</Title>
                {(hasPermission('rbac:user:add') || hasPermission('*')) && (
                    <Button
                        type="primary"
                        icon={<UserAddOutlined />}
                        onClick={() => {
                            setEditingUser(null);
                            form.resetFields();
                            setIsModalOpen(true);
                        }}
                    >新增用户</Button>
                )}
            </div>

            <Card className="shadow-sm">
                <div className="mb-4 flex justify-between">
                    <Space>
                        <Input
                            placeholder="搜索用户名/邮箱"
                            prefix={<SearchOutlined />}
                            className="w-64"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                        <Button icon={<ReloadOutlined />} onClick={() => setInputValue('')}>重置</Button>
                    </Space>
                </div>

                <Table
                    dataSource={data?.data}
                    columns={columns}
                    loading={isLoading}
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
            </Card>

            <Modal
                title={editingUser ? '编辑用户' : '新增用户'}
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
                    <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                        <Input placeholder="请输入用户名" disabled={!!editingUser} />
                    </Form.Item>
                    <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email' }]}>
                        <Input placeholder="example@ansflow.com" />
                    </Form.Item>
                    {!editingUser && (
                        <Form.Item label="初始密码" name="password" rules={[{ required: true, min: 6 }]}>
                            <Input.Password placeholder="请输入密码" />
                        </Form.Item>
                    )}
                    <Form.Item label="状态" name="is_active" valuePropName="checked" initialValue={true}>
                        <Select options={[
                            { label: '正常', value: true },
                            { label: '禁用', value: false },
                        ]} />
                    </Form.Item>
                    <Form.Item label="管理员权限" name="is_staff" valuePropName="checked" initialValue={false}>
                        <Select options={[
                            { label: '是', value: true },
                            { label: '否', value: false },
                        ]} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`分配角色 - ${editingUser?.username}`}
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
                    <Form.Item label="选择角色" name="role_ids">
                        <Select
                            mode="multiple"
                            placeholder="请选择角色"
                            style={{ width: '100%' }}
                            options={allRoles?.data?.map((r: any) => ({ label: r.name, value: r.id }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserManagement;