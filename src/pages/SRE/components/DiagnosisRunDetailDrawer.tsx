import React from 'react';
import { Card, Descriptions, Drawer, Space, Tag, Typography, Input } from 'antd';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

import { DiagnosisRun } from '@/api/sre';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  run?: DiagnosisRun;
  onClose: () => void;
  statusMap: Record<string, { color: string; text: string }>;
  structuredReport: React.ReactNode;
  aiEvidenceRefs: React.ReactNode;
  collectionPlanComparison: React.ReactNode;
  collectionSummary: React.ReactNode;
  ciCdContext: React.ReactNode;
  metricSourceContexts: React.ReactNode;
  logSourceContexts: React.ReactNode;
  logClusters: React.ReactNode;
  logHighlights: React.ReactNode;
  evidenceIndex: React.ReactNode;
}

const DiagnosisRunDetailDrawer: React.FC<Props> = ({
  run,
  onClose,
  statusMap,
  structuredReport,
  aiEvidenceRefs,
  collectionPlanComparison,
  collectionSummary,
  ciCdContext,
  metricSourceContexts,
  logSourceContexts,
  logClusters,
  logHighlights,
  evidenceIndex,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer title={run?.title} open={!!run} width={860} onClose={onClose}>
      {run && (
        <Space direction="vertical" className="w-full">
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label={t('diagnosis.status.label')}>
              <Tag color={statusMap[run.status]?.color}>{statusMap[run.status]?.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.diagnosisTemplate')}>
              {run.template_name || run.context_snapshot?.template?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.templateSnapshot')}>
              {run.context_snapshot?.template?.code || run.query_params?.template_snapshot?.code || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.service')}>{run.service_name || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.time')}>
              {dayjs(run.diagnosis_time).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('diagnosis.error')}>{run.error_message || '-'}</Descriptions.Item>
          </Descriptions>
          <Card title={t('diagnosis.structuredReport')}>{structuredReport}</Card>
          <Card title={t('diagnosis.aiResult')}>
            {run.ai_result ? (
              <>
                {aiEvidenceRefs}
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.ai_result}</ReactMarkdown>
              </>
            ) : <Text type="secondary">{t('common.noData')}</Text>}
          </Card>
          <Card title={t('diagnosis.collectionPlanComparison')}>{collectionPlanComparison}</Card>
          <Card title={t('diagnosis.collectionSummary')}>{collectionSummary}</Card>
          {ciCdContext && <Card title={t('diagnosis.ciCdContext')}>{ciCdContext}</Card>}
          {metricSourceContexts}
          {logSourceContexts}
          {logClusters}
          <Card title={t('diagnosis.logHighlights')}>{logHighlights}</Card>
          <Card title={t('diagnosis.evidenceIndex')}>{evidenceIndex}</Card>
          <Card title={t('diagnosis.contextSnapshot')}>
            <TextArea rows={12} readOnly value={JSON.stringify(run.context_snapshot || {}, null, 2)} />
          </Card>
        </Space>
      )}
    </Drawer>
  );
};

export default DiagnosisRunDetailDrawer;
