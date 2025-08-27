import React from 'react';

interface ResizableHeaderProps {
    children: React.ReactNode;
    width: number;
    onResize: (width: number) => void;
}

const ResizableHeader: React.FC<ResizableHeaderProps> = ({ children, width, onResize }) => {
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

    return (
        <th
            scope="col"
            style={{ width: `${width}px` }}
            className="relative px-2 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
        >
            {children}
            <div
                onMouseDown={handleMouseDown}
                className="absolute top-0 right-0 h-full w-2 cursor-col-resize bg-gray-600/20 hover:bg-blue-500/50"
            />
        </th>
    );
};

export default ResizableHeader;
