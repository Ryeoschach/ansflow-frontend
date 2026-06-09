import React from 'react';
import { App, Button, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { DiagnosisReplayCase } from '@/api/sre';

const { Text } = Typography;

interface Props {
  cases: DiagnosisReplayCase[];
  loading?: boolean;
  onRun: (id: number) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  onRefresh: () => void;
}

const DiagnosisReplayCases: React.FC<Props> = ({
  cases,
  loading,
  onRun,
  onDelete,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();

  return (
    <Space direction="vertical" className="w-full">
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>{t('common.refresh')}</Button>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={cases}
        columns={[
          { title: t('diagnosis.name'), dataIndex: 'name' },
          { title: t('diagnosis.diagnosisTemplate'), dataIndex: 'template_name', render: (value: string) => value || '-' },
          { title: t('diagnosis.sourceRun'), dataIndex: 'source_run_title', render: (value: string) => value || '-' },
          {
            title: t('diagnosis.replay.latestResult'),
            dataIndex: 'latest_result',
            render: (result: any) => result ? (
              <Space>
                <Tag color={result.passed ? 'success' : result.status === 'running' ? 'processing' : 'error'}>{result.status}</Tag>
                <Text>{Number(result.score || 0).toFixed(1)}</Text>
              </Space>
            ) : '-',
          },
          {
            title: t('common.action'),
            render: (_: unknown, record: DiagnosisReplayCase) => (
              <Space>
                <Button
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={() => onRun(record.id).then(() => message.success(t('diagnosis.messages.replaySubmitted')))}
                >
                  {t('diagnosis.replay.run')}
                </Button>
                <Popconfirm
                  title={t('common.confirmDelete')}
                  onConfirm={() => onDelete(record.id).then(() => message.success(t('common.deleteSuccess')))}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
};

export default DiagnosisReplayCases;
