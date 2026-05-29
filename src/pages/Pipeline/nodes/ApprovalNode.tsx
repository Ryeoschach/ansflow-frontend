import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const ApprovalNode = (props: NodeProps) => {
  const { data, isConnectable } = props;
  const { t } = useTranslation();

  return (
    <BaseNode
      title={t('pipelineNode.approval')}
      icon={<UserOutlined style={{ color: '#722ed1' }} />}
      data={data}
      isConnectable={isConnectable}
      defaultColor="#722ed1"
      defaultBg="#f9f0ff"
    >
      <div className="text-[10px] text-gray-500 mt-1">
        {t('pipelineNode.waitingApproval')}
      </div>
      {data.approver_type === 'role' && (
        <Tag color="purple" className="mt-2 text-[9px]">
          {t('pipelineNode.role')}: {data.role_name || t('pipelineNode.unassigned')}
        </Tag>
      )}
    </BaseNode>
  );
};

export default memo(ApprovalNode);
