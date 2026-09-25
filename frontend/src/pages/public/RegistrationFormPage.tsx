// frontend/src/pages/public/RegistrationFormPage.tsx
//
// Rota pública /register/:token — não requer login (ver PUBLIC_ROUTE_PREFIXES em
// utils/publicRouting.ts). Resolve por Organization.publicRegistrationToken no backend
// (backend/src/registrations/registrations-public.controller.ts). Nome/e-mail/telefone
// são sempre pedidos; os demais campos (batismo/pioneiro/petições/profissão) só aparecem
// se a academia habilitou (GET :token devolve `enabledFields`) — mesmos widgets/parsing
// de People.tsx (petições em texto separado por vírgula) pra manter consistência.
// Depois do envio, a solicitação fica pendente até um staff com registrations:manage
// aprovar ou recusar — esta página só mostra uma confirmação estática, sem login/redirect.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { CheckCircle2, ShieldAlert, UserPlus } from 'lucide-react';
import { Field, Label, Input, Select, ErrorText, Form, FormActions, HelpText, FieldRow } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { registrationsPublicApi, type PublicRegistrationForm } from '@/services/registrations';

const Wrapper = styled.div`
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ theme }) => theme.colors.pageBackground};
    padding: 1rem;
`;

const Card = styled.div`
    width: 100%;
    max-width: 480px;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.lg};
    box-shadow: ${({ theme }) => theme.shadows.e2};
    padding: 2rem;
`;

const IconWrap = styled.div<{ $tone: 'ok' | 'error' }>`
    width: 56px;
    height: 56px;
    margin: 0 auto 1rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    background: ${({ $tone, theme }) => ($tone === 'ok' ? theme.colors.success : theme.colors.danger)};
`;

const Centered = styled.div`
    text-align: center;
`;

const OrgName = styled.p`
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0.25rem 0 1.5rem;
    font-size: 0.875rem;
    text-align: center;
`;

const schema = z.object({
    name: z.string().min(1, 'Informe seu nome'),
    email: z.string().email('E-mail inválido'),
    phone: z.string().min(1, 'Informe seu telefone'),
    baptismDate: z.string().optional(),
    pioneerStatus: z.enum(['', 'AUXILIARY', 'REGULAR']).optional(),
    signedPetitions: z.string().optional(),
    profession: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RegistrationFormPage() {
    const { token } = useParams<{ token: string }>();
    const [form, setForm] = useState<PublicRegistrationForm | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { name: '', email: '', phone: '', baptismDate: '', pioneerStatus: '', signedPetitions: '', profession: '' },
    });

    useEffect(() => {
        if (!token) return;
        registrationsPublicApi.getForm(token)
            .then(setForm)
            .catch((err) => setError(err?.response?.data?.message || 'Link de cadastro inválido ou desativado.'))
            .finally(() => setIsLoading(false));
    }, [token]);

    const enabledFields = new Set(form?.enabledFields ?? []);

    const onSubmit = async (data: FormData) => {
        if (!token) return;
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            await registrationsPublicApi.submit(token, {
                name: data.name,
                email: data.email,
                phone: data.phone,
                baptismDate: enabledFields.has('baptismDate') && data.baptismDate ? data.baptismDate : undefined,
                pioneerStatus: enabledFields.has('pioneerStatus') && data.pioneerStatus ? data.pioneerStatus : undefined,
                signedPetitions: enabledFields.has('signedPetitions') && data.signedPetitions
                    ? data.signedPetitions.split(',').map((item) => item.trim()).filter(Boolean)
                    : undefined,
                profession: enabledFields.has('profession') && data.profession ? data.profession : undefined,
            });
            setSubmitted(true);
        } catch (err: any) {
            setSubmitError(err?.response?.data?.message || 'Não foi possível enviar o cadastro. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <Wrapper>
                <Card>Carregando formulário...</Card>
            </Wrapper>
        );
    }

    if (error || !form) {
        return (
            <Wrapper>
                <Card>
                    <IconWrap $tone="error"><ShieldAlert size={28} /></IconWrap>
                    <Centered>
                        <h2>Link inválido</h2>
                        <p>{error}</p>
                    </Centered>
                </Card>
            </Wrapper>
        );
    }

    if (submitted) {
        return (
            <Wrapper>
                <Card>
                    <IconWrap $tone="ok"><CheckCircle2 size={28} /></IconWrap>
                    <Centered>
                        <h2>Cadastro enviado!</h2>
                        <p>Assim que for revisado por {form.organizationName}, você receberá um e-mail com os dados de acesso.</p>
                    </Centered>
                </Card>
            </Wrapper>
        );
    }

    return (
        <Wrapper>
            <Card>
                <IconWrap $tone="ok"><UserPlus size={28} /></IconWrap>
                <Centered>
                    <h2>Cadastro</h2>
                </Centered>
                <OrgName>{form.organizationName}</OrgName>

                <Form onSubmit={handleSubmit(onSubmit)}>
                    <Field>
                        <Label htmlFor="reg-name">Nome completo</Label>
                        <Input id="reg-name" {...register('name')} />
                        {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                    </Field>

                    <Field>
                        <Label htmlFor="reg-email">E-mail</Label>
                        <Input id="reg-email" type="email" {...register('email')} />
                        {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                    </Field>

                    <Field>
                        <Label htmlFor="reg-phone">Telefone</Label>
                        <Input id="reg-phone" {...register('phone')} />
                        {errors.phone && <ErrorText>{errors.phone.message}</ErrorText>}
                    </Field>

                    {(enabledFields.has('baptismDate') || enabledFields.has('pioneerStatus')) && (
                        <FieldRow>
                            {enabledFields.has('baptismDate') && (
                                <Field>
                                    <Label htmlFor="reg-baptismDate">Data de batismo</Label>
                                    <Input id="reg-baptismDate" type="date" {...register('baptismDate')} />
                                </Field>
                            )}
                            {enabledFields.has('pioneerStatus') && (
                                <Field>
                                    <Label htmlFor="reg-pioneerStatus">Pioneiro</Label>
                                    <Select id="reg-pioneerStatus" {...register('pioneerStatus')}>
                                        <option value="">Não é pioneiro</option>
                                        <option value="AUXILIARY">Pioneiro auxiliar</option>
                                        <option value="REGULAR">Pioneiro regular</option>
                                    </Select>
                                </Field>
                            )}
                        </FieldRow>
                    )}

                    {enabledFields.has('profession') && (
                        <Field>
                            <Label htmlFor="reg-profession">Profissão ou área de estudo</Label>
                            <Input id="reg-profession" {...register('profession')} />
                        </Field>
                    )}

                    {enabledFields.has('signedPetitions') && (
                        <Field>
                            <Label htmlFor="reg-signedPetitions">Petições assinadas</Label>
                            <Input id="reg-signedPetitions" placeholder="Ex: Pioneiro regular, Emissário" {...register('signedPetitions')} />
                            <HelpText>Separe múltiplas petições por vírgula. Deixe em branco se não houver petição assinada.</HelpText>
                        </Field>
                    )}

                    {submitError && <ErrorText>{submitError}</ErrorText>}

                    <FormActions>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Enviando...' : 'Enviar cadastro'}
                        </Button>
                    </FormActions>
                </Form>
            </Card>
        </Wrapper>
    );
}
