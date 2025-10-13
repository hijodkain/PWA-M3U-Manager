import React from 'react';
import { AntdIconProps } from '@ant-design/icons/lib/components/AntdIcon';

interface AntIconProps extends Partial<AntdIconProps> {
    icon: React.ForwardRefExoticComponent<any>;
}

export const AntIcon: React.FC<AntIconProps> = ({ icon: IconComponent, ...props }) => {
    return <IconComponent {...props} />;
};