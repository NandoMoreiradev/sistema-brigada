/**
 * Validador de Sintaxe de Merge Tags
 */

export interface ValidationError {
    message: string;
    position: number;
    length: number;
    type: 'error' | 'warning';
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

/**
 * Valida a sintaxe de merge tags em um texto
 */
export function validateMergeTags(text: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (!text) {
        return { isValid: true, errors: [] };
    }

    // 1. Verificar tags não fechadas
    const unclosedTags = findUnclosedTags(text);
    errors.push(...unclosedTags);

    // 2. Verificar condicionais malformadas
    const conditionalErrors = validateConditionals(text);
    errors.push(...conditionalErrors);

    // 3. Verificar sintaxe de transformações
    const transformationErrors = validateTransformations(text);
    errors.push(...transformationErrors);

    return {
        isValid: errors.filter((e) => e.type === 'error').length === 0,
        errors,
    };
}

/**
 * Encontra tags não fechadas
 */
function findUnclosedTags(text: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const openTagRegex = /\{\{/g;
    const closeTagRegex = /\}\}/g;

    let match;
    let openCount = 0;
    let lastOpenPos = -1;

    // Contar aberturas
    while ((match = openTagRegex.exec(text)) !== null) {
        openCount++;
        lastOpenPos = match.index;
    }

    // Contar fechamentos
    let closeCount = 0;
    while ((match = closeTagRegex.exec(text)) !== null) {
        closeCount++;
    }

    if (openCount > closeCount) {
        errors.push({
            message: 'Tag não fechada. Falta "}}"',
            position: lastOpenPos,
            length: 2,
            type: 'error',
        });
    } else if (closeCount > openCount) {
        errors.push({
            message: 'Fechamento de tag sem abertura correspondente',
            position: 0,
            length: text.length,
            type: 'error',
        });
    }

    return errors;
}

/**
 * Valida condicionais {{#if}}...{{/if}}
 */
function validateConditionals(text: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Verificar {{#if}} sem {{/if}}
    const ifRegex = /\{\{#if\s+([^}]+)\}\}/g;
    const endifRegex = /\{\{\/if\}\}/g;

    let match;
    let ifCount = 0;
    let lastIfPos = -1;

    while ((match = ifRegex.exec(text)) !== null) {
        ifCount++;
        lastIfPos = match.index;
    }

    let endifCount = 0;
    while ((match = endifRegex.exec(text)) !== null) {
        endifCount++;
    }

    if (ifCount > endifCount) {
        errors.push({
            message: 'Condicional {{#if}} sem fechamento {{/if}}',
            position: lastIfPos,
            length: 5,
            type: 'error',
        });
    } else if (endifCount > ifCount) {
        errors.push({
            message: 'Fechamento {{/if}} sem abertura {{#if}} correspondente',
            position: 0,
            length: text.length,
            type: 'error',
        });
    }

    // Verificar condições vazias
    const emptyConditionRegex = /\{\{#if\s*\}\}/g;
    while ((match = emptyConditionRegex.exec(text)) !== null) {
        errors.push({
            message: 'Condição vazia. Exemplo correto: {{#if lead.score > 50}}',
            position: match.index,
            length: match[0].length,
            type: 'error',
        });
    }

    return errors;
}

/**
 * Valida transformações (pipes)
 */
function validateTransformations(text: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const mergeTagRegex = /\{\{([^}]+)\}\}/g;

    let match;
    while ((match = mergeTagRegex.exec(text)) !== null) {
        const tag = match[1].trim();

        // Se tem pipe, validar transformações
        if (tag.includes('|')) {
            const parts = tag.split('|').map((s) => s.trim());
            const transformations = parts.slice(1);

            for (const transformation of transformations) {
                // Validar transformação com parâmetro
                if (transformation.includes('(')) {
                    if (!transformation.includes(')')) {
                        errors.push({
                            message: `Transformação malformada: ${transformation}. Falta parêntese de fechamento`,
                            position: match.index,
                            length: match[0].length,
                            type: 'error',
                        });
                    }

                    // Validar aspas em parâmetros
                    const paramMatch = transformation.match(/\(([^)]+)\)/);
                    if (paramMatch) {
                        const param = paramMatch[1];
                        const hasOpenQuote = param.includes("'") || param.includes('"');
                        const quoteCount = (param.match(/['"]/g) || []).length;

                        if (hasOpenQuote && quoteCount % 2 !== 0) {
                            errors.push({
                                message: `Parâmetro com aspas não fechadas: ${transformation}`,
                                position: match.index,
                                length: match[0].length,
                                type: 'error',
                            });
                        }
                    }
                }

                // Validar transformações conhecidas
                const validTransformations = [
                    'uppercase',
                    'lowercase',
                    'capitalize',
                    'currency',
                ];

                const transformationName = transformation.split('(')[0].trim();

                if (
                    !validTransformations.includes(transformationName) &&
                    !transformationName.startsWith('date') &&
                    !transformationName.startsWith('default')
                ) {
                    errors.push({
                        message: `Transformação desconhecida: ${transformationName}`,
                        position: match.index,
                        length: match[0].length,
                        type: 'warning',
                    });
                }
            }
        }
    }

    return errors;
}

/**
 * Extrai todas as merge tags de um texto
 */
export function extractMergeTags(text: string): string[] {
    const tags: string[] = [];
    const mergeTagRegex = /\{\{([^}]+)\}\}/g;

    let match;
    while ((match = mergeTagRegex.exec(text)) !== null) {
        tags.push(match[1].trim());
    }

    return tags;
}

/**
 * Verifica se um texto contém merge tags
 */
export function hasMergeTags(text: string): boolean {
    return /\{\{[^}]+\}\}/.test(text);
}