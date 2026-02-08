import React, { useRef, useState, useEffect } from 'react';
import { Channel, QualityLevel, ChannelStatus } from './index';
import { Play } from 'lucide-react';

interface ReparacionChannelItemProps {
    channel: Channel;
    onBodyClick: () => void;
    onSelectClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
    isSelected: boolean;
    isChecked?: boolean;
    hasEpg?: boolean;
    showCheckbox?: boolean;
    verificationStatus?: ChannelStatus;
    quality?: QualityLevel;
    resolution?: string;
    onVerifyClick?: () => void;
    onPlayClick?: () => void;
    style?: React.CSSProperties;
    isSencillo?: boolean;
}

const MarqueeText: React.FC<{ text: string; className?: string; isSelected?: boolean }> = ({ text, className = "", isSelected = false }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const checkOverflow = () => {
            if (containerRef.current && textRef.current) {
                // Check if scrollWidth > clientWidth
                setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
            }
        };

        checkOverflow();
        window.addEventListener('resize', checkOverflow);
        return () => window.removeEventListener('resize', checkOverflow);
    }, [text]);

    // We use data-attributes to styling in CSS
    // Logic: If overflow, on hover OR if selected, animate.
    // We duplicate text to clear gap for smooth marquee
    
    return (
        <div 
            ref={containerRef} 
            className={`relative overflow-hidden whitespace-nowrap ${className}`}
        >
             <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); } 
                }
                .animate-marquee {
                    display: inline-flex;
                    animation: marquee 10s linear infinite;
                }
                /* Pause on start? No, requested scrolling */
             `}</style>
             
            {isOverflowing ? (
                 <div 
                    ref={textRef as any}
                    className={`inline-flex transition-transform ${isSelected ? 'animate-marquee' : 'group-hover/item:animate-marquee'}`}
                 >
                    <span className="pr-8">{text}</span>
                    <span>{text}</span>
                </div>
            ) : (
                <div ref={textRef as any} className="truncate">{text}</div>
            )}
        </div>
    );
};

const ReparacionChannelItem: React.FC<ReparacionChannelItemProps> = ({
    channel,
    onBodyClick,
    onSelectClick,
    isSelected,
    isChecked,
    hasEpg,
    showCheckbox = false,
    verificationStatus = 'pending',
    quality = 'unknown',
    resolution,
    onVerifyClick,
    onPlayClick,
    style,
    isSencillo = false,
}) => {
    const getDomainFromUrl = (url: string) => {
        if (!url) return '---';
        if (typeof window === 'undefined') {
            const parts = url.split('/');
            return parts.length > 2 ? parts[2] : url;
        }
        try {
            return new URL(url).hostname;
        } catch (_) {
            const parts = url.split('/');
            return parts.length > 2 ? parts[2] : url;
        }
    };

    const nameColor = verificationStatus === 'failed' ? 'text-yellow-400' : (hasEpg === false ? 'text-red-400' : 'text-white');

    const statusIndicator = () => {
        switch (verificationStatus) {
            case 'ok':
                return <span className="text-green-500 text-xs">✓ OK</span>;
            case 'failed':
                return <span className="text-red-500 text-xs">✗ Offline</span>;
            case 'verifying':
                return <span className="text-yellow-500 text-xs animate-pulse">⟳ Verifying...</span>;
            default:
                return <span className="text-gray-500 text-xs">○ Pending</span>;
        }
    };

    const qualityBadge = () => {
        if (verificationStatus !== 'ok') return null;
        
        const qualityColors: Record<QualityLevel, string> = {
            '4K': 'bg-purple-600 text-white',
            'FHD': 'bg-blue-600 text-white',
            'HD': 'bg-green-600 text-white',
            'SD': 'bg-yellow-600 text-white',
            'unknown': 'bg-gray-600 text-white',
        };

        const qualityText = quality === 'unknown' ? '?' : quality;
        const tooltipText = quality === 'unknown' 
            ? 'No se pudo detectar la resolución.'
            : `Calidad: ${quality}`;

        return (
            <div 
                className={`${qualityColors[quality]} px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight cursor-help`}
                title={tooltipText}
            >
                {qualityText}
                {resolution && quality !== 'unknown' && <div className="text-[8px] opacity-90 leading-tight">{resolution}</div>}
            </div>
        );
    };

    return (
        <div
            style={style}
            onClick={onBodyClick}
            className={`group/item flex items-center gap-2 p-2 rounded-lg border-2 ${
                isSelected ? 'border-blue-500 bg-blue-900/50' : 'border-transparent'
            } cursor-pointer hover:bg-gray-700 min-h-[60px] transition-colors`}
        >
            <img
                src={channel.tvgLogo || 'https://placehold.co/40x40/2d3748/e2e8f0?text=?'}
                alt="logo"
                className="w-10 h-10 object-contain rounded-md flex-shrink-0 bg-gray-900"
                onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/40x40/2d3748/e2e8f0?text=Error';
                }}
            />
            <div className="text-xs overflow-hidden flex-grow min-w-0 pr-2">
                <MarqueeText 
                    text={channel.name} 
                    className={`font-bold text-sm ${nameColor} mb-0.5`} 
                    isSelected={isSelected} 
                />
                
                {!isSencillo && (
                    <div className="flex gap-3 text-[11px] mb-0.5">
                        <div className="flex-1 overflow-hidden flex gap-1">
                             <span className="font-semibold text-gray-300 flex-shrink-0">ID:</span> 
                             <MarqueeText text={channel.tvgId || '---'} className="text-gray-400" isSelected={isSelected} />
                        </div>
                        <div className="flex-1 overflow-hidden flex gap-1">
                            <span className="font-semibold text-gray-300 flex-shrink-0">Name:</span> 
                            <MarqueeText text={channel.tvgName || '---'} className="text-gray-400" isSelected={isSelected} />
                        </div>
                    </div>
                )}
                <div className="flex gap-1 overflow-hidden">
                    <span className="font-semibold text-gray-300 flex-shrink-0 text-[11px]">URL:</span> 
                    <MarqueeText text={getDomainFromUrl(channel.url)} className="text-gray-400 text-[11px]" isSelected={isSelected} />
                </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
                {/* Quality Badge */}
                <div className="w-12 flex justify-center">
                    {qualityBadge()}
                </div>
                
                {/* Status */}
                <div className="w-16 text-center">
                    {statusIndicator()}
                </div>
                
                {/* Play Button */}
                {onPlayClick && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlayClick();
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold p-2 rounded-full transition-all whitespace-nowrap"
                        title="Abrir en VLC"
                    >
                        <Play size={16} fill="white" />
                    </button>
                )}
                
                {/* Verify Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onVerifyClick) onVerifyClick();
                    }}
                    disabled={verificationStatus === 'verifying'}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-[10px] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                >
                    {verificationStatus === 'verifying' ? 'Verifying...' : 'Verify'}
                </button>
                
                {/* Checkbox */}
                {showCheckbox && (
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectClick) onSelectClick(e as any);
                        }}
                        readOnly
                        className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                )}
            </div>
        </div>
    );
};

export default ReparacionChannelItem;
