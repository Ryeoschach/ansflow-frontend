import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Space, Card, App, Typography, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPermissions, createPermission, updatePermission, deletePermission } from '../../api/rbac';
import useAppStore from '../../store/useAppStore';
import { PaginatedResponse, Permission } from '../../types';

const { Title } = Typography;

const PermissionManagement: React.FC = () => {
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
            message.success(editingPermission ? '更新成功' : '创建成功');
            setIsModalVisible(false);
            setEditingPermission(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['permissions'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deletePermission,
        onSuccess: () => {
            message.success('删除成功');
            queryClient.invalidateQueries({ queryKey: ['permissions'] });
        },
    });

    const handleAdd = () => {
        setEditingPermission(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const columns = [
        { title: '权限名称', dataIndex: 'name', key: 'name' },
        { title: '权限代码', dataIndex: 'code', key: 'code', render: (code: string) => <Typography.Text code>{code}</Typography.Text> },
        { title: '描述', dataIndex: 'desc', key: 'desc' },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    {(hasPermission('*') || hasPermission('rbac:permission:edit')) && (
                        <Tooltip title="编辑">
                            <Button type="text" icon={<EditOutlined />} onClick={() => { setEditingPermission(record); form.setFieldsValue(record); setIsModalVisible(true); }} />
                        </Tooltip>
                    )}
                    {(hasPermission('*') || hasPermission('rbac:permission:delete')) && (
                        <Tooltip title="删除">
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => {
                                modal.confirm({
                                    title: '确定删除该权限吗？',
                                    content: '删除后将无法恢复，且关联该权限的角色将失去此权限。',
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
                <Title level={4}>权限管理</Title>
                {(hasPermission('*') || hasPermission('rbac:permission:create') || hasPermission('rbac:permission:add')) && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增权限</Button>
                )}
            </div>

            <Card className="shadow-sm">
                <Table 
                    dataSource={permissions?.data} 
                    columns={columns} 
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 1200 }}
                    pagination={{ 
                        total: permissions?.total,
                        current: params.page,
                        pageSize: params.size,
                        showSizeChanger: true,
                        onChange: (p, s) => setParams({ ...params, page: p, size: s }),
                    }} 
                />
            </Card>

            <Modal title={editingPermission ? '编辑权限' : '新增权限'} open={isModalVisible} onOk={() => form.submit()} onCancel={() => setIsModalVisible(false)} confirmLoading={mutation.isPending}>
                <Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)}>
                    <Form.Item label="权限名称" name="name" rules={[{ required: true, message: '请输入权限名称' }]}><Input /></Form.Item>
                    <Form.Item
                        label={
                            <span>
                                权限代码&nbsp;
                                <Tooltip title={
                                    <div>
                                        <p><strong>命名规范：</strong> 资源:操作</p>
                                        <p><strong>常见操作：</strong></p>
                                        <ul>
                                            <li><code>list</code> 或 <code>view</code>: 查看列表</li>
                                            <li><code>create</code> 或 <code>add</code>: 新增数据</li>
                                            <li><code>update</code> 或 <code>edit</code>: 编辑修改</li>
                                            <li><code>destroy</code> 或 <code>delete</code>: 删除数据</li>
                                        </ul>
                                        <p><strong>示例：</strong> <code>user:list</code>, <code>rbac:menu:create</code></p>
                                        <p><strong>通配符：</strong> <code>*</code> 代表拥有所有权限</p>
                                    </div>
                                }>
                                    <QuestionCircleOutlined style={{ color: 'rgba(0,0,0,0.45)', cursor: 'help' }} />
                                </Tooltip>
                            </span>
                        }
                        name="code"
                        rules={[{ required: true, message: '请输入权限码' }]}
                    >
                        <Input placeholder="例如：user:list" />
                    </Form.Item>
                    <Form.Item label="描述" name="desc"><Input.TextArea /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PermissionManagement;
