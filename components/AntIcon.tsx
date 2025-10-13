import React from 'react';

interface Props {
    icon: React.ForwardRefExoticComponent<any>;
    className?: string;
    style?: React.CSSProperties;
}

export const AntIcon: React.FC<Props> = ({ icon: IconComponent, ...props }) => {
    return <IconComponent {...props} />;
};