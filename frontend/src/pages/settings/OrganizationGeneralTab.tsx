// frontend/src/pages/settings/OrganizationGeneralTab.tsx
//
// Aba "Academia › Geral": identidade da academia (nome, subdomínio, grupo). Visível só para
// ORG_ADMIN/GROUP_ADMIN (ver Settings.tsx). `isMatrix`/hierarquia ficam de fora de propósito: são
// definidos pelo SUPER_ADMIN no onboarding, não são preferência de autoatendimento.

import { useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Field, Label, Input, ErrorText, Form, HelpText } from '@/components/ui/FormField';
import { Badge } from '@/components/ui/Table';
import { SettingsCard, TabStack, FormGrid, FullRow, SaveFooter, CardSkeleton, useReportDirty } from './SettingsParts';
import { useMyOrganization } from './useMyOrganization';

const schema = z.object({
    name: z.string().min(1, 'Informe o nome da academia'),
    subdomain: z.string().optional(),
    groupName: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function OrganizationGeneralTab() {
    const { data, isLoading, save } = useMyOrganization();
    const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', subdomain: '', groupName: '' },
    });
    useReportDirty(isDirty);

    useEffect(() => {
        if (data) reset({ name: data.name, subdomain: data.subdomain || '', groupName: data.groupName || '' });
    }, [data, reset]);

    if (isLoading) return <TabStack><CardSkeleton /></TabStack>;

    return (
        <TabStack>
            <SettingsCard
                icon={<Building2 size={18} />}
                title="Dados da academia"
                description="Como a academia é identificada no sistema."
                aside={<Badge $tone={data?.isMatrix ? 'info' : 'neutral'}>{data?.isMatrix ? 'Matriz' : 'Unidade'}</Badge>}
                footer={<SaveFooter form="org-general-form" isDirty={isDirty} isPending={save.isPending} isSuccess={save.isSuccess} />}
            >
                <Form
                    id="org-general-form"
                    onSubmit={handleSubmit((input) => save.mutate({
                        name: input.name,
                        subdomain: input.subdomain || undefined,
                        groupName: input.groupName || undefined,
                    }))}
                >
                    <FormGrid>
                        <FullRow>
                            <Label htmlFor="org-name">Nome</Label>
                            <Input id="org-name" {...register('name')} />
                            {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                        </FullRow>
                        <Field>
                            <Label htmlFor="org-subdomain">Subdomínio (opcional)</Label>
                            <Input id="org-subdomain" placeholder="ex: sp-central" {...register('subdomain')} />
                            <HelpText>Usado para identificar a academia em integrações futuras.</HelpText>
                        </Field>
                        <Field>
                            <Label htmlFor="org-groupName">Nome do grupo (opcional)</Label>
                            <Input id="org-groupName" {...register('groupName')} />
                        </Field>
                    </FormGrid>
                </Form>
            </SettingsCard>
        </TabStack>
    );
}
