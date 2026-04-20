import React, { memo, ReactNode } from 'react';
import { Handle, Position } from 'reactflow';
import { theme } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, SyncOutlined, MinusCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface BaseNodeProps {
  title: string;
  icon: ReactNode;
  data: any;
  isConnectable: boolean;
  children?: ReactNode;
  defaultColor?: string;
  defaultBg?: string;
  className?: string;
}

const BaseNode: React.FC<BaseNodeProps> = ({
  title,
  icon,
  data,
  isConnectable,
  children,
  defaultColor,
  className = ''
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const isRunning = data.runStatus === 'running';
  const isSuccess = data.runStatus === 'success';
  const isFailed = data.runStatus === 'failed';
  const isSkipped = data.runStatus === 'skipped';

  // 颜色优先级：运行状态 > 品牌色 (defaultColor) > 默认主题色
  let primaryColor = defaultColor || token.colorPrimary;
  let headerBg = primaryColor;
  let textColor = '#ffffff'; // 默认品牌色模式下使用白字
  let shadowColor = 'rgba(0, 0, 0, 0.05)';

  if (isRunning) {
    primaryColor = token.colorWarning;
    headerBg = token.colorWarning;
    textColor = '#ffffff';
    shadowColor = token.colorWarningOutline || 'rgba(250, 173, 20, 0.2)';
  } else if (isSuccess) {
    primaryColor = token.colorSuccess;
    headerBg = token.colorSuccess;
    textColor = '#ffffff';
  } else if (isFailed) {
    primaryColor = token.colorError;
    headerBg = token.colorError;
    textColor = '#ffffff';
  } else if (isSkipped) {
    primaryColor = '#94a3b8';
    headerBg = '#94a3b8';
    textColor = '#ffffff';
  }

  return (
    <div 
      style={{
        backgroundColor: token.colorBgContainer,
        border: `1.5px solid ${primaryColor}`,
        borderRadius: '12px',
        boxShadow: isRunning ? `0 0 20px ${shadowColor}` : '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        width: '210px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden'
      }}
      className={`${isRunning ? 'running-node-bg' : ''} ${className}`}
    >
      {/* 增强层：运行中背景动画 (确保不会被 body 遮挡) */}
      {isRunning && (
          <div className="running-node-bg absolute inset-0 opacity-40 pointer-events-none" />
      )}
      {/* 状态大图标背景 */}
      {isSuccess && (
        <CheckCircleFilled 
          style={{ 
            position: 'absolute', 
            right: '-10px', 
            bottom: '-10px', 
            fontSize: '80px', 
            color: token.colorSuccess, 
            opacity: 0.1,
            pointerEvents: 'none'
          }} 
        />
      )}
      {isFailed && (
        <CloseCircleFilled 
          style={{ 
            position: 'absolute', 
            right: '-10px', 
            bottom: '-10px', 
            fontSize: '80px', 
            color: token.colorError, 
            opacity: 0.1,
            pointerEvents: 'none'
          }} 
        />
      )}
      {isRunning && (
        <SyncOutlined
           spin
           style={{
            position: 'absolute',
            right: '8px',
            top: '8px',
            fontSize: '14px',
            color: token.colorWarning,
            fontWeight: 'bold',
            zIndex: 10
          }}
        />
      )}
      {isSkipped && (
        <MinusCircleFilled
          style={{
            position: 'absolute',
            right: '-10px',
            bottom: '-10px',
            fontSize: '80px',
            color: '#94a3b8',
            opacity: 0.15,
            pointerEvents: 'none'
          }}
        />
      )}

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ zIndex: 20, width: 8, height: 8, background: primaryColor, border: `2px solid #ffffff`, top: '-4px' }}
      />
      
      {/* Header */}
      <div 
        style={{ 
          background: headerBg, 
          padding: '10px 14px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          position: 'relative',
          zIndex: 2,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' // 顶部微弱高光
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', color: textColor, fontSize: '16px' }}>{icon}</div>
        <span style={{ 
            fontSize: '13px', 
            fontWeight: 800, 
            color: textColor,
            letterSpacing: '0.04em',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          {title}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px', position: 'relative', zIndex: 2, borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px' }}>
        {children || (
          <div style={{ 
              fontSize: '11px', 
              color: token.colorTextDescription,
              wordBreak: 'break-all',
              lineHeight: '1.4'
          }}>
            {data?.label || `${t('pipelineNode.notConfigured')}${title}`}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ zIndex: 20, width: 8, height: 8, background: primaryColor, border: `2px solid #ffffff`, bottom: '-4px' }}
      />
    </div>
  );
};

export default memo(BaseNode);
