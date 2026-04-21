import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Table, Button, Space, Modal, Form, Input, App, Popconfirm, Card, Drawer, Tag, Tooltip, Tabs, Spin, Select, Typography, Alert, Divider, Checkbox, Collapse, theme } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SecurityScanOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getRoles, createRole, updateRole, deleteRole, getPermissions, getMenus, updateRoleDataPolicies } from '../../api/rbac';
import { getPipelines } from '../../api/pipeline';
import { getK8sClusters } from '../../api/k8s';
import { getResourcePools, getCredentials } from '../../api/hosts';
import { getRegistries } from '../../api/registry';
import { getAnsibleTasks } from '../../api/tasks';
import useAppStore from '../../store/useAppStore';
import { PaginatedResponse, Permission } from '../../types';

/**
 * 角色管理页面
 */
const RoleManagement: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { message } = App.useApp();
    const { token } = theme.useToken();
    const { hasPermission } = useAppStore();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    
    // 抽屉宽度拖拽状态
    const [drawerWidth, setDrawerWidth] = useState(800);
    const isDragging = useRef(false);

    // 拖拽调整大小逻辑
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current) return;
        requestAnimationFrame(() => {
            const newWidth = document.body.clientWidth - e.clientX;
            // 限制最小 400px，最大为屏幕宽度 - 100px
            if (newWidth > 400 && newWidth < document.body.clientWidth - 100) {
                setDrawerWidth(newWidth);
            }
        });
    }, []);

    const handleMouseUp = useCallback(() => {
        if (isDragging.current) {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);
    const [editingRole, setEditingRole] = useState<any>(null);
    const [form] = Form.useForm();

    // 统一管理分页与搜索参数
    const [params, setParams] = useState({
        page: 1,
        size: 10,
        search: ''
    });

    // 树形选择的数据状态
    const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
    const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
    const [dataPolicies, setDataPolicies] = useState<Record<string, any>>({
        pipeline: { manage: [], use: [] },
        ansible_task: { manage: [], use: [] },
        k8s_cluster: { manage: [], use: [] },
        resource_pool: { manage: [], use: [] },
        registry: { manage: [], use: [] },
        credential: { manage: [], use: [] }
    });

    // 获取数据
    const { data: roles, isLoading } = useQuery<PaginatedResponse<any>, Error>({
        queryKey: ['roles', params],
        queryFn: () => getRoles(params),
        enabled: !!(hasPermission('*') || hasPermission('rbac:role:view'))
    });
    const { data: permissions } = useQuery<PaginatedResponse<Permission>, Error>({
        queryKey: ['perms'],
        queryFn: () => getPermissions({ size: 1000 }),
        enabled: !!token && isDrawerOpen
    });
    const { data: menuTree, isLoading: isLoadingMenuTree } = useQuery<any[], Error>({
        queryKey: ['menuTree'],
        queryFn: () => getMenus({ parent_is_null: 'true' }),
        enabled: !!token && isDrawerOpen
    });

    // 数据范围资源
    const { data: pipelines } = useQuery({
        queryKey: ['resource_pipelines'],
        queryFn: () => getPipelines({ size: 1000 }),
        enabled: isDrawerOpen
    });
    const { data: clusters } = useQuery({
        queryKey: ['resource_clusters'],
        queryFn: () => getK8sClusters({ size: 1000 }),
        enabled: isDrawerOpen
    });
    const { data: resourcePools } = useQuery({
        queryKey: ['resource_pools'],
        queryFn: () => getResourcePools({ size: 1000 }),
        enabled: isDrawerOpen
    });
    const { data: registries } = useQuery({
        queryKey: ['resource_registries'],
        queryFn: () => getRegistries({ size: 1000 }),
        enabled: isDrawerOpen
    });
    const { data: credentials } = useQuery({
        queryKey: ['resource_credentials'],
        queryFn: () => getCredentials({ size: 1000 }),
        enabled: isDrawerOpen
    });
    const { data: ansibleTasks } = useQuery({
        queryKey: ['resource_ansible_tasks'],
        queryFn: () => getAnsibleTasks({ size: 1000 }),
        enabled: isDrawerOpen
    });

    // 基础 CRUD Mutation
    const mutation = useMutation({
        mutationFn: (values: any) => editingRole ? updateRole(editingRole.id, values) : createRole(values),
        onSuccess: () => {
            message.success(editingRole ? t('role.updateSuccess') : t('role.createSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteRole,
        onSuccess: () => {
            message.success(t('role.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        }
    });

    // 授权 Mutation
    const assignMutation = useMutation({
        mutationFn: async (payload: any) => {
            const { menus, permissions, policies } = payload;
            // 1. 更新菜单和 API 权限
            await updateRole(editingRole.id, { menus, permissions });
            // 2. 更新数据范围策略
            await updateRoleDataPolicies(editingRole.id, policies);
        },
        onSuccess: () => {
            message.success(t('role.configSuccess'));
            setIsDrawerOpen(false);
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            queryClient.invalidateQueries({ queryKey: ['my_menus'] });
        },
        onError: (err: any) => {
            message.error(err.response?.data?.message || t('role.configError'));
        }
    });

    const showModal = (role?: any) => {
        setEditingRole(role || null);
        if (role) {
            form.setFieldsValue(role);
        } else {
            form.resetFields();
        }
        setIsModalOpen(true);
    };

    const showAssignDrawer = (role: any) => {
        setEditingRole(role);
        setSelectedMenus((role.menus || []).map(String));
        setSelectedPerms((role.permissions || []).map(String));
        
        // 初始化数据策略 (支持嵌套: { rtype: { manage: [], use: [] } })
        const policies = role.data_policies || {};
        const getIds = (rtype: string, atype: string) => (policies[rtype] && policies[rtype][atype]) || [];

        setDataPolicies({
            pipeline: { manage: getIds('pipeline', 'manage'), use: getIds('pipeline', 'use') },
            ansible_task: { manage: getIds('ansible_task', 'manage'), use: getIds('ansible_task', 'use') },
            k8s_cluster: { manage: getIds('k8s_cluster', 'manage'), use: getIds('k8s_cluster', 'use') },
            resource_pool: { manage: getIds('resource_pool', 'manage'), use: getIds('resource_pool', 'use') },
            registry: { manage: getIds('registry', 'manage'), use: getIds('registry', 'use') },
            credential: { manage: getIds('credential', 'manage'), use: getIds('credential', 'use') }
        });
        
        setIsDrawerOpen(true);
    };

    const columns = [
        { title: t('role.columnName'), dataIndex: 'name', key: 'name', width: 150, ellipsis: true },
        { title: t('role.columnCode'), dataIndex: 'code', key: 'code', width: 150, render: (code: string) => <Tag color="blue">{code}</Tag> },
        {
            title: t('role.columnParents'),
            dataIndex: 'parents',
            key: 'parents',
            render: (parents: number[]) => {
                if (!parents || parents.length === 0) return <Text type="secondary">-</Text>;
                return (
                    <Space size={[0, 4]} wrap>
                        {parents.map(pid => {
                            const pRole = roles?.data?.find(r => r.id === pid);
                            return <Tag key={pid} color="default">{pRole?.name || `ID:${pid}`}</Tag>;
                        })}
                    </Space>
                );
            }
        },
        {
            title: t('role.columnAction'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {(hasPermission('*') || hasPermission('rbac:role:edit')) && (
                        <Tooltip title={t('role.authorize')}>
                            <Button type="text" icon={<SecurityScanOutlined />} onClick={() => showAssignDrawer(record)} />
                        </Tooltip>
                    )}
                    {(hasPermission('*') || hasPermission('rbac:role:edit')) && (
                        <Tooltip title={t('role.edit')}>
                            <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
                        </Tooltip>
                    )}
                    {(hasPermission('*') || hasPermission('rbac:role:delete')) && (
                        <Popconfirm title={t('role.deleteConfirm')} onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title={t('role.delete')}>
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const {Text} = Typography;

    return (
        <Card
            title={t('role.title')}
            className="m-4 shadow-sm"
            extra={(hasPermission('*') || hasPermission('rbac:role:add')) && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>{t('role.addRole')}</Button>
            )}
        >
            <Table
                loading={isLoading}
                columns={columns}
                dataSource={roles?.data}
                rowKey="id"
                scroll={{ x: 'max-content' }}
               
                pagination={{
                    total: roles?.total,
                    current: params.page,
                    pageSize: params.size,
                    showSizeChanger: true,
                    onChange: (p, s) => setParams({ ...params, page: p, size: s }),
                }}
            />

            {/* 编辑框 */}
            <Modal title={editingRole ? t('role.editRole') : t('role.createRole')} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} confirmLoading={mutation.isPending}>
                <Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)}>
                    <Form.Item name="name" label={t('role.roleName')} rules={[{ required: true, message: t('role.roleNameRequired') }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="code" label={t('role.roleCode')} rules={[{ required: true, message: t('role.roleCodeRequired') }]}>
                        <Input placeholder={t('role.roleCodePlaceholder')} />
                    </Form.Item>
                    <Form.Item name="parents" label={t('role.inheritFrom')} tooltip={t('role.inheritFromTooltip')}>
                        <Select
                            mode="multiple"
                            placeholder={t('role.inheritFromPlaceholder')}
                            allowClear
                            options={roles?.data
                                ?.filter((r: any) => r.id !== editingRole?.id)
                                .map((r: any) => ({ label: r.name, value: r.id }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 授权抽屉 */}
            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        {/* 拖拽手柄 */}
                        <div
                            onMouseDown={handleMouseDown}
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '6px',
                                cursor: 'col-resize',
                                background: 'transparent',
                                zIndex: 10,
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(22,119,255,0.25)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            title={t('role.dragToResize')}
                        />
                        <span>{t('role.drawerTitle', { name: editingRole?.name })}</span>
                    </div>
                }
                width={drawerWidth}
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                extra={
                    <Button
                        type="primary"
                        onClick={() => {
                            // 先把所有 ID 转字符串去重，再转回数字
                            const cleanMenus = Array.from(new Set(selectedMenus.map(String))).map(Number).filter(Boolean);
                            const cleanPerms = Array.from(new Set(selectedPerms.map(String))).map(Number).filter(Boolean);

                            console.log('Final Payload:', { menus: cleanMenus, permissions: cleanPerms, policies: dataPolicies });

                            assignMutation.mutate({
                                menus: cleanMenus,
                                permissions: cleanPerms,
                                policies: dataPolicies
                            });
                        }}
                        loading={assignMutation.isPending}
                    >{t('role.saveConfig')}</Button>
                }
            >
                <Tabs
                    defaultActiveKey="1"
                    items={[
                        {
                            key: '1',
                            label: t('role.tabMenuAllocation'),
                            children: (
                                <div className="py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                                    {isLoadingMenuTree ? (
                                        <div className="text-center py-8"><Spin /></div>
                                    ) : (() => {
                                        const tree: any[] = menuTree || [];

                                        // 收集某节点下所有子孙节点 ID
                                        const collectChildIds = (node: any): string[] => {
                                            const ids: string[] = [String(node.id)];
                                            (node.children || []).forEach((c: any) => ids.push(...collectChildIds(c)));
                                            return ids;
                                        };

                                        const toggleParent = (node: any) => {
                                            const allIds = collectChildIds(node);
                                            const parentId = String(node.id);
                                            const isSelected = selectedMenus.includes(parentId);
                                            if (isSelected) {
                                                // 取消父菜单：移除该父及所有子孙
                                                setSelectedMenus(prev => prev.filter(id => !allIds.includes(id)));
                                            } else {
                                                // 勾选父菜单：加入该父及所有子孙
                                                setSelectedMenus(prev => Array.from(new Set([...prev, ...allIds])));
                                            }
                                        };

                                        const toggleChild = (childId: string, parentNode: any) => {
                                            const childIds = (parentNode.children || []).map((c: any) => String(c.id));
                                            const parentId = String(parentNode.id);

                                            setSelectedMenus(prev => {
                                                let next: string[];
                                                if (prev.includes(childId)) {
                                                    next = prev.filter(id => id !== childId);
                                                } else {
                                                    next = [...prev, childId];
                                                }
                                                // 若子菜单全选，自动勾选父菜单
                                                const allChildrenSelected = childIds.every((id: string) => next.includes(id));
                                                if (allChildrenSelected && !next.includes(parentId)) {
                                                    next = [...next, parentId];
                                                }
                                                // 若子菜单有取消，自动取消父菜单
                                                if (!allChildrenSelected) {
                                                    next = next.filter(id => id !== parentId);
                                                }
                                                return next;
                                            });
                                        };

                                        return (
                                            <Collapse
                                                defaultActiveKey={tree.map((n: any) => String(n.id))}
                                                ghost
                                                expandIconPosition="end"
                                            >
                                                {tree.map((parent: any) => {
                                                    const parentId = String(parent.id);
                                                    const isParentChecked = selectedMenus.includes(parentId);
                                                    const children: any[] = parent.children || [];
                                                    const hasChildren = children.length > 0;
                                                    const checkedChildCount = children.filter((c: any) => selectedMenus.includes(String(c.id))).length;
                                                    const isPartial = !isParentChecked && checkedChildCount > 0;

                                                    return (
                                                        <Collapse.Panel
                                                            key={parentId}
                                                            header={
                                                                <div className="flex items-center gap-3 py-1">
                                                                    <div
                                                                        className="w-1.5 h-5 rounded-full"
                                                                        style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})` }}
                                                                    />
                                                                    <Checkbox
                                                                        checked={isParentChecked}
                                                                        indeterminate={isPartial}
                                                                        onClick={e => { e.stopPropagation(); toggleParent(parent); }}
                                                                    />
                                                                    <Typography.Text strong style={{ fontSize: '15px', color: token.colorTextHeading }}>
                                                                        {parent.title}
                                                                    </Typography.Text>
                                                                    {hasChildren && (
                                                                        <span style={{ fontSize: '12px', color: token.colorTextQuaternary }}>
                                                                            ({t('role.selectedCount', { checked: checkedChildCount, total: children.length })})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            }
                                                            className="mb-4 rounded-xl overflow-hidden"
                                                            style={{
                                                                background: token.colorBgElevated,
                                                                border: `1px solid ${token.colorBorderSecondary}`,
                                                                boxShadow: token.boxShadowTertiary
                                                            }}
                                                        >
                                                            {hasChildren ? (
                                                                <div className="px-5 py-4 flex flex-wrap gap-3">
                                                                    {children.map((child: any) => {
                                                                        const childId = String(child.id);
                                                                        const isChecked = selectedMenus.includes(childId);
                                                                        return (
                                                                            <Tooltip key={childId} title={child.path || child.key} placement="top">
                                                                                <label
                                                                                    className="flex items-center gap-2 cursor-pointer select-none"
                                                                                    onClick={() => toggleChild(childId, parent)}
                                                                                    style={{
                                                                                        display: 'inline-flex',
                                                                                        alignItems: 'center',
                                                                                        gap: '6px',
                                                                                        padding: '5px 14px',
                                                                                        borderRadius: '20px',
                                                                                        fontSize: '13px',
                                                                                        fontWeight: isChecked ? 600 : 400,
                                                                                        transition: 'all 0.25s ease',
                                                                                        cursor: 'pointer',
                                                                                        color: isChecked ? token.colorPrimary : token.colorTextSecondary,
                                                                                        background: isChecked ? token.colorPrimaryBg : token.colorFillQuaternary,
                                                                                        border: `1.5px solid ${isChecked ? token.colorPrimaryBorder : 'transparent'}`,
                                                                                    }}
                                                                                >
                                                                                    <span style={{
                                                                                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                                                                        background: token.colorPrimary,
                                                                                        opacity: isChecked ? 1 : 0.3,
                                                                                    }} />
                                                                                    {child.title}
                                                                                </label>
                                                                            </Tooltip>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="px-5 py-3" style={{ color: token.colorTextQuaternary, fontSize: '13px' }}>
                                                                    {t('role.noChildren')}
                                                                </div>
                                                            )}
                                                        </Collapse.Panel>
                                                    );
                                                })}
                                            </Collapse>
                                        );
                                    })()}
                                </div>
                            ),
                        },
                        {
                            key: '2',
                            label: t('role.tabFunctionalPermission'),
                            children: (
                                <div className="py-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                                    {(() => {
                                        const permsList = Array.isArray(permissions?.data) ? permissions.data : [];

                                        const MODULE_NAMES: Record<string, string> = {
                                            'pipeline':   t('role.moduleNames.pipeline'),
                                            'tasks':      t('role.moduleNames.tasks'),
                                            'k8s':        t('role.moduleNames.k8s'),
                                            'host':       t('role.moduleNames.host'),
                                            'registry':   t('role.moduleNames.registry'),
                                            'credential': t('role.moduleNames.credential'),
                                            'rbac':       t('role.moduleNames.rbac'),
                                            'config':     t('role.moduleNames.config'),
                                        };

                                        const dangerVariants: Record<string, { color: string; border: string; bg: string }> = {
                                            'safe': { color: token.colorSuccess, border: token.colorSuccessBorder, bg: token.colorSuccessBg },
                                            'warn': { color: token.colorWarning, border: token.colorWarningBorder, bg: token.colorWarningBg },
                                            'high': { color: token.colorError,   border: token.colorErrorBorder,   bg: token.colorErrorBg   },
                                        };

                                        const grouped: Record<string, Record<string, any[]>> = {};
                                        permsList.forEach((p: any) => {
                                            const modKey = p.code.split(':')[0] || 'other';
                                            const resKey = p.code.split(':')[1] || 'core';
                                            if (!grouped[modKey]) grouped[modKey] = {};
                                            if (!grouped[modKey][resKey]) grouped[modKey][resKey] = [];
                                            grouped[modKey][resKey].push(p);
                                        });

                                        return (
                                            <Collapse defaultActiveKey={Object.keys(grouped)} ghost expandIconPosition="end">
                                                {Object.entries(grouped).map(([mod, resources]) => {
                                                    const allModPerms = Object.values(resources).flat();
                                                    const allModPermIds = allModPerms.map((p: any) => String(p.id));
                                                    const checkedModCount = allModPermIds.filter(id => selectedPerms.includes(id)).length;
                                                    const isAllChecked = allModPermIds.length > 0 && checkedModCount === allModPermIds.length;
                                                    const isPartial = checkedModCount > 0 && checkedModCount < allModPermIds.length;

                                                    const toggleModule = () => {
                                                        if (isAllChecked) {
                                                            setSelectedPerms(prev => prev.filter(id => !allModPermIds.includes(id)));
                                                        } else {
                                                            setSelectedPerms(prev => Array.from(new Set([...prev, ...allModPermIds])));
                                                        }
                                                    };

                                                    return (
                                                        <Collapse.Panel
                                                            key={mod}
                                                            header={
                                                                <div className="flex items-center gap-3 py-1">
                                                                    <div className="w-1.5 h-5 rounded-full"
                                                                        style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})` }}
                                                                    />
                                                                    <Checkbox
                                                                        checked={isAllChecked}
                                                                        indeterminate={isPartial}
                                                                        onClick={e => { e.stopPropagation(); toggleModule(); }}
                                                                    />
                                                                    <Typography.Text strong style={{ fontSize: '15px', color: token.colorTextHeading }}>
                                                                        {MODULE_NAMES[mod] || mod.toUpperCase()}
                                                                    </Typography.Text>
                                                                    <span style={{ fontSize: '12px', color: token.colorTextQuaternary }}>
                                                                        ({t('role.selectedCount', { checked: checkedModCount, total: allModPermIds.length })})
                                                                    </span>
                                                                </div>
                                                            }
                                                            className="mb-4 rounded-xl overflow-hidden"
                                                            style={{
                                                                background: token.colorBgElevated,
                                                                border: `1px solid ${token.colorBorderSecondary}`,
                                                                boxShadow: token.boxShadowTertiary
                                                            }}
                                                        >
                                                            {Object.entries(resources).map(([res, plist]) => {
                                                                const allResPermIds = plist.map((p: any) => String(p.id));
                                                                const checkedResCount = allResPermIds.filter(id => selectedPerms.includes(id)).length;
                                                                const isAllResChecked = allResPermIds.length > 0 && checkedResCount === allResPermIds.length;
                                                                const isResPartial = checkedResCount > 0 && checkedResCount < allResPermIds.length;

                                                                const toggleResource = () => {
                                                                    if (isAllResChecked) {
                                                                        setSelectedPerms(prev => prev.filter(id => !allResPermIds.includes(id)));
                                                                    } else {
                                                                        setSelectedPerms(prev => Array.from(new Set([...prev, ...allResPermIds])));
                                                                    }
                                                                };

                                                                return (
                                                                    <div
                                                                        key={`${mod}-${res}`}
                                                                        className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-4"
                                                                        style={{ borderBottom: `1px solid ${token.colorFillQuaternary}` }}
                                                                    >
                                                                        <div className="min-w-[160px] shrink-0 flex items-center gap-2 mt-1">
                                                                            <Checkbox
                                                                                checked={isAllResChecked}
                                                                                indeterminate={isResPartial}
                                                                                onChange={toggleResource}
                                                                            />
                                                                            <div className="flex flex-col">
                                                                                <span style={{
                                                                                    fontSize: '12px', fontWeight: 600,
                                                                                    letterSpacing: '1px', textTransform: 'uppercase',
                                                                                    color: token.colorTextTertiary,
                                                                                    background: token.colorFillTertiary,
                                                                                    padding: '2px 8px', borderRadius: '4px',
                                                                                    width: 'fit-content'
                                                                                }}>
                                                                                    {res}
                                                                                </span>
                                                                                <span style={{ fontSize: '11px', color: token.colorTextQuaternary, marginTop: '2px' }}>
                                                                                    ({t('role.selectedCount', { checked: checkedResCount, total: allResPermIds.length })})
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <Checkbox.Group
                                                                            value={selectedPerms}
                                                                            onChange={(values) => {
                                                                                setSelectedPerms(prev => [
                                                                                    ...prev.filter(id => !allResPermIds.includes(id)),
                                                                                    ...(values as string[]),
                                                                                ]);
                                                                            }}
                                                                            className="flex-1"
                                                                        >
                                                                            <div className="flex flex-wrap gap-3">
                                                                                {plist.map((p: any) => {
                                                                                    const isChecked = selectedPerms.includes(String(p.id));
                                                                                    const danger = p.danger_level || 'safe';
                                                                                    const variant = dangerVariants[danger] || dangerVariants['safe'];
                                                                                    return (
                                                                                        <Tooltip
                                                                                            key={p.id}
                                                                                            placement="top"
                                                                                            title={
                                                                                                <div>
                                                                                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                                                                    {p.desc && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginTop: '2px' }}>{p.desc}</div>}
                                                                                                    <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', marginTop: '4px', fontFamily: 'monospace' }}>{p.code}</div>
                                                                                                </div>
                                                                                            }
                                                                                        >
                                                                                            <Checkbox value={String(p.id)} className="m-0">
                                                                                                <span style={{
                                                                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                                                    fontSize: '13px',
                                                                                                    fontWeight: isChecked ? 600 : 400,
                                                                                                    padding: '4px 12px', borderRadius: '20px',
                                                                                                    transition: 'all 0.25s ease',
                                                                                                    color: isChecked ? variant.color : token.colorTextSecondary,
                                                                                                    background: isChecked ? variant.bg : token.colorFillQuaternary,
                                                                                                    border: `1.5px solid ${isChecked ? variant.border : 'transparent'}`,
                                                                                                }}>
                                                                                                    <span style={{
                                                                                                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                                                                                        background: variant.color,
                                                                                                        opacity: isChecked ? 1 : 0.35,
                                                                                                    }} />
                                                                                                    {p.name}
                                                                                                </span>
                                                                                            </Checkbox>
                                                                                        </Tooltip>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </Checkbox.Group>
                                                                    </div>
                                                                );
                                                            })}
                                                        </Collapse.Panel>
                                                    );
                                                })}
                                            </Collapse>
                                        );
                                    })()}
                                </div>
                            ),
                        },
                        {
                            key: '3',
                            label: t('role.tabResourceIsolation'),
                            children: (
                                <div className="py-2 space-y-6">
                                    <Alert
                                        message={t('role.isolationAlert')}
                                        type="info"
                                        showIcon
                                        className="mb-4"
                                    />

                                    {/* 流水线配置 */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1.5 h-6 rounded-full"
                                                 style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})`, boxShadow: `0 2px 4px ${token.colorPrimary}40` }}
                                            />
                                            <Typography.Title level={5} style={{ margin: 0 }}>{t('role.pipelineSection')}</Typography.Title>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 mt-2">
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.managePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.managePlaceholder')}
                                                    value={dataPolicies.pipeline?.manage}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, pipeline: {...dataPolicies.pipeline, manage: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(pipelines?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.usePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.usePlaceholder')}
                                                    value={dataPolicies.pipeline?.use}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, pipeline: {...dataPolicies.pipeline, use: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(pipelines?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Divider />

                                    {/* Ansible 任务配置 */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1.5 h-6 rounded-full"
                                                 style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})`, boxShadow: `0 2px 4px ${token.colorPrimary}40` }}
                                            />
                                            <Typography.Title level={5} style={{ margin: 0 }}>{t('role.ansibleSection')}</Typography.Title>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 mt-2">
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.managePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.ansibleManagePlaceholder')}
                                                    value={dataPolicies.ansible_task?.manage}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, ansible_task: {...dataPolicies.ansible_task, manage: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(ansibleTasks?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.runPermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.ansibleRunPlaceholder')}
                                                    value={dataPolicies.ansible_task?.use}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, ansible_task: {...dataPolicies.ansible_task, use: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(ansibleTasks?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Divider />

                                    {/* K8s 配置 */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1.5 h-6 rounded-full"
                                                 style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})`, boxShadow: `0 2px 4px ${token.colorPrimary}40` }}
                                            />
                                            <Typography.Title level={5} style={{ margin: 0 }}>{t('role.k8sSection')}</Typography.Title>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 mt-2">
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.managePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.k8sManagePlaceholder')}
                                                    value={dataPolicies.k8s_cluster?.manage}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, k8s_cluster: {...dataPolicies.k8s_cluster, manage: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(clusters?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.usePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.k8sUsePlaceholder')}
                                                    value={dataPolicies.k8s_cluster?.use}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, k8s_cluster: {...dataPolicies.k8s_cluster, use: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(clusters?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Divider />

                                    {/* 资源池配置 */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1.5 h-6 rounded-full"
                                                 style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})`, boxShadow: `0 2px 4px ${token.colorPrimary}40` }}
                                            />
                                            <Typography.Title level={5} style={{ margin: 0 }}>{t('role.resourcePoolSection')}</Typography.Title>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 mt-2">
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.managePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.poolManagePlaceholder')}
                                                    value={dataPolicies.resource_pool?.manage}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, resource_pool: {...dataPolicies.resource_pool, manage: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(resourcePools?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                            <div>
                                                <Typography.Text type="secondary">{t('role.usePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.poolUsePlaceholder')}
                                                    value={dataPolicies.resource_pool?.use}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, resource_pool: {...dataPolicies.resource_pool, use: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(resourcePools?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Divider />

                                    {/* 镜像仓库配置 */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1.5 h-6 rounded-full"
                                                 style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})`, boxShadow: `0 2px 4px ${token.colorPrimary}40` }}
                                            />
                                            <Typography.Title level={5} style={{ margin: 0 }}>{t('role.registrySection')}</Typography.Title>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 mt-2">
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.managePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.registryManagePlaceholder')}
                                                    value={dataPolicies.registry?.manage}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, registry: {...dataPolicies.registry, manage: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(registries?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                            <div>
                                                <Typography.Text type="secondary">{t('role.usePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.registryUsePlaceholder')}
                                                    value={dataPolicies.registry?.use}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, registry: {...dataPolicies.registry, use: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...(registries?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Divider />

                                    {/* SSH 凭据配置 */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-1.5 h-6 rounded-full"
                                                 style={{ background: `linear-gradient(to bottom, ${token.colorPrimary}, ${token.colorPrimaryActive})`, boxShadow: `0 2px 4px ${token.colorPrimary}40` }}
                                            />
                                            <Typography.Title level={5} style={{ margin: 0 }}>{t('role.credentialSection')}</Typography.Title>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 mt-2">
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '13px', color: token.colorTextSecondary }}>{t('role.managePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.credManagePlaceholder')}
                                                    value={dataPolicies.credential?.manage}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, credential: {...dataPolicies.credential, manage: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...((credentials as any)?.results || (credentials as any)?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                            <div>
                                                <Typography.Text type="secondary">{t('role.usePermission')}</Typography.Text>
                                                <Select
                                                    mode="multiple"
                                                    className="w-full mt-1"
                                                    placeholder={t('role.credUsePlaceholder')}
                                                    value={dataPolicies.credential?.use}
                                                    onChange={(v) => setDataPolicies({...dataPolicies, credential: {...dataPolicies.credential, use: v}})}
                                                    options={[{label: t('role.allOption'), value: '*'}, ...((credentials as any)?.results || (credentials as any)?.data || []).map((i: any) => ({ label: i.name, value: i.id }))]}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />
            </Drawer>
        </Card>
    );
};

export default RoleManagement;
