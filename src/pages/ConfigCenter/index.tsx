import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, Select, Tag, Popconfirm,
  Tabs, Typography, Tooltip, Drawer, Descriptions, Timeline, App, message, Divider, Switch, Checkbox
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, HistoryOutlined,
  ReloadOutlined, RollbackOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { ColumnType } from 'antd/es/table';
import useAppStore from '../../store/useAppStore';
import {
  getCategories, getCategory, createCategory, updateCategory, deleteCategory,
  getConfigItems, createConfigItem, updateConfigItem, deleteConfigItem,
  getChangeLogs, rollbackConfigItem, ConfigCategory, ConfigItem, ConfigChangeLog
} from '../../api/config';

const { Text, Title } = Typography;
const { TextArea } = Input;

const ConfigCenter: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = useAppStore();
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('categories');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [isCategoryDetailModalOpen, setIsCategoryDetailModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ConfigCategory | null>(null);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ConfigCategory | null>(null);
  const [selectedItem, setSelectedItem] = useState<ConfigItem | null>(null);
  const [rollbackLogs, setRollbackLogs] = useState<ConfigChangeLog[]>([]);
  const [categoryForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [rollbackForm] = Form.useForm();

  // 获取分类列表
  const { data: categoriesData, isLoading: categoriesLoading, refetch: refetchCategories } = useQuery({
    queryKey: ['config_categories'],
    queryFn: () => getCategories(),
  });

  // 获取选中分类的详情（含 items）
  const { data: categoryDetail, refetch: refetchCategoryDetail } = useQuery({
    queryKey: ['config_category_detail', selectedCategory?.id],
    queryFn: () => getCategory(selectedCategory!.id),
    enabled: !!selectedCategory,
  });

  // 获取变更日志
  const { data: changeLogsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['config_change_logs'],
    queryFn: () => getChangeLogs(),
  });

  // 创建/更新分类
  const categoryMutation = useMutation({
    mutationFn: (values: any) =>
      editingCategory
        ? updateCategory(editingCategory.id, values)
        : createCategory(values),
    onSuccess: () => {
      message.success(editingCategory ? t('common.success') : t('common.success'));
      setIsCategoryModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['config_categories'] });
      if (selectedCategory) refetchCategoryDetail();
    },
    onError: (err: any) => message.error(err?.message || t('common.error')),
  });

  // 删除分类
  const deleteCategoryMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      message.success(t('common.success'));
      queryClient.invalidateQueries({ queryKey: ['config_categories'] });
      if (selectedCategory) setSelectedCategory(null);
    },
    onError: (err: any) => message.error(err?.message || t('common.error')),
  });

  // 创建/更新配置项
  const itemMutation = useMutation({
    mutationFn: (values: any) => {
      if (editingItem) {
        return updateConfigItem(editingItem.id, values);
      }
      return createConfigItem({ ...values, category: selectedCategory!.id });
    },
    onSuccess: () => {
      message.success(editingItem ? t('common.success') : t('common.success'));
      setIsItemModalOpen(false);
      if (selectedCategory) refetchCategoryDetail();
      queryClient.invalidateQueries({ queryKey: ['config_change_logs'] });
    },
    onError: (err: any) => message.error(err?.message || t('common.error')),
  });

  // 删除配置项
  const deleteItemMutation = useMutation({
    mutationFn: deleteConfigItem,
    onSuccess: () => {
      message.success(t('common.success'));
      if (selectedCategory) refetchCategoryDetail();
      queryClient.invalidateQueries({ queryKey: ['config_change_logs'] });
    },
    onError: (err: any) => message.error(err?.message || t('common.error')),
  });

  // 回滚
  const rollbackMutation = useMutation({
    mutationFn: ({ changeLogId, reason }: { changeLogId: number; reason: string }) =>
      rollbackConfigItem(selectedItem!.id, { change_log_id: changeLogId, reason }),
    onSuccess: (res: any) => {
      message.success(t('configCenter.rollbackSuccess'));
      setIsRollbackModalOpen(false);
      rollbackForm.resetFields();
      if (selectedCategory) refetchCategoryDetail();
      queryClient.invalidateQueries({ queryKey: ['config_change_logs'] });
    },
    onError: (err: any) => message.error(err?.message || t('common.error')),
  });

  // 选中分类打开详情弹窗
  const handleSelectCategory = (cat: ConfigCategory) => {
    setSelectedCategory(cat);
    setIsCategoryDetailModalOpen(true);
  };

  // 打开回滚弹窗（获取历史）
  const handleOpenRollback = (item: ConfigItem) => {
    setSelectedItem(item);
    // 获取该 item 的所有变更记录
    const logs = ((changeLogsData as any)?.results || changeLogsData?.data || [])?.filter((l: ConfigChangeLog) => l.item === item.id) || [];
    setRollbackLogs(logs);
    setIsRollbackModalOpen(true);
  };

  // 分类表单
  const openCategoryModal = (cat?: ConfigCategory) => {
    setEditingCategory(cat || null);
    if (cat) {
      categoryForm.setFieldsValue(cat);
    } else {
      categoryForm.resetFields();
    }
    setIsCategoryModalOpen(true);
  };

  // 配置项表单
  const openItemModal = (item?: ConfigItem) => {
    setEditingItem(item || null);
    if (item) {
      itemForm.setFieldsValue({ ...item, value: item.is_encrypted ? '' : item.value });
    } else {
      itemForm.resetFields();
    }
    setIsItemModalOpen(true);
  };

  // 表格列定义
  const categoryColumns: ColumnType<ConfigCategory>[] = [
    { title: t('configCenter.categoryLabel'), dataIndex: 'label', key: 'label' },
    { title: t('configCenter.categoryName'), dataIndex: 'name', key: 'name', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('configCenter.categoryDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
    { title: t('configCenter.categoryItemCount'), dataIndex: 'item_count', key: 'item_count', width: 100 },
    {
      title: t('pipeline.action'),
      key: 'action',
      width: 150,
      render: (_: any, record: ConfigCategory) => (
        <Space size="middle">
          {hasPermission('config:category:edit') && (
            <Button type="text" icon={<EditOutlined />} onClick={() => openCategoryModal(record)} />
          )}
          {hasPermission('config:category:delete') && (
            <Popconfirm
              title={t('configCenter.confirmDeleteCategory')}
              onConfirm={() => deleteCategoryMutation.mutate(record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const itemColumns: ColumnType<ConfigItem>[] = [
    { title: t('configCenter.itemKey'), dataIndex: 'key', key: 'key', render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: t('configCenter.itemValue'),
      dataIndex: 'value_display',
      key: 'value_display',
      width: 350,
      render: (v: string, record: ConfigItem) => {
        if (record.value_type === 'bool') {
          return (
            <Switch
              checked={v === 'true' || v === 'True' || v === '1'}
              onChange={(checked) => {
                updateConfigItem(record.id, { value: checked ? 'true' : 'false' }).then(() => {
                  message.success(t('common.success'));
                  if (selectedCategory) refetchCategoryDetail();
                }).catch((err: any) => message.error(err?.message || t('common.error')));
              }}
              disabled={!hasPermission('config:item:edit')}
            />
          );
        }
        // notify_on 特殊渲染：JSON 数组 -> Checkbox 多选
        if (record.key === 'notify_on') {
          let currentValues: string[] = [];
          try {
            currentValues = JSON.parse(v);
          } catch { currentValues = []; }
          const allOptions = [
            { label: '流水线开始', value: 'pipeline_start' },
            { label: '流水线结果', value: 'pipeline_result' },
            { label: '审批请求', value: 'approval_requested' },
            { label: '审批结果', value: 'approval_result' },
            { label: 'Ansible 任务结果', value: 'task_result' },
          ];
          return (
            <Checkbox.Group
              options={allOptions}
              value={currentValues}
              onChange={(checkedValues) => {
                updateConfigItem(record.id, { value: JSON.stringify(checkedValues) }).then(() => {
                  message.success(t('common.success'));
                  if (selectedCategory) refetchCategoryDetail();
                }).catch((err: any) => message.error(err?.message || t('common.error')));
              }}
              disabled={!hasPermission('config:item:edit')}
            />
          );
        }
        return (
          <Input
            defaultValue={v}
            onBlur={(e) => {
              const newValue = e.target.value;
              if (newValue !== v) {
                updateConfigItem(record.id, { value: newValue }).then(() => {
                  message.success(t('common.success'));
                  if (selectedCategory) refetchCategoryDetail();
                }).catch((err: any) => message.error(err?.message || t('common.error')));
              }
            }}
            onPressEnter={(e) => {
              (e.target as HTMLInputElement).blur();
            }}
            disabled={!hasPermission('config:item:edit')}
            style={{ maxWidth: 250 }}
          />
        );
      },
    },
    { title: t('configCenter.itemValueType'), dataIndex: 'value_type', key: 'value_type', width: 80 },
    {
      title: t('configCenter.itemEncrypted'),
      dataIndex: 'is_encrypted',
      key: 'is_encrypted',
      width: 80,
      render: (v: boolean) => v ? <Tag color="orange">{t('configCenter.itemEncrypted')}</Tag> : '-',
    },
    { title: t('configCenter.itemDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: t('pipeline.action'),
      key: 'action',
      width: 150,
      render: (_: any, record: ConfigItem) => (
        <Space size="middle">
          {hasPermission('config:item:edit') && (
            <Button type="text" icon={<EditOutlined />} onClick={() => openItemModal(record)} />
          )}
          {hasPermission('config:item:rollback') && (
            <Tooltip title={t('configCenter.rollback')}>
              <Button type="text" icon={<HistoryOutlined />} onClick={() => handleOpenRollback(record)} />
            </Tooltip>
          )}
          {hasPermission('config:item:delete') && (
            <Popconfirm
              title={t('configCenter.confirmDeleteItem')}
              onConfirm={() => deleteItemMutation.mutate(record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const changeLogColumns: ColumnType<ConfigChangeLog>[] = [
    { title: t('configCenter.changeLogTime'), dataIndex: 'create_time', key: 'create_time', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
    { title: t('configCenter.itemKey'), dataIndex: 'item_key', key: 'item_key', render: (v: string, r: ConfigChangeLog) => <Tag>{r.item_category}/{v}</Tag> },
    {
      title: t('configCenter.changeLogAction'),
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          create: { color: 'green', text: t('configCenter.actionCreate') },
          update: { color: 'blue', text: t('configCenter.actionUpdate') },
          delete: { color: 'red', text: t('configCenter.actionDelete') },
          rollback: { color: 'orange', text: t('configCenter.actionRollback') },
        };
        const m = map[v] || { color: 'default', text: v };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    { title: t('configCenter.oldValue'), dataIndex: 'old_value_display', key: 'old_value_display', ellipsis: true, render: (v: string) => <Text type="secondary">{v || '-'}</Text> },
    { title: t('configCenter.newValue'), dataIndex: 'new_value_display', key: 'new_value_display', ellipsis: true, render: (v: string) => <Text code>{v || '-'}</Text> },
    { title: t('configCenter.changeLogOperator'), dataIndex: 'operator_username', key: 'operator_username' },
    { title: t('configCenter.changeLogReason'), dataIndex: 'reason', key: 'reason', ellipsis: true },
  ];

  return (
    <div className="p-4">
      <Title level={4}>{t('configCenter.title')}</Title>

      <Card className="mt-4 shadow-sm overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'categories',
              label: t('configCenter.categories'),
              children: (
                <div className="flex gap-4 overflow-x-auto">
                  {/* 左侧：分类列表 */}
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-3">
                      <Text strong>{t('configCenter.categories')}</Text>
                      {hasPermission('config:category:add') && (
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openCategoryModal()}>
                          {t('configCenter.addCategory')}
                        </Button>
                      )}
                    </div>
                    <Table
                      size="small"
                      dataSource={(categoriesData as any)?.results || categoriesData?.data || []}
                      columns={categoryColumns}
                      rowKey="id"
                      loading={categoriesLoading}
                      pagination={false}
                      rowClassName={(record) => selectedCategory?.id === record.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                      onRow={(record) => ({
                        onClick: () => handleSelectCategory(record),
                        style: { cursor: 'pointer' },
                      })}
                      scroll={{ x: 'max-content' }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'changeLogs',
              label: t('configCenter.changeLogs'),
              children: (
                <Table
                  size="small"
                  dataSource={(changeLogsData as any)?.results || changeLogsData?.data || []}
                  columns={changeLogColumns}
                  rowKey="id"
                  loading={logsLoading}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 'max-content' }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* 分类 Modal */}
      <Modal
        title={editingCategory ? t('configCenter.editCategory') : t('configCenter.addCategory')}
        open={isCategoryModalOpen}
        onCancel={() => setIsCategoryModalOpen(false)}
        onOk={() => categoryForm.submit()}
        confirmLoading={categoryMutation.isPending}
      >
        <Form
          form={categoryForm}
          layout="vertical"
          onFinish={(values) => categoryMutation.mutate(values)}
        >
          <Form.Item name="label" label={t('configCenter.categoryLabel')} rules={[{ required: true, message: t('configCenter.nameRequired') }]}>
            <Input placeholder={t('configCenter.categoryLabel')} />
          </Form.Item>
          <Form.Item name="name" label={t('configCenter.categoryName')} rules={[{ required: true, message: t('configCenter.nameRequired') }]}>
            <Input placeholder={t('configCenter.categoryName')} />
          </Form.Item>
          <Form.Item name="description" label={t('configCenter.categoryDescription')}>
            <TextArea rows={2} placeholder={t('configCenter.categoryDescription')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 配置项 Modal */}
      <Modal
        title={editingItem ? t('configCenter.editItem') : t('configCenter.addItem')}
        open={isItemModalOpen}
        onCancel={() => setIsItemModalOpen(false)}
        onOk={() => itemForm.submit()}
        confirmLoading={itemMutation.isPending}
        width={600}
      >
        <Form
          form={itemForm}
          layout="vertical"
          onFinish={(values) => itemMutation.mutate(values)}
        >
          {!editingItem && (
            <>
              <Form.Item name="key" label={t('configCenter.itemKey')} rules={[{ required: true, message: t('configCenter.keyRequired') }]}>
                <Input placeholder="e.g. host, port" />
              </Form.Item>
              <Form.Item name="value" label={t('configCenter.itemValue')} rules={[{ required: true, message: t('configCenter.valueRequired') }]}>
                <Input.Password placeholder={t('configCenter.itemValue')} />
              </Form.Item>
              <Form.Item name="value_type" label={t('configCenter.itemValueType')} initialValue="string" rules={[{ required: true }]}>
                <Select options={[
                  { label: t('configCenter.typeString'), value: 'string' },
                  { label: t('configCenter.typeInt'), value: 'int' },
                  { label: t('configCenter.typeFloat'), value: 'float' },
                  { label: t('configCenter.typeBool'), value: 'bool' },
                  { label: t('configCenter.typeJson'), value: 'json' },
                ]} />
              </Form.Item>
              <Form.Item name="is_encrypted" label={t('configCenter.itemEncrypted')} valuePropName="checked" initialValue={false}>
                <Select options={[
                  { label: t('configCenter.itemEncrypted'), value: true },
                  { label: t('common.no'), value: false },
                ]} />
              </Form.Item>
            </>
          )}
          {editingItem && (
            <>
              <Descriptions column={2} size="small" className="mb-4">
                <Descriptions.Item label={t('configCenter.itemKey')}>{editingItem.key}</Descriptions.Item>
                <Descriptions.Item label={t('configCenter.itemValueType')}>{editingItem.value_type}</Descriptions.Item>
              </Descriptions>
              <Form.Item name="value" label={t('configCenter.itemValue')} rules={[{ required: true, message: t('configCenter.valueRequired') }]}>
                <Input.Password placeholder={editingItem.is_encrypted ? '******' : t('configCenter.itemValue')} />
              </Form.Item>
            </>
          )}
          <Form.Item name="description" label={t('configCenter.itemDescription')}>
            <TextArea rows={2} placeholder={t('configCenter.itemDescription')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 回滚 Modal */}
      <Modal
        title={t('configCenter.rollbackHistory')}
        open={isRollbackModalOpen}
        onCancel={() => setIsRollbackModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedItem && (
          <div>
            <Descriptions column={2} size="small" className="mb-4">
              <Descriptions.Item label={t('configCenter.itemKey')}>{selectedItem.key}</Descriptions.Item>
              <Descriptions.Item label={t('configCenter.itemValue')}>
                <Text code>{selectedItem.value_display}</Text>
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Title level={5}>{t('configCenter.rollbackHistory')}</Title>
            <div className="max-h-64 overflow-y-auto">
              <Timeline
                items={rollbackLogs.map((log) => ({
                  color: log.action === 'create' ? 'green' : log.action === 'update' ? 'blue' : 'orange',
                  children: (
                    <div>
                      <Space>
                        <Tag color={log.action === 'create' ? 'green' : log.action === 'update' ? 'blue' : 'orange'}>
                          {log.action}
                        </Tag>
                        <Text type="secondary">{dayjs(log.create_time).format('YYYY-MM-DD HH:mm:ss')}</Text>
                        <Text>{log.operator_username}</Text>
                      </Space>
                      <div className="text-xs text-gray-400 mt-1">
                        {t('configCenter.oldValue')}: {log.old_value_display || '-'} → {t('configCenter.newValue')}: {log.new_value_display}
                      </div>
                      {log.reason && <div className="text-xs text-gray-500">Reason: {log.reason}</div>}
                      <Button
                        size="small"
                        icon={<RollbackOutlined />}
                        className="mt-1"
                        onClick={() => {
                          rollbackForm.setFieldsValue({ change_log_id: log.id, reason: '' });
                          Modal.confirm({
                            title: t('configCenter.confirmDeleteItem'),
                            content: (
                              <Form form={rollbackForm} layout="vertical">
                                <Form.Item name="reason" label={t('configCenter.rollbackReason')} rules={[{ required: true }]}>
                                  <Input placeholder={t('configCenter.rollbackReason')} />
                                </Form.Item>
                              </Form>
                            ),
                            onOk: () => {
                              rollbackForm.validateFields().then((vals) => {
                                rollbackMutation.mutate({ changeLogId: log.id, reason: vals.reason });
                              });
                            },
                          });
                        }}
                      >
                        {t('configCenter.rollback')}
                      </Button>
                    </div>
                  ),
                }))}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 分类详情 Modal */}
      <Modal
        title={
          <Space>
            <Text strong>{selectedCategory?.label}</Text>
            {selectedCategory && <Tag>{selectedCategory.name}</Tag>}
            {selectedCategory?.description && <Text type="secondary" className="text-sm">{selectedCategory.description}</Text>}
          </Space>
        }
        open={isCategoryDetailModalOpen}
        onCancel={() => setIsCategoryDetailModalOpen(false)}
        footer={null}
        width={900}
      >
        {selectedCategory && (
          <Table
            size="small"
            dataSource={categoryDetail?.items || []}
            columns={itemColumns}
            rowKey="id"
            loading={!categoryDetail}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ConfigCenter;
