import React from 'react';
import type { IconComponentProps } from '@ant-design/icons/lib/components/Icon';

interface AntIconProps extends Partial<IconComponentProps> {
    icon: React.ForwardRefExoticComponent<any>;
}

export const AntIcon: React.FC<AntIconProps> = ({ icon: IconComponent, ...props }) => {
    return <IconComponent {...props} />;
};