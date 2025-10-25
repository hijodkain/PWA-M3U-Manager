import { useMemo } from 'react';

export interface SearchMatch<T> {
    item: T;
    score: number;
    matchType: 'exact' | 'partial' | 'fuzzy';
    highlightedName?: string;
}

export interface UseSmartSearchProps {
    channelPrefixes: string[];
    channelSuffixes: string[];
}

/**
 * Hook para búsqueda inteligente con coincidencias parciales y manejo de prefijos/sufijos
 */
export const useSmartSearch = ({ channelPrefixes, channelSuffixes }: UseSmartSearchProps) => {
    
    /**
     * Normaliza un nombre de canal eliminando prefijos y sufijos configurados
     */
    const normalizeChannelName = useMemo(() => (name: string): string => {
        if (!name) return '';
        
        let normalized = name.trim();
        
        // Eliminar prefijos
        for (const prefix of channelPrefixes) {
            if (normalized.toLowerCase().startsWith(prefix.toLowerCase())) {
                normalized = normalized.substring(prefix.length).trim();
                break; // Solo eliminar el primer prefijo encontrado
            }
        }
        
        // Eliminar sufijos
        for (const suffix of channelSuffixes) {
            if (normalized.toLowerCase().endsWith(suffix.toLowerCase())) {
                normalized = normalized.substring(0, normalized.length - suffix.length).trim();
                break; // Solo eliminar el primer sufijo encontrado
            }
        }
        
        return normalized;
    }, [channelPrefixes, channelSuffixes]);

    /**
     * Calcula la similaridad entre dos strings usando distancia de Levenshtein normalizada
     */
    const calculateSimilarity = (str1: string, str2: string): number => {
        if (str1 === str2) return 1;
        
        const len1 = str1.length;
        const len2 = str2.length;
        
        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;
        
        // Matriz para distancia de Levenshtein
        const matrix: number[][] = [];
        
        // Inicializar matriz
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }
        
        // Llenar matriz
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase() ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // Deletion
                    matrix[i][j - 1] + 1,      // Insertion
                    matrix[i - 1][j - 1] + cost // Substitution
                );
            }
        }
        
        const maxLen = Math.max(len1, len2);
        return (maxLen - matrix[len1][len2]) / maxLen;
    };

    /**
     * Busca canales con coincidencias inteligentes
     */
    const searchChannels = <T extends { name: string }>(
        channels: T[],
        searchTerm: string,
        minSimilarity: number = 0.6
    ): SearchMatch<T>[] => {
        if (!searchTerm.trim()) return [];
        
        const normalizedSearchTerm = normalizeChannelName(searchTerm).toLowerCase();
        const matches: SearchMatch<T>[] = [];
        
        for (const channel of channels) {
            const originalName = channel.name.toLowerCase();
            const normalizedName = normalizeChannelName(channel.name).toLowerCase();
            
            let score = 0;
            let matchType: 'exact' | 'partial' | 'fuzzy' = 'fuzzy';
            
            // 1. Coincidencia exacta (original)
            if (originalName === searchTerm.toLowerCase()) {
                score = 1.0;
                matchType = 'exact';
            }
            // 2. Coincidencia exacta (normalizada)
            else if (normalizedName === normalizedSearchTerm) {
                score = 0.95;
                matchType = 'exact';
            }
            // 3. Contiene la búsqueda (original)
            else if (originalName.includes(searchTerm.toLowerCase())) {
                score = 0.9;
                matchType = 'partial';
            }
            // 4. Contiene la búsqueda (normalizada)
            else if (normalizedName.includes(normalizedSearchTerm)) {
                score = 0.85;
                matchType = 'partial';
            }
            // 5. Búsqueda contenida en el nombre (original)
            else if (searchTerm.toLowerCase().length > 3 && originalName.includes(searchTerm.toLowerCase())) {
                score = 0.8;
                matchType = 'partial';
            }
            // 6. Búsqueda contenida en el nombre (normalizada)
            else if (normalizedSearchTerm.length > 3 && normalizedName.includes(normalizedSearchTerm)) {
                score = 0.75;
                matchType = 'partial';
            }
            // 7. Similaridad por palabras
            else {
                const searchWords = normalizedSearchTerm.split(/\s+/).filter(w => w.length > 2);
                const nameWords = normalizedName.split(/\s+/).filter(w => w.length > 2);
                
                if (searchWords.length > 0 && nameWords.length > 0) {
                    let wordMatches = 0;
                    let totalSimilarity = 0;
                    
                    for (const searchWord of searchWords) {
                        let bestWordSimilarity = 0;
                        for (const nameWord of nameWords) {
                            const similarity = calculateSimilarity(searchWord, nameWord);
                            bestWordSimilarity = Math.max(bestWordSimilarity, similarity);
                        }
                        if (bestWordSimilarity >= minSimilarity) {
                            wordMatches++;
                            totalSimilarity += bestWordSimilarity;
                        }
                    }
                    
                    if (wordMatches > 0) {
                        score = (totalSimilarity / searchWords.length) * 0.7;
                        matchType = 'fuzzy';
                    }
                }
                
                // 8. Similaridad global como último recurso
                if (score === 0) {
                    const globalSimilarity = calculateSimilarity(normalizedSearchTerm, normalizedName);
                    if (globalSimilarity >= minSimilarity) {
                        score = globalSimilarity * 0.6;
                        matchType = 'fuzzy';
                    }
                }
            }
            
            if (score > 0) {
                matches.push({
                    item: channel,
                    score,
                    matchType,
                    highlightedName: highlightMatches(channel.name, searchTerm, normalizedSearchTerm)
                });
            }
        }
        
        // Ordenar por score descendente
        return matches.sort((a, b) => b.score - a.score);
    };

    /**
     * Resalta las coincidencias en el nombre del canal
     */
    const highlightMatches = (originalName: string, searchTerm: string, normalizedSearchTerm: string): string => {
        let highlighted = originalName;
        
        // Intentar resaltar la búsqueda original
        const regex1 = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
        if (regex1.test(originalName)) {
            highlighted = originalName.replace(regex1, '<mark>$1</mark>');
        }
        // Si no hay coincidencias, intentar con término normalizado
        else if (normalizedSearchTerm !== searchTerm) {
            const regex2 = new RegExp(`(${escapeRegExp(normalizedSearchTerm)})`, 'gi');
            const normalizedName = normalizeChannelName(originalName);
            if (regex2.test(normalizedName)) {
                // Mapear coincidencias del nombre normalizado al original
                highlighted = originalName.replace(regex2, '<mark>$1</mark>');
            }
        }
        
        return highlighted;
    };

    /**
     * Escapa caracteres especiales de regex
     */
    const escapeRegExp = (string: string): string => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    /**
     * Obtiene sugerencias de búsqueda basadas en canales existentes
     */
    const getSuggestions = <T extends { name: string }>(
        channels: T[],
        searchTerm: string,
        maxSuggestions: number = 5
    ): string[] => {
        if (!searchTerm.trim() || searchTerm.length < 2) return [];
        
        const normalizedSearchTerm = normalizeChannelName(searchTerm).toLowerCase();
        const suggestions = new Set<string>();
        
        for (const channel of channels) {
            const normalizedName = normalizeChannelName(channel.name);
            const words = normalizedName.split(/\s+/).filter(w => w.length > 2);
            
            for (const word of words) {
                if (word.toLowerCase().startsWith(normalizedSearchTerm) && word.length > normalizedSearchTerm.length) {
                    suggestions.add(word);
                    if (suggestions.size >= maxSuggestions) break;
                }
            }
            
            if (suggestions.size >= maxSuggestions) break;
        }
        
        return Array.from(suggestions);
    };

    return {
        normalizeChannelName,
        calculateSimilarity,
        searchChannels,
        getSuggestions,
        highlightMatches
    };
};