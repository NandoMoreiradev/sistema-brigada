// backend/src/common/constants/merge-tags.constant.ts
//
// Catálogo de merge tags disponíveis nos templates de e-mail (ver EmailTemplatesService.
// getAvailableMergeTags e o construtor visual no frontend). Trimado de maskotCrmEdu/
// backend/src/constants/merge-tags.constant.ts para só as tags que os gatilhos deste
// produto usam — sem lead/visit/checkout/assinatura/pesquisa NPS.

export interface MergeTag {
    value: string;
    label: string;
    description: string;
}

export interface MergeTagGroup {
    label: string;
    tags: MergeTag[];
}

export const MERGE_TAGS: MergeTagGroup[] = [
    {
        label: 'Academia',
        tags: [
            { value: '{{organization.name}}', label: 'Nome da Academia', description: 'O nome da academia.' },
            { value: '{{organization_name}}', label: 'Nome da Academia (alias)', description: 'Alias alternativo para o nome da academia.' },
        ],
    },
    {
        label: 'Destinatário',
        tags: [
            { value: '{{user.name}}', label: 'Nome', description: 'Nome de quem recebe o e-mail.' },
            { value: '{{user_name}}', label: 'Nome (alias)', description: 'Alias alternativo para o nome do destinatário.' },
            { value: '{{user.name | firstname}}', label: 'Primeiro nome', description: 'Só o primeiro nome do destinatário.' },
            { value: '{{user.email}}', label: 'E-mail', description: 'E-mail de quem recebe.' },
        ],
    },
    {
        label: 'Aluno / Turma',
        tags: [
            { value: '{{student.name}}', label: 'Nome do aluno', description: 'Usado no e-mail de vencimento de certificado.' },
            { value: '{{course.name}}', label: 'Nome da turma', description: 'Usado nos e-mails de certificado e de matrícula.' },
            { value: '{{course.startDate}}', label: 'Início da turma', description: 'Data de início da turma. Usado no e-mail de matrícula confirmada.' },
            { value: '{{course.location}}', label: 'Local da turma', description: 'Local da turma. Usado no e-mail de matrícula confirmada.' },
            { value: '{{course.link}}', label: 'Link da turma', description: 'Link para a turma. Usado no e-mail de matrícula confirmada.' },
        ],
    },
    {
        label: 'Evento / Escala',
        tags: [
            { value: '{{event.name}}', label: 'Nome do evento', description: 'Usado no e-mail de nova designação.' },
            { value: '{{event.date}}', label: 'Data e hora do evento', description: 'Usado no e-mail de nova designação.' },
            { value: '{{event.location}}', label: 'Local do evento', description: 'Usado no e-mail de nova designação.' },
            { value: '{{event.link}}', label: 'Link do evento', description: 'Link para confirmar ou recusar a escala. Usado no e-mail de nova designação.' },
            { value: '{{designation.role}}', label: 'Função na escala', description: 'Função atribuída à pessoa. Usado no e-mail de nova designação.' },
        ],
    },
    {
        label: 'Links de acesso',
        tags: [
            {
                value: '{{login_link}}',
                label: 'Link de acesso / definir senha',
                description: 'Link para definir a senha. Usado nos e-mails de boas-vindas e de cadastro aprovado (equivale a {{password_reset_link}}).',
            },
            {
                value: '{{invite_link}}',
                label: 'Link do convite',
                description: 'Usado no e-mail de convite para se cadastrar na academia.',
            },
            {
                value: '{{invite_kind}}',
                label: 'Papel do convite',
                description: 'Aluno, instrutor ou equipe — o papel com que a pessoa foi convidada.',
            },
            {
                value: '{{rejection_reason}}',
                label: 'Motivo da recusa',
                description: 'Motivo informado por quem recusou o cadastro (pode estar vazio).',
            },
            {
                value: '{{password_reset_link}}',
                label: 'Link de redefinição de senha',
                description: 'Usado no e-mail de "esqueci minha senha" e também nos de boas-vindas (equivale a {{login_link}}).',
            },
            {
                value: '{{certificate.link}}',
                label: 'Link do certificado',
                description: 'Usado nos e-mails de certificado emitido e de vencimento de certificado.',
            },
            {
                value: '{{certificate.expiresAt}}',
                label: 'Data de vencimento do certificado',
                description: 'Usado nos e-mails de certificado vencendo e vencido.',
            },
        ],
    },
    {
        label: 'Lembrete de vencimento',
        tags: [
            {
                value: '{{certificate.daysLeft}}',
                label: 'Dias até vencer / desde que venceu',
                description: 'No e-mail de certificado vencendo, quantos dias faltam; no de vencido, há quantos dias venceu.',
            },
            { value: '{{certificate.code}}', label: 'Código do certificado', description: 'Código de verificação impresso no PDF.' },
            {
                value: '{{certificate.verifyLink}}',
                label: 'Link de validação',
                description: 'Página pública que confirma a autenticidade e o status do certificado.',
            },
            {
                value: '{{recycling.courseName}}',
                label: 'Turma de reciclagem sugerida',
                description: 'Próxima turma de reciclagem (pode estar vazio — use {{#if recycling.courseName}}...{{/if}}).',
            },
            { value: '{{recycling.startDate}}', label: 'Início da reciclagem sugerida', description: 'Data de início da turma de reciclagem sugerida.' },
        ],
    },
];
