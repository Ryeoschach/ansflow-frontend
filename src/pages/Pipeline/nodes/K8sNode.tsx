import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ClusterOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

const K8sNode = ({ data, isConnectable, ...props }: NodeProps) => {
  return (
    <BaseNode
      {...props}
      title="K8s 部署"
      icon={<ClusterOutlined />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#326CE5"
    />
  );
};

export default memo(K8sNode);
