import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Modal, Upload, message, Typography, Popconfirm,
  Statistic, Row, Col, Alert, Checkbox
} from 'antd';
import type { TablePaginationConfig } from 'antd';
import {
  DownloadOutlined, UploadOutlined, DatabaseOutlined, FileZipOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { getBackupList, createBackup, restoreBackup, uploadAndRestoreBackup, downloadBackupFile, deleteBackupFiles, BackupFile } from '../../api/backup';

const { Title, Text } = Typography;

const BackupManagement: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

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
    mutationFn: createBackup,
    onSuccess: (res: any) => {
      if (res.success) {
        message.success(t('backup.createSuccess'));
        queryClient.invalidateQueries({ queryKey: ['system_backups'] });
      } else {
        message.error(res.error || t('backup.createFailed'));
      }
    },
    onError: () => message.error(t('backup.createFailed')),
  });

  // 恢复备份
  const restoreMutation = useMutation({
    mutationFn: (filename: string) => restoreBackup(filename),
    onSuccess: (res: any) => {
      setRestoreLoading(false);
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
    mutationFn: (file: File) => uploadAndRestoreBackup(file),
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
          <Popconfirm
            title={t('backup.confirmRestore')}
            description={t('backup.restoreWarning')}
            onConfirm={() => {
              setRestoreLoading(true);
              restoreMutation.mutate(record.filename);
            }}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="text" icon={<FileZipOutlined />} danger>
              {t('backup.restore')}
            </Button>
          </Popconfirm>
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
            <Button type="primary" icon={<DatabaseOutlined />} onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
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

      <Modal title={t('backup.upload')} open={uploadModalOpen} onCancel={() => setUploadModalOpen(false)} footer={null} width={500}>
        <div className="py-4">
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
              <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
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
