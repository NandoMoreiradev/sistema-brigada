/**
 * Processador de Merge Tags para Preview no Client-Side
 * Simula o comportamento do backend para preview em tempo real
 */

export interface MergeTagContext {
  // --- Variáveis de Sistema/Transacionais (Top Level) ---
  confirmation_link?: string;
  unsubscribe_link?: string;
  
  // --- Objetos de Entidade ---
  lead?: {
    name?: string;
    parentName?: string;
    email?: string;
    phone?: string;
    source?: string;
    status?: string;
    score?: number;
    value?: number;
    createdAt?: string;
    customFields?: Record<string, any>;
  };
  school?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  user?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  student?: {
    name?: string;
    desired_class?: string;
  };
  // Caso existam variáveis agrupadas em 'system'
  system?: {
      date?: string;
  }
}

/**
 * Dados de teste padrão para preview
 */
export const DEFAULT_TEST_DATA: MergeTagContext = {
  // ✅ CORREÇÃO: Adicionados links simulados para o preview funcionar
  confirmation_link: 'https://escola.maskot.edu/confirmar?token=simulacao123',
  unsubscribe_link: 'https://escola.maskot.edu/descadastrar?token=simulacao123',

  lead: {
    name: 'Maria Silva',
    parentName: 'Maria Silva',
    email: 'maria.silva@email.com',
    phone: '(11) 98765-4321',
    source: 'Google',
    status: 'Novo',
    score: 75,
    value: 1500,
    createdAt: new Date().toISOString(),
    customFields: {
      cpf: '123.456.789-00',
      rg: '12.345.678-9',
    },
  },
  school: {
    name: 'Escola Exemplo',
    email: 'contato@escola.com',
    phone: '(11) 1234-5678',
    address: 'Rua Exemplo, 123',
  },
  user: {
    name: 'João Consultor',
    email: 'joao@escola.com',
    phone: '(11) 91234-5678',
  },
  student: {
    name: 'Pedro Silva',
    desired_class: '1º Ano',
  },
  system: {
      date: new Date().toLocaleDateString('pt-BR')
  }
};

/**
 * Processa merge tags em um texto
 */
export function processMergeTags(
  text: string,
  context: MergeTagContext = DEFAULT_TEST_DATA
): string {
  if (!text) return '';

  try {
    // 1. Processar condicionais {{#if}}...{{/if}}
    text = processConditionals(text, context);

    // 2. Processar merge tags simples {{lead.name | uppercase}}
    text = processSimpleTags(text, context);

    return text;
  } catch (error) {
    console.error('Erro ao processar merge tags:', error);
    return text;
  }
}

/**
 * Processa condicionais: {{#if lead.score > 50}}HOT{{else}}COLD{{/if}}
 */
function processConditionals(text: string, context: MergeTagContext): string {
  const conditionalRegex =
    /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

  return text.replace(
    conditionalRegex,
    (match, condition, trueBlock, falseBlock = '') => {
      try {
        const isTrue = evaluateCondition(condition.trim(), context);
        return isTrue ? trueBlock : falseBlock;
      } catch (error) {
        console.warn('Erro ao avaliar condicional:', condition);
        return match;
      }
    }
  );
}

/**
 * Avalia uma condição simples
 */
function evaluateCondition(condition: string, context: MergeTagContext): boolean {
  const operators = ['>=', '<=', '==', '!=', '>', '<'];

  for (const op of operators) {
    if (condition.includes(op)) {
      const [left, right] = condition.split(op).map((s) => s.trim());
      const leftValue = resolveValue(left, context);
      const rightValue = parseValue(right);

      return compareValues(leftValue, rightValue, op);
    }
  }

  // Se não tem operador, apenas verifica se é truthy
  const value = resolveValue(condition, context);
  return !!value;
}

/**
 * Compara dois valores com um operador
 */
function compareValues(left: any, right: any, operator: string): boolean {
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

/**
 * Processa merge tags simples: {{lead.name | uppercase}}
 */
function processSimpleTags(text: string, context: MergeTagContext): string {
  const mergeTagRegex = /\{\{([^}]+)\}\}/g;

  return text.replace(mergeTagRegex, (match, tag) => {
    try {
      return processTag(tag.trim(), context);
    } catch (error) {
      console.warn('Erro ao processar tag:', tag);
      return match;
    }
  });
}

/**
 * Processa uma única tag com transformações
 */
function processTag(tag: string, context: MergeTagContext): string {
  // Separar tag e transformações: "lead.name | uppercase | default('Sem nome')"
  const parts = tag.split('|').map((s) => s.trim());
  const path = parts[0];
  const transformations = parts.slice(1);

  // Resolver valor base
  let value = resolveValue(path, context);

  // Aplicar transformações
  for (const transformation of transformations) {
    value = applyTransformation(value, transformation);
  }

  return String(value ?? '');
}

/**
 * Resolve o valor de um path (ex: "lead.customFields.cpf")
 */
function resolveValue(path: string, context: MergeTagContext): any {
  const keys = path.split('.');
  let current: any = context;

  for (const key of keys) {
    if (current == null) return null;
    current = current[key];
  }

  return current;
}

/**
 * Aplica uma transformação ao valor
 */
function applyTransformation(value: any, transformation: string): any {
  // Detectar tipo de transformação
  if (transformation.startsWith('date(')) {
    return formatDate(value, extractParameter(transformation) || 'DD/MM/YYYY');
  }

  if (transformation.startsWith('default(')) {
    return value ?? extractParameter(transformation);
  }

  if (transformation === 'currency') {
    return formatCurrency(value);
  }

  if (transformation === 'uppercase') {
    return String(value ?? '').toUpperCase();
  }

  if (transformation === 'lowercase') {
    return String(value ?? '').toLowerCase();
  }

  if (transformation === 'capitalize') {
    return capitalize(String(value ?? ''));
  }

  return value;
}

/**
 * Formata uma data
 */
function formatDate(value: any, format: string): string {
  if (!value) return '';

  const date = typeof value === 'string' ? new Date(value) : value;

  if (isNaN(date.getTime())) return String(value);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', String(year))
    .replace('HH', hours)
    .replace('mm', minutes);
}

/**
 * Formata um valor como moeda
 */
function formatCurrency(value: any): string {
  if (value == null) return '';

  const number = Number(value);
  if (isNaN(number)) return String(value);

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(number);
}

/**
 * Capitaliza a primeira letra de cada palavra
 */
function capitalize(text: string): string {
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extrai parâmetro de uma função: default('valor') → 'valor'
 */
function extractParameter(transformation: string): string | null {
  const match = transformation.match(/\(['"](.+)['"]\)/);
  return match ? match[1] : null;
}

/**
 * Parse de valor (número ou string)
 */
function parseValue(value: string): any {
  // Remover aspas se existirem
  value = value.replace(/^['"]|['"]$/g, '');

  // Tentar converter para número
  const num = Number(value);
  if (!isNaN(num)) return num;

  return value;
}