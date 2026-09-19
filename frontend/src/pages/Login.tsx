// frontend/src/pages/Login.tsx
// Formulário de login funcional (email/senha + 2FA), usando o AuthContext
// adaptado do maskotCrmEdu. Estilo minimalista — ainda não é o design final.

import { useState } from 'react';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { toast } from '@/utils/toast';

const schema = z.object({
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().min(1, 'Informe sua senha'),
});

type FormData = z.infer<typeof schema>;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: left;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
`;

const Label = styled.label`
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
`;

const InputWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
`;

const InputIcon = styled.div`
    position: absolute;
    left: 0.85rem;
    display: flex;
    color: #adb5bd;
    pointer-events: none;
`;

const Input = styled.input`
    width: 100%;
    padding: 0.7rem 0.85rem 0.7rem 2.5rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.92);
    font-size: 0.9375rem;
    box-sizing: border-box;
    transition: box-shadow 0.15s ease, border-color 0.15s ease;

    &:focus {
        outline: none;
        border-color: white;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
    }
`;

const ToggleVisibilityButton = styled.button`
    position: absolute;
    right: 0.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #868e96;
    cursor: pointer;
    padding: 0.3rem;
    border-radius: 6px;

    &:hover {
        color: #495057;
        background: rgba(0, 0, 0, 0.06);
    }
`;

const ErrorText = styled.span`
    font-size: 0.75rem;
    color: #FFD8D8;
`;

const SubmitButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    border: none;
    background: white;
    color: #b02a1f;
    font-weight: 700;
    font-size: 0.9375rem;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;

    &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
    }

    &:active:not(:disabled) {
        transform: translateY(0);
    }
`;

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
        <AuthLayout title="Brigada Treinamentos" subtitle="Entre com sua conta">
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
                <SubmitButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Entrando...' : 'Entrar'} <ArrowRight size={16} />
                </SubmitButton>
            </Form>
        </AuthLayout>
    );
}
