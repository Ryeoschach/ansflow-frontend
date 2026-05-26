import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Typography,
  Card,
  App,
  theme,
  Tooltip,
  Badge,
  Progress,
  List,
  Checkbox,
  Empty,
  Spin,
} from 'antd';
import {
  SafetyCertificateOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  DisconnectOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getComplianceFrameworks,
  getComplianceClauses,
  createComplianceMapping,
  deleteComplianceMapping,
  checkComplianceClauseManual,
} from '../../api/compliance';
import { getHostBaselines } from '../../api/hosts';

const { Title, Text, Paragraph } = Typography;

const ComplianceManagement: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message, modal: antModal } = App.useApp();
  const queryClient = useQueryClient();

  // Selected state
  const [selectedClauseId, setSelectedClauseId] = useState<number | null>(null);
  const [isMappingModalVisible, setIsMappingModalVisible] = useState(false);
  const [selectedBaselines, setSelectedBaselines] = useState<number[]>([]);

  // Queries
  const { data: frameworksData, isLoading: isFrameworksLoading } = useQuery({
    queryKey: ['compliance', 'frameworks'],
    queryFn: () => getComplianceFrameworks({ page: 1, size: 100 }),
  });

  const { data: clausesData, isLoading: isClausesLoading } = useQuery({
    queryKey: ['compliance', 'clauses'],
    queryFn: () => getComplianceClauses({ page: 1, size: 100 }),
    refetchInterval: (query) => {
      // 智能轮询：如果列表中有任何一条关联的基线正在执行，则每 3 秒刷新一次
      const hasRunning = query.state.data?.data?.some(
        (c: any) => c.compliance_status === 'running'
      );
      return hasRunning ? 3000 : false;
    },
  });

  const { data: allBaselinesData } = useQuery({
    queryKey: ['host', 'baselines'],
    queryFn: () => getHostBaselines({ page: 1, size: 100 }),
  });

  // Target framework (usually MLPS 2.0 / 等保2.0 reference)
  const currentFramework = frameworksData?.data?.[0];

  // Mutations
  const mappingMutation = useMutation({
    mutationFn: async ({ clauseId, baselineIds }: { clauseId: number; baselineIds: number[] }) => {
      const activeClause = clausesData?.data?.find((c: any) => c.id === clauseId);
      const existingMappings = activeClause?.baseline_details || [];
      const existingBaselineIds = existingMappings.map((m: any) => m.baseline_id);

      // Mappings to add
      const toAdd = baselineIds.filter((id) => !existingBaselineIds.includes(id));
      // Mappings to delete
      const toDelete = existingMappings.filter((m: any) => !baselineIds.includes(m.baseline_id));

      // Execute deletions
      for (const m of toDelete) {
        await deleteComplianceMapping(m.mapping_id);
      }
      // Execute additions
      for (const id of toAdd) {
        await createComplianceMapping({ clause: clauseId, baseline: id });
      }
    },
    onSuccess: () => {
      message.success(t('compliance.mappingSuccess'));
      setIsMappingModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['compliance', 'clauses'] });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (mappingId: number) => deleteComplianceMapping(mappingId),
    onSuccess: () => {
      message.success(t('compliance.mappingSuccess'));
      queryClient.invalidateQueries({ queryKey: ['compliance', 'clauses'] });
    },
  });

  const triggerClauseCheckMutation = useMutation({
    mutationFn: (clauseId: number) => checkComplianceClauseManual(clauseId),
    onSuccess: () => {
      message.success(t('compliance.triggerClauseSuccess'));
      queryClient.invalidateQueries({ queryKey: ['compliance', 'clauses'] });
    },
  });

  // Calculate compliance statistics
  const clausesList = clausesData?.data || [];
  const leafClauses = clausesList.filter(
    (c: any) => !clausesList.some((child: any) => child.parent === c.id)
  );

  const totalClauses = leafClauses.length;
  const compliantClauses = leafClauses.filter((c: any) => c.compliance_status === 'success').length;
  const nonCompliantClauses = leafClauses.filter((c: any) => c.compliance_status === 'failed').length;
  const pendingClauses = leafClauses.filter(
    (c: any) => c.compliance_status === 'pending' || c.compliance_status === 'running'
  ).length;

  const complianceRate = totalClauses > 0 ? Math.round((compliantClauses / totalClauses) * 100) : 0;

  // Selected Clause
  const selectedClause = clausesList.find((c: any) => c.id === selectedClauseId) || clausesList[0];

  // Set initial selected clause id once data is loaded
  if (clausesList.length > 0 && selectedClauseId === null) {
    setSelectedClauseId(clausesList[0].id);
  }

  // Handle open association modal
  const openMappingModal = () => {
    if (!selectedClause) return;
    const initialIds = (selectedClause.baseline_details || []).map((m: any) => m.baseline_id);
    setSelectedBaselines(initialIds);
    setIsMappingModalVisible(true);
  };

  // Build hierarchical lists
  const rootClauses = clausesList.filter((c: any) => !c.parent);
  const getSubClauses = (parentId: number) => clausesList.filter((c: any) => c.parent === parentId);

  // Status rendering helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge status="success" text={t('compliance.status.success')} />;
      case 'failed':
        return <Badge status="error" text={t('compliance.status.failed')} />;
      case 'running':
        return <Badge status="processing" text={t('compliance.status.running')} />;
      default:
        return <Badge status="default" text={t('compliance.status.pending')} />;
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            {t('compliance.status.success')}
          </Tag>
        );
      case 'failed':
        return (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            {t('compliance.status.failed')}
          </Tag>
        );
      case 'running':
        return (
          <Tag color="processing" icon={<ReloadOutlined spin />}>
            {t('compliance.status.running')}
          </Tag>
        );
      default:
        return (
          <Tag color="default" icon={<ClockCircleOutlined />}>
            {t('compliance.status.pending')}
          </Tag>
        );
    }
  };

  return (
    <div className="p-0">
      {/* Page Header */}
      <div className="mb-6">
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Title level={3} style={{ margin: 0 }}>
            <SafetyCertificateOutlined style={{ color: token.colorPrimary, marginRight: 8 }} />
            {t('compliance.title')}
          </Title>
          <Text type="secondary">{t('compliance.description')}</Text>
        </Space>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="shadow-sm border-none flex items-center justify-between" bodyStyle={{ width: '100%' }}>
          <div className="flex items-center justify-between w-100">
            <div>
              <Text type="secondary" className="block text-xs uppercase mb-1">
                {t('compliance.overallCompliance')}
              </Text>
              <Title level={3} style={{ margin: 0 }}>
                {complianceRate}%
              </Title>
            </div>
            <Progress
              type="circle"
              percent={complianceRate}
              size={50}
              strokeColor={complianceRate > 80 ? token.colorSuccess : complianceRate > 50 ? token.colorWarning : token.colorError}
            />
          </div>
        </Card>

        <Card className="shadow-sm border-none" bodyStyle={{ width: '100%' }}>
          <Text type="secondary" className="block text-xs mb-1">
            {t('compliance.compliantCount')}
          </Text>
          <div className="flex items-baseline gap-x-2">
            <Title level={3} style={{ margin: 0, color: token.colorSuccess }}>
              {compliantClauses}
            </Title>
            <Text type="secondary" className="text-xs">
              / {totalClauses} {t('compliance.clauseCount')}
            </Text>
          </div>
        </Card>

        <Card className="shadow-sm border-none" bodyStyle={{ width: '100%' }}>
          <Text type="secondary" className="block text-xs mb-1">
            {t('compliance.nonCompliantCount')}
          </Text>
          <div className="flex items-baseline gap-x-2">
            <Title level={3} style={{ margin: 0, color: token.colorError }}>
              {nonCompliantClauses}
            </Title>
            <Text type="secondary" className="text-xs">
              / {totalClauses} {t('compliance.clauseCount')}
            </Text>
          </div>
        </Card>

        <Card className="shadow-sm border-none" bodyStyle={{ width: '100%' }}>
          <Text type="secondary" className="block text-xs mb-1">
            {t('compliance.pendingCount')}
          </Text>
          <div className="flex items-baseline gap-x-2">
            <Title level={3} style={{ margin: 0, color: token.colorTextSecondary }}>
              {pendingClauses}
            </Title>
            <Text type="secondary" className="text-xs">
              / {totalClauses} {t('compliance.clauseCount')}
            </Text>
          </div>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="flex gap-x-6">
        {/* Left Side: Clause Tree */}
        <Card
          title={t('compliance.clausesList')}
          className="shadow-sm border-none"
          style={{ width: '35%', minWidth: '320px' }}
          bodyStyle={{ padding: '12px', height: '600px', overflowY: 'auto' }}
          extra={
            currentFramework && (
              <Tag color="blue" className="m-0">
                {currentFramework.name} {currentFramework.version}
              </Tag>
            )
          }
        >
          {isClausesLoading ? (
            <div className="flex justify-center items-center h-full">
              <Spin size="medium" />
            </div>
          ) : (
            <List
              dataSource={rootClauses}
              renderItem={(root: any) => {
                const subClauses = getSubClauses(root.id);
                return (
                  <div key={root.id} className="mb-4">
                    {/* Parent header */}
                    <div
                      className="px-3 py-2 rounded-md font-medium text-sm flex items-center bg-gray-50 dark:bg-gray-800/40 mb-1"
                      style={{ color: token.colorText }}
                    >
                      <SafetyCertificateOutlined className="mr-2" style={{ color: token.colorPrimary }} />
                      <Text strong className="truncate max-w-[240px]">
                        [{root.code}] {root.name}
                      </Text>
                    </div>
                    {/* Sub-clauses list */}
                    <div className="pl-4">
                      <List
                        dataSource={subClauses}
                        renderItem={(sub: any) => {
                          const isSelected = selectedClauseId === sub.id;
                          return (
                            <div
                              key={sub.id}
                              onClick={() => setSelectedClauseId(sub.id)}
                              className={`px-3 py-2 rounded-md cursor-pointer transition-all duration-200 flex items-center justify-between mb-1 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                                isSelected
                                  ? 'bg-blue-50/60 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-medium'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                              style={
                                isSelected
                                  ? { borderLeft: `3px solid ${token.colorPrimary}` }
                                  : undefined
                              }
                            >
                              <Text
                                className={`text-xs truncate max-w-[180px] ${
                                  isSelected ? 'text-blue-600 dark:text-blue-400 font-medium' : ''
                                }`}
                              >
                                {sub.code} {sub.name}
                              </Text>
                              <div className="flex-shrink-0">
                                {getStatusBadge(sub.compliance_status)}
                              </div>
                            </div>
                          );
                        }}
                      />
                    </div>
                  </div>
                );
              }}
            />
          )}
        </Card>

        {/* Right Side: Clause Details & Associated Baselines */}
        <Card
          title={t('compliance.clauseDetails')}
          className="shadow-sm border-none flex-1"
          bodyStyle={{ padding: '24px', height: '600px', overflowY: 'auto' }}
          extra={
            selectedClause && (
              <Space>
                <Button
                  type="primary"
                  ghost
                  icon={<LinkOutlined />}
                  onClick={openMappingModal}
                >
                  {t('compliance.associateBaselines')}
                </Button>
                {(selectedClause.baseline_details || []).length > 0 && (
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => triggerClauseCheckMutation.mutate(selectedClause.id)}
                    loading={triggerClauseCheckMutation.isPending}
                  >
                    {t('compliance.triggerCheck')}
                  </Button>
                )}
              </Space>
            )
          }
        >
          {selectedClause ? (
            <div>
              {/* Clause description */}
              <div className="mb-6 p-4 rounded-lg bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <Title level={4} style={{ margin: 0 }}>
                    [{selectedClause.code}] {selectedClause.name}
                  </Title>
                  {getStatusTag(selectedClause.compliance_status)}
                </div>
                <Paragraph type="secondary" style={{ margin: 0, fontSize: '13px' }}>
                  {selectedClause.description}
                </Paragraph>
              </div>

              {/* Associated baselines list */}
              <Title level={5} className="mb-4">
                <SafetyOutlined className="mr-2" />
                {t('compliance.associatedBaselines')} ({(selectedClause.baseline_details || []).length})
              </Title>

              {(selectedClause.baseline_details || []).length > 0 ? (
                <Table<any>
                  dataSource={selectedClause.baseline_details}
                  rowKey="mapping_id"
                  pagination={false}
                  size="middle"
                  columns={[
                    {
                      title: t('host.baseline.name'),
                      dataIndex: 'baseline_name',
                      key: 'baseline_name',
                      render: (text) => <Text strong>{text}</Text>,
                    },
                    {
                      title: t('host.baseline.targetPool'),
                      dataIndex: 'pool_name',
                      key: 'pool_name',
                      render: (text) => <Tag color="cyan">{text}</Tag>,
                    },
                    {
                      title: t('common.status'),
                      dataIndex: 'last_check_status',
                      key: 'last_check_status',
                      render: (status) => getStatusTag(status),
                    },
                    {
                      title: t('host.baseline.lastCheck'),
                      dataIndex: 'last_check_time',
                      key: 'last_check_time',
                      render: (val) =>
                        val ? (
                          <Text type="secondary" className="text-xs">
                            {new Date(val).toLocaleString()}
                          </Text>
                        ) : (
                          <Text type="secondary" className="text-xs">
                            {t('host.baseline.neverChecked')}
                          </Text>
                        ),
                    },
                    {
                      title: t('common.action'),
                      key: 'action',
                      width: 100,
                      render: (_, record) => (
                        <Space>
                          <Tooltip title={t('compliance.associateBaselines')}>
                            <Button
                              type="link"
                              size="small"
                              danger
                              icon={<DisconnectOutlined />}
                              onClick={() => {
                                antModal.confirm({
                                  title: '确认解除绑定?',
                                  content: '解除绑定后，该基线的巡检状态将不再映射至此等保条款。',
                                  onOk: () => deleteMappingMutation.mutate(record.mapping_id),
                                });
                              }}
                            />
                          </Tooltip>
                        </Space>
                      ),
                    },
                  ]}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t('compliance.noBaselines')}
                  style={{ marginTop: '60px' }}
                >
                  <Button type="primary" ghost icon={<LinkOutlined />} onClick={openMappingModal}>
                    {t('compliance.associateBaselines')}
                  </Button>
                </Empty>
              )}
            </div>
          ) : (
            <div className="flex justify-center items-center h-full">
              <Empty description="请从左侧选择一个合规条款项" />
            </div>
          )}
        </Card>
      </div>

      {/* Association Mapping Modal */}
      {selectedClause && (
        <Modal
          title={t('compliance.associateModalTitle', { code: selectedClause.code })}
          open={isMappingModalVisible}
          onCancel={() => setIsMappingModalVisible(false)}
          onOk={() =>
            mappingMutation.mutate({
              clauseId: selectedClause.id,
              baselineIds: selectedBaselines,
            })
          }
          confirmLoading={mappingMutation.isPending}
          width={680}
        >
          <div className="mb-4">
            <Text type="secondary">{t('compliance.selectBaselines')}</Text>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2 border border-gray-100 dark:border-gray-800 rounded-md">
            <Checkbox.Group
              value={selectedBaselines}
              onChange={(checkedValues) => setSelectedBaselines(checkedValues as number[])}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {(allBaselinesData?.data || []).map((b: any) => (
                <Checkbox key={b.id} value={b.id} className="m-0 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded px-2">
                  <Space>
                    <Text strong>{b.name}</Text>
                    <Tag color="cyan">{b.pool_name}</Tag>
                  </Space>
                </Checkbox>
              ))}
            </Checkbox.Group>
            {(allBaselinesData?.data || []).length === 0 && (
              <div className="py-8 text-center">
                <Text type="secondary">暂无可用主机基线，请先前往「主机基线」页面创建</Text>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ComplianceManagement;
