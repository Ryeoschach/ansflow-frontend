import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Modal, Upload, message, Typography, Popconfirm,
  Statistic, Row, Col, Alert, Checkbox, theme, Input, Divider, Tag
} from 'antd';
import type { TablePaginationConfig } from 'antd';
import {
  DownloadOutlined, UploadOutlined, DatabaseOutlined, FileZipOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  getBackupList,
  createBackup,
  restoreBackup,
  uploadAndRestoreBackup,
  downloadBackupFile,
  deleteBackupFiles,
  getBackupModules,
  BackupFile,
  RestoreBackupResponse,
} from '../../api/backup';

const { Title, Text } = Typography;

const BackupManagement: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [passphrase, setPassphrase] = useState<string>('');
  const [includeHistory, setIncludeHistory] = useState(false);

  // 获取模块列表
  const { data: modules = [] } = useQuery({
    queryKey: ['backup_modules'],
    queryFn: getBackupModules,
  });

  // 获取备份列表
  const { data: backupList = [], isLoading } = useQuery({
    queryKey: ['system_backups'],
    queryFn: async () => {
      const res = await getBackupList();
      return Array.isArray(res) ? res : [];
    },
  });

  // 创建备份
  const createMutation = useMutation({
    mutationFn: ({ mods, pass }: { mods?: string[]; pass?: string }) => createBackup(mods, pass),
    onSuccess: (res: any) => {
      if (res.success) {
        message.success(t('backup.createSuccess'));
        setCreateModalOpen(false);
        queryClient.invalidateQueries({ queryKey: ['system_backups'] });
      } else {
        message.error(res.error || t('backup.createFailed'));
      }
    },
    onError: () => message.error(t('backup.createFailed')),
  });

  // 恢复备份
  const restoreMutation = useMutation({
    mutationFn: ({ filename, mods, pass, history }: { filename: string, mods?: string[], pass?: string, history?: boolean }) =>
      restoreBackup(filename, mods, pass, history),
    onSuccess: (res: RestoreBackupResponse) => {
      setRestoreLoading(false);
      setRestoreModalOpen(false);
      if (res.success) {
        Modal.success({
          title: t('backup.restoreSuccess'),
          width: 560,
          content: renderRestoreResult(res),
        });
      } else {
        message.error(res.error || t('backup.restoreFailed'));
      }
    },
    onError: () => {
      setRestoreLoading(false);
      setRestoreModalOpen(false);
      message.error(t('backup.restoreFailed'));
    },
  });

  // 删除备份
  const deleteMutation = useMutation({
    mutationFn: (filenames: string[]) => deleteBackupFiles(filenames),
    onSuccess: (res: any) => {
      if (res.success) {
        message.success(t('backup.deleteSuccess'));
        setSelectedRowKeys([]);
        queryClient.invalidateQueries({ queryKey: ['system_backups'] });
      } else {
        message.error(res.error || t('backup.deleteFailed'));
      }
    },
    onError: () => message.error(t('backup.deleteFailed')),
  });

  // 上传并恢复
  const uploadMutation = useMutation({
    mutationFn: ({ file, pass, history }: { file: File; pass?: string; history?: boolean }) =>
      uploadAndRestoreBackup(file, selectedModules, pass, history),
    onSuccess: (res: RestoreBackupResponse) => {
      setRestoreLoading(false);
      setUploadModalOpen(false);
      if (res.success) {
        Modal.success({
          title: t('backup.restoreSuccess'),
          width: 560,
          content: renderRestoreResult(res),
        });
      } else {
        message.error(res.error || t('backup.restoreFailed'));
      }
    },
    onError: () => {
      setRestoreLoading(false);
      message.error(t('backup.restoreFailed'));
    },
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (filename: string) => {
    try {
      await downloadBackupFile(filename);
    } catch {
      message.error(t('common.error'));
    }
  };

  const renderList = (title: string, items?: string[], color: string = 'orange') => {
    if (!items?.length) return null;
    return (
      <div className="mt-3">
        <Text type="secondary">{title}</Text>
        <ul className={`text-xs mt-1 ${color === 'red' ? 'text-red-500' : 'text-orange-500'}`}>
          {items.slice(0, 5).map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderTags = (title: string, items?: string[]) => {
    if (!items?.length) return null;
    return (
      <div className="mt-3">
        <Text type="secondary" className="mr-2">{title}</Text>
        {items.map((item) => (
          <Tag key={item} color="blue">{item}</Tag>
        ))}
      </div>
    );
  };

  const renderRestoreResult = (res: RestoreBackupResponse) => {
    const remappedEntries = Object.entries(res.remapped_refs || {}).filter(([, count]) => count > 0);
    return (
      <div>
        <p>{t('backup.restoreSuccessTip')}</p>
        {renderTags(t('backup.autoAddedModules'), res.added_dependency_modules)}
        {renderTags(t('backup.skippedHistoryModels'), res.skipped_history_models)}
        {remappedEntries.length > 0 && (
          <div className="mt-3">
            <Text type="secondary" className="mr-2">{t('backup.remappedReferences')}</Text>
            {remappedEntries.map(([key, count]) => (
              <Tag key={key} color="green">{key}: {count}</Tag>
            ))}
          </div>
        )}
        {(res.warnings?.length || res.errors?.length || res.unresolved_refs?.length) ? <Divider className="my-3" /> : null}
        {renderList(t('backup.restoreWarnings'), res.warnings)}
        {renderList(t('backup.unresolvedReferences'), res.unresolved_refs)}
        {renderList(t('backup.restoreErrors'), res.errors, 'red')}
      </div>
    );
  };

  // 列表按时间倒序
  const sortedList = [...(Array.isArray(backupList) ? backupList : [])].sort(
    (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
  );

  // 添加序号（ID）
  sortedList.forEach((item, index) => {
    (item as any).id = index + 1;
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      render: (id: number) => <Text type="secondary">{id}</Text>,
    },
    {
      title: t('backup.filename'),
      dataIndex: 'filename',
      key: 'filename',
      render: (filename: string) => (
        <Space>
          <FileZipOutlined className="text-blue-500" />
          <Text code>{filename}</Text>
        </Space>
      ),
    },
    {
      title: t('backup.size'),
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => formatSize(size),
    },
    {
      title: t('backup.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('pipeline.action'),
      key: 'action',
      width: 200,
      render: (_: any, record: BackupFile) => (
        <Space>
          <Button type="text" icon={<DownloadOutlined />} onClick={() => handleDownload(record.filename)}>
            {t('backup.download')}
          </Button>
          <Button
            type="text"
            icon={<FileZipOutlined />}
            danger
            onClick={() => {
              setCurrentFilename(record.filename);
              setSelectedModules(modules.map((m: any) => m.key)); // 默认全选
              setPassphrase('');
              setIncludeHistory(false);
              setRestoreModalOpen(true);
            }}
          >
            {t('backup.restore')}
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys as string[]);
    },
  };

  return (
    <div className="p-4">
      <Title level={4}>{t('backup.title')}</Title>

      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card>
            <Statistic title={t('backup.totalBackups')} value={sortedList.length} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('backup.latestBackup')}
              value={sortedList[0] ? dayjs(sortedList[0].created_at).format('MM-DD HH:mm') : '-'}
              prefix={<FileZipOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('backup.totalSize')}
              value={formatSize(sortedList.reduce((sum: number, f: BackupFile) => sum + (f.size || 0), 0))}
              prefix={<FileZipOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Alert message={t('backup.tipTitle')} description={t('backup.tipDesc')} type="info" showIcon className="mb-4" />

      <Card
        title={t('backup.backupList')}
        extra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={t('backup.confirmDelete')}
                description={t('backup.deleteWarning')}
                onConfirm={() => deleteMutation.mutate(selectedRowKeys)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                  {t('backup.deleteSelected')} ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button
              type="primary"
              icon={<DatabaseOutlined />}
              onClick={() => {
                setSelectedModules(modules.map((m: any) => m.key));
                setPassphrase('');
                setIncludeHistory(false);
                setCreateModalOpen(true);
              }}
              loading={createMutation.isPending}
            >
              {t('backup.create')}
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => {
              setSelectedModules(modules.map((m: any) => m.key));
              setPassphrase('');
              setIncludeHistory(false);
              setUploadModalOpen(true);
            }}>
              {t('backup.upload')}
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={sortedList}
          columns={columns}
          rowKey="filename"
          loading={isLoading}
          rowSelection={rowSelection}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={t('backup.selectBackupScope')}
        open={createModalOpen}
        onOk={() => createMutation.mutate({ mods: selectedModules, pass: passphrase })}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={createMutation.isPending}
      >
        <div className="py-4">
          <Text type="secondary" className="mb-4 block">{t('backup.selectExportModules')}</Text>
          <Checkbox.Group
            style={{ width: '100%' }}
            value={selectedModules}
            onChange={(vals) => setSelectedModules(vals as string[])}
          >
            <Row gutter={[16, 12]}>
              {modules.map((m: any) => (
                <Col span={12} key={m.key}>
                  <Checkbox value={m.key}>{m.label}</Checkbox>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
          <div className="mt-4">
            <Text className="mb-2 block">{t('backup.backupPasswordLabel')}</Text>
            <Input.Password
              placeholder={t('backup.backupPasswordPlaceholder')}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={t('backup.confirmRestoreData')}
        open={restoreModalOpen}
        onOk={() => {
          setRestoreLoading(true);
          restoreMutation.mutate({ filename: currentFilename, mods: selectedModules, pass: passphrase, history: includeHistory });
        }}
        onCancel={() => setRestoreModalOpen(false)}
        confirmLoading={restoreLoading}
      >
        <div className="py-4">
          <Alert
            message={t('backup.highRiskOperation')}
            description={t('backup.restoreOverwriteWarning')}
            type="warning"
            showIcon
            className="mb-4"
          />
          <Text strong>{t('backup.selectRestoreModules')}</Text>
          <div className="mt-4 p-4 bg-ans-bg-container border border-ans-border rounded-lg">
            <Checkbox.Group
              style={{ width: '100%' }}
              value={selectedModules}
              onChange={(vals) => setSelectedModules(vals as string[])}
            >
              <Row gutter={[16, 12]}>
                {modules.map((m: any) => (
                  <Col span={12} key={m.key}>
                    <Checkbox value={m.key}>{m.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </div>
          <div className="mt-4">
            <Text className="mb-2 block">{t('backup.decryptPasswordLabel')}</Text>
            <Input.Password
              placeholder={t('backup.decryptPasswordPlaceholder')}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Checkbox
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
            >
              {t('backup.includeHistory')}
            </Checkbox>
            <div className="mt-1">
              <Text type="secondary">{t('backup.includeHistoryDesc')}</Text>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={t('backup.upload')}
        open={uploadModalOpen}
        onCancel={() => setUploadModalOpen(false)}
        footer={null}
        width={600}
      >
        <div className="py-4">
          <Alert
            message={t('backup.uploadRestoreNote')}
            description={t('backup.uploadRestoreDesc')}
            type="info"
            showIcon
            className="mb-4"
          />

          <div className="mb-6 p-4 bg-ans-bg-container border border-ans-border rounded-lg border-dashed">
            <Text strong className="mb-3 block">{t('backup.selectRestoreModulesShort')}</Text>
            <Checkbox.Group
              style={{ width: '100%' }}
              value={selectedModules}
              onChange={(vals) => setSelectedModules(vals as string[])}
            >
              <Row gutter={[16, 12]}>
                {modules.map((m: any) => (
                  <Col span={12} key={m.key}>
                    <Checkbox value={m.key}>{m.label}</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </div>

          <div className="mb-4">
            <Text className="mb-2 block">{t('backup.decryptPasswordBeforeUploadLabel')}</Text>
            <Input.Password
              placeholder={t('backup.decryptPasswordPlaceholder')}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              disabled={restoreLoading}
            />
          </div>

          <div className="mb-4">
            <Checkbox
              checked={includeHistory}
              disabled={restoreLoading}
              onChange={(e) => setIncludeHistory(e.target.checked)}
            >
              {t('backup.includeHistory')}
            </Checkbox>
            <div className="mt-1">
              <Text type="secondary">{t('backup.includeHistoryDesc')}</Text>
            </div>
          </div>

          <Upload.Dragger
            accept=".json.gz"
            beforeUpload={(file) => {
              if (!file.name.endsWith('.json.gz')) {
                message.error(t('backup.onlyGzTip'));
                return false;
              }
              setRestoreLoading(true);
              uploadMutation.mutate({ file, pass: passphrase, history: includeHistory });
              return false;
            }}
            showUploadList={false}
            disabled={restoreLoading}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
            </p>
            <p className="ant-upload-text">{t('backup.uploadTip')}</p>
            <p className="ant-upload-hint">{t('backup.uploadHint')}</p>
          </Upload.Dragger>
          {restoreLoading && (
            <div className="mt-4 text-center">
              <Text type="secondary">{t('backup.restoring')}</Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default BackupManagement;
