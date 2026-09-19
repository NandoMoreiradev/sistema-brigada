// backend/src/common/constants/merge-tags.constant.ts
//
// Catálogo de merge tags disponíveis nos templates de e-mail (ver EmailTemplatesService.
// getAvailableMergeTags e o construtor visual no frontend). Trimado de maskotCrmEdu/
// backend/src/constants/merge-tags.constant.ts para só as tags que os 3 gatilhos deste
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
            { value: '{{course.name}}', label: 'Nome da turma', description: 'Usado no e-mail de vencimento de certificado.' },
        ],
    },
    {
        label: 'Links de acesso',
        tags: [
            {
                value: '{{login_link}}',
                label: 'Link de acesso / definir senha',
                description: 'Usado no e-mail de boas-vindas do administrador de academia.',
            },
            {
                value: '{{password_reset_link}}',
                label: 'Link de redefinição de senha',
                description: 'Usado no e-mail de "esqueci minha senha".',
            },
            {
                value: '{{certificate.link}}',
                label: 'Link do certificado',
                description: 'Usado no e-mail de vencimento de certificado.',
            },
            {
                value: '{{certificate.expiresAt}}',
                label: 'Data de vencimento do certificado',
                description: 'Usado no e-mail de vencimento de certificado.',
            },
        ],
    },
];
