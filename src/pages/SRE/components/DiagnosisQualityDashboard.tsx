import React from 'react';
import { Card, Col, Progress, Row, Skeleton, Statistic, Table } from 'antd';
import { useTranslation } from 'react-i18next';

import { DiagnosisQualitySummary } from '@/api/sre';

interface Props {
  data?: DiagnosisQualitySummary;
  loading?: boolean;
}

const percent = (value: unknown) => Number(value || 0);

const DiagnosisQualityDashboard: React.FC<Props> = ({ data, loading }) => {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton active />;
  }

  const runs = data?.runs || {};
  const feedback = data?.feedback || {};
  const replay = data?.replay || {};

  return (
    <>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title={t('diagnosis.quality.totalRuns')} value={percent(runs.total)} />
            <Progress percent={percent(runs.success_rate)} status="active" />
            <Statistic title={t('diagnosis.quality.averageScore')} value={percent(runs.avg_quality)} precision={1} suffix="/ 100" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title={t('diagnosis.quality.feedbackCount')} value={percent(feedback.total)} />
            <Progress percent={percent(feedback.root_cause_accuracy)} />
            <Statistic title={t('diagnosis.quality.actionAdoption')} value={percent(feedback.adoption_rate)} precision={1} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title={t('diagnosis.quality.replayCases')} value={percent(replay.cases)} />
            <Progress percent={percent(replay.pass_rate)} status={percent(replay.pass_rate) < 60 ? 'exception' : 'success'} />
            <Statistic title={t('diagnosis.quality.replayEvaluated')} value={percent(replay.evaluated)} />
          </Card>
        </Col>
      </Row>
      <Card size="small" title={t('diagnosis.quality.templatePerformance')} className="mt-3">
        <Table
          rowKey="code"
          size="small"
          pagination={false}
          dataSource={data?.templates || []}
          columns={[
            { title: t('diagnosis.diagnosisTemplate'), dataIndex: 'name' },
            { title: t('diagnosis.quality.totalRuns'), dataIndex: 'total' },
            { title: t('diagnosis.quality.successRate'), dataIndex: 'success_rate', render: (value: number) => `${Number(value || 0).toFixed(1)}%` },
            { title: t('diagnosis.quality.averageScore'), dataIndex: 'avg_quality', render: (value: number) => Number(value || 0).toFixed(1) },
          ]}
        />
      </Card>
    </>
  );
};

export default DiagnosisQualityDashboard;
