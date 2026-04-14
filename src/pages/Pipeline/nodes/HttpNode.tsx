import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { ApiOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

const HttpNode = (props: NodeProps) => {
  const { data, isConnectable } = props; // Destructure data and isConnectable from props

  return (
    <BaseNode
      {...props} // Keep spreading props to maintain other node properties
      title="HTTP 调用" // Changed title as per Code Edit
      icon={<ApiOutlined />}
      data={data} // Added data prop from NodeProps
      isConnectable={isConnectable} // Added isConnectable prop from NodeProps
      defaultColor="#8E44AD" // Changed defaultColor as per instruction and Code Edit
      defaultBg="#f9f0ff"   // AntD Purple-1
    />
  );
};

export default memo(HttpNode);
