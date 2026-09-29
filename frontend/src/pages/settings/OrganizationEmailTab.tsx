// frontend/src/pages/settings/OrganizationEmailTab.tsx
//
// Aba "Academia › E-mail": chave Resend, remetente, espelho do status dos domínios e envio de
// teste. A verificação de domínio (DNS/SPF/DKIM) é feita no painel do Resend; aqui só mostramos o
// status. A chave nunca volta do backend, só um booleano dizendo se já existe.

import { useEffect, useState } from 'react';
import { Mail, Globe, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { Field, Label, Input, ErrorText, Form, HelpText } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { organizationsApi } from '@/services/organizations';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@/utils/toast';
import { SettingsCard, TabStack, FormGrid, FullRow, SaveFooter, CardSkeleton, useReportDirty } from './SettingsParts';
import { useMyOrganization } from './useMyOrganization';

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

const STATUS_DOT: Record<'success' | 'warning' | 'danger' | 'neutral', string> = {
    success: '#28a745',
    warning: '#f59f00',
    danger: '#e03131',
    neutral: '#adb5bd',
};

function emailDomain(email: string): string | null {
    const at = email.lastIndexOf('@');
    return at === -1 ? null : email.slice(at + 1).toLowerCase();
}

const DomainList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
`;

const DomainRow = styled.li`
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textDark};

    & + & {
        border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    }

    .dot {
        flex: none;
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .status {
        margin-left: auto;
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const TestRow = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;

    input {
        flex: 1;
        min-width: 200px;
    }
`;

const schema = z.object({
    resendApiKey: z.string().optional(),
    emailFromAddress: z.string().email('E-mail inválido').optional().or(z.literal('')),
    emailFromName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function OrganizationEmailTab() {
    const { user } = useAuth();
    const { data, isLoading, save } = useMyOrganization();
    const [testEmailTo, setTestEmailTo] = useState('');

    const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { resendApiKey: '', emailFromAddress: '', emailFromName: '' },
    });
    useReportDirty(isDirty);

    // Só leitura: espelha o status de verificação já existente na conta Resend cuja chave foi colada.
    const { data: domainsData, isError: domainsError, error: domainsErrorDetail } = useQuery({
        queryKey: ['organizations', 'me', 'resend-domains'],
        queryFn: () => organizationsApi.getResendDomains(),
        enabled: !!data?.hasCustomResendKey,
        retry: false,
    });

    useEffect(() => {
        if (user?.email) setTestEmailTo((prev) => prev || user.email);
    }, [user?.email]);

    useEffect(() => {
        if (data) reset({ resendApiKey: '', emailFromAddress: data.emailFromAddress || '', emailFromName: data.emailFromName || '' });
    }, [data, reset]);

    const testEmailMutation = useMutation({
        mutationFn: (to: string) => organizationsApi.sendTestEmail(to),
        onSuccess: (result) => toast.success(result.message),
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível enviar o e-mail de teste.'),
    });

    const fromDomain = emailDomain(watch('emailFromAddress') || '');
    const verifiedDomainNames = new Set((domainsData?.domains ?? []).filter((d) => d.status === 'verified').map((d) => d.name));
    const fromDomainIsUnverified = !!data?.hasCustomResendKey && !!fromDomain && domainsData && !verifiedDomainNames.has(fromDomain);

    if (isLoading) return <TabStack><CardSkeleton /><CardSkeleton /></TabStack>;

    return (
        <TabStack>
            <SettingsCard
                icon={<Mail size={18} />}
                title="Remetente e chave de envio"
                description="Sem chave própria, os e-mails da academia saem pela conta compartilhada da plataforma."
                footer={<SaveFooter form="org-email-form" isDirty={isDirty} isPending={save.isPending} isSuccess={save.isSuccess} />}
            >
                <Form
                    id="org-email-form"
                    onSubmit={handleSubmit((input) => save.mutate({
                        resendApiKey: input.resendApiKey || undefined,
                        emailFromAddress: input.emailFromAddress || undefined,
                        emailFromName: input.emailFromName || undefined,
                    }))}
                >
                    <FormGrid>
                        <FullRow>
                            <Label htmlFor="org-resendApiKey">Chave Resend própria (opcional)</Label>
                            <Input
                                id="org-resendApiKey"
                                type="password"
                                autoComplete="off"
                                placeholder={data?.hasCustomResendKey ? 'Configurada — digite para trocar' : 're_...'}
                                {...register('resendApiKey')}
                            />
                            <HelpText>
                                {data?.hasCustomResendKey
                                    ? 'Sua academia já tem uma chave própria configurada. Deixe em branco para mantê-la.'
                                    : 'Cole aqui a chave da sua conta Resend para enviar com o seu domínio.'}
                            </HelpText>
                        </FullRow>
                        <Field>
                            <Label htmlFor="org-emailFromAddress">E-mail de remetente (opcional)</Label>
                            <Input id="org-emailFromAddress" type="email" placeholder="contato@suaacademia.com.br" {...register('emailFromAddress')} />
                            {errors.emailFromAddress && <ErrorText>{errors.emailFromAddress.message}</ErrorText>}
                        </Field>
                        <Field>
                            <Label htmlFor="org-emailFromName">Nome de remetente (opcional)</Label>
                            <Input id="org-emailFromName" {...register('emailFromName')} />
                        </Field>
                    </FormGrid>
                    {fromDomainIsUnverified && (
                        <ErrorText>
                            O domínio "{fromDomain}" do remetente não está verificado nesta conta Resend — o envio vai falhar até
                            você verificá-lo em resend.com/domains.
                        </ErrorText>
                    )}
                </Form>
            </SettingsCard>

            {data?.hasCustomResendKey && (
                <SettingsCard
                    icon={<Globe size={18} />}
                    title="Domínios da sua conta Resend"
                    description="A verificação (DNS/SPF/DKIM) é feita direto no painel do Resend — aqui só espelhamos o status."
                >
                    {domainsError ? (
                        <ErrorText>
                            {(domainsErrorDetail as any)?.response?.data?.message || 'Não foi possível consultar os domínios do Resend.'}
                        </ErrorText>
                    ) : domainsData && domainsData.domains.length > 0 ? (
                        <DomainList>
                            {domainsData.domains.map((domain) => {
                                const tone = DOMAIN_STATUS_TONE[domain.status as DomainStatus] ?? 'neutral';
                                return (
                                    <DomainRow key={domain.name}>
                                        <span className="dot" style={{ background: STATUS_DOT[tone] }} />
                                        {domain.name}
                                        <span className="status">{DOMAIN_STATUS_LABEL[domain.status as DomainStatus] ?? domain.status}</span>
                                    </DomainRow>
                                );
                            })}
                        </DomainList>
                    ) : (
                        <HelpText>Nenhum domínio cadastrado nesta conta Resend ainda — adicione e verifique em resend.com/domains.</HelpText>
                    )}
                </SettingsCard>
            )}

            <SettingsCard
                icon={<Send size={18} />}
                title="Testar envio"
                description="Usa a configuração de remetente já salva."
            >
                <Field>
                    <Label htmlFor="org-testEmailTo">Enviar e-mail de teste para</Label>
                    <TestRow>
                        <Input id="org-testEmailTo" type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)} placeholder="voce@email.com" />
                        <Button
                            type="button"
                            $variant="secondary"
                            disabled={testEmailMutation.isPending || !testEmailTo || isDirty}
                            onClick={() => testEmailMutation.mutate(testEmailTo)}
                        >
                            <Send size={16} /> {testEmailMutation.isPending ? 'Enviando...' : 'Enviar teste'}
                        </Button>
                    </TestRow>
                    {isDirty && <HelpText>Salve as alterações acima antes de testar.</HelpText>}
                </Field>
            </SettingsCard>
        </TabStack>
    );
}
