import React, { useState } from 'react';
import { 
    Table, Card, Button, Form, Input, Select, Modal, Typography, 
    Space, Tooltip, App, theme, Tag, Popconfirm
} from 'antd';
import { 
    PlusOutlined, EditOutlined, DeleteOutlined, 
    ProjectOutlined, TeamOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import useAppStore from '../../store/useAppStore';
import { 
    getProjects, createProject, updateProject, deleteProject,
    getProjectMembers, createProjectMember, updateProjectMember, deleteProjectMember
} from '../../api/rbac';
import { getUsers } from '../../api/user';

const { Title, Text } = Typography;

const ProjectManagement: React.FC = () => {
    const { token } = theme.useToken();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message, modal } = App.useApp();
    const { hasPermission, currentUser } = useAppStore();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [form] = Form.useForm();

    const [params, setParams] = useState({
        page: 1,
        size: 10,
        search: ''
    });

    // Fetch projects
    const { data: projectsData, isLoading } = useQuery({
        queryKey: ['projects', params],
        queryFn: () => getProjects(params)
    });

    // Fetch users for owner selection
    const { data: usersData } = useQuery({
        queryKey: ['users', { size: 1000 }],
        queryFn: () => getUsers({ size: 1000 })
    });

    const usersList = usersData?.data || [];

    const mutation = useMutation({
        mutationFn: (values: any) => editingProject ? updateProject(editingProject.id, values) : createProject(values),
        onSuccess: () => {
            message.success(editingProject ? '更新项目成功' : '创建项目成功');
            setIsModalVisible(false);
            setEditingProject(null);
            form.resetFields();
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            // Refresh store project list
            getProjects({ page_size: 1000 }).then((res: any) => {
                useAppStore.getState().setProjects(res.data || []);
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteProject,
        onSuccess: () => {
            message.success('删除项目成功');
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            getProjects({ page_size: 1000 }).then((res: any) => {
                useAppStore.getState().setProjects(res.data || []);
            });
        }
    });

    // Member Management States
    const [memberModalVisible, setMemberModalVisible] = useState(false);
    const [currentProjectForMembers, setCurrentProjectForMembers] = useState<any>(null);
    const [addMemberForm] = Form.useForm();

    const { data: membersData, refetch: refetchMembers, isLoading: isMembersLoading } = useQuery({
        queryKey: ['projectMembers', currentProjectForMembers?.id],
        queryFn: () => getProjectMembers({ project_id: currentProjectForMembers?.id, page_size: 1000 }),
        enabled: !!currentProjectForMembers?.id
    });

    const projectMembers = membersData?.data || [];

    const addMemberMutation = useMutation({
        mutationFn: (values: { user: number; role: string }) => createProjectMember({
            project: currentProjectForMembers?.id,
            user: values.user,
            role: values.role
        }),
        onSuccess: () => {
            message.success('添加成员成功');
            addMemberForm.resetFields();
            refetchMembers();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.message || err.response?.data?.non_field_errors?.[0] || '添加成员失败');
        }
    });

    const updateMemberRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: number; role: string }) => updateProjectMember(id, { role }),
        onSuccess: () => {
            message.success('修改角色成功');
            refetchMembers();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.message || '修改角色失败');
        }
    });

    const deleteMemberMutation = useMutation({
        mutationFn: deleteProjectMember,
        onSuccess: () => {
            message.success('移除成员成功');
            refetchMembers();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.message || '移除成员失败');
        }
    });

    const handleManageMembers = (project: any) => {
        setCurrentProjectForMembers(project);
        setMemberModalVisible(true);
    };

    const handleAdd = () => {
        setEditingProject(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (record: any) => {
        setEditingProject(record);
        form.setFieldsValue(record);
        setIsModalVisible(true);
    };

    const columns = [
        { 
            title: t('project.columnCode', '项目标识'), 
            dataIndex: 'code', 
            key: 'code', 
            width: 150, 
            ellipsis: true,
            render: (code: string) => <Text code>{code}</Text>
        },
        { 
            title: t('project.columnName', '项目名称'), 
            dataIndex: 'name', 
            key: 'name', 
            width: 180, 
            ellipsis: true,
            render: (name: string) => <Text strong>{name}</Text>
        },
        { 
            title: t('project.columnOwner', '负责人'), 
            dataIndex: 'owner_name', 
            key: 'owner_name', 
            width: 150, 
            ellipsis: true,
            render: (_: any, record: any) => record.owner_username || '-'
        },
        { 
            title: t('project.columnDesc', '项目描述'), 
            dataIndex: 'description', 
            key: 'description', 
            width: 250, 
            ellipsis: true 
        },
        { 
            title: t('project.columnAction', '操作'), 
            key: 'action', 
            width: 120,
            render: (_: any, record: any) => {
                const isDefault = record.code === 'default';
                return (
                    <Space>
                        <Tooltip title="成员管理">
                            <Button 
                                type="text" 
                                icon={<TeamOutlined />} 
                                onClick={() => handleManageMembers(record)} 
                            />
                        </Tooltip>
                        <Tooltip title={t('common.edit', '编辑')}>
                            <Button 
                                type="text" 
                                icon={<EditOutlined />} 
                                onClick={() => handleEdit(record)} 
                            />
                        </Tooltip>
                        {!isDefault && (
                            <Tooltip title={t('common.delete', '删除')}>
                                <Button 
                                    type="text" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    onClick={() => {
                                        modal.confirm({
                                            title: '确认删除该项目？',
                                            content: '项目删除后，相关的独立资产可能失去关联，请确认。',
                                            okText: t('common.confirm', '确认'),
                                            cancelText: t('common.cancel', '取消'),
                                            onOk: () => deleteMutation.mutate(record.id),
                                        });
                                    }} 
                                />
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        }
    ];

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <Space>
                    <ProjectOutlined style={{ fontSize: '20px', color: token.colorPrimary }} />
                    <Title level={4} style={{ margin: 0 }}>{t('project.title', '项目管理')}</Title>
                </Space>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={handleAdd}
                >
                    {t('project.addProject', '新建项目')}
                </Button>
            </div>

            <Card className="shadow-sm">
                <Table
                    dataSource={projectsData?.data || []}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        total: projectsData?.total || 0,
                        current: params.page,
                        pageSize: params.size,
                        showSizeChanger: true,
                        onChange: (p, s) => setParams({ ...params, page: p, size: s }),
                    }}
                />
            </Card>

            <Modal 
                title={editingProject ? t('project.editProject', '编辑项目') : t('project.createProject', '创建项目')} 
                open={isModalVisible} 
                onOk={() => form.submit()} 
                onCancel={() => setIsModalVisible(false)} 
                confirmLoading={mutation.isPending}
                destroyOnClose
            >
                <Form 
                    form={form} 
                    layout="vertical" 
                    onFinish={(values) => mutation.mutate(values)}
                >
                    <Form.Item 
                        label={t('project.projectCode', '项目标识')} 
                        name="code" 
                        rules={[
                            { required: true, message: '请输入项目标识' },
                            { pattern: /^[a-zA-Z0-9_-]+$/, message: '项目标识仅支持字母、数字、下划线和连字符' }
                        ]}
                    >
                        <Input placeholder="例如: default, marketing, devops" disabled={!!editingProject} />
                    </Form.Item>

                    <Form.Item 
                        label={t('project.projectName', '项目名称')} 
                        name="name" 
                        rules={[{ required: true, message: '请输入项目名称' }]}
                    >
                        <Input placeholder="例如: 默认项目, 市场系统, 智能运维平台" />
                    </Form.Item>

                    <Form.Item 
                        label={t('project.projectOwner', '项目负责人')} 
                        name="owner"
                    >
                        <Select 
                            placeholder="请选择项目负责人" 
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={usersList.map((u: any) => ({
                                value: u.id,
                                label: `${u.username} (${u.email})`
                            }))}
                        />
                    </Form.Item>

                    <Form.Item 
                        label={t('project.projectDesc', '项目描述')} 
                        name="description"
                    >
                        <Input.TextArea placeholder="请输入项目用途、团队以及描述信息" rows={4} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Member Management Modal */}
            <Modal
                title={`项目成员管理 - ${currentProjectForMembers?.name || ''}`}
                open={memberModalVisible}
                onCancel={() => {
                    setMemberModalVisible(false);
                    setCurrentProjectForMembers(null);
                    addMemberForm.resetFields();
                }}
                footer={null}
                width={700}
                destroyOnClose
            >
                <div className="flex flex-col gap-6 py-2">
                    {/* Add Member Form */}
                    <div className="p-4 rounded-lg bg-ans-bg-secondary border border-solid border-black/5 dark:border-white/5" style={{ background: token.colorFillAlter, border: `1px solid ${token.colorBorder}` }}>
                        <Typography.Title level={5} className="mt-0 mb-3" style={{ fontSize: '14px', marginTop: 0, marginBottom: '12px' }}>添加项目成员</Typography.Title>
                        <Form
                            form={addMemberForm}
                            layout="inline"
                            onFinish={(values) => addMemberMutation.mutate(values)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                        >
                            <Form.Item
                                name="user"
                                rules={[{ required: true, message: '请选择成员' }]}
                                style={{ flex: '1 1 200px', margin: 0 }}
                            >
                                <Select
                                    placeholder="搜索并选择用户"
                                    showSearch
                                    optionFilterProp="label"
                                    options={usersList.map((u: any) => ({
                                        value: u.id,
                                        label: `${u.username} (${u.email || '无邮箱'})`
                                    }))}
                                />
                            </Form.Item>
                            <Form.Item
                                name="role"
                                initialValue="member"
                                rules={[{ required: true }]}
                                style={{ width: '130px', margin: 0 }}
                            >
                                <Select
                                    options={[
                                        { value: 'admin', label: '项目管理员' },
                                        { value: 'member', label: '成员' },
                                        { value: 'viewer', label: '只读成员' }
                                    ]}
                                />
                            </Form.Item>
                            <Form.Item style={{ margin: 0 }}>
                                <Button type="primary" htmlType="submit" loading={addMemberMutation.isPending}>
                                    添加
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>

                    {/* Member List Table */}
                    <Table
                        dataSource={projectMembers}
                        loading={isMembersLoading}
                        rowKey="id"
                        size="middle"
                        pagination={{ pageSize: 5 }}
                        columns={[
                            {
                                title: '用户名',
                                dataIndex: 'username',
                                key: 'username',
                                render: (text: string) => <Text strong>{text}</Text>
                            },
                            {
                                title: '项目内角色',
                                dataIndex: 'role',
                                key: 'role',
                                render: (role: string, record: any) => {
                                    const isProjectOwner = currentProjectForMembers?.owner_username === currentUser;
                                    const isAdminOfProject = projectMembers.some((m: any) => m.username === currentUser && m.role === 'admin');
                                    const isSuper = hasPermission('*');
                                    
                                    const canManage = isSuper || isProjectOwner || isAdminOfProject;
                                    const isOwnerSelf = currentProjectForMembers?.owner_username === record.username;

                                    if (!canManage || isOwnerSelf) {
                                        const roleLabel = {
                                            admin: '项目管理员',
                                            member: '成员',
                                            viewer: '只读成员'
                                        }[role] || role;
                                        return <Tag color={role === 'admin' ? 'blue' : role === 'viewer' ? 'default' : 'green'}>{roleLabel}</Tag>;
                                    }

                                    return (
                                        <Select
                                            value={role}
                                            style={{ width: 120 }}
                                            onChange={(newRole) => updateMemberRoleMutation.mutate({ id: record.id, role: newRole })}
                                            options={[
                                                { value: 'admin', label: '项目管理员' },
                                                { value: 'member', label: '成员' },
                                                { value: 'viewer', label: '只读成员' }
                                            ]}
                                        />
                                    );
                                }
                            },
                            {
                                title: '加入时间',
                                dataIndex: 'create_time',
                                key: 'create_time',
                                render: (val: string) => val ? new Date(val).toLocaleString() : '-'
                            },
                            {
                                title: '操作',
                                key: 'action',
                                width: 80,
                                render: (_: any, record: any) => {
                                    const isProjectOwner = currentProjectForMembers?.owner_username === currentUser;
                                    const isAdminOfProject = projectMembers.some((m: any) => m.username === currentUser && m.role === 'admin');
                                    const isSuper = hasPermission('*');
                                    
                                    const canManage = isSuper || isProjectOwner || isAdminOfProject;
                                    const isOwnerSelf = currentProjectForMembers?.owner_username === record.username;

                                    if (!canManage || isOwnerSelf) return '-';

                                    return (
                                        <Popconfirm
                                            title="确定移除该成员吗？"
                                            onConfirm={() => deleteMemberMutation.mutate(record.id)}
                                            okText="确定"
                                            cancelText="取消"
                                        >
                                            <Button type="link" danger size="small">
                                                移除
                                            </Button>
                                        </Popconfirm>
                                    );
                                }
                            }
                        ]}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default ProjectManagement;
