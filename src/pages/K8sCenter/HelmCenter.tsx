import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Card,
  App,
  Upload,
  theme,
  Checkbox,
  List,
  Dropdown,
  MenuProps,
} from 'antd';
import {
  ReloadOutlined,
  RocketOutlined,
  CloudUploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BuildOutlined,
  HistoryOutlined,
  EllipsisOutlined,
  RotateRightOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getK8sClusters,
  getK8sNamespaces,
  getHelmList,
  installHelmChart,
  upgradeHelmChart,
  uninstallHelmChart,
  getHelmHistory,
  getHelmValues,
  rollbackHelmChart,
  restartHelmChart,
  stopHelmChart,
} from '../../api/k8s';
import request from '../../utils/requests';
import { Resizable } from 'react-resizable';
import './TableResizable.css';
import useAppStore from "../../store/useAppStore.ts";
import useBreakpoint from '../../utils/useBreakpoint';


const { Title, Text } = Typography;
const { TextArea } = Input;

// 格式化 Helm 时间字符串
const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
        const parts = dateStr.split(' ');
        if (parts.length >= 2) {
            return `${parts[0]} ${parts[1].split('.')[0]}`;
        }
    } catch(e: any) {
      return e.toString();
    }
    return dateStr;
};

// --- 可缩放表头组件 ---
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      handle={<span className="react-resizable-handle" onClick={(e) => e.stopPropagation()} />}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

interface ScaffoldFile {
  path: string;
  content: string;
}

