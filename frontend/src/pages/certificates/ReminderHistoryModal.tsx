// frontend/src/pages/certificates/ReminderHistoryModal.tsx
//
// Histórico de lembretes de vencimento de UM certificado + envio manual.

import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { format } from 'date-fns';
import { Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Table';
import { HelpText, FormActions } from '@/components/ui/FormField';
import { certificateRemindersApi, type Certificate, type ReminderStatus } from '@/services/certificates';
import { toast } from '@/utils/toast';

const List = styled.ul`
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};

    li {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.6rem 0.8rem;
        font-size: 0.8125rem;
    }

    li + li {
        border-top: 1px solid ${({ theme }) => theme.colors.borderLight};
    }

    strong {
        display: block;
        color: ${({ theme }) => theme.colors.textDark};
    }

    small {
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const STATUS: Record<ReminderStatus, { label: string; tone: 'success' | 'danger' | 'neutral' | 'info' }> = {
    SENT: { label: 'Enviado', tone: 'success' },
    FAILED: { label: 'Falhou', tone: 'danger' },
    SKIPPED: { label: 'Não enviado', tone: 'neutral' },
    SENDING: { label: 'Enviando', tone: 'info' },
};

interface Props {
    certificate: Certificate | null;
    onClose: () => void;
}

export function ReminderHistoryModal({ certificate, onClose }: Props) {
    const queryClient = useQueryClient();
    const queryKey = ['certificate-reminders', certificate?.id];

    const { data: reminders, isLoading } = useQuery({
        queryKey,
        queryFn: () => certificateRemindersApi.listForCertificate(certificate!.id),
        enabled: !!certificate,
    });

    const sendMutation = useMutation({
        mutationFn: () => certificateRemindersApi.sendNow(certificate!.id),
        onSuccess: () => {
            toast.success('Lembrete enviado.');
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (error) => {
            toast.error((isAxiosError(error) && error.response?.data?.message) || 'Não foi possível enviar o lembrete.');
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const cannotSendReason = !certificate
        ? null
        : certificate.status === 'REVOKED'
          ? 'Certificado revogado não recebe lembrete.'
          : !certificate.expiresAt
            ? 'Este certificado não tem vencimento.'
            : null;

    return (
        <Modal open={!!certificate} onOpenChange={(open) => !open && onClose()} title="Lembretes de vencimento" width="560px">
            {certificate && (
                <>
                    <p style={{ margin: '0 0 0.75rem' }}>
                        <strong>{certificate.enrollment.studentProfile.user.name}</strong> · {certificate.enrollment.course.event.title}
                        {certificate.expiresAt && <> · vence em {format(new Date(certificate.expiresAt), 'dd/MM/yyyy')}</>}
                    </p>

                    {isLoading ? (
                        <p>Carregando...</p>
                    ) : !reminders?.length ? (
                        <HelpText>Nenhum lembrete enviado ainda para este certificado.</HelpText>
                    ) : (
                        <List>
                            {reminders.map((reminder) => (
                                <li key={reminder.id}>
                                    <div>
                                        <strong>{reminder.stageLabel}</strong>
                                        <small>
                                            {format(new Date(reminder.sentAt ?? reminder.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                                            {reminder.attempts > 1 && ` · ${reminder.attempts} tentativas`}
                                            {reminder.error && ` · ${reminder.error}`}
                                        </small>
                                    </div>
                                    <Badge $tone={STATUS[reminder.status].tone}>{STATUS[reminder.status].label}</Badge>
                                </li>
                            ))}
                        </List>
                    )}

                    <FormActions>
                        {cannotSendReason && <HelpText style={{ marginRight: 'auto', alignSelf: 'center' }}>{cannotSendReason}</HelpText>}
                        <Button type="button" $variant="secondary" onClick={onClose}>Fechar</Button>
                        <Button type="button" onClick={() => sendMutation.mutate()} disabled={!!cannotSendReason || sendMutation.isPending}>
                            <Send size={14} /> {sendMutation.isPending ? 'Enviando...' : 'Enviar lembrete agora'}
                        </Button>
                    </FormActions>
                </>
            )}
        </Modal>
    );
}
