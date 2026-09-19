// backend/src/common/merge-tag.service.ts
//
// Portado quase sem alteração de maskotCrmEdu/backend/src/common/services/merge-tag.service.ts
// — é um motor de substituição de texto genérico, sem nada específico de CRM/escola. Só o
// `MergeTagContext` foi trocado pelos campos que os 3 gatilhos de e-mail do sistema-brigada
// usam (ver EmailTriggerType em schema.prisma), no lugar de lead/visit/checkout/subscription.

import { Injectable, Logger } from '@nestjs/common';

export interface MergeTagContext {
    organization?: {
        name?: string | null;
        [key: string]: any;
    };
    user?: {
        name?: string | null;
        email?: string | null;
        [key: string]: any;
    };
    student?: {
        name?: string | null;
        [key: string]: any;
    };
    course?: {
        name?: string | null;
        [key: string]: any;
    };
    certificate?: {
        expiresAt?: string | null;
        link?: string | null;
        [key: string]: any;
    };
    login_link?: string;
    password_reset_link?: string;

    // Assinatura de índice: permite aliases achatados na raiz (ex: organization_name)
    // sem precisar declarar cada um no tipo.
    [key: string]: any;
}

export interface MergeTagOptions {
    dateFormat?: string;
    locale?: string;
    strictMode?: boolean;
}

@Injectable()
export class MergeTagService {
    private readonly logger = new Logger(MergeTagService.name);

    private readonly defaultOptions: MergeTagOptions = {
        dateFormat: 'DD/MM/YYYY',
        locale: 'pt-BR',
        strictMode: false,
    };

    /**
     * Processa um texto substituindo merge tags. Suporta:
     * - Variáveis simples: {{user.name}}
     * - Transformações: {{user.name | uppercase}}
     * - Condicionais: {{#if course.name}}...{{else}}...{{/if}}
     */
    process(text: string, context: MergeTagContext, options?: Partial<MergeTagOptions>): string {
        if (!text) return '';

        const opts = { ...this.defaultOptions, ...options };

        try {
            let processedText = this.processConditionals(text, context);
            processedText = this.processMergeTags(processedText, context, opts);
            return processedText;
        } catch (error: any) {
            this.logger.error(`Erro ao processar merge tags: ${error.message}`, error.stack);
            if (opts.strictMode) throw error;
            return text;
        }
    }

    private processConditionals(text: string, context: MergeTagContext): string {
        const conditionalRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

        return text.replace(conditionalRegex, (match, condition, trueBlock, falseBlock = '') => {
            try {
                return this.evaluateCondition(condition.trim(), context) ? trueBlock : falseBlock;
            } catch {
                this.logger.warn(`Erro ao avaliar condicional: ${condition}`);
                return match;
            }
        });
    }

    private evaluateCondition(condition: string, context: MergeTagContext): boolean {
        const operators = ['>=', '<=', '==', '!=', '>', '<'];

        for (const op of operators) {
            if (condition.includes(op)) {
                const [left, right] = condition.split(op).map((s) => s.trim());
                return this.compareValues(this.resolveValue(left, context), this.parseValue(right), op);
            }
        }

        return !!this.resolveValue(condition, context);
    }

    private compareValues(left: any, right: any, operator: string): boolean {
        switch (operator) {
            case '>':
                return Number(left) > Number(right);
            case '<':
                return Number(left) < Number(right);
            case '>=':
                return Number(left) >= Number(right);
            case '<=':
                return Number(left) <= Number(right);
            case '==':
                return left == right;
            case '!=':
                return left != right;
            default:
                return false;
        }
    }

    private processMergeTags(text: string, context: MergeTagContext, options: MergeTagOptions): string {
        const mergeTagRegex = /\{\{(?!#|\/)([^}]+)\}\}/g;

        return text.replace(mergeTagRegex, (match, tag) => {
            try {
                const cleanTag = tag.trim();
                if (cleanTag.startsWith('#') || cleanTag.startsWith('/')) return match;
                return this.processTag(cleanTag, context, options);
            } catch {
                this.logger.warn(`Erro ao processar tag: ${tag}`);
                return match;
            }
        });
    }

    private processTag(tag: string, context: MergeTagContext, options: MergeTagOptions): string {
        const parts = tag.split('|').map((s) => s.trim());
        const path = parts[0];
        const transformations = parts.slice(1);

        let value = this.resolveValue(path, context);
        for (const transformation of transformations) {
            value = this.applyTransformation(value, transformation, options);
        }

        return value !== null && value !== undefined ? String(value) : '';
    }

    private resolveValue(path: string, context: MergeTagContext): any {
        if (!path) return null;

        let current: any = context;
        for (const key of path.split('.')) {
            if (current === null || current === undefined) return null;
            current = current[key];
        }

        return current;
    }

    private applyTransformation(value: any, transformation: string, options: MergeTagOptions): any {
        const lowerTrans = transformation.toLowerCase();

        if (lowerTrans.startsWith('date')) {
            return this.formatDate(value, this.extractParameter(transformation) || options.dateFormat || 'DD/MM/YYYY');
        }

        if (lowerTrans.startsWith('default')) {
            const defaultVal = this.extractParameter(transformation);
            return value !== null && value !== undefined && value !== '' ? value : defaultVal;
        }

        if (lowerTrans === 'uppercase') return String(value ?? '').toUpperCase();
        if (lowerTrans === 'lowercase') return String(value ?? '').toLowerCase();
        if (lowerTrans === 'capitalize') return this.capitalize(String(value ?? ''));
        if (lowerTrans === 'firstname') return String(value ?? '').split(' ')[0];

        return value;
    }

    private formatDate(value: any, format: string): string {
        if (!value) return '';

        const date = value instanceof Date ? value : new Date(value);
        if (isNaN(date.getTime())) return String(value);

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return format
            .replace('DD', day)
            .replace('MM', month)
            .replace('YYYY', String(year))
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    private capitalize(text: string): string {
        return text
            .toLowerCase()
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private extractParameter(transformation: string): string | null {
        const match = transformation.match(/\(['"](.+)['"]\)/);
        return match ? match[1] : null;
    }

    private parseValue(value: string): any {
        if (!value) return value;

        const cleanValue = value.replace(/^['"]|['"]$/g, '');
        if (cleanValue.toLowerCase() === 'true') return true;
        if (cleanValue.toLowerCase() === 'false') return false;

        const num = Number(cleanValue);
        if (!isNaN(num) && cleanValue.trim() !== '') return num;

        return cleanValue;
    }
}
