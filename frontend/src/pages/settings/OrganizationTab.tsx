// frontend/src/pages/settings/OrganizationTab.tsx
//
// Aba "Academia" da central de configurações — visível só pra ORG_ADMIN/
// GROUP_ADMIN (ver Settings.tsx). Autoatendimento sobre a PRÓPRIA academia via
// GET/PATCH /organizations/me (não usa organizationsApi.update(id, ...), que é
// exclusivo de SUPER_ADMIN e opera por :id arbitrário — ver
// OrganizationsController). isMatrix/parentOrganizationId ficam de fora do
// formulário de propósito: são campos de hierarquia definidos pelo SUPER_ADMIN
// no onboarding, não preferência de autoatendimento.

import { useEffect, useState } from 'react';
import { Building2, Globe, Send, Copy, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, Label, Input, ErrorText, CheckboxField, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Table';
import { organizationsApi } from '@/services/organizations';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';

type DomainStatus = 'pending' | 'verified' | 'failed' | 'not_started' | 'partially_verified' | 'partially_failed';

const DOMAIN_STATUS_LABEL: Record<DomainStatus, string> = {
    verified: 'Verificado',
    pending: 'Pendente',
    not_started: 'Não iniciado',
    failed: 'Falhou',
    partially_verified: 'Parcialmente verificado',
    partially_failed: 'Parcialmente falhou',
};

const DOMAIN_STATUS_TONE: Record<DomainStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
    verified: 'success',
    pending: 'warning',
    not_started: 'neutral',
    failed: 'danger',
    partially_verified: 'warning',
    partially_failed: 'danger',
};

// Mesmo catálogo fixo de backend/src/common/constants/public-registration-fields.constant.ts
// (não é form-builder livre — só toggle sobre esses 4 campos).
const PUBLIC_REGISTRATION_FIELDS: { value: string; label: string }[] = [
    { value: 'baptismDate', label: 'Data de batismo' },
    { value: 'pioneerStatus', label: 'Situação de pioneiro' },
    { value: 'signedPetitions', label: 'Petições assinadas' },
    { value: 'profession', label: 'Profissão' },
];

