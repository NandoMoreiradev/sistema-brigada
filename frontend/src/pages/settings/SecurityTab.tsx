// frontend/src/pages/settings/SecurityTab.tsx
//
// Aba "Segurança": troca de senha (com indicador de força) e autenticação de dois fatores.
// Endpoints em auth.controller.ts.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, KeyRound, Copy, Eye, EyeOff } from 'lucide-react';
import { Field, Label, Input, ErrorText, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Table';
import { authApi } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';
import { SettingsCard, TabStack, StatusRow, SaveFooter, useReportDirty } from './SettingsParts';

const QrImage = styled.img`
    width: 180px;
    height: 180px;
    align-self: center;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
`;

const RecoveryCodeList = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0.75rem;
    background: ${({ theme }) => theme.colors.lightGray};
    border-radius: ${({ theme }) => theme.radii.sm};
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    font-family: monospace;
    font-size: 0.8125rem;
`;


const PasswordWrap = styled.div`
    position: relative;
    display: flex;

    input {
        flex: 1;
        padding-right: 2.5rem;
    }

    button {
        position: absolute;
        right: 0.4rem;
        top: 50%;
        transform: translateY(-50%);
        display: inline-flex;
        padding: 0.3rem;
        background: none;
        border: none;
        color: ${({ theme }) => theme.colors.textMuted};
        cursor: pointer;
    }
`;

const StrengthBar = styled.div<{ $score: number }>`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;

    span {
        height: 4px;
        border-radius: 2px;
        background: ${({ theme }) => theme.colors.backgroundMedium};
    }

    span:nth-child(-n + ${({ $score }) => $score}) {
        background: ${({ $score }) => ['#e03131', '#e03131', '#f59f00', '#f59f00', '#28a745'][$score]};
    }
`;

const STRENGTH_LABEL = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];

function passwordStrength(value: string): number {
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[A-Za-z]/.test(value) && /[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value) || (/[a-z]/.test(value) && /[A-Z]/.test(value))) score += 1;
    return Math.max(score, 1);
}

function PasswordInput({ id, ...rest }: { id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    const [visible, setVisible] = useState(false);
    return (
        <PasswordWrap>
            <Input id={id} type={visible ? 'text' : 'password'} {...rest} />
            <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </PasswordWrap>
    );
}

// Mesma política de backend/src/auth/dto/is-strong-password.decorator.ts.
const passwordSchema = z
    .object({
        currentPassword: z.string().min(1, 'Informe a senha atual'),
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
type PasswordFormData = z.infer<typeof passwordSchema>;

export function SecurityTab() {
    const { user, fetchUserProfile } = useAuth();

    const passwordForm = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const passwordMutation = useMutation({
        mutationFn: (data: PasswordFormData) => authApi.changePassword(data.currentPassword, data.newPassword),
        onSuccess: () => {
            toast.success('Senha alterada com sucesso.');
            passwordForm.reset();
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível alterar a senha.'),
    });

    // ─── 2FA ───────────────────────────────────────────────────────────────
    const [setupOpen, setSetupOpen] = useState(false);
    const [setupStep, setSetupStep] = useState<'qr' | 'recovery'>('qr');
    const [qrCodeDataURL, setQrCodeDataURL] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [setupCode, setSetupCode] = useState('');
    const [disableOpen, setDisableOpen] = useState(false);
    const [disableCode, setDisableCode] = useState('');

    const generateMutation = useMutation({
        mutationFn: () => authApi.generateTwoFactor(),
        onSuccess: (data) => {
            setQrCodeDataURL(data.qrCodeDataURL);
            setSetupStep('qr');
            setSetupCode('');
            setSetupOpen(true);
        },
        onError: () => toast.error('Não foi possível gerar o QR Code do 2FA.'),
    });

    const turnOnMutation = useMutation({
        mutationFn: (code: string) => authApi.turnOnTwoFactor(code),
        onSuccess: async (data) => {
            setRecoveryCodes(data.recoveryCodes);
            setSetupStep('recovery');
            await fetchUserProfile();
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Código inválido.'),
    });

    const turnOffMutation = useMutation({
        mutationFn: (code: string) => authApi.turnOffTwoFactor(code),
        onSuccess: async () => {
            toast.success('2FA desativado com sucesso.');
            setDisableOpen(false);
            setDisableCode('');
            await fetchUserProfile();
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Código inválido.'),
    });

    const closeSetup = () => {
        setSetupOpen(false);
    };

    const { isDirty: passwordDirty } = passwordForm.formState;
    useReportDirty(passwordDirty);
    const strength = passwordStrength(passwordForm.watch('newPassword'));
    const passwordRegister = (name: keyof PasswordFormData) => passwordForm.register(name);

    return (
        <TabStack>
            <SettingsCard
                icon={<KeyRound size={18} />}
                title="Senha"
                description="Use uma senha que você não usa em outros lugares."
                footer={<SaveFooter form="password-form" label="Alterar senha" isDirty={passwordDirty} isPending={passwordMutation.isPending} />}
            >
                <Form id="password-form" onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="currentPassword">Senha atual</Label>
                        <PasswordInput id="currentPassword" autoComplete="current-password" {...passwordRegister('currentPassword')} />
                        {passwordForm.formState.errors.currentPassword && <ErrorText>{passwordForm.formState.errors.currentPassword.message}</ErrorText>}
                    </Field>
                    <Field>
                        <Label htmlFor="newPassword">Nova senha</Label>
                        <PasswordInput id="newPassword" autoComplete="new-password" {...passwordRegister('newPassword')} />
                        {strength > 0 && (
                            <>
                                <StrengthBar $score={strength}><span /><span /><span /><span /></StrengthBar>
                                <HelpText>Força: {STRENGTH_LABEL[strength]}</HelpText>
                            </>
                        )}
                        {passwordForm.formState.errors.newPassword && <ErrorText>{passwordForm.formState.errors.newPassword.message}</ErrorText>}
                        <HelpText>Mínimo de 8 caracteres, com ao menos uma letra e um número.</HelpText>
                    </Field>
                    <Field>
                        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                        <PasswordInput id="confirmPassword" autoComplete="new-password" {...passwordRegister('confirmPassword')} />
                        {passwordForm.formState.errors.confirmPassword && <ErrorText>{passwordForm.formState.errors.confirmPassword.message}</ErrorText>}
                    </Field>
                </Form>
            </SettingsCard>

            <SettingsCard
                icon={<ShieldCheck size={18} />}
                tone={user?.isTwoFactorEnabled ? 'success' : 'neutral'}
                title="Autenticação de dois fatores"
                description="Exige um código do seu aplicativo autenticador (Google Authenticator, Authy etc.) a cada login, além da senha."
                aside={
                    <Badge $tone={user?.isTwoFactorEnabled ? 'success' : 'neutral'}>
                        {user?.isTwoFactorEnabled ? 'Ativado' : 'Desativado'}
                    </Badge>
                }
            >
                <StatusRow>
                    <HelpText>
                        {user?.isTwoFactorEnabled
                            ? 'Sua conta está protegida com um segundo fator.'
                            : 'Recomendado, principalmente para administradores.'}
                    </HelpText>
                    {user?.isTwoFactorEnabled ? (
                        <Button $variant="danger" onClick={() => setDisableOpen(true)}>Desativar 2FA</Button>
                    ) : (
                        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                            {generateMutation.isPending ? 'Gerando...' : 'Ativar 2FA'}
                        </Button>
                    )}
                </StatusRow>
            </SettingsCard>

            <Modal
                open={setupOpen}
                onOpenChange={(open) => (open ? setSetupOpen(true) : closeSetup())}
                title={setupStep === 'qr' ? 'Ativar autenticação de dois fatores' : '2FA ativado — guarde seus códigos'}
            >
                {setupStep === 'qr' ? (
                    <Form onSubmit={(e) => { e.preventDefault(); turnOnMutation.mutate(setupCode); }}>
                        <HelpText>Escaneie o QR Code com seu aplicativo autenticador e digite o código gerado.</HelpText>
                        {qrCodeDataURL && <QrImage src={qrCodeDataURL} alt="QR Code do 2FA" />}
                        <Field>
                            <Label htmlFor="setupCode">Código de 6 dígitos</Label>
                            <Input
                                id="setupCode"
                                inputMode="numeric"
                                maxLength={6}
                                value={setupCode}
                                onChange={(e) => setSetupCode(e.target.value)}
                            />
                        </Field>
                        <FormActions>
                            <Button type="button" $variant="secondary" onClick={closeSetup}>Cancelar</Button>
                            <Button type="submit" disabled={turnOnMutation.isPending || setupCode.length !== 6}>
                                {turnOnMutation.isPending ? 'Confirmando...' : 'Confirmar e ativar'}
                            </Button>
                        </FormActions>
                    </Form>
                ) : (
                    <>
                        <HelpText>
                            Guarde estes códigos de recuperação em um local seguro — cada um só pode ser usado uma vez
                            pra entrar caso você perca acesso ao aplicativo autenticador. Eles não serão mostrados de novo.
                        </HelpText>
                        <RecoveryCodeList>
                            {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
                        </RecoveryCodeList>
                        <FormActions>
                            <Button
                                type="button"
                                $variant="secondary"
                                onClick={() => navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
                            >
                                <Copy size={16} /> Copiar códigos
                            </Button>
                            <Button type="button" onClick={closeSetup}>Já salvei, fechar</Button>
                        </FormActions>
                    </>
                )}
            </Modal>

            <Modal open={disableOpen} onOpenChange={setDisableOpen} title="Desativar autenticação de dois fatores">
                <Form onSubmit={(e) => { e.preventDefault(); turnOffMutation.mutate(disableCode); }}>
                    <HelpText>Digite um código atual do seu aplicativo autenticador para confirmar.</HelpText>
                    <Field>
                        <Label htmlFor="disableCode">Código de 6 dígitos</Label>
                        <Input
                            id="disableCode"
                            inputMode="numeric"
                            maxLength={6}
                            value={disableCode}
                            onChange={(e) => setDisableCode(e.target.value)}
                        />
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setDisableOpen(false)}>Cancelar</Button>
                        <Button type="submit" $variant="danger" disabled={turnOffMutation.isPending || disableCode.length !== 6}>
                            {turnOffMutation.isPending ? 'Desativando...' : 'Desativar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </TabStack>
    );
}
