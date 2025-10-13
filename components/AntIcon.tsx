import React from 'react';
import type { AntdIconProps } from '@ant-design/icons/es/components/AntdIcon';

interface AntIconProps extends Partial<AntdIconProps> {
    icon: React.ForwardRefExoticComponent<any>;
}

export const AntIcon: React.FC<AntIconProps> = ({ icon: IconComponent, ...props }) => {
    return <IconComponent {...props} />;
};