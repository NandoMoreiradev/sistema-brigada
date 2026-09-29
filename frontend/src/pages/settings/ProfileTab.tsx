// frontend/src/pages/settings/ProfileTab.tsx
//
// Aba "Perfil": foto e dados pessoais. Senha e 2FA moram em SecurityTab.tsx. Os endpoints
// (auth.controller.ts) já existiam; esta tela é só o consumidor.

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import styled from 'styled-components';
import { useMutation } from '@tanstack/react-query';
import { UserRound, Camera } from 'lucide-react';
import { Field, Label, Input, ErrorText, Form, HelpText } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { authApi } from '@/services/auth';
import { mediaApi } from '@/services/media';
import { useAuth } from '@/contexts/AuthContext';
import { tokenManager } from '@/services/tokenManager';
import { toast } from '@/utils/toast';
import { SettingsCard, TabStack, FormGrid, FullRow, SaveFooter, useReportDirty } from './SettingsParts';

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

const profileSchema = z.object({
    name: z.string().min(1, 'Informe seu nome'),
    phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileTab() {
    const { user, fetchUserProfile } = useAuth();

    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' },
    });
    const { isDirty } = profileForm.formState;
    useReportDirty(isDirty);

    const profileMutation = useMutation({
        mutationFn: (data: ProfileFormData) => authApi.updateProfile({ name: data.name, phone: data.phone || undefined }),
        onSuccess: async ({ access_token }, data) => {
            tokenManager.set(access_token);
            await fetchUserProfile();
            profileForm.reset(data);
            toast.success('Dados atualizados com sucesso.');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível salvar seus dados.'),
    });

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

    return (
        <TabStack>
            <SettingsCard
                icon={<UserRound size={18} />}
                title="Dados pessoais"
                description="Como você aparece para a equipe e nos e-mails do sistema."
                footer={<SaveFooter form="profile-form" isDirty={isDirty} isPending={profileMutation.isPending} isSuccess={profileMutation.isSuccess} />}
            >
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
                <Form id="profile-form" onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}>
                    <FormGrid>
                        <Field>
                            <Label htmlFor="name">Nome</Label>
                            <Input id="name" {...profileForm.register('name')} />
                            {profileForm.formState.errors.name && <ErrorText>{profileForm.formState.errors.name.message}</ErrorText>}
                        </Field>
                        <Field>
                            <Label htmlFor="phone">Telefone (opcional)</Label>
                            <Input id="phone" {...profileForm.register('phone')} />
                        </Field>
                        <FullRow>
                            <Label>E-mail</Label>
                            <Input value={user?.email ?? ''} disabled />
                            <HelpText>O e-mail de login não pode ser alterado por aqui.</HelpText>
                        </FullRow>
                    </FormGrid>
                </Form>
            </SettingsCard>
        </TabStack>
    );
}
