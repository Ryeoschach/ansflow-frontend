import React from 'react';
import { Icon } from '@iconify/react';
import * as AntdIcons from '@ant-design/icons';

/**
 * 图标映射组件 - Iconify
 * https://icones.js.org
 * 支持：
 * 1. 冒号格式 (Iconify): 如 "tabler:brand-ansible", "bi:home", "mdi:settings"
 * 2. AntD: 如 "UserOutlined", "SettingOutlined"
 */
interface IconMapperProps {
    iconName?: string;
    className?: string;
    size?: string | number;
}

const IconMapper: React.FC<IconMapperProps> = ({ iconName, className, size }) => {
    if (!iconName) return null;

    // 1. 处理 Iconify 格式 (带冒号)
    if (iconName.includes(':')) {
        return (
            <Icon 
                icon={iconName} 
                className={className}
                style={{ 
                    fontSize: size || '1.2em', 
                    verticalAlign: 'middle',
                    display: 'inline-block'
                }} 
            />
        );
    }

    // 2. Ant Design 图标
    const AntdIcon = (AntdIcons as any)[iconName];
    if (AntdIcon) {
        return <AntdIcon className={className} style={{ fontSize: size }} />;
    }

    // 3. 兜底逻辑
    return <AntdIcons.QuestionCircleOutlined className={`${className} opacity-30`} />;
};

export default IconMapper;
