// frontend/src/pages/ForgotPassword.tsx
//
// Passo 1 do fluxo de redefinição de senha: pede o e-mail e aciona
// POST /auth/forgot-password (backend/src/auth/auth.controller.ts). A
// mensagem de sucesso é sempre a mesma exista ou não o e-mail (anti-
// enumeração, ver AuthService.requestPasswordReset) — por isso a tela troca
// pra uma confirmação genérica em vez de indicar se o e-mail foi encontrado.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowRight, ArrowLeft, MailCheck } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Form, Field, Label, InputWrapper, InputIcon, Input, ErrorText, SubmitButton, HelpText, AuthLink } from '@/components/auth/AuthFormControls';
import { authApi } from '@/services/auth';
import { toast } from '@/utils/toast';

const schema = z.object({
    email: z.string().email('Informe um e-mail válido'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPassword() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            await authApi.forgotPassword(data.email);
            setSent(true);
        } catch {
            toast.error('Não foi possível enviar o link de redefinição. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (sent) {
        return (
            <AuthLayout title="Verifique seu e-mail" subtitle="Enviamos um link de redefinição, se o e-mail estiver cadastrado">
                <Form>
                    <MailCheck size={40} color="white" style={{ margin: '0 auto' }} />
                    <HelpText>
                        O link expira em 1 hora. Se não encontrar o e-mail, confira também a caixa de spam.
                    </HelpText>
                    <AuthLink to="/login" style={{ alignSelf: 'center' }}>
                        <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                        Voltar para o login
                    </AuthLink>
                </Form>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Esqueci minha senha" subtitle="Informe seu e-mail para receber o link de redefinição">
            <Form onSubmit={handleSubmit(onSubmit)}>
                <Field>
                    <Label htmlFor="email">E-mail</Label>
                    <InputWrapper>
                        <InputIcon><Mail size={16} /></InputIcon>
                        <Input id="email" type="email" autoComplete="email" placeholder="voce@escola.com" autoFocus {...register('email')} />
                    </InputWrapper>
                    {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                </Field>
                <SubmitButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Enviando...' : 'Enviar link de redefinição'} <ArrowRight size={16} />
                </SubmitButton>
                <AuthLink to="/login" style={{ alignSelf: 'center' }}>Voltar para o login</AuthLink>
            </Form>
        </AuthLayout>
    );
}
