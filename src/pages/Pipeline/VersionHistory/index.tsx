import React, { useState } from 'react';
import { Drawer, Table, Tag, Space, Typography, Button, App, Popconfirm, Timeline, Descriptions, Card, Empty, Tooltip } from 'antd';
import { HistoryOutlined, RollbackOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getPipelineVersions, rollbackPipeline, type PipelineVersion } from '../../../api/pipeline';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

interface VersionHistoryDrawerProps {
  pipelineId: number | null;
  pipelineName: string;
  open: boolean;
  onClose: () => void;
}

const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  pipelineId,
  pipelineName,
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState<PipelineVersion | null>(null);

  const { data: versionData, isLoading } = useQuery({
    queryKey: ['pipeline-versions', pipelineId],
    queryFn: () => getPipelineVersions({ pipeline: pipelineId, page: 1, page_size: 50 }),
    enabled: !!pipelineId && open,
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: number) => rollbackPipeline(pipelineId!, versionId),
    onSuccess: () => {
      message.success(t('version.rollbackSuccess'));
      queryClient.invalidateQueries({ queryKey: ['pipeline-versions', pipelineId] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setSelectedVersion(null);
    },
    onError: (err: any) => message.error(`${t('version.rollbackFailed')}: ${err.message}`),
  });

  const handleRollback = (version: PipelineVersion) => {
    setSelectedVersion(version);
  };

  const confirmRollback = () => {
    if (selectedVersion) {
      rollbackMutation.mutate(selectedVersion.id);
    }
  };

  const columns = [
    {
      title: t('version.number'),
      dataIndex: 'version_number',
      key: 'version_number',
      width: 80,
      render: (num: number, record: PipelineVersion) => (
        <Tag color={record.is_current ? 'green' : 'default'} className="rounded-full">
          v{num}
        </Tag>
      ),
    },
    {
      title: t('version.changeSummary'),
      dataIndex: 'change_summary',
      key: 'change_summary',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: t('version.creator'),
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: t('version.createdAt'),
      dataIndex: 'create_time',
      key: 'create_time',
      width: 170,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('version.status'),
      key: 'status',
      width: 100,
      render: (_: any, record: PipelineVersion) => (
        record.is_current ? (
          <Tag icon={<CheckCircleOutlined />} color="success">{t('version.current')}</Tag>
        ) : (
          <Tag>{t('version.historical')}</Tag>
        )
      ),
    },
    {
      title: t('version.action'),
      key: 'action',
      width: 120,
      render: (_: any, record: PipelineVersion) => (
        <Space>
          <Tooltip title={t('version.preview')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setSelectedVersion(record)}
            />
          </Tooltip>
          {!record.is_current && (
            <Tooltip title={t('version.rollback')}>
              <Popconfirm
                title={t('version.confirmRollback')}
                description={t('version.confirmRollbackTip', { version: record.version_number })}
                onConfirm={() => rollbackMutation.mutate(record.id)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<RollbackOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          {t('version.title', { name: pipelineName })}
        </Space>
      }
      placement="right"
      width={800}
      open={open}
      onClose={onClose}
    >
      {selectedVersion ? (
        <div className="flex flex-col gap-4">
          <Button onClick={() => setSelectedVersion(null)} className="self-start">
            ← {t('version.backToList')}
          </Button>
          <Card size="small" title={t('version.versionDetail', { version: selectedVersion.version_number })}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label={t('version.versionNumber')}>
                <Tag color="green">v{selectedVersion.version_number}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('version.creator')}>
                {selectedVersion.creator_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('version.changeSummary')}>
                {selectedVersion.change_summary || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('version.createdAt')}>
                {dayjs(selectedVersion.create_time).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label={t('version.pipelineName')}>
                {selectedVersion.pipeline_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('version.status')}>
                {selectedVersion.is_current ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">{t('version.current')}</Tag>
                ) : (
                  <Tag>{t('version.historical')}</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {selectedVersion.desc && (
            <Card size="small" title={t('version.description')}>
              <Text>{selectedVersion.desc}</Text>
            </Card>
          )}

          <Card size="small" title={t('version.graphPreview')}>
            <Paragraph type="secondary" className="text-xs mb-3">
              {t('version.graphPreviewTip')}
            </Paragraph>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto max-h-96">
              <pre className="text-xs whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
                {JSON.stringify(selectedVersion.graph_data, null, 2)}
              </pre>
            </div>
          </Card>

          {!selectedVersion.is_current && (
            <div className="flex justify-end">
              <Popconfirm
                title={t('version.confirmRollback')}
                description={t('version.confirmRollbackTip', { version: selectedVersion.version_number })}
                onConfirm={confirmRollback}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="primary"
                  danger
                  icon={<RollbackOutlined />}
                  loading={rollbackMutation.isPending}
                >
                  {t('version.rollbackToThis', { version: selectedVersion.version_number })}
                </Button>
              </Popconfirm>
            </div>
          )}
        </div>
      ) : (
        <>
          <Text type="secondary" className="mb-4 block">
            {t('version.subtitle')}
          </Text>
          {versionData?.data && versionData.data.length > 0 ? (
            <Table
              dataSource={versionData.data}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              pagination={false}
              scroll={{ y: 500 }}
            />
          ) : (
            <Empty description={t('version.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </>
      )}
    </Drawer>
  );
};

export default VersionHistoryDrawer;
