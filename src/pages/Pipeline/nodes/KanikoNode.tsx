import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Typography } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

const { Text } = Typography;

const KanikoNode = (props: NodeProps) => {
  const { data, isConnectable } = props; // Destructure isConnectable from props
  
  return (
    <BaseNode 
      title="安全沙箱编译" 
      icon={<CloudUploadOutlined />} // Keeping original icon as SafetyOutlined is not imported
      data={data} 
      isConnectable={isConnectable}
      defaultColor="#F39C12"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Text strong style={{ fontSize: '11px' }}>{data.label || 'Kaniko 任务'}</Text>
        {(data.registry_id || data.image_name) && (
          <div style={{ 
            background: 'rgba(0,0,0,0.03)', 
            padding: '4px 8px', 
            borderRadius: '4px',
            marginTop: '4px',
            border: '1px dashed rgba(0,0,0,0.1)'
          }}>
            <Text type="secondary" style={{ fontSize: '10px', display: 'block' }}>
               目标: {data.image_name || '未指定'}
            </Text>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default memo(KanikoNode);
