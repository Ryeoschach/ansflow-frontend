import React, { useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, App, Popconfirm, Card, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMenus, createMenu, updateMenu, deleteMenu } from '../../api/rbac';
import IconMapper from '../../components/IconMapper';
import useAppStore from '../../store/useAppStore';
import useBreakpoint from '../../utils/useBreakpoint';

/**
 * 菜单管理页面
 */
const MenuManagement: React.FC = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { hasPermission, token } = useAppStore();
    const { isMobile } = useBreakpoint();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { message } = App.useApp();
    const [editingMenu, setEditingMenu] = useState<any>(null);
    const [form] = Form.useForm();

    // 1. 获取菜单列表 (树形)
    const { data: menuTree, isLoading } = useQuery({
        queryKey: ['all_menus'],
        queryFn: async () => {
            const res = await getMenus({ parent_is_null: 'true' })
            // 对于非分页请求，拦截器返回的是 res.data (数组)
            return res as unknown as any[]
        },
        enabled: !!token && (hasPermission('*') || hasPermission('rbac:menu:view') || hasPermission('rbac:menu:list'))
    });

    // 2. 获取平面菜单列表 (用于父级选择)
    const { data: flatMenus } = useQuery({
        queryKey: ['flat_menus'],
        queryFn: async () => {
            const res = await getMenus()
            return res as unknown as any[]
        },
        enabled: !!token && isModalOpen
    });

    // 3. 提交表单
    const mutation = useMutation({
        mutationFn: (values: any) => editingMenu ? updateMenu(editingMenu.id, values) : createMenu(values),
        onSuccess: () => {
            message.success(editingMenu ? t('menuManagement.updateSuccess') : t('menuManagement.createSuccess'));
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['all_menus'] });
            queryClient.invalidateQueries({ queryKey: ['flat_menus'] });
            queryClient.invalidateQueries({ queryKey: ['my_menus'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteMenu,
        onSuccess: () => {
            message.success(t('menuManagement.deleteSuccess'));
            queryClient.invalidateQueries({ queryKey: ['all_menus'] });
            queryClient.invalidateQueries({ queryKey: ['flat_menus'] });
            queryClient.invalidateQueries({ queryKey: ['my_menus'] });
        }
    });

    const showModal = (menu?: any) => {
        setEditingMenu(menu || null);
        if (menu) {
            // 确保 parent 传入的是 ID 值，如果是对象则取其 ID
            const formData = {
                ...menu,
                parent: typeof menu.parent === 'object' ? menu.parent?.id : menu.parent
            };
            form.setFieldsValue(formData);
        } else {
            form.resetFields();
        }
        setIsModalOpen(true);
    };

    const columns = [
        { title: t('menuManagement.columnName'), dataIndex: 'title', key: 'title' },
        { title: t('menuManagement.columnIcon'), dataIndex: 'icon', key: 'icon', render: (icon: string) => <IconMapper iconName={icon} /> },
        { title: t('menuManagement.columnKey'), dataIndex: 'key', key: 'key' },
        { title: t('menuManagement.columnPath'), dataIndex: 'path', key: 'path' },
        { title: t('menuManagement.columnOrder'), dataIndex: 'order', key: 'order' },
        {
            title: t('menuManagement.columnAction'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    {(hasPermission('*') || hasPermission('rbac:menu:edit')) && (
                        <Tooltip title={t('menuManagement.edit')}>
                            <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
                        </Tooltip>
                    )}
                    {(hasPermission('*') || hasPermission('rbac:menu:delete')) && (
                        <Popconfirm title={t('menuManagement.deleteConfirm')} onConfirm={() => deleteMutation.mutate(record.id)}>
                            <Tooltip title={t('menuManagement.delete')}>
                                <Button type="text" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Card title={t('menuManagement.title')} className="m-4 shadow-sm" extra={
            (hasPermission('*') || hasPermission('rbac:menu:create') || hasPermission('rbac:menu:add')) && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>{t('menuManagement.addMenu')}</Button>
            )
        }>
            <Table loading={isLoading} columns={columns} dataSource={menuTree} rowKey="id" scroll={{ x: 1200 }} pagination={false} expandable={{ defaultExpandAllRows: true }} />

            <Modal title={editingMenu ? t('menuManagement.editMenu') : t('menuManagement.createMenu')} open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()} confirmLoading={mutation.isPending} width={isMobile ? '95vw' : 600} bodyStyle={{ overflowX: 'auto' }}>
                <Form form={form} layout="vertical" onFinish={(values) => mutation.mutate({...values, parent: values.parent || null})} initialValues={{ order: 0 }}>
                    <Form.Item name="title" label={t('menuManagement.menuName')} rules={[{ required: true, message: t('menuManagement.menuNameRequired') }]}><Input /></Form.Item>
                    <Form.Item name="title_en" label={t('menuManagement.menuNameEn')}><Input placeholder={t('menuManagement.menuNameEnPlaceholder')} /></Form.Item>
                    <Form.Item name="key" label={t('menuManagement.antdKey')} rules={[{ required: true, message: t('menuManagement.antdKeyRequired') }]}><Input /></Form.Item>
                    <Form.Item name="path" label={t('menuManagement.routePath')} rules={[{ required: true, message: t('menuManagement.routePathRequired') }]}><Input /></Form.Item>
                    <Form.Item name="icon" label={t('menuManagement.iconLabel')}><Input placeholder={t('menuManagement.iconPlaceholder')} /></Form.Item>
                    <Form.Item name="parent" label={t('menuManagement.parentMenu')}>
                        <Select
                            placeholder={t('menuManagement.parentMenuPlaceholder')}
                            allowClear
                            options={flatMenus
                                ?.filter((m: any) => m.id !== editingMenu?.id)
                                ?.map((m: any) => ({ label: m.title, value: m.id }))}
                        />
                    </Form.Item>
                    <Form.Item name="order" label={t('menuManagement.displayOrder')}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default MenuManagement;
