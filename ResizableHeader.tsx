import React from 'react';

interface ResizableHeaderProps {
    children: React.ReactNode;
    width: number;
    onResize: (width: number) => void;
    align?: 'left' | 'center' | 'right';
}

const ResizableHeader: React.FC<ResizableHeaderProps> = ({ children, width, onResize, align = 'center' }) => {
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (moveEvent.clientX - startX);
            if (newWidth > 50) {
                onResize(newWidth);
            }
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const alignmentClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';

    return (
        <th
            scope="col"
            style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
            className={`relative px-2 py-3 ${alignmentClass} text-xs font-medium text-gray-300 uppercase tracking-wider`}
        >
            {children}
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-gray-600/20 hover:bg-blue-500/50 transition-colors"
            />
        </th>
    );
};

export default ResizableHeader;
