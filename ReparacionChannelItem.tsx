import React, { useRef, useState, useEffect } from 'react';
import { Channel, QualityLevel, ChannelStatus } from './index';
import { Play } from 'lucide-react';

interface ReparacionChannelItemProps {
    channel: Channel;
    onBodyClick?: () => void;
    onSelectClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
    onDragSelect?: () => void;
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
    animateMarqueeWhenSelected?: boolean;
    density?: 'normal' | 'compact' | 'tight';
    compact?: boolean;
    visibleFields?: {
        logo: boolean;
        name: boolean;
        tvgId: boolean;
        tvgName: boolean;
        url: boolean;
        verifyButton: boolean;
        playButton: boolean;
        statusIndicator: boolean;
        selectionCheckbox: boolean;
    };
    className?: string; // Add className prop
}

const MarqueeText: React.FC<{ text: string; className?: string; isSelected?: boolean; animateWhenSelected?: boolean }> = ({ text, className = "", isSelected = false, animateWhenSelected = true }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

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

    const shouldAnimate = isOverflowing && isHovered;
    
    return (
        <div 
            ref={containerRef} 
            className={`relative overflow-hidden whitespace-nowrap ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
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
                <div ref={textRef as any} className={shouldAnimate ? 'inline-flex animate-marquee' : 'truncate'}>
                    <span className={shouldAnimate ? 'pr-8' : ''}>{text}</span>
                    {shouldAnimate && <span>{text}</span>}
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
    onDragSelect,
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
    animateMarqueeWhenSelected = true,
    density,
    compact = false,
    visibleFields,
    className = "", // Destructure className
}) => {
    const resolvedDensity = density ?? (compact ? 'tight' : 'normal');
    const isCompact = resolvedDensity !== 'normal';
    const isTight = resolvedDensity === 'tight';

    const fields = visibleFields ?? {
        logo: true,
        name: true,
        tvgId: true,
        tvgName: true,
        url: true,
        verifyButton: true,
        playButton: true,
        statusIndicator: true,
        selectionCheckbox: true,
    };

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
                return <span className={isCompact ? 'text-green-500 text-[10px]' : 'text-green-500 text-xs'}>✓ OK</span>;
            case 'failed':
                return <span className={isCompact ? 'text-red-500 text-[10px]' : 'text-red-500 text-xs'}>✗ Offline</span>;
            case 'verifying':
                return <span className={isCompact ? 'text-yellow-500 text-[10px] animate-pulse' : 'text-yellow-500 text-xs animate-pulse'}>⟳ Verifying...</span>;
            default:
                return <span className={isCompact ? 'text-gray-500 text-[10px]' : 'text-gray-500 text-xs'}>○ Pending</span>;
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
        const badgeClass = isCompact
            ? `${qualityColors[quality]} px-1 py-0.5 rounded text-[9px] font-bold leading-tight cursor-help`
            : `${qualityColors[quality]} px-1.5 py-0.5 rounded text-[10px] font-bold leading-tight cursor-help`;

        return (
            <div 
                className={badgeClass}
                title={tooltipText}
            >
                {qualityText}
                {resolution && quality !== 'unknown' && <div className={isCompact ? 'text-[7px] opacity-90 leading-tight' : 'text-[8px] opacity-90 leading-tight'}>{resolution}</div>}
            </div>
        );
    };

    return (
        <div
            style={style}
            onClick={onBodyClick}
            className={`group/item flex items-center ${isTight ? 'gap-1.5 p-1.5 min-h-[52px]' : isCompact ? 'gap-2 p-1.5 min-h-[56px]' : 'gap-2 p-2 min-h-[60px]'} rounded-lg border ${
                isSelected ? 'border-blue-500 bg-blue-900/50' : 'border-gray-700/80'
            } cursor-pointer hover:bg-gray-700 hover:border-gray-500 transition-colors relative ${className}`} // Add relative and className
        >
            {fields.logo && (
                <img
                    src={channel.tvgLogo || (isCompact ? 'https://placehold.co/32x32/2d3748/e2e8f0?text=?' : 'https://placehold.co/40x40/2d3748/e2e8f0?text=?')}
                    alt="logo"
                    className={`${isTight ? 'w-7 h-7 rounded' : isCompact ? 'w-8 h-8 rounded' : 'w-10 h-10 rounded-md'} object-contain flex-shrink-0 bg-gray-900`}
                    onError={(e) => {
                        e.currentTarget.src = isCompact ? 'https://placehold.co/32x32/2d3748/e2e8f0?text=Error' : 'https://placehold.co/40x40/2d3748/e2e8f0?text=Error';
                    }}
                />
            )}
            <div className={`${isTight ? 'text-[10px] pr-1' : isCompact ? 'text-[11px] pr-1.5' : 'text-xs pr-2'} overflow-hidden flex-grow min-w-0`}>
                {fields.name && (
                    <MarqueeText 
                        text={channel.name} 
                        className={`font-bold ${isTight ? 'text-[11px]' : isCompact ? 'text-xs' : 'text-sm'} ${nameColor} mb-0.5`} 
                        isSelected={isSelected}
                        animateWhenSelected={animateMarqueeWhenSelected}
                    />
                )}
                
                {!isSencillo && (fields.tvgId || fields.tvgName) && (
                    <div className={`flex ${isTight ? 'gap-1.5 text-[9px]' : isCompact ? 'gap-2 text-[10px]' : 'gap-3 text-[11px]'} mb-0.5`}>
                        {fields.tvgId && (
                            <div className="flex-1 overflow-hidden flex gap-1">
                                 <span className="font-semibold text-gray-300 flex-shrink-0">ID:</span> 
                                 <MarqueeText text={channel.tvgId || '---'} className="text-gray-400" isSelected={isSelected} animateWhenSelected={animateMarqueeWhenSelected} />
                            </div>
                        )}
                        {fields.tvgName && (
                            <div className="flex-1 overflow-hidden flex gap-1">
                                <span className="font-semibold text-gray-300 flex-shrink-0">Name:</span> 
                                <MarqueeText text={channel.tvgName || '---'} className="text-gray-400" isSelected={isSelected} animateWhenSelected={animateMarqueeWhenSelected} />
                            </div>
                        )}
                    </div>
                )}
                {fields.url && (
                    <div className="flex gap-1 overflow-hidden">
                        <span className={`font-semibold text-gray-300 flex-shrink-0 ${isTight ? 'text-[9px]' : isCompact ? 'text-[10px]' : 'text-[11px]'}`}>URL:</span> 
                        <MarqueeText text={getDomainFromUrl(channel.url)} className={isTight ? 'text-gray-400 text-[9px]' : isCompact ? 'text-gray-400 text-[10px]' : 'text-gray-400 text-[11px]'} isSelected={isSelected} animateWhenSelected={animateMarqueeWhenSelected} />
                    </div>
                )}
            </div>
            
            <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'} flex-shrink-0`}>
                {/* Quality Badge */}
                <div className={isTight ? 'w-9 flex justify-center' : isCompact ? 'w-10 flex justify-center' : 'w-12 flex justify-center'}>
                    {qualityBadge()}
                </div>
                
                {/* Status */}
                {fields.statusIndicator && (
                    <div className={isTight ? 'w-12 text-center' : isCompact ? 'w-14 text-center' : 'w-16 text-center'}>
                        {statusIndicator()}
                    </div>
                )}
                
                {/* Play Button */}
                {fields.playButton && onPlayClick && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onPlayClick();
                        }}
                        className={`bg-green-600 hover:bg-green-700 text-white font-bold rounded-full transition-all whitespace-nowrap ${isTight ? 'p-1' : isCompact ? 'p-1.5' : 'p-2'}`}
                        title="Abrir en VLC"
                    >
                        <Play size={isTight ? 12 : isCompact ? 14 : 16} fill="white" />
                    </button>
                )}
                
                {/* Verify Button */}
                {fields.verifyButton && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onVerifyClick) onVerifyClick();
                        }}
                        disabled={verificationStatus === 'verifying'}
                        className={`bg-blue-500 hover:bg-blue-700 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap relative z-10 ${isTight ? 'py-0.5 px-1 text-[8px]' : isCompact ? 'py-0.5 px-1.5 text-[9px]' : 'py-1 px-2 text-[10px]'}`}
                    >
                        {verificationStatus === 'verifying' ? 'Verifying...' : 'Verify'}
                    </button>
                )}
                
                {/* Checkbox */}
                {showCheckbox && fields.selectionCheckbox && (
                    <div 
                        className="flex justify-center items-center p-1 md:p-2 cursor-pointer touch-none"
                        onMouseEnter={() => {
                            if (onDragSelect) onDragSelect();
                        }}
                        onPointerEnter={(e) => {
                            if (e.pointerType === 'mouse' && e.buttons !== 1) return; // Solo arrastre con ratón pulsado
                            if (onDragSelect) onDragSelect();
                        }}
                        onPointerDown={(e) => {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                            // Usaremos solo onPointerDown o onClick, no los dos o causaría toggle duplicado
                            // onClick hace bubbling. Si paramos propagación aquí, mejor lanzarlo aquí y evitar onClick on div.
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectClick) onSelectClick(e as any);
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className={`form-checkbox text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 pointer-events-none ${isTight ? 'h-3 w-3 md:h-3.5 md:w-3.5' : isCompact ? 'h-3.5 w-3.5 md:h-4 md:w-4' : 'h-4 w-4 md:h-5 md:w-5'}`}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReparacionChannelItem;
