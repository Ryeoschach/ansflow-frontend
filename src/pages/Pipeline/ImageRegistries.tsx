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
import { getRegistries, createRegistry, updateRegistry, deleteRegistry } from "../../api/registry";
import { DeleteOutlined, EditOutlined, PlusOutlined, LockOutlined, UserOutlined, GlobalOutlined } from "@ant-design/icons";
import { TableSkeleton } from "../../components/Skeletons";
import useAppStore from '../../store/useAppStore';


const { Text } = Typography;

const ImageRegistries: React.FC = () => {
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { token, hasPermission } = useAppStore();
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
            message.success("镜像仓库配置创建成功");
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['image-registries'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (vars: { id: number, data: any }) => updateRegistry(vars.id, vars.data),
        onSuccess: () => {
            message.success("镜像仓库配置更新成功");
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['image-registries'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteRegistry,
        onSuccess: () => {
            message.success("镜像仓库配置已删除");
            queryClient.invalidateQueries({ queryKey: ['image-registries'] });
        },
    });

    const handleEdit = (record: any) => {
        setEditingRegistry(record);
        form.setFieldsValue(record);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingRegistry(null);
        form.resetFields();
        setIsModalOpen(true);
    };

    const columns = [
        {
            title: '仓库名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: '仓库地址 (URL)',
            dataIndex: 'url',
            key: 'url',
        },
        {
            title: '默认 Namespace',
            dataIndex: 'namespace',
            key: 'namespace',
        },
        {
            title: '拥有者/用户名',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: '创建时间',
            dataIndex: 'create_time',
            key: 'create_time',
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {hasPermission('registry:docker:edit') && (
                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    )}
                    {hasPermission('registry:docker:delete') && (
                    <Popconfirm
                        title="确定要删除该仓库配置吗？"
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card title="全局镜像仓库管理" extra={
            hasPermission('registry:docker:add') ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增仓库</Button>
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
                    pagination={{ pageSize: 10 }}
                />
            )}

            <Modal
                title={editingRegistry ? "编辑镜像仓库" : "新增镜像仓库"}
                open={isModalOpen}
                forceRender
                onCancel={() => setIsModalOpen(false)}
                onOk={() => form.submit()}
                width={600}
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
                    <Form.Item label="标识名称" name="name" rules={[{ required: true, message: '请输入前端展示名称' }]}>
                        <Input placeholder="例: Harbor-Production" />
                    </Form.Item>
                    <Form.Item label="仓库 URL" name="url" rules={[{ required: true, message: '请输入仓库URL' }]}>
                        <Input prefix={<GlobalOutlined />} placeholder="例如: harbor.demo.com 或 https://harbor.demo.com" />
                    </Form.Item>
                    <Form.Item label="默认命名空间 (可选)" name="namespace">
                        <Input placeholder="例如: library 或 ops" />
                    </Form.Item>

                    <div className="flex gap-4">
                        <Form.Item label="用户名" name="username" className="flex-1" rules={[{ required: true, message: '请输入用户名' }]}>
                            <Input prefix={<UserOutlined />} />
                        </Form.Item>
                        <Form.Item label="密码/Token" name="password" className="flex-1" rules={[{ required: !editingRegistry, message: '请输入认证密钥' }]}>
                            <Input.Password prefix={<LockOutlined />} placeholder="输入密码或访问 Token" />
                        </Form.Item>
                    </div>

                    <Form.Item label="备注描述" name="description">
                        <Input.TextArea />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ImageRegistries;
