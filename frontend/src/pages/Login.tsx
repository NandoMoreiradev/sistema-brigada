// frontend/src/pages/Login.tsx
// Formulário de login funcional (email/senha + 2FA), usando o AuthContext
// adaptado do maskotCrmEdu. Estilo minimalista — ainda não é o design final.

import { useState } from 'react';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
    gap: 0.875rem;
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

const Input = styled.input`
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.9);
    font-size: 0.9375rem;

    &:focus {
        outline: 2px solid rgba(255, 255, 255, 0.6);
    }
`;

const ErrorText = styled.span`
    font-size: 0.75rem;
    color: #FFD8D8;
`;

const SubmitButton = styled.button`
    margin-top: 0.5rem;
    padding: 0.7rem 1rem;
    border-radius: 10px;
    border: none;
    background: white;
    color: #b02a1f;
    font-weight: 700;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: opacity 0.15s ease;

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    &:hover:not(:disabled) {
        opacity: 0.9;
    }
`;

export default function Login() {
    const { signIn, finishSignIn } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [twoFactorPending, setTwoFactorPending] = useState<{ tempToken: string } | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');

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
        // Placeholder: a verificação de 2FA propriamente dita (endpoint que
        // troca temp_token + código pelo access_token) ainda não existe nas
        // páginas — este bootstrap só monta a casca do fluxo.
        toast.info('Verificação de 2FA ainda não implementada nesta tela.');
    };

    if (twoFactorPending) {
        return (
            <AuthLayout title="Verificação em duas etapas" subtitle="Digite o código do seu aplicativo autenticador">
                <Form onSubmit={(e) => { e.preventDefault(); onSubmitTwoFactor(); }}>
                    <Field>
                        <Label htmlFor="code">Código</Label>
                        <Input
                            id="code"
                            inputMode="numeric"
                            maxLength={6}
                            value={twoFactorCode}
                            onChange={(e) => setTwoFactorCode(e.target.value)}
                            placeholder="000000"
                        />
                    </Field>
                    <SubmitButton type="submit">Confirmar</SubmitButton>
                </Form>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Brigada Treinamentos" subtitle="Entre com sua conta">
            <Form onSubmit={handleSubmit(onSubmit)}>
                <Field>
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" autoComplete="email" {...register('email')} />
                    {errors.email && <ErrorText>{errors.email.message}</ErrorText>}
                </Field>
                <Field>
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
                    {errors.password && <ErrorText>{errors.password.message}</ErrorText>}
                </Field>
                <SubmitButton type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Entrando...' : 'Entrar'}
                </SubmitButton>
            </Form>
        </AuthLayout>
    );
}
