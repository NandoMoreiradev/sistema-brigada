// frontend/src/pages/settings/OrganizationTab.tsx
//
// Aba "Academia" da central de configurações — visível só pra ORG_ADMIN/
// GROUP_ADMIN (ver Settings.tsx). Autoatendimento sobre a PRÓPRIA academia via
// GET/PATCH /organizations/me (não usa organizationsApi.update(id, ...), que é
// exclusivo de SUPER_ADMIN e opera por :id arbitrário — ver
// OrganizationsController). isMatrix/parentOrganizationId ficam de fora do
// formulário de propósito: são campos de hierarquia definidos pelo SUPER_ADMIN
// no onboarding, não preferência de autoatendimento.

import { useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, Label, Input, ErrorText, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Table';
import { organizationsApi } from '@/services/organizations';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';

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

const schema = z.object({
    name: z.string().min(1, 'Informe o nome da academia'),
    subdomain: z.string().optional(),
    groupName: z.string().optional(),
    resendApiKey: z.string().optional(),
    emailFromAddress: z.string().email('E-mail inválido').optional().or(z.literal('')),
    emailFromName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function OrganizationTab() {
    const { organization, setOrganization } = useAuth();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['organizations', 'me'],
        queryFn: () => organizationsApi.getMine(),
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', subdomain: '', groupName: '', resendApiKey: '', emailFromAddress: '', emailFromName: '' },
    });

    useEffect(() => {
        if (!data) return;
        reset({
            name: data.name,
            subdomain: data.subdomain || '',
            groupName: data.groupName || '',
            resendApiKey: '',
            emailFromAddress: data.emailFromAddress || '',
            emailFromName: data.emailFromName || '',
        });
    }, [data, reset]);

    const saveMutation = useMutation({
        mutationFn: (input: FormData) => organizationsApi.updateMine({
            name: input.name,
            subdomain: input.subdomain || undefined,
            groupName: input.groupName || undefined,
            resendApiKey: input.resendApiKey || undefined,
            emailFromAddress: input.emailFromAddress || undefined,
            emailFromName: input.emailFromName || undefined,
        }),
        onSuccess: (updated) => {
            toast.success('Configurações da academia atualizadas.');
            queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
            // Mantém o nome/logo já visíveis no topbar (UserBadge) em dia sem esperar um F5.
            setOrganization((prev) => (prev ? { ...prev, ...updated } : prev));
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar.'),
    });

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

                <FormActions>
                    <Button type="submit" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                </FormActions>
            </Form>
        </Card>
    );
}
