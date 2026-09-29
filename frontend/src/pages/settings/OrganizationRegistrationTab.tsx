// frontend/src/pages/settings/OrganizationRegistrationTab.tsx
//
// Aba "Academia › Cadastro público": liga/desliga o autocadastro por link, escolhe os campos extras
// do formulário e gerencia o link. Quem se cadastra fica pendente até alguém com a permissão
// "Gerenciar Cadastros" aprovar.

import { useEffect, useState } from 'react';
import { UserPlus, Copy, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import styled from 'styled-components';
import { Field, Label, Input, Form, HelpText } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/pages/course-detail/styles';
import { toast } from '@/utils/toast';
import { KIND_LABEL, KIND_ORDER, KIND_QUERY } from '@/utils/registrationKinds';
import { SettingsCard, TabStack, SaveFooter, CardSkeleton, SwitchRow, SwitchInput, DangerZone, useReportDirty } from './SettingsParts';
import { useMyOrganization } from './useMyOrganization';

// Mesmo catálogo fixo de backend/src/common/constants/public-registration-fields.constant.ts
// (não é form-builder livre — só toggle sobre esses 4 campos).
const PUBLIC_REGISTRATION_FIELDS: { value: string; label: string }[] = [
    { value: 'baptismDate', label: 'Data de batismo' },
    { value: 'pioneerStatus', label: 'Situação de pioneiro' },
    { value: 'signedPetitions', label: 'Petições assinadas' },
    { value: 'profession', label: 'Profissão' },
];

const LinkRow = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;
`;

const KindTag = styled.span`
    flex: none;
    width: 4.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textMedium};
`;

const Chips = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
`;

interface FormData {
    publicRegistrationEnabled: boolean;
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export function OrganizationRegistrationTab() {
    const { data, isLoading, save, regenerateToken } = useMyOrganization();
    const [fields, setFields] = useState<string[]>([]);
    const { register, handleSubmit, reset, watch, formState: { isDirty: switchDirty } } = useForm<FormData>({ defaultValues: { publicRegistrationEnabled: false } });

    useEffect(() => {
        if (!data) return;
        reset({ publicRegistrationEnabled: data.publicRegistrationEnabled });
        setFields(data.publicRegistrationFields || []);
    }, [data, reset]);

    const enabled = watch('publicRegistrationEnabled');
    const isDirty = switchDirty || (!!data && !sameSet(fields, data.publicRegistrationFields || []));
    useReportDirty(isDirty);

    const link = data?.publicRegistrationToken ? `${window.location.origin}/register/${data.publicRegistrationToken}` : null;

    const toggleField = (value: string) => setFields((prev) => (prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]));

    const copyLink = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success('Link copiado.');
        } catch {
            toast.error('Não foi possível copiar o link.');
        }
    };

    if (isLoading) return <TabStack><CardSkeleton /></TabStack>;

    return (
        <TabStack>
            <SettingsCard
                icon={<UserPlus size={18} />}
                title="Autocadastro público"
                description="Permita que pessoas se cadastrem por um link. A aprovação cria a conta e envia o e-mail de acesso automaticamente."
                footer={<SaveFooter form="org-registration-form" isDirty={isDirty} isPending={save.isPending} isSuccess={save.isSuccess} />}
            >
                <Form
                    id="org-registration-form"
                    onSubmit={handleSubmit((input) => save.mutate({ publicRegistrationEnabled: input.publicRegistrationEnabled, publicRegistrationFields: fields }))}
                >
                    <SwitchRow>
                        <span className="text">
                            <strong>Permitir cadastro por link público</strong>
                            <span className="hint">Quem preencher o formulário fica pendente até ser aprovado.</span>
                        </span>
                        <SwitchInput {...register('publicRegistrationEnabled')} />
                    </SwitchRow>

                    {enabled && (
                        <>
                            <Field>
                                <Label>Campos extras no formulário</Label>
                                <Chips>
                                    {PUBLIC_REGISTRATION_FIELDS.map((field) => (
                                        <FilterChip key={field.value} type="button" $active={fields.includes(field.value)} aria-pressed={fields.includes(field.value)} onClick={() => toggleField(field.value)}>
                                            {field.label}
                                        </FilterChip>
                                    ))}
                                </Chips>
                                <HelpText>Nome, e-mail e telefone são sempre pedidos — estes são os campos opcionais.</HelpText>
                            </Field>

                            <Field>
                                <Label>Links para compartilhar</Label>
                                {link ? (
                                    <>
                                        {KIND_ORDER.map((kind) => {
                                            const kindLink = kind === 'STUDENT' ? link : `${link}?tipo=${KIND_QUERY[kind]}`;
                                            return (
                                                <LinkRow key={kind}>
                                                    <KindTag>{KIND_LABEL[kind]}</KindTag>
                                                    <Input readOnly value={kindLink} onFocus={(e) => e.target.select()} />
                                                    <Button type="button" $variant="secondary" onClick={() => copyLink(kindLink)} aria-label={`Copiar link de ${KIND_LABEL[kind]}`}><Copy size={16} /></Button>
                                                </LinkRow>
                                            );
                                        })}
                                        <HelpText>
                                            O tipo do link é só uma sugestão: quem revisa confirma o papel de cada pessoa. Para convidar
                                            alguém já com o papel definido, use "Convidar pessoa" na tela de Cadastros.
                                        </HelpText>
                                    </>
                                ) : (
                                    <HelpText>Os links são gerados quando você salva com o cadastro público ativado.</HelpText>
                                )}
                            </Field>
                        </>
                    )}
                </Form>
            </SettingsCard>

            {data?.publicRegistrationEnabled && link && (
                <DangerZone>
                    <div>
                        <strong>Gerar um novo link</strong>
                        <span>O link atual deixa de funcionar para quem já o recebeu.</span>
                    </div>
                    <Button
                        type="button"
                        $variant="danger"
                        disabled={regenerateToken.isPending}
                        onClick={() => {
                            if (window.confirm('Gerar um novo link vai invalidar o link atual — quem já tiver o link antigo não vai mais conseguir usá-lo. Continuar?')) {
                                regenerateToken.mutate();
                            }
                        }}
                    >
                        <RefreshCw size={16} /> Gerar novo link
                    </Button>
                </DangerZone>
            )}
        </TabStack>
    );
}