function emailDomain(email: string): string | null {
    const at = email.lastIndexOf('@');
    return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

const Card = styled.div`
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.md};
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    padding: 1.25rem;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const CardTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
`;

const SectionTitle = styled.h4`
    margin: 0.5rem 0 -0.25rem;
    font-size: 0.8125rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textDark};
    border-top: 1px solid #e9ecef;
    padding-top: 1rem;
`;

const DomainList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
`;

const DomainRow = styled.li`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    background: ${({ theme }) => theme.colors.lightGray};
    border-radius: ${({ theme }) => theme.radii.sm};
    font-size: 0.8125rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
`;

const TestEmailRow = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
`;

const LinkRow = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;
`;

const FieldCheckboxGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
`;

const schema = z.object({
    name: z.string().min(1, 'Informe o nome da academia'),
    subdomain: z.string().optional(),
    groupName: z.string().optional(),
    resendApiKey: z.string().optional(),
    emailFromAddress: z.string().email('E-mail inválido').optional().or(z.literal('')),
    emailFromName: z.string().optional(),
    publicRegistrationEnabled: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export function OrganizationTab() {
    const { organization, setOrganization, user } = useAuth();
    const queryClient = useQueryClient();
    const [testEmailTo, setTestEmailTo] = useState('');
    const [selectedRegistrationFields, setSelectedRegistrationFields] = useState<string[]>([]);

    const { data, isLoading } = useQuery({
        queryKey: ['organizations', 'me'],
        queryFn: () => organizationsApi.getMine(),
    });

    // Só leitura — não cria/edita domínio nenhum, só espelha o status de verificação já
    // existente na conta Resend cuja chave foi colada acima (ver OrganizationsController).
    const { data: domainsData, isError: domainsError, error: domainsErrorDetail } = useQuery({
        queryKey: ['organizations', 'me', 'resend-domains'],
        queryFn: () => organizationsApi.getResendDomains(),
        enabled: !!data?.hasCustomResendKey,
        retry: false,
    });

    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: '',
            subdomain: '',
            groupName: '',
            resendApiKey: '',
            emailFromAddress: '',
            emailFromName: '',
            publicRegistrationEnabled: false,
        },
    });

    const publicRegistrationEnabled = watch('publicRegistrationEnabled');
    const registrationLink = data?.publicRegistrationToken
        ? `${window.location.origin}/register/${data.publicRegistrationToken}`
        : null;

    const fromDomain = emailDomain(watch('emailFromAddress') || '');
    const verifiedDomainNames = new Set((domainsData?.domains ?? []).filter((d) => d.status === 'verified').map((d) => d.name));
    const fromDomainIsUnverified = !!data?.hasCustomResendKey && !!fromDomain && domainsData && !verifiedDomainNames.has(fromDomain);

    useEffect(() => {
        if (user?.email) setTestEmailTo((prev) => prev || user.email);
    }, [user?.email]);

    useEffect(() => {
        if (!data) return;
        reset({
            name: data.name,
            subdomain: data.subdomain || '',
            groupName: data.groupName || '',
            resendApiKey: '',
            emailFromAddress: data.emailFromAddress || '',
            emailFromName: data.emailFromName || '',
            publicRegistrationEnabled: data.publicRegistrationEnabled,
        });
        setSelectedRegistrationFields(data.publicRegistrationFields || []);
    }, [data, reset]);

    const saveMutation = useMutation({
        mutationFn: (input: FormData) => organizationsApi.updateMine({
            name: input.name,
            subdomain: input.subdomain || undefined,
            groupName: input.groupName || undefined,
            resendApiKey: input.resendApiKey || undefined,
            emailFromAddress: input.emailFromAddress || undefined,
            emailFromName: input.emailFromName || undefined,
            publicRegistrationEnabled: input.publicRegistrationEnabled,
            publicRegistrationFields: selectedRegistrationFields,
        }),
        onSuccess: (updated) => {
            toast.success('Configurações da academia atualizadas.');
            queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
            // Mantém o nome/logo já visíveis no topbar (UserBadge) em dia sem esperar um F5.
            setOrganization((prev) => (prev ? { ...prev, ...updated } : prev));
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar.'),
    });

    const testEmailMutation = useMutation({
        mutationFn: (to: string) => organizationsApi.sendTestEmail(to),
        onSuccess: (result) => toast.success(result.message),
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível enviar o e-mail de teste.'),
    });

    const regenerateTokenMutation = useMutation({
        mutationFn: () => organizationsApi.regeneratePublicRegistrationToken(),
        onSuccess: (updated) => {
            toast.success('Novo link gerado — o link anterior parou de funcionar.');
            queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
            setOrganization((prev) => (prev ? { ...prev, ...updated } : prev));
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível gerar um novo link.'),
    });

    const toggleRegistrationField = (value: string) => {
        setSelectedRegistrationFields((prev) => (prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]));
    };

    const copyRegistrationLink = async () => {
        if (!registrationLink) return;
        try {
            await navigator.clipboard.writeText(registrationLink);
            toast.success('Link copiado.');
        } catch {
            toast.error('Não foi possível copiar o link.');
        }
    };

    if (isLoading) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle><Building2 size={18} /> {organization?.name || 'Sua academia'}</CardTitle>
                <Badge $tone={data?.isMatrix ? 'info' : 'neutral'}>{data?.isMatrix ? 'Matriz' : 'Unidade'}</Badge>
            </CardHeader>

            <Form onSubmit={handleSubmit((formData) => saveMutation.mutate(formData))}>
                <Field>
                    <Label htmlFor="org-name">Nome</Label>
                    <Input id="org-name" {...register('name')} />
                    {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                </Field>

                <Field>
                    <Label htmlFor="org-subdomain">Subdomínio (opcional)</Label>
                    <Input id="org-subdomain" placeholder="ex: sp-central" {...register('subdomain')} />
                    <HelpText>Usado para identificar a academia em integrações futuras.</HelpText>
                </Field>

                <Field>
                    <Label htmlFor="org-groupName">Nome do grupo (opcional)</Label>
                    <Input id="org-groupName" {...register('groupName')} />
                </Field>

                <SectionTitle>Configurações de e-mail</SectionTitle>
                <Field>
                    <Label htmlFor="org-resendApiKey">Chave Resend própria (opcional)</Label>
                    <Input
                        id="org-resendApiKey"
                        type="password"
                        placeholder={data?.hasCustomResendKey ? 'Configurada — digite para trocar' : 're_...'}
                        {...register('resendApiKey')}
                    />
                    <HelpText>
                        {data?.hasCustomResendKey
                            ? 'Sua academia já tem uma chave Resend própria configurada. Deixe em branco para mantê-la.'
                            : 'Sem chave própria, os e-mails da academia saem pela conta compartilhada da plataforma.'}
                    </HelpText>
                </Field>
                <Field>
                    <Label htmlFor="org-emailFromAddress">E-mail de remetente (opcional)</Label>
                    <Input id="org-emailFromAddress" type="email" placeholder="contato@suaacademia.com.br" {...register('emailFromAddress')} />
                    {errors.emailFromAddress && <ErrorText>{errors.emailFromAddress.message}</ErrorText>}
                </Field>
                <Field>
                    <Label htmlFor="org-emailFromName">Nome de remetente (opcional)</Label>
                    <Input id="org-emailFromName" {...register('emailFromName')} />
                </Field>

                {data?.hasCustomResendKey && (
                    <Field>
                        <Label><Globe size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.3rem' }} />Domínios da sua conta Resend</Label>
                        {domainsError ? (
                            <ErrorText>
                                {(domainsErrorDetail as any)?.response?.data?.message || 'Não foi possível consultar os domínios do Resend.'}
                            </ErrorText>
                        ) : domainsData && domainsData.domains.length > 0 ? (
                            <DomainList>
                                {domainsData.domains.map((domain) => (
                                    <DomainRow key={domain.name}>
                                        {domain.name}
                                        <Badge $tone={DOMAIN_STATUS_TONE[domain.status as DomainStatus] ?? 'neutral'}>
                                            {DOMAIN_STATUS_LABEL[domain.status as DomainStatus] ?? domain.status}
                                        </Badge>
                                    </DomainRow>
                                ))}
                            </DomainList>
                        ) : (
                            <HelpText>Nenhum domínio cadastrado nesta conta Resend ainda — adicione e verifique em resend.com/domains.</HelpText>
                        )}
                        {fromDomainIsUnverified && (
                            <ErrorText>
                                O domínio "{fromDomain}" do e-mail de remetente acima não está verificado nesta conta Resend — o
                                envio vai falhar até você verificá-lo em resend.com/domains.
                            </ErrorText>
                        )}
                        <HelpText>
                            A verificação de domínio (DNS/SPF/DKIM) é feita direto no painel do Resend — aqui só espelhamos o status.
                        </HelpText>
                    </Field>
                )}

                <SectionTitle>Autocadastro público</SectionTitle>
                <Field>
                    <CheckboxField>
                        <input type="checkbox" {...register('publicRegistrationEnabled')} />
                        Permitir que pessoas se cadastrem por um link público
                    </CheckboxField>
                    <HelpText>
                        Quem preencher o formulário fica pendente até alguém com a permissão "Gerenciar Cadastros" aprovar —
                        a aprovação cria a conta e manda o e-mail de acesso automaticamente.
                    </HelpText>
                </Field>

                {publicRegistrationEnabled && (
                    <>
                        <Field>
                            <Label>Campos exibidos no formulário</Label>
                            <FieldCheckboxGroup>
                                {PUBLIC_REGISTRATION_FIELDS.map((field) => (
                                    <CheckboxField key={field.value}>
                                        <input
                                            type="checkbox"
                                            checked={selectedRegistrationFields.includes(field.value)}
                                            onChange={() => toggleRegistrationField(field.value)}
                                        />
                                        {field.label}
                                    </CheckboxField>
                                ))}
                            </FieldCheckboxGroup>
                            <HelpText>Nome, e-mail e telefone são sempre pedidos — estes são os campos extras opcionais.</HelpText>
                        </Field>

                        {registrationLink && (
                            <Field>
                                <Label>Link para compartilhar</Label>
                                <LinkRow>
                                    <Input readOnly value={registrationLink} onFocus={(e) => e.target.select()} />
                                    <Button type="button" $variant="secondary" onClick={copyRegistrationLink}>
                                        <Copy size={16} />
                                    </Button>
                                </LinkRow>
                                <TestEmailRow>
                                    <Button
                                        type="button"
                                        $variant="secondary"
                                        disabled={regenerateTokenMutation.isPending}
                                        onClick={() => {
                                            if (window.confirm('Gerar um novo link vai invalidar o link atual — quem já tiver o link antigo não vai mais conseguir usá-lo. Continuar?')) {
                                                regenerateTokenMutation.mutate();
                                            }
                                        }}
                                    >
                                        <RefreshCw size={16} /> Gerar novo link
                                    </Button>
                                </TestEmailRow>
                            </Field>
                        )}
                    </>
                )}

                <SectionTitle>Testar envio</SectionTitle>
                <Field>
                    <Label htmlFor="org-testEmailTo">Enviar e-mail de teste para</Label>
                    <TestEmailRow>
                        <Input
                            id="org-testEmailTo"
                            type="email"
                            value={testEmailTo}
                            onChange={(e) => setTestEmailTo(e.target.value)}
                            placeholder="voce@email.com"
                        />
                        <Button
                            type="button"
                            $variant="secondary"
                            disabled={testEmailMutation.isPending || !testEmailTo}
                            onClick={() => testEmailMutation.mutate(testEmailTo)}
                        >
                            <Send size={16} /> {testEmailMutation.isPending ? 'Enviando...' : 'Enviar teste'}
                        </Button>
                    </TestEmailRow>
                    <HelpText>Usa a configuração de remetente já salva (salve as alterações acima antes de testar).</HelpText>
                </Field>

                <FormActions>
                    <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                </FormActions>
            </Form>
        </Card>
    );
}
