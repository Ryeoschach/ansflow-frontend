import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Typography } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const { Text } = Typography;

const KanikoNode = (props: NodeProps) => {
  const { t } = useTranslation();
  const { data, isConnectable } = props;

  return (
    <BaseNode
      title={t('pipelineNode.safeSandboxCompilation')}
      icon={<CloudUploadOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#F39C12"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Text strong style={{ fontSize: '11px' }}>{data.label || t('pipelineNode.kanikoTask')}</Text>
        {(data.registry_id || data.image_name) && (
          <div style={{
            background: 'rgba(0,0,0,0.03)',
            padding: '4px 8px',
            borderRadius: '4px',
            marginTop: '4px',
            border: '1px dashed rgba(0,0,0,0.1)'
          }}>
            <Text type="secondary" style={{ fontSize: '10px', display: 'block' }}>
               {t('pipelineNode.target')}: {data.image_name || t('pipelineNode.notConfigured')}
            </Text>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default memo(KanikoNode);
