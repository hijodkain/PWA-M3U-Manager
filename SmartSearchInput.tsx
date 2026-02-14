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
}

export const SmartSearchInput: React.FC<SmartSearchInputProps> = ({
    searchTerm,
    onSearchChange,
    isSmartSearchEnabled,
    onToggleSmartSearch,
    placeholder = "Buscar canales...",
    showResults = false,
    resultCount = 0,
    className = ""
}) => {
    return (
        <div className={`space-y-2 ${className}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={placeholder}
                    className="block w-full pl-10 pr-20 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                        onClick={onToggleSmartSearch}
                        className={`p-1 rounded transition-colors ${
                            isSmartSearchEnabled 
                                ? 'text-green-400 hover:text-green-300' 
                                : 'text-gray-400 hover:text-gray-300'
                        }`}
                        title={isSmartSearchEnabled ? 'Búsqueda inteligente activada' : 'Búsqueda exacta activada'}
                    >
                        {isSmartSearchEnabled ? (
                            <ToggleRight className="h-5 w-5" />
                        ) : (
                            <ToggleLeft className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>
            
            {/* Indicador de modo de búsqueda y resultados */}
            <div className="flex items-center justify-between text-xs">
                <div className={`flex items-center gap-1 ${
                    isSmartSearchEnabled ? 'text-green-400' : 'text-gray-400'
                }`}>
                    <Settings className="h-3 w-3" />
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
                <div className="hidden sm:block text-xs text-gray-500 bg-gray-800 p-2 rounded">
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