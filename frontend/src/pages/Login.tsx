// frontend/src/pages/Login.tsx
// Formulário de login funcional (email/senha + 2FA), usando o AuthContext
// adaptado do maskotCrmEdu. Estilo minimalista — ainda não é o design final.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';
import {
    Form, Field, Label, InputWrapper, InputIcon, Input, ToggleVisibilityButton, ErrorText,
    SubmitButton, AuthLink, LinkRow,
} from '@/components/auth/AuthFormControls';
import { toast } from '@/utils/toast';

const schema = z.object({
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().min(1, 'Informe sua senha'),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
    const { signIn, verifyTwoFactor, finishSignIn } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [twoFactorPending, setTwoFactorPending] = useState<{ tempToken: string } | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormData) => {
        setIsSubmitting(true);
        try {
            const result = await signIn(data);

            if (result.twoFactorEnabled && result.temp_token) {
                setTwoFactorPending({ tempToken: result.temp_token });
                return;
            }

            if (result.access_token) {
                await finishSignIn(result.access_token);
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'E-mail ou senha inválidos.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmitTwoFactor = async () => {
        if (!twoFactorPending || twoFactorCode.trim().length === 0) return;
        setIsVerifyingTwoFactor(true);
        try {
            const result = await verifyTwoFactor(twoFactorPending.tempToken, twoFactorCode);
            await finishSignIn(result.access_token);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Código inválido ou expirado.');
        } finally {
            setIsVerifyingTwoFactor(false);
        }
    };

    if (twoFactorPending) {
        return (
            <AuthLayout title="Verificação em duas etapas" subtitle="Digite o código do seu aplicativo autenticador ou um código de recuperação">
                <Form onSubmit={(e) => { e.preventDefault(); onSubmitTwoFactor(); }}>
                    <Field>
                        <Label htmlFor="code">Código</Label>
                        <InputWrapper>
                            <InputIcon><KeyRound size={16} /></InputIcon>
                            <Input
                                id="code"
                                maxLength={20}
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value)}
                                placeholder="000000 ou xxxx-xxxx-xxxx"
                                autoFocus
                            />
                        </InputWrapper>
                    </Field>
                    <SubmitButton type="submit" disabled={isVerifyingTwoFactor || twoFactorCode.length === 0}>
                        {isVerifyingTwoFactor ? 'Verificando...' : 'Confirmar'} <ArrowRight size={16} />
                    </SubmitButton>
                </Form>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Pronthea" subtitle="Entre com sua conta">
            <Form onSubmit={handleSubmit(onSubmit)}>
                <Field>
                    <Label htmlFor="email">E-mail</Label>
                    <InputWrapper>
                        <InputIcon><Mail size={16} /></InputIcon>
                        <Input id="email" type="email" autoComplete="email" placeholder="voce@escola.com" {...register('email')} />
                    </InputWrapper>
                    {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                </Field>
                <Field>
                    <Label htmlFor="password">Senha</Label>
                    <InputWrapper>
                        <InputIcon><Lock size={16} /></InputIcon>
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            style={{ paddingRight: '2.5rem' }}
                            {...register('password')}
                        />
                        <ToggleVisibilityButton
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </ToggleVisibilityButton>
                    </InputWrapper>
                    {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
                </Field>
                <LinkRow>
                    <AuthLink to="/forgot-password">Esqueci minha senha</AuthLink>
                </LinkRow>
                <SubmitButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Entrando...' : 'Entrar'} <ArrowRight size={16} />
                </SubmitButton>
            </Form>
        </AuthLayout>
    );
}
