import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Modal, Upload, message, Typography, Popconfirm,
  Statistic, Row, Col, Alert, Checkbox, theme
} from 'antd';
import type { TablePaginationConfig } from 'antd';
import {
  DownloadOutlined, UploadOutlined, DatabaseOutlined, FileZipOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { getBackupList, createBackup, restoreBackup, uploadAndRestoreBackup, downloadBackupFile, deleteBackupFiles, getBackupModules, BackupFile } from '../../api/backup';

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
    mutationFn: (mods?: string[]) => createBackup(mods),
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
    mutationFn: ({filename, mods}: {filename: string, mods?: string[]}) => restoreBackup(filename, mods),
    onSuccess: (res: any) => {
      setRestoreLoading(false);
      setRestoreModalOpen(false);
      if (res.success) {
        Modal.success({
          title: t('backup.restoreSuccess'),
          content: (
            <div>
              <p>{t('backup.restoreSuccessTip')}</p>
              {res.errors?.length > 0 && (
                <div className="mt-2">
                  <Text type="warning">{t('backup.restoreErrors')}:</Text>
                  <ul className="text-xs text-orange-500 mt-1">
                    {res.errors.slice(0, 5).map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
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
    mutationFn: (file: File) => uploadAndRestoreBackup(file, selectedModules),
    onSuccess: (res: any) => {
      setRestoreLoading(false);
      setUploadModalOpen(false);
      if (res.success) {
        Modal.success({
          title: t('backup.restoreSuccess'),
          content: (
            <div>
              <p>{t('backup.restoreSuccessTip')}</p>
              {res.errors?.length > 0 && (
                <div className="mt-2">
                  <Text type="warning">{t('backup.restoreErrors')}:</Text>
                  <ul className="text-xs text-orange-500 mt-1">
                    {res.errors.slice(0, 5).map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
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

  // 列表按时间倒序
  const sortedList = [...(Array.isArray(backupList) ? backupList : [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
                setCreateModalOpen(true);
              }} 
              loading={createMutation.isPending}
            >
              {t('backup.create')}
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>
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
        title="选择备份范围"
        open={createModalOpen}
        onOk={() => createMutation.mutate(selectedModules)}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={createMutation.isPending}
      >
        <div className="py-4">
          <Text type="secondary" className="mb-4 block">请选择您需要导出的功能模块数据：</Text>
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
      </Modal>

      <Modal
        title="确认恢复数据"
        open={restoreModalOpen}
        onOk={() => {
          setRestoreLoading(true);
          restoreMutation.mutate({ filename: currentFilename, mods: selectedModules });
        }}
        onCancel={() => setRestoreModalOpen(false)}
        confirmLoading={restoreLoading}
      >
        <div className="py-4">
          <Alert
            message="高风险操作"
            description="恢复操作将覆盖系统中现有的同名数据。建议您选择仅恢复必要的模块。"
            type="warning"
            showIcon
            className="mb-4"
          />
          <Text strong>选择要恢复的模块：</Text>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
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
            message="上传恢复说明"
            description="上传文件后将立即执行恢复操作。请在下方勾选需要恢复的模块，默认将尝试恢复全部数据。"
            type="info"
            showIcon
            className="mb-4"
          />
          
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-dashed">
            <Text strong className="mb-3 block">选择恢复模块：</Text>
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

          <Upload.Dragger
            accept=".json.gz"
            beforeUpload={(file) => {
              if (!file.name.endsWith('.json.gz')) {
                message.error(t('backup.onlyGzTip'));
                return false;
              }
              setRestoreLoading(true);
              uploadMutation.mutate(file);
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
