import React from 'react';
import { Search, Settings, ToggleLeft, ToggleRight } from 'lucide-react';

interface SmartSearchInputProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    isSmartSearchEnabled: boolean;
    onToggleSmartSearch: () => void;
    placeholder?: string;
    showResults?: boolean;
    resultCount?: number;
    className?: string;
    compact?: boolean;
    density?: 'normal' | 'compact' | 'tight';
}

export const SmartSearchInput: React.FC<SmartSearchInputProps> = ({
    searchTerm,
    onSearchChange,
    isSmartSearchEnabled,
    onToggleSmartSearch,
    placeholder = "Buscar canales...",
    showResults = false,
    resultCount = 0,
    className = "",
    compact = false,
    density
}) => {
    const resolvedDensity = density ?? (compact ? 'compact' : 'normal');
    const isCompact = resolvedDensity !== 'normal';
    const isTight = resolvedDensity === 'tight';

    const iconClass = isTight ? 'h-3.5 w-3.5' : isCompact ? 'h-4 w-4' : 'h-5 w-5';
    const inputClass = isCompact
        ? 'block w-full pl-9 pr-16 py-1.5 text-xs border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
        : 'block w-full pl-10 pr-20 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

    return (
        <div className={`${isCompact ? 'space-y-1.5' : 'space-y-2'} ${className}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className={`${iconClass} text-gray-400`} />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={placeholder}
                    className={inputClass}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                        onClick={onToggleSmartSearch}
                        className={`${isCompact ? 'p-0.5' : 'p-1'} rounded transition-colors ${
                            isSmartSearchEnabled 
                                ? 'text-green-400 hover:text-green-300' 
                                : 'text-gray-400 hover:text-gray-300'
                        }`}
                        title={isSmartSearchEnabled ? 'Búsqueda inteligente activada' : 'Búsqueda exacta activada'}
                    >
                        {isSmartSearchEnabled ? (
                            <ToggleRight className={iconClass} />
                        ) : (
                            <ToggleLeft className={iconClass} />
                        )}
                    </button>
                </div>
            </div>
            
            {/* Indicador de modo de búsqueda y resultados */}
            <div className={`flex items-center justify-between ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
                <div className={`flex items-center gap-1 ${
                    isSmartSearchEnabled ? 'text-green-400' : 'text-gray-400'
                }`}>
                    <Settings className={isTight ? 'h-2 w-2' : isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                    <span>
                        {isSmartSearchEnabled ? 'Búsqueda inteligente' : 'Búsqueda exacta'}
                    </span>
                </div>
                
                {showResults && searchTerm && (
                    <div className="text-gray-400">
                        {resultCount} resultado{resultCount !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
            
            {/* Descripción del modo actual */}
            {searchTerm && (
                <div className={`hidden sm:block text-gray-500 bg-gray-800 rounded ${isCompact ? 'text-[10px] p-1.5' : 'text-xs p-2'}`}>
                    {isSmartSearchEnabled ? (
                        <>
                            <strong>Búsqueda inteligente:</strong> Encuentra coincidencias parciales, 
                            ignora prefijos/sufijos (HD, 4K, etc.) y ordena por similaridad.
                        </>
                    ) : (
                        <>
                            <strong>Búsqueda exacta:</strong> Solo muestra canales que contengan 
                            exactamente el texto buscado.
                        </>
                    )}
                </div>
            )}
        </div>
    );
};