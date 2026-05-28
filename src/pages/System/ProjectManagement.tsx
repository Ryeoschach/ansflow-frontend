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
            message.success(editingProject ? t('project.updateSuccess') : t('project.createSuccess'));
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
            message.success(t('project.deleteSuccess'));
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
            message.success(t('project.addMemberSuccess'));
            addMemberForm.resetFields();
            refetchMembers();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.message || err.response?.data?.non_field_errors?.[0] || t('project.addMemberFailed'));
        }
    });

    const updateMemberRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: number; role: string }) => updateProjectMember(id, { role }),
        onSuccess: () => {
            message.success(t('project.updateRoleSuccess'));
            refetchMembers();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.message || t('project.updateRoleFailed'));
        }
    });

    const deleteMemberMutation = useMutation({
        mutationFn: deleteProjectMember,
        onSuccess: () => {
            message.success(t('project.removeMemberSuccess'));
            refetchMembers();
        },
        onError: (err: any) => {
            message.error(err.response?.data?.message || t('project.removeMemberFailed'));
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
            title: t('project.columnCode'),
            dataIndex: 'code', 
            key: 'code', 
            width: 150, 
            ellipsis: true,
            render: (code: string) => <Text code>{code}</Text>
        },
        { 
            title: t('project.columnName'),
            dataIndex: 'name', 
            key: 'name', 
            width: 180, 
            ellipsis: true,
            render: (name: string) => <Text strong>{name}</Text>
        },
        { 
            title: t('project.columnOwner'),
            dataIndex: 'owner_name', 
            key: 'owner_name', 
            width: 150, 
            ellipsis: true,
            render: (_: any, record: any) => record.owner_username || '-'
        },
        { 
            title: t('project.columnDesc'),
            dataIndex: 'description', 
            key: 'description', 
            width: 250, 
            ellipsis: true 
        },
        { 
            title: t('project.columnAction'),
            key: 'action', 
            width: 120,
            render: (_: any, record: any) => {
                const isDefault = record.code === 'default';
                return (
                    <Space>
                        <Tooltip title={t('project.manageMembers')}>
                            <Button 
                                type="text" 
                                icon={<TeamOutlined />} 
                                onClick={() => handleManageMembers(record)} 
                            />
                        </Tooltip>
                        <Tooltip title={t('common.edit')}>
                            <Button 
                                type="text" 
                                icon={<EditOutlined />} 
                                onClick={() => handleEdit(record)} 
                            />
                        </Tooltip>
                        {!isDefault && (
                            <Tooltip title={t('common.delete')}>
                                <Button 
                                    type="text" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    onClick={() => {
                                        modal.confirm({
                                            title: t('project.confirmDeleteTitle'),
                                            content: t('project.confirmDeleteContent'),
                                            okText: t('common.confirm'),
                                            cancelText: t('common.cancel'),
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
                    <Title level={4} style={{ margin: 0 }}>{t('project.title')}</Title>
                </Space>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={handleAdd}
                >
                    {t('project.addProject')}
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
                title={editingProject ? t('project.editProject') : t('project.createProject')}
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
                        label={t('project.projectCode')}
                        name="code" 
                        rules={[
                            { required: true, message: t('project.codeRequired') },
                            { pattern: /^[a-zA-Z0-9_-]+$/, message: t('project.codePattern') }
                        ]}
                    >
                        <Input placeholder={t('project.codePlaceholder')} disabled={!!editingProject} />
                    </Form.Item>

                    <Form.Item 
                        label={t('project.projectName')}
                        name="name" 
                        rules={[{ required: true, message: t('project.nameRequired') }]}
                    >
                        <Input placeholder={t('project.namePlaceholder')} />
                    </Form.Item>

                    <Form.Item 
                        label={t('project.projectOwner')}
                        name="owner"
                    >
                        <Select 
                            placeholder={t('project.ownerPlaceholder')}
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
                        label={t('project.projectDesc')}
                        name="description"
                    >
                        <Input.TextArea placeholder={t('project.descPlaceholder')} rows={4} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Member Management Modal */}
            <Modal
                title={t('project.memberModalTitle', { name: currentProjectForMembers?.name || '' })}
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
                        <Typography.Title level={5} className="mt-0 mb-3" style={{ fontSize: '14px', marginTop: 0, marginBottom: '12px' }}>{t('project.addMember')}</Typography.Title>
                        <Form
                            form={addMemberForm}
                            layout="inline"
                            onFinish={(values) => addMemberMutation.mutate(values)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                        >
                            <Form.Item
                                name="user"
                                rules={[{ required: true, message: t('project.selectMember') }]}
                                style={{ flex: '1 1 200px', margin: 0 }}
                            >
                                <Select
                                    placeholder={t('project.selectUser')}
                                    showSearch
                                    optionFilterProp="label"
                                    options={usersList.map((u: any) => ({
                                        value: u.id,
                                        label: `${u.username} (${u.email || t('project.noEmail')})`
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
                                        { value: 'admin', label: t('project.roleAdmin') },
                                        { value: 'member', label: t('project.roleMember') },
                                        { value: 'viewer', label: t('project.roleViewer') }
                                    ]}
                                />
                            </Form.Item>
                            <Form.Item style={{ margin: 0 }}>
                                <Button type="primary" htmlType="submit" loading={addMemberMutation.isPending}>
                                    {t('project.add')}
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
                                title: t('project.username'),
                                dataIndex: 'username',
                                key: 'username',
                                render: (text: string) => <Text strong>{text}</Text>
                            },
                            {
                                title: t('project.projectRole'),
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
                                            admin: t('project.roleAdmin'),
                                            member: t('project.roleMember'),
                                            viewer: t('project.roleViewer')
                                        }[role] || role;
                                        return <Tag color={role === 'admin' ? 'blue' : role === 'viewer' ? 'default' : 'green'}>{roleLabel}</Tag>;
                                    }

                                    return (
                                        <Select
                                            value={role}
                                            style={{ width: 120 }}
                                            onChange={(newRole) => updateMemberRoleMutation.mutate({ id: record.id, role: newRole })}
                                            options={[
                                                { value: 'admin', label: t('project.roleAdmin') },
                                                { value: 'member', label: t('project.roleMember') },
                                                { value: 'viewer', label: t('project.roleViewer') }
                                            ]}
                                        />
                                    );
                                }
                            },
                            {
                                title: t('project.joinedAt'),
                                dataIndex: 'create_time',
                                key: 'create_time',
                                render: (val: string) => val ? new Date(val).toLocaleString() : '-'
                            },
                            {
                                title: t('common.actions'),
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
                                            title={t('project.confirmRemoveMember')}
                                            onConfirm={() => deleteMemberMutation.mutate(record.id)}
                                            okText={t('common.confirm')}
                                            cancelText={t('common.cancel')}
                                        >
                                            <Button type="link" danger size="small">
                                                {t('project.remove')}
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