const HelmCenter: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal: appModal } = App.useApp();
  const { token } = theme.useToken();
  const [selectedCluster, setSelectedCluster] = useState<any>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | undefined>();
    const [isChartModalVisible, setIsChartModalVisible] = useState(false);
    const [chartForm] = Form.useForm();
    const { hasPermission } = useAppStore();
    const { isMobile } = useBreakpoint();
  
    const [installMode, setInstallMode] = useState<'repo' | 'upload' | 'create'>('upload');
  const [fileList, setFileList] = useState<any[]>([]);
  const [isUpgrade, setIsUpgrade] = useState(false);

  // Online Creation & Editor State
  const [scaffoldFiles, setScaffoldFiles] = useState<ScaffoldFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [isScaffolding, setIsScaffolding] = useState(false);

  // History & Values State
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [activeRelease, setActiveRelease] = useState<any>(null);
  const [editValuesYaml, setEditValuesYaml] = useState('');

  // Queries
  const { data: clustersData } = useQuery({
    queryKey: ['k8s', 'clusters'],
    queryFn: () => getK8sClusters({ page: 1, size: 100 }),
    staleTime: 30 * 60 * 1000
  });

  const { data: namespacesData } = useQuery({
    queryKey: ['k8s', selectedCluster?.id, 'namespaces'],
    queryFn: () => getK8sNamespaces(selectedCluster?.id!),
    enabled: !!selectedCluster,
    staleTime: 10 * 60 * 1000
  });

  const { data: helmData, isLoading: helmLoading, refetch: refetchHelm } = useQuery({
    queryKey: ['k8s', selectedCluster?.id, 'helm', selectedNamespace],
    queryFn: () => getHelmList(selectedCluster?.id!, { namespace: selectedNamespace }),
    enabled: !!selectedCluster,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['k8s', selectedCluster?.id, 'helm-history', activeRelease?.name],
    queryFn: () => getHelmHistory(selectedCluster?.id!, { name: activeRelease?.name, namespace: activeRelease?.namespace }),
    enabled: !!selectedCluster && !!activeRelease && isHistoryVisible,
  });

  // Mutations
  const installChartMutation = useMutation({
    mutationFn: (data: { name: string; chart: string; namespace?: string }) => installHelmChart(selectedCluster?.id!, data),
    onSuccess: (res: any) => { message.success(res?.msg || t('helm.publishSuccess')); setIsChartModalVisible(false); chartForm.resetFields(); refetchHelm(); },
    onError: (err: any) => { message.error(`${t('helm.publishFailed')}: ${err.response?.data?.error || err.message}`); }
  });

  const upgradeChartMutation = useMutation({
    mutationFn: (data: { name: string; chart?: string; namespace?: string; force?: boolean; values?: string }) =>
      upgradeHelmChart(selectedCluster?.id!, data),
    onSuccess: (res: any) => { message.success(res?.msg || t('helm.operateSuccess')); setIsChartModalVisible(false); chartForm.resetFields(); refetchHelm(); },
    onError: (err: any) => { message.error(`${t('helm.submitFailed')}: ${err.response?.data?.error || err.message}`); }
  });

  const uploadChartMutation = useMutation({
    mutationFn: (formData: FormData) => request.post(`/k8s/${selectedCluster?.id}/chart_upload/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (res: any) => { message.success(res?.msg || res?.data?.msg || t('helm.operateSuccess')); setIsChartModalVisible(false); chartForm.resetFields(); setFileList([]); refetchHelm(); },
    onError: (err: any) => { message.error(`${t('helm.submitFailed')}: ${err.response?.data?.error || err.message}`); }
  });

  const createChartMutation = useMutation({
    mutationFn: (data: { name: string; namespace?: string, files?: ScaffoldFile[] }) => request.post(`/k8s/${selectedCluster?.id}/chart_create/`, data),
    onSuccess: (res: any) => { message.success(res?.msg || t('helm.chartReleasePublishSuccess')); setIsChartModalVisible(false); chartForm.resetFields(); setScaffoldFiles([]); setActiveFilePath(null); refetchHelm(); },
    onError: (err: any) => { message.error(`${t('helm.createFailed')}: ${err.response?.data?.error || err.message}`); }
  });

  const uninstallMutation = useMutation({
    mutationFn: (record: any) => uninstallHelmChart(selectedCluster?.id!, { name: record.name, namespace: record.namespace }),
    onSuccess: (res: any) => { message.success(res?.msg || t('helm.uninstallSuccess')); refetchHelm(); },
    onError: (err: any) => { message.error(`${t('helm.uninstallFailed')}: ${err.response?.data?.error || err.message}`); }
  });

  const rollbackMutation = useMutation({
    mutationFn: (revision: number) => rollbackHelmChart(selectedCluster?.id!, { name: activeRelease?.name, revision, namespace: activeRelease?.namespace }),
    onSuccess: (res: any) => { message.success(res?.msg || t('helm.rollbackSuccess')); setIsHistoryVisible(false); refetchHelm(); },
    onError: (err: any) => { message.error(`${t('helm.rollbackFailed')}: ${err.response?.data?.error || err.message}`); }
  });

  const restartMutation = useMutation({
    mutationFn: (record: any) => restartHelmChart(selectedCluster?.id!, { name: record.name, namespace: record.namespace }),
    onSuccess: (res: any) => message.success(res?.msg || t('helm.restartSuccess')),
    onError: (err: any) => message.error(`${t('helm.restartFailed')}: ${err.response?.data?.error || err.message}`)
  });

  const stopMutation = useMutation({
    mutationFn: (record: any) => stopHelmChart(selectedCluster?.id!, { name: record.name, namespace: record.namespace }),
    onSuccess: (res: any) => message.success(res?.msg || t('helm.stoppedReplicas')),
    onError: (err: any) => message.error(`${t('helm.stopFailed')}: ${err.response?.data?.error || err.message}`)
  });

  // --- 表格列定义与缩放逻辑 ---
  const initialColumns: any[] = [
    { title: t('helm.releaseName'), dataIndex: 'name', key: 'name', width: 150 },
    { title: t('helm.dimension'), dataIndex: 'namespace', key: 'namespace', width: 120 },
    {
      title: t('helm.replicasPods'), dataIndex: 'replicas_status', key: 'replicas_status', width: 120,
      render: (v: string) => {
          const [ready, total] = (v || '-/-').split('/');
          const color = ready === total && total !== '0' ? 'success' : (total === '0' ? 'default' : 'processing');
          return <Tag color={color}>{v}</Tag>;
      }
    },
    {
      title: t('helm.deployedImage'), dataIndex: 'deployed_images', key: 'deployed_images', width: 220, ellipsis: true,
      render: (images: string[]) => images && images.length > 0
        ? images.map((img, i) => <Tag key={i} color="geekblue" style={{ marginBottom: 2 }}>{img}</Tag>)
        : <Text type="secondary">-</Text>
    },
    { title: t('helm.releaseBatch'), dataIndex: 'revision', key: 'revision', width: 100, render: (v: any) => <Tag color="purple">Rev: {v}</Tag> },
    {
      title: t('helm.status'), dataIndex: 'status', key: 'status', width: 100,
      render: (s: string) => <Tag color={s === 'deployed' ? 'success' : 'warning'}>{s}</Tag>
    },
    { title: t('helm.chart'), dataIndex: 'chart', key: 'chart', width: 150, ellipsis: true },
    { title: t('helm.latestOperationTime'), dataIndex: 'updated', key: 'updated', width: 150, render: (v: string) => <Text className="text-xs" type="secondary">{formatDateTime(v)}</Text> },
    {
      title: t('helm.action'), key: 'action', width: 150,
      render: (_: any, record: any) => {
        const items = [
          hasPermission('helm:chart:helm_history') ? { key: 'history', icon: <HistoryOutlined />, label: t('helm.versionHistoryRollback'), onClick: () => { setActiveRelease(record); setIsHistoryVisible(true); } } : null,
          hasPermission('helm:chart:helm_restart') ? { key: 'restart', icon: <RotateRightOutlined />, label: t('helm.rollingRestart'), onClick: () => restartMutation.mutate(record) } : null,
          hasPermission('helm:chart:helm_stop') ? { key: 'stop', icon: <PauseCircleOutlined />, label: t('helm.stopRunning'), danger: true, onClick: () => appModal.confirm({ title: t('helm.confirmStopDeployment'), content: t('helm.confirmStopDeploymentContent', { name: record.name }), onOk: () => stopMutation.mutate(record)}) } : null,
          hasPermission('helm:chart:helm_uninstall') ? { key: 'uninstall', icon: <DeleteOutlined />, label: t('helm.uninstallApp'), danger: true, onClick: () => appModal.confirm({ title: t('helm.confirmUninstall'), content: t('helm.confirmUninstallContent', { name: record.name }), onOk: () => uninstallMutation.mutate(record)}) } : null,
        ].filter(Boolean) as MenuProps['items'];
        return (
          <Space>
            { hasPermission('helm:chart:helm_upgrade') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => showUpgradeModal(record)}>{t('helm.upgrade')}</Button>
                )}
            { items && items.length > 0 && (
              <Dropdown menu={{ items }} placement="bottomRight"><Button type="text" size="small" icon={<EllipsisOutlined />} /></Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  const [columns, setColumns] = useState(initialColumns);

  const handleResize = (index: number) => (_e: React.SyntheticEvent, { size }: any) => {
    setColumns(prev => {
      const nextColumns = [...prev];
      nextColumns[index] = { ...nextColumns[index], width: size.width };
      return nextColumns;
    });
  };

  const tableColumns = columns.map((col, index) => ({
    ...col,
    onHeaderCell: (column: any) => ({
      width: column.width,
      onResize: handleResize(index),
    }),
  }));

  // --- 提交处理逻辑 ---
  const handleInstallSubmit = (values: any) => {
    if (installMode === 'repo') {
      const payload = { ...values, values: editValuesYaml };
      if (isUpgrade) {
        upgradeChartMutation.mutate(payload);
      } else {
        installChartMutation.mutate(payload);
      }
    } else if (installMode === 'upload') {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('namespace', values.namespace || 'default');
      if (fileList[0]) formData.append('file', fileList[0]);
      if (isUpgrade) {
          formData.append('is_upgrade', 'true');
          if (editValuesYaml) formData.append('values', editValuesYaml);
          if (values.force) formData.append('force', 'true');
      }
      uploadChartMutation.mutate(formData);
    } else if (installMode === 'create') {
      createChartMutation.mutate({ ...values, files: (scaffoldFiles?.length ?? 0) > 0 ? scaffoldFiles : undefined });
    }
  };

  const handleScaffold = async () => {
    const name = chartForm.getFieldValue('name');
    if (!name) { message.warning(t('helm.enterReleaseNameFirst')); return; }
    setIsScaffolding(true);
    try {
      const res = await request.post(`/k8s/${selectedCluster?.id}/chart_scaffold/`, { name });
      const files = Array.isArray(res) ? res : (res as any)?.data || [];
      if (files.length === 0) { message.warning(t('helm.scaffoldGeneratedSuccessNoFiles')); return; }
      setScaffoldFiles(files);
      setActiveFilePath(files[0].path);
      message.success(t('helm.scaffoldGeneratedSuccessEdit'));
    } catch (err: any) { message.error(`${t('helm.generateFailed')}: ${err.response?.data?.error || err.message}`);
    } finally { setIsScaffolding(false); }
  };

  const showUpgradeModal = async (record: any) => {
    setIsUpgrade(true);
    setInstallMode(record.origin_mode || 'upload');
    setIsChartModalVisible(true);
    chartForm.setFieldsValue({
      name: record.name,
      namespace: record.namespace,
      chart: record.origin_mode === 'repo' ? (record.repo_chart_path || record.chart) : '',
    });
    setActiveRelease(record);
    const cId = record.cluster_id || selectedCluster?.id!;
    if (!cId) {
        message.warning(t('helm.cannotDetermineClusterContext'));
        return;
    }

    try {
        const res = await getHelmValues(cId, { name: record.name, namespace: record.namespace });
        setEditValuesYaml((res as any).data?.yaml || (res as any).yaml);
    } catch (e:any) {
      message.error(e.message);
      return;
    }
  };

  const activeFileContent = (scaffoldFiles || []).find(f => f.path === activeFilePath)?.content || '';
  const handleFileContentChange = (content: string) => setScaffoldFiles(prev => prev.map(f => f.path === activeFilePath ? { ...f, content } : f));

  const historyColumns = [
    { title: t('helm.revision'), dataIndex: 'revision', key: 'revision', width: 70 },
    { title: t('helm.updateTime'), dataIndex: 'updated', key: 'updated', width: 180, render: (v: string) => formatDateTime(v) },
    { title: t('helm.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('helm.chartVersion'), dataIndex: 'chart', key: 'chart' },
    { title: t('helm.action'), key: 'actions', render: (_: any, row: any) =>
          hasPermission('helm:chart:helm_rollback') && (
          <Button type="link" size="small" disabled={row.status === 'deployed'} onClick={() => rollbackMutation.mutate(row.revision)}>{t('helm.rollback')}</Button>
          )
    }
  ];

  return (
    <div className="p-6">
      <Card title={<Space><RocketOutlined style={{ color: token.colorPrimary }} /><Title level={4} className="m-0">{t('helm.helmApplicationCenter')}</Title></Space>}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Select
              className="w-64"
              placeholder={t('k8s.selectTargetCluster')}
              onChange={(val) => {
                const clustersArr = Array.isArray(clustersData) ? clustersData : (clustersData as any)?.data || [];
                const cluster = clustersArr.find((c: any) => c.id == val);
                setSelectedCluster(cluster);
                setSelectedNamespace(undefined);
              }}
              value={selectedCluster?.id}
              options={(Array.isArray(clustersData) ? clustersData : (clustersData as any)?.data || []).map((c: any) => ({ label: c.name, value: c.id }))}
            />
            <Select
              className="w-48"
              placeholder={t('k8s.allNamespaces')}
              allowClear
              onChange={(val) => setSelectedNamespace(val)}
              value={selectedNamespace}
              disabled={!selectedCluster}
              options={namespacesData?.map((ns: string) => ({ label: ns, value: ns }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetchHelm()} disabled={!selectedCluster}>{t('helm.refreshList')}</Button>
            <div className="flex-1 text-right">
              { hasPermission('helm:chart:add') && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setIsUpgrade(false); setIsChartModalVisible(true); chartForm.resetFields(); setScaffoldFiles([]); setEditValuesYaml(''); setActiveFilePath(null); }} disabled={!selectedCluster}>{t('helm.publishNewApp')}</Button>
              )}
            </div>
          </div>
          {!selectedCluster ? (
            <div className="text-center py-24 bg-gray-50 dark:bg-black/20 rounded-lg"><Text type="secondary" className="text-lg">{t('helm.switchClusterFirst')}</Text></div>
          ) : (
            <Table
              components={{ header: { cell: ResizableTitle } }}
              columns={tableColumns}
              dataSource={Array.isArray(helmData) ? helmData : (helmData as any)?.data || []}
              rowKey="name"
              loading={helmLoading}
              pagination={{ pageSize: 10 }}
              className="w-full resizable-table"
              scroll={{ x: 'max-content' }}
             
            />
          )}
        </div>
      </Card>

      <Modal
        title={isUpgrade ? t('helm.upgradeHelmApp') : t('helm.publishHelmApp')}
        open={isChartModalVisible}
        onCancel={() => { setIsChartModalVisible(false); chartForm.resetFields(); setInstallMode('upload'); setFileList([]); setIsUpgrade(false); setScaffoldFiles([]); setEditValuesYaml(''); }}
        onOk={() => chartForm.submit()}
        confirmLoading={installChartMutation.isPending || upgradeChartMutation.isPending || uploadChartMutation.isPending || createChartMutation.isPending || isScaffolding}
        okText={isUpgrade ? t('helm.confirmUpgrade') : t('helm.publishNow')}
        width={isUpgrade || scaffoldFiles?.length > 0 ? 1100 : 700}
        style={{ top: 20 }}
        transitionName=""
      >
        <div className="flex flex-col gap-4">
          <div className="mb-2 text-center">
            <Select
                value={installMode}
                onChange={(v: any) => setInstallMode(v)}
                className="w-72"
                options={[
                    { label: t('helm.uploadLocalChart'), value: 'upload' },
                    { label: t('helm.uploadFromRepo'), value: 'repo' },
                    ...(!isUpgrade ? [{ label: t('helm.onlineCreateChart'), value: 'create' }] : [])
                ]}
            />
          </div>
          <div className="flex gap-6">
            <div className={isUpgrade || scaffoldFiles?.length > 0 ? "w-1/3" : "w-full"}>
              <Form form={chartForm} layout="vertical" onFinish={handleInstallSubmit} initialValues={{ namespace: selectedNamespace || 'default' }}>
                <Form.Item name="name" label={t('helm.releaseName')} rules={[{ required: true }]}><Input placeholder={t('helm.releaseNamePlaceholder')} disabled={isUpgrade || (scaffoldFiles?.length ?? 0) > 0} /></Form.Item>
                <Form.Item name="namespace" label={t('k8s.namespace')} rules={[{ required: true }]}>
                  <Select
                    placeholder={t('helm.selectNamespace')}
                    disabled={isUpgrade || (scaffoldFiles?.length ?? 0) > 0}
                    options={namespacesData?.map((ns: string) => ({ label: ns, value: ns }))}
                  />
                </Form.Item>
                {installMode === 'repo' && (
                  <>
                    <Form.Item name="chart" label={t('helm.chartSource')} rules={[{ required: !isUpgrade }]}><Input placeholder={isUpgrade ? t('helm.autoIdentify') : "bitnami/nginx"} /></Form.Item>
                    <Form.Item name="version" label={t('helm.chartVersionOptional')} extra={t('helm.chartVersionExample')}><Input placeholder="latest" /></Form.Item>
                  </>
                )}
                {installMode === 'upload' && (
                  <Form.Item label={t('helm.chartFile')} required={!isUpgrade}>
                    <Upload beforeUpload={(f) => { setFileList([f]); return false; }} fileList={fileList} maxCount={1} accept=".tgz"><Button icon={<CloudUploadOutlined />} block>{isUpgrade ? t('helm.reuploadAndUpdateOptional') : t('helm.selectTgzFile')}</Button></Upload>
                    {isUpgrade && <Text type="secondary" className="text-xs">{t('helm.justChangeConfig')}</Text>}
                  </Form.Item>
                )}
                {!isUpgrade && installMode === 'create' && (scaffoldFiles?.length ?? 0) === 0 && <Button icon={<BuildOutlined />} onClick={handleScaffold} loading={isScaffolding} block>{t('helm.generateScaffold')}</Button>}
                {isUpgrade && <Form.Item name="force" valuePropName="checked"><Checkbox>{t('helm.forceOverwrite')}</Checkbox></Form.Item>}
              </Form>
            </div>
            {(isUpgrade || scaffoldFiles?.length > 0) && (
              <div className="w-2/3 flex flex-col border-l pl-6">
                <div className="mb-2 flex justify-between items-center"><Text strong>{isUpgrade ? t('helm.editValuesYaml') : t('helm.editScaffoldFiles')}</Text>{isUpgrade && <Tag color="blue">{t('helm.realtimeSync')}</Tag>}</div>
                {isUpgrade ? (
                  <TextArea
                    value={editValuesYaml}
                    onChange={(e) => setEditValuesYaml(e.target.value)}
                    className="h-112.5 font-mono text-xs bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-950 dark:border-gray-800 dark:text-green-400 p-4 rounded-lg"
                    placeholder={t('helm.editConfigHere')}
                  />) : (
                    <div className="flex gap-4 h-112.5">
                        <div className="w-40 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded p-2 bg-gray-50 dark:bg-gray-950">
                          <List
                            size="small"
                            dataSource={scaffoldFiles}
                            renderItem={item => (
                              <div
                                onClick={() => setActiveFilePath(item.path)}
                                className={`p-2 cursor-pointer rounded truncate text-[11px] mb-1 transition-colors ${activeFilePath === item.path ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                              >
                                {item.path}
                              </div>
                            )}
                          />
                        </div>
                        <TextArea
                          value={activeFileContent}
                          onChange={(e) => handleFileContentChange(e.target.value)}
                          className="flex-1 font-mono text-xs bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-950 dark:border-gray-800 dark:text-green-400 p-4 rounded-lg"
                        />
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
      <Modal title={t('helm.releaseHistory', { name: activeRelease?.name })} open={isHistoryVisible} onCancel={() => setIsHistoryVisible(false)} footer={null} width={isMobile ? '95vw' : 750} bodyStyle={{ overflowX: 'auto' }}><Table columns={historyColumns} dataSource={Array.isArray(historyData) ? historyData : []} loading={historyLoading} rowKey="revision" pagination={false} /></Modal>
    </div>
  );
};

export default HelmCenter;
