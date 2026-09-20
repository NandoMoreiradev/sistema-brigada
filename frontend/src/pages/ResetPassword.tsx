// frontend/src/pages/ResetPassword.tsx
//
// Passo 2 do fluxo de redefinição: recebe `?token=` (emitido por
// AuthService.createPasswordResetToken — 1h de validade, ver
// auth.service.ts) e chama POST /auth/reset-password. É a MESMA rota que o
// e-mail de boas-vindas de um ORG_ADMIN recém-criado usa pra definir a
// primeira senha (OrganizationsService.create) — "resetar" e "definir a
// primeira senha" são o mesmo fluxo no backend.

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Form, Field, Label, InputWrapper, InputIcon, Input, ErrorText, SubmitButton, HelpText, AuthLink } from '@/components/auth/AuthFormControls';
import { authApi } from '@/services/auth';
import { toast } from '@/utils/toast';

// Mesma política de backend/src/auth/dto/is-strong-password.decorator.ts.
const schema = z
    .object({
        newPassword: z
            .string()
            .min(8, 'A senha deve ter no mínimo 8 caracteres')
            .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
            .regex(/[0-9]/, 'A senha deve conter ao menos um número'),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'As senhas não coincidem',
        path: ['confirmPassword'],
    });
type FormData = z.infer<typeof schema>;

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    if (!token) {
        return (
            <AuthLayout title="Link inválido" subtitle="Este link de redefinição está incompleto ou expirou">
                <Form>
                    <HelpText>Solicite um novo link de redefinição de senha.</HelpText>
                    <AuthLink to="/forgot-password" style={{ alignSelf: 'center' }}>Solicitar novo link</AuthLink>
                </Form>
            </AuthLayout>
        );
    }

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            await authApi.resetPassword(token, data.newPassword);
            toast.success('Senha redefinida com sucesso. Faça login com a nova senha.');
            navigate('/login', { replace: true });
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Token de redefinição inválido ou expirado.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthLayout title="Nova senha" subtitle="Escolha uma nova senha para sua conta">
            <Form onSubmit={handleSubmit(onSubmit)}>
                <Field>
                    <Label htmlFor="newPassword">Nova senha</Label>
                    <InputWrapper>
                        <InputIcon><Lock size={16} /></InputIcon>
                        <Input id="newPassword" type="password" autoComplete="new-password" placeholder="••••••••" autoFocus {...register('newPassword')} />
                    </InputWrapper>
                    {errors.newPassword && <ErrorText>{errors.newPassword.message}</ErrorText>}
                    <HelpText>Mínimo de 8 caracteres, com ao menos uma letra e um número.</HelpText>
                </Field>
                <Field>
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <InputWrapper>
                        <InputIcon><Lock size={16} /></InputIcon>
                        <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" {...register('confirmPassword')} />
                    </InputWrapper>
                    {errors.confirmPassword && <ErrorText>{errors.confirmPassword.message}</ErrorText>}
                </Field>
                <SubmitButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Redefinir senha'} <ArrowRight size={16} />
                </SubmitButton>
            </Form>
        </AuthLayout>
    );
}
