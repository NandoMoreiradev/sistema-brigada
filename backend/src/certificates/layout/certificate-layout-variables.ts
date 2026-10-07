// backend/src/certificates/layout/certificate-layout-variables.ts
//
// Variáveis disponíveis nos textos do certificado e o mini-processador que as
// substitui. Sintaxe igual à dos e-mails (merge-tag.service.ts) para quem já
// conhece: {{aluno.nome}} e {{#if curso.local}}, em {{curso.local}}{{else}}...{{/if}}.
// Nomes em português porque quem escreve os textos é a academia, não um dev.

export interface CertificateVariableDefinition {
    key: string;
    label: string;
    example: string;
}

/** Catálogo exibido no editor (e devolvido em GET /certificate-templates/variables). */
export const CERTIFICATE_VARIABLES: CertificateVariableDefinition[] = [
    { key: 'aluno.nome', label: 'Nome do aluno', example: 'Maria da Silva Santos' },
    { key: 'curso.nome', label: 'Nome do curso (o "Nome no certificado" da turma, ou o nome da turma)', example: 'Formação de Brigada de Incêndio — Nível Intermediário' },
    { key: 'turma.nome', label: 'Nome interno da turma', example: 'Brigadistas Intermediários 11/10' },
    { key: 'curso.categoria', label: 'Categoria da turma', example: 'Brigada de Incêndio' },
    { key: 'curso.cargaHoraria', label: 'Carga horária', example: '20 horas' },
    { key: 'curso.periodo', label: 'Período da turma', example: 'de 06/10/2026 a 10/10/2026' },
    { key: 'curso.inicio', label: 'Data de início', example: '06/10/2026' },
    { key: 'curso.fim', label: 'Data de término', example: '10/10/2026' },
    { key: 'curso.local', label: 'Local da turma', example: 'Sede da academia' },
    { key: 'curso.instrutores', label: 'Instrutores da turma', example: 'Carlos Lima e Ana Souza' },
    { key: 'academia.nome', label: 'Nome da academia', example: 'Academia Exemplo' },
    { key: 'certificado.emissao', label: 'Data de emissão', example: '10/10/2026' },
    { key: 'certificado.emissaoExtenso', label: 'Data de emissão por extenso', example: '10 de outubro de 2026' },
    { key: 'certificado.validade', label: 'Validade (vazio se não vence)', example: '10/10/2027' },
    { key: 'certificado.codigo', label: 'Código de verificação', example: 'AB3K-9X2M-Q7TD' },
    { key: 'certificado.urlValidacao', label: 'Endereço de validação', example: 'app.exemplo.com.br/validar' },
];

export type CertificateVariables = Record<string, string>;

/** Valores de exemplo — pré-visualização sem um certificado de verdade. */
export const SAMPLE_VARIABLES: CertificateVariables = Object.fromEntries(CERTIFICATE_VARIABLES.map((v) => [v.key, v.example]));

const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;
const CONDITIONAL = /\{\{#if\s+([\w.]+)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

/** Substitui variáveis; desconhecida ou vazia vira texto vazio. Condicionais não aninham (não precisam). */
export function renderCertificateText(template: string, variables: CertificateVariables): string {
    return template
        .replace(CONDITIONAL, (_, key: string, whenTrue: string, whenFalse = '') => (variables[key]?.trim() ? whenTrue : whenFalse))
        .replace(VARIABLE, (_, key: string) => variables[key] ?? '');
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "15/03/2026" → "15 de março de 2026" */
export function dateInFull(ddmmyyyy: string): string {
    const [day, month, year] = ddmmyyyy.split('/');
    return `${Number(day)} de ${MONTHS[Number(month) - 1]} de ${year}`;
}

/** ["A"] → "A"; ["A","B"] → "A e B"; ["A","B","C"] → "A, B e C" */
export function joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

export function formatWorkload(hours: number | null | undefined): string {
    if (!hours) return '';
    return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}
