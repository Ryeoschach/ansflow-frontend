import { memo } from 'react';
import { NodeProps } from 'reactflow';
import { GithubOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import { useTranslation } from 'react-i18next';
import BaseNode from './BaseNode';

const GitNode = (props: NodeProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isDark = token.colorBgContainer === '#141414';

  return (
    <BaseNode
      {...props}
      title={t('pipelineNode.codePull')}
      icon={<GithubOutlined />}
      defaultColor="#171515"
      defaultBg={isDark ? '#1f1f1f' : '#f6f8fa'}
    />
  );
};

export default memo(GitNode);
