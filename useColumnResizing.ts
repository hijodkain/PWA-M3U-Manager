import { useState } from 'react';

const defaultWidths = {
    select: 80,
    order: 80,
    tvgId: 200,
    tvgName: 200,
    tvgLogo: 100,
    groupTitle: 180,
    name: 250,
    url: 300,
};

export const useColumnResizing = (initialWidths = defaultWidths) => {
    const [columnWidths, setColumnWidths] = useState(initialWidths);

    const handleResize = (key: string, newWidth: number) => {
        setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
    };

    return { columnWidths, handleResize };
};
