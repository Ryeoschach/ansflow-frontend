import React, { useState } from 'react';
import { Card, Table, Tag, Button, Input, Space, theme, Modal, Form, Select, App as AntdApp } from 'antd';
import { PlusOutlined, SearchOutlined, CodeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TableSkeleton } from '../../../components/Skeletons';
import { getCIEnvironments, createCIEnvironment, updateCIEnvironment, deleteCIEnvironment } from '../../../api/pipeline';
import useAppStore from '../../../store/useAppStore';

interface CIEnvironment {
    id: string | number;
    name: string;
    image: string;
    type: string;
    status: 'READY' | 'PULLING' | 'ERROR';
    description: string;
}

const CIEnvironments: React.FC = () => {
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
            message.success('创建环境成功');
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ci-environments'] });
        },
        onError: () => message.error('创建失败，请检查配置')
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string | number, data: any }) => updateCIEnvironment(id, data),
        onSuccess: () => {
            message.success('更新环境成功');
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['ci-environments'] });
        },
        onError: () => message.error('更新失败')
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCIEnvironment,
        onSuccess: () => {
            message.success('已删除环境');
            queryClient.invalidateQueries({ queryKey: ['ci-environments'] });
        },
        onError: () => message.error('删除失败')
    });

    const columns = [
        {
            title: '环境名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-semibold text-[15px]">{text}</span>,
        },
        {
            title: 'Docker 镜像 URI',
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
            title: '编译类型',
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
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                if (status === 'READY') return <Tag color="success" className="border-0">可用</Tag>;
                if (status === 'PULLING') return <Tag color="processing" className="border-0">拉取中</Tag>;
                return <Tag color="error" className="border-0">异常</Tag>;
            }
        },
        {
            title: '用途描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (text: string) => <span className="text-gray-500 text-sm">{text || '-'}</span>,
        },
        {
            title: '操作',
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
            title: '确认删除该构建环境？',
            content: '删除后，使用该环境模板的流水线可能无法正常工作。',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
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
                <h2 className="text-2xl font-bold mb-1 tracking-tight">构建镜像管理 (CI Environments)</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">统一化管理流水线的底层执行沙箱，流水线使用者将能在表单中直接选用这里的环境进行安全编译。</p>
            </div>

            <Card className="shadow-sm border-0 root-card">
                {isLoading ? (
                    <TableSkeleton />
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <Input
                                placeholder="搜索环境名称、镜像或类型..."
                                prefix={<SearchOutlined className="text-gray-400" />}
                                className="w-72"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                allowClear
                            />
                            {hasPermission('pipeline:ci_env:add') && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} className="shadow-sm">
                                注册新环境
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
                title={editingId ? "编辑构建环境" : "注册新构建环境"}
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={() => setIsModalOpen(false)}
                okText="保存"
                cancelText="取消"
                confirmLoading={createMutation.isPending || updateMutation.isPending}
            >
                <div className="pt-4">
                    <Form form={form} layout="vertical">
                        <Form.Item label="环境展示名称" name="name" rules={[{ required: true, message: '请填写名称' }]}>
                            <Input placeholder="例如：Node.js 18 LTS" />
                        </Form.Item>
                        <Form.Item 
                            label="Docker 镜像地址" 
                            name="image" 
                            rules={[{ required: true, message: '请填写镜像URI' }]}
                            extra={<span className="text-xs text-gray-500">保存后系统宿主机（或节点）将自动拉取此 Docker 镜像作为本地沙箱备用。</span>}
                        >
                            <Input placeholder="例如：node:18-alpine 或 hub.docker.com/my-node:18" prefix={<CodeOutlined className="text-gray-400" />} />
                        </Form.Item>
                        <Form.Item label="技术栈标签" name="type" rules={[{ required: true, message: '请选择或填写技术栈' }]}>
                            <Select 
                                mode="tags" 
                                maxCount={1}
                                options={[{ value: 'Frontend', label: 'Frontend' }, { value: 'Java', label: 'Java' }, { value: 'Go', label: 'Go' }, { value: 'Python', label: 'Python' }]}
                                placeholder="选择或输入标签" 
                            />
                        </Form.Item>
                        <Form.Item label="用途描述" name="description">
                            <Input.TextArea rows={3} placeholder="描述此环境通常用于何种流水的编译或执行..." />
                        </Form.Item>
                    </Form>
                </div>
            </Modal>
        </div>
    );
};

export default CIEnvironments;
