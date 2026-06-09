import React, { useEffect, useState } from 'react';
import {
  App, Button, Card, Descriptions, Drawer, Form, Input, Modal, Progress,
  Radio, Rate, Select, Space, Table, Tag, Timeline, Typography,
} from 'antd';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

import {
  compareDiagnosisRuns,
  createReplayCaseFromRun,
  DiagnosisFeedback,
  DiagnosisRun,
  getDiagnosisFeedback,
  saveDiagnosisFeedback,
} from '@/api/sre';

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
  compareRuns?: DiagnosisRun[];
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
  compareRuns = [],
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareRunId, setCompareRunId] = useState<number>();
  const [comparison, setComparison] = useState<any>(null);
  const [feedbackForm] = Form.useForm();

  useEffect(() => {
    if (!run?.id) return;
    getDiagnosisFeedback(run.id).then((feedback: DiagnosisFeedback | null) => {
      if (feedback) feedbackForm.setFieldsValue(feedback);
      else feedbackForm.resetFields();
    }).catch(() => feedbackForm.resetFields());
  }, [run?.id, feedbackForm]);

  const timelineItems = (run?.context_snapshot?.timeline || []).map((item: any) => ({
    color: item.severity === 'error' ? 'red' : item.severity === 'warning' ? 'orange' : 'blue',
    children: (
      <Space direction="vertical" size={0}>
        <Text strong>{item.title}</Text>
        <Text type="secondary">{item.timestamp ? dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>
        {item.summary && <Text>{item.summary}</Text>}
        {item.ref && <Tag>{item.ref}</Tag>}
      </Space>
    ),
  }));
  const correlationCandidates = run?.context_snapshot?.correlation_analysis?.root_cause_candidates || [];
  const runtimeContext = run?.context_snapshot?.runtime_context || {};
  const hasRuntimeContext = !!(
    runtimeContext.cluster
    || runtimeContext.hosts?.length
    || runtimeContext.pods?.length
    || runtimeContext.k8s_events?.length
  );

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
          <Card title={t('diagnosis.quality.title')}>
            <Space wrap size="large">
              <Progress type="circle" size={86} percent={Number(run.quality_score || 0)} />
              <Descriptions size="small" column={1}>
                <Descriptions.Item label={t('diagnosis.quality.confidence')}>
                  {(Number(run.confidence_score || 0) * 100).toFixed(1)}%
                </Descriptions.Item>
                <Descriptions.Item label={t('diagnosis.quality.evidenceCoverage')}>
                  {(Number(run.evidence_coverage || 0) * 100).toFixed(1)}%
                </Descriptions.Item>
              </Descriptions>
              <Space>
                <Button onClick={() => setFeedbackOpen(true)}>{t('diagnosis.feedback.title')}</Button>
                <Button onClick={() => setCompareOpen(true)}>{t('diagnosis.compare.title')}</Button>
                <Button onClick={() => createReplayCaseFromRun(run.id).then(() => message.success(t('diagnosis.messages.replayCreated')))}>
                  {t('diagnosis.replay.create')}
                </Button>
              </Space>
            </Space>
          </Card>
          {timelineItems.length > 0 && <Card title={t('diagnosis.timeline')}><Timeline items={timelineItems} /></Card>}
          {correlationCandidates.length > 0 && (
            <Card title={t('diagnosis.correlation')}>
              <Table
                rowKey={(_, index) => String(index)}
                size="small"
                pagination={false}
                dataSource={correlationCandidates}
                columns={[
                  { title: t('diagnosis.finding'), dataIndex: 'title' },
                  { title: t('diagnosis.confidence'), dataIndex: 'confidence_score', width: 110, render: (value: number) => `${(Number(value || 0) * 100).toFixed(0)}%` },
                  { title: t('diagnosis.evidenceRefs'), dataIndex: 'evidence_refs', render: (refs: string[]) => (refs || []).map(ref => <Tag key={ref}>{ref}</Tag>) },
                  { title: t('diagnosis.summary'), dataIndex: 'basis' },
                ]}
              />
            </Card>
          )}
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
          {hasRuntimeContext && (
            <Card title={t('diagnosis.runtimeContext')}>
              <Space direction="vertical" className="w-full">
                {runtimeContext.cluster && (
                  <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label={t('diagnosis.k8sCluster')}>{runtimeContext.cluster.name}</Descriptions.Item>
                    <Descriptions.Item label={t('diagnosis.status.label')}>{runtimeContext.cluster.status}</Descriptions.Item>
                    <Descriptions.Item label={t('diagnosis.version')}>{runtimeContext.cluster.version || '-'}</Descriptions.Item>
                    <Descriptions.Item label={t('diagnosis.nodes')}>{runtimeContext.cluster.ready_node_count}/{runtimeContext.cluster.node_count}</Descriptions.Item>
                  </Descriptions>
                )}
                {runtimeContext.hosts?.length > 0 && (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={runtimeContext.hosts}
                    columns={[
                      { title: t('diagnosis.host'), dataIndex: 'hostname' },
                      { title: 'IP', render: (_: unknown, item: any) => item.private_ip || item.ip_address || '-' },
                      { title: t('diagnosis.status.label'), dataIndex: 'status' },
                      { title: 'CPU', dataIndex: 'cpu' },
                      { title: t('diagnosis.memory'), dataIndex: 'memory' },
                    ]}
                  />
                )}
                {runtimeContext.pods?.length > 0 && (
                  <Table
                    rowKey={(item: any) => `${item.namespace}/${item.name}`}
                    size="small"
                    pagination={{ pageSize: 10 }}
                    dataSource={runtimeContext.pods}
                    columns={[
                      { title: 'Pod', dataIndex: 'name' },
                      { title: t('diagnosis.namespace'), dataIndex: 'namespace' },
                      { title: t('diagnosis.status.label'), dataIndex: 'status', render: (value: string) => <Tag color={value === 'Running' ? 'success' : 'error'}>{value}</Tag> },
                      { title: t('diagnosis.restarts'), dataIndex: 'restarts' },
                      { title: t('diagnosis.nodeName'), dataIndex: 'node_name' },
                    ]}
                  />
                )}
                {runtimeContext.k8s_events?.length > 0 && (
                  <Table
                    rowKey={(_, index) => String(index)}
                    size="small"
                    pagination={{ pageSize: 10 }}
                    dataSource={runtimeContext.k8s_events}
                    columns={[
                      { title: t('diagnosis.type'), dataIndex: 'type', render: (value: string) => <Tag color={value === 'Warning' ? 'warning' : 'default'}>{value}</Tag> },
                      { title: t('diagnosis.reason'), dataIndex: 'reason' },
                      { title: t('diagnosis.resourceType'), dataIndex: 'object' },
                      { title: t('diagnosis.message'), dataIndex: 'message' },
                    ]}
                  />
                )}
              </Space>
            </Card>
          )}
          {metricSourceContexts}
          {logSourceContexts}
          {logClusters}
          <Card title={t('diagnosis.logHighlights')}>{logHighlights}</Card>
          <Card title={t('diagnosis.evidenceIndex')}>{evidenceIndex}</Card>
          <Card title={t('diagnosis.contextSnapshot')}>
            <TextArea rows={12} readOnly value={JSON.stringify(run.context_snapshot || {}, null, 2)} />
          </Card>
          <Modal
            title={t('diagnosis.feedback.title')}
            open={feedbackOpen}
            onCancel={() => setFeedbackOpen(false)}
            onOk={() => feedbackForm.submit()}
          >
            <Form
              form={feedbackForm}
              layout="vertical"
              onFinish={(values) => saveDiagnosisFeedback(run.id, values).then(() => {
                message.success(t('common.updateSuccess'));
                setFeedbackOpen(false);
              })}
            >
              <Form.Item name="accuracy_rating" label={t('diagnosis.feedback.accuracy')} rules={[{ required: true }]}><Rate /></Form.Item>
              <Form.Item name="evidence_rating" label={t('diagnosis.feedback.evidence')} rules={[{ required: true }]}><Rate /></Form.Item>
              <Form.Item name="actionability_rating" label={t('diagnosis.feedback.actionability')} rules={[{ required: true }]}><Rate /></Form.Item>
              <Form.Item name="root_cause_correct" label={t('diagnosis.feedback.rootCauseCorrect')}>
                <Radio.Group options={[{ value: true, label: t('diagnosis.feedback.yes') }, { value: false, label: t('diagnosis.feedback.no') }]} />
              </Form.Item>
              <Form.Item name="recommendation_adopted" label={t('diagnosis.feedback.recommendationAdopted')}>
                <Radio.Group options={[{ value: true, label: t('diagnosis.feedback.yes') }, { value: false, label: t('diagnosis.feedback.no') }]} />
              </Form.Item>
              <Form.Item name="corrected_root_cause" label={t('diagnosis.feedback.correctedRootCause')}><TextArea rows={3} /></Form.Item>
              <Form.Item name="comment" label={t('diagnosis.feedback.comment')}><TextArea rows={3} /></Form.Item>
            </Form>
          </Modal>
          <Modal
            title={t('diagnosis.compare.title')}
            open={compareOpen}
            onCancel={() => setCompareOpen(false)}
            onOk={() => compareRunId && compareDiagnosisRuns(run.id, compareRunId).then(setComparison)}
          >
            <Select
              className="w-full mb-4"
              value={compareRunId}
              onChange={setCompareRunId}
              placeholder={t('diagnosis.compare.selectRun')}
              options={compareRuns.filter(item => item.id !== run.id).map(item => ({ value: item.id, label: item.title }))}
            />
            {comparison && (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label={t('diagnosis.compare.qualityDelta')}>{comparison.quality_delta}</Descriptions.Item>
                <Descriptions.Item label={t('diagnosis.compare.confidenceDelta')}>{comparison.confidence_delta}</Descriptions.Item>
                <Descriptions.Item label={t('diagnosis.compare.addedEvidence')}>{(comparison.evidence?.added || []).join(', ') || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('diagnosis.compare.removedEvidence')}>{(comparison.evidence?.removed || []).join(', ') || '-'}</Descriptions.Item>
              </Descriptions>
            )}
          </Modal>
        </Space>
      )}
    </Drawer>
  );
};

export default DiagnosisRunDetailDrawer;
