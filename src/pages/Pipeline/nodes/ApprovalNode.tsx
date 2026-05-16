import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import BaseNode from './BaseNode';

const ApprovalNode = (props: NodeProps) => {
  const { data, isConnectable } = props;
  return (
    <BaseNode
      title="人工审批"
      icon={<UserOutlined style={{ color: '#722ed1' }} />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#722ed1"
      defaultBg="#f9f0ff"
    >
      <div className="text-[10px] text-gray-500 mt-1">
        等待指定人员审核通过
      </div>
      {data.approver_type === 'role' && (
        <Tag color="purple" className="mt-2 text-[9px]">角色: {data.role_name || '未指定'}</Tag>
      )}
    </BaseNode>
  );
};

export default memo(ApprovalNode);
