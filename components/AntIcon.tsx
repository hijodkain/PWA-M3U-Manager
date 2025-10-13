import React from 'react';
import { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';

interface AntIconProps extends Partial<CustomIconComponentProps> {
    icon: React.ForwardRefExoticComponent<any>;
}

export const AntIcon: React.FC<AntIconProps> = ({ icon: IconComponent, ...props }) => {
    return <IconComponent {...props} />;
};