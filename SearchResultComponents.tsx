import React from 'react';
import { Star, Target, Zap } from 'lucide-react';

interface SearchResultItemProps {
    name?: string;
    score?: number;
    matchType?: 'exact' | 'partial' | 'fuzzy';
    isSelected?: boolean;
    onClick?: () => void;
    className?: string;
    children?: React.ReactNode;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({
    name,
    score,
    matchType,
    isSelected = false,
    onClick,
    className = "",
    children
}) => {
    const getScoreColor = (score: number) => {
        if (score >= 0.9) return 'text-green-400';
        if (score >= 0.7) return 'text-yellow-400';
        if (score >= 0.5) return 'text-orange-400';
        return 'text-red-400';
    };

    const getMatchIcon = (matchType: string) => {
        switch (matchType) {
            case 'exact':
                return (
                    <div title="Coincidencia exacta">
                        <Target className="h-3 w-3 text-green-400" />
                    </div>
                );
            case 'partial':
                return (
                    <div title="Coincidencia parcial">
                        <Star className="h-3 w-3 text-yellow-400" />
                    </div>
                );
            case 'fuzzy':
                return (
                    <div title="Coincidencia por similaridad">
                        <Zap className="h-3 w-3 text-blue-400" />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div
            onClick={onClick}
            className={`
                relative p-3 rounded-lg cursor-pointer transition-all duration-200
                ${isSelected 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
                }
                ${className}
            `}
        >
            {/* Contenido principal */}
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    {name && (
                        <div className="font-medium truncate" title={name}>
                            {name}
                        </div>
                    )}
                    {children}
                </div>
                
                {/* Indicadores de búsqueda inteligente */}
                {score !== undefined && matchType && (
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        {getMatchIcon(matchType)}
                        <div className={`text-xs font-mono ${getScoreColor(score)}`}>
                            {Math.round(score * 100)}%
                        </div>
                    </div>
                )}
            </div>
            
            {/* Barra de score visual */}
            {score !== undefined && (
                <div className="mt-2 w-full bg-gray-600 rounded-full h-1">
                    <div 
                        className={`h-1 rounded-full transition-all duration-300 ${
                            score >= 0.9 ? 'bg-green-400' :
                            score >= 0.7 ? 'bg-yellow-400' :
                            score >= 0.5 ? 'bg-orange-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${score * 100}%` }}
                    />
                </div>
            )}
        </div>
    );
};

interface SearchResultsListProps {
    title?: string;
    showScores?: boolean;
    emptyMessage?: string;
    className?: string;
    children: React.ReactNode;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
    title,
    showScores = false,
    emptyMessage = "No se encontraron resultados",
    className = "",
    children
}) => {
    const childrenArray = React.Children.toArray(children);
    
    return (
        <div className={`space-y-2 ${className}`}>
            {title && (
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-300">{title}</h3>
                    {showScores && (
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <Target className="h-3 w-3" /> Exacta
                            <Star className="h-3 w-3" /> Parcial
                            <Zap className="h-3 w-3" /> Similaridad
                        </div>
                    )}
                </div>
            )}
            
            {childrenArray.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    {emptyMessage}
                </div>
            ) : (
                <div className="space-y-1">
                    {children}
                </div>
            )}
        </div>
    );
};