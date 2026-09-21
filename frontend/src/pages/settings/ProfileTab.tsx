// frontend/src/pages/settings/ProfileTab.tsx
//
// Aba "Perfil" da central de configurações. Os três blocos abaixo (dados
// pessoais, senha, 2FA) já tinham endpoint pronto no backend (auth.controller.ts)
// mas nenhuma UI em lugar nenhum do frontend — esta tela é só o consumidor que
// faltava, sem nada novo no backend.

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, KeyRound, UserRound, Copy, Camera } from 'lucide-react';
import { Field, Label, Input, ErrorText, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Table';
import { Avatar } from '@/components/ui/Avatar';
import { authApi } from '@/services/auth';
import { mediaApi } from '@/services/media';
import { useAuth } from '@/contexts/AuthContext';
import { tokenManager } from '@/services/tokenManager';
import { toast } from '@/utils/toast';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

const AvatarRow = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

const AvatarActions = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
`;

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

const CardTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const CardDescription = styled.p`
    margin: -0.4rem 0 0;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textMuted};
`;

const Stack = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
`;

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

const profileSchema = z.object({
    name: z.string().min(1, 'Informe seu nome'),
    phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

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

export function ProfileTab() {
    const { user, fetchUserProfile } = useAuth();

    // ─── Dados pessoais ────────────────────────────────────────────────────
    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' },
    });

    const profileMutation = useMutation({
        mutationFn: (data: ProfileFormData) => authApi.updateProfile({ name: data.name, phone: data.phone || undefined }),
        onSuccess: async ({ access_token }) => {
            tokenManager.set(access_token);
            await fetchUserProfile();
            toast.success('Dados atualizados com sucesso.');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar seus dados.'),
    });

    // ─── Foto de perfil ────────────────────────────────────────────────────
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const avatarMutation = useMutation({
        mutationFn: (avatarUrl: string) =>
            authApi.updateProfile({ name: user?.name ?? '', phone: user?.phone ?? undefined, avatarUrl }),
        onSuccess: async ({ access_token }) => {
            tokenManager.set(access_token);
            await fetchUserProfile();
            toast.success('Foto de perfil atualizada.');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar a foto.'),
    });

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
        if (!file) return;

        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            toast.error('Formato inválido. Envie uma imagem JPG, PNG, WEBP ou GIF.');
            return;
        }
        if (file.size > MAX_AVATAR_SIZE) {
            toast.error('A imagem deve ter no máximo 5MB.');
            return;
        }

        setIsUploadingAvatar(true);
        try {
            const { fileUrl } = await mediaApi.upload(file, 'avatars');
            avatarMutation.mutate(fileUrl);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Não foi possível enviar a imagem.');
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    // ─── Senha ─────────────────────────────────────────────────────────────
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

    return (
        <Stack>
            <Card>
                <CardTitle><UserRound size={18} /> Dados pessoais</CardTitle>
                <AvatarRow>
                    <Avatar name={user?.name} avatarUrl={user?.avatarUrl} size={64} />
                    <AvatarActions>
                        <Button
                            type="button"
                            $variant="secondary"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isUploadingAvatar || avatarMutation.isPending}
                        >
                            <Camera size={16} />
                            {isUploadingAvatar || avatarMutation.isPending ? 'Enviando...' : 'Alterar foto'}
                        </Button>
                        <HelpText>JPG, PNG, WEBP ou GIF, até 5MB.</HelpText>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            style={{ display: 'none' }}
                            onChange={handleAvatarChange}
                        />
                    </AvatarActions>
                </AvatarRow>
                <Form onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" {...profileForm.register('name')} />
                        {profileForm.formState.errors.name && (
                            <ErrorText>{profileForm.formState.errors.name.message}</ErrorText>
                        )}
                    </Field>
                    <Field>
                        <Label htmlFor="phone">Telefone (opcional)</Label>
                        <Input id="phone" {...profileForm.register('phone')} />
                    </Field>
                    <Field>
                        <Label>E-mail</Label>
                        <Input value={user?.email ?? ''} disabled />
                        <HelpText>O e-mail de login não pode ser alterado por aqui.</HelpText>
                    </Field>
                    <FormActions>
                        <Button type="submit" disabled={profileMutation.isPending}>
                            {profileMutation.isPending ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </FormActions>
                </Form>
            </Card>

            <Card>
                <CardTitle><KeyRound size={18} /> Senha</CardTitle>
                <Form onSubmit={passwordForm.handleSubmit((data) => passwordMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="currentPassword">Senha atual</Label>
                        <Input id="currentPassword" type="password" {...passwordForm.register('currentPassword')} />
                        {passwordForm.formState.errors.currentPassword && (
                            <ErrorText>{passwordForm.formState.errors.currentPassword.message}</ErrorText>
                        )}
                    </Field>
                    <Field>
                        <Label htmlFor="newPassword">Nova senha</Label>
                        <Input id="newPassword" type="password" {...passwordForm.register('newPassword')} />
                        {passwordForm.formState.errors.newPassword && (
                            <ErrorText>{passwordForm.formState.errors.newPassword.message}</ErrorText>
                        )}
                        <HelpText>Mínimo de 8 caracteres, com ao menos uma letra e um número.</HelpText>
                    </Field>
                    <Field>
                        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                        <Input id="confirmPassword" type="password" {...passwordForm.register('confirmPassword')} />
                        {passwordForm.formState.errors.confirmPassword && (
                            <ErrorText>{passwordForm.formState.errors.confirmPassword.message}</ErrorText>
                        )}
                    </Field>
                    <FormActions>
                        <Button type="submit" disabled={passwordMutation.isPending}>
                            {passwordMutation.isPending ? 'Alterando...' : 'Alterar senha'}
                        </Button>
                    </FormActions>
                </Form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle><ShieldCheck size={18} /> Autenticação de dois fatores</CardTitle>
                    <Badge $tone={user?.isTwoFactorEnabled ? 'success' : 'neutral'}>
                        {user?.isTwoFactorEnabled ? 'Ativado' : 'Desativado'}
                    </Badge>
                </CardHeader>
                <CardDescription>
                    Exige um código do seu aplicativo autenticador (Google Authenticator, Authy, etc.) a cada login,
                    além da senha.
                </CardDescription>
                {user?.isTwoFactorEnabled ? (
                    <FormActions>
                        <Button $variant="danger" onClick={() => setDisableOpen(true)}>Desativar 2FA</Button>
                    </FormActions>
                ) : (
                    <FormActions>
                        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                            {generateMutation.isPending ? 'Gerando...' : 'Ativar 2FA'}
                        </Button>
                    </FormActions>
                )}
            </Card>

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
        </Stack>
    );
}
