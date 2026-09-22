// frontend/src/pages/MyDesignations.tsx
//
// Fase 3 de posse de dado (docs/decisoes.md): "minhas designações" — a escala
// do próprio staff/brigadista em eventos de atuação, via /me/designations.
// Confirmar/recusar usa o mesmo endpoint de Events/EventDetail
// (DesignationsService.updateStatus já checa posse — Fase 2).

import { ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { meApi } from '@/services/me';
import { designationsApi, type DesignationStatus, type EventKind } from '@/services/events';
import { toast } from '@/utils/toast';

const KIND_LABEL: Record<EventKind, string> = {
    ASSEMBLEIA: 'Assembleia',
    CONGRESSO: 'Congresso',
    REUNIAO: 'Reunião',
};

const STATUS_LABEL: Record<DesignationStatus, string> = {
    PENDING: 'Aguardando confirmação',
    CONFIRMED: 'Confirmada',
    DECLINED: 'Recusada',
};

const STATUS_TONE: Record<DesignationStatus, 'warning' | 'success' | 'danger'> = {
    PENDING: 'warning',
    CONFIRMED: 'success',
    DECLINED: 'danger',
};

export default function MyDesignations() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['me', 'designations'], queryFn: () => meApi.getMyDesignations() });
    const designations = data ?? [];

    const statusMutation = useMutation({
        mutationFn: ({ eventId, designationId, status }: { eventId: string; designationId: string; status: DesignationStatus }) =>
            designationsApi.updateStatus(eventId, designationId, status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['me', 'designations'] });
            toast.success('Designação atualizada.');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível atualizar a designação.'),
    });

    return (
        <PageLayout title="Minhas Designações" subtitle="Sua escala em eventos de atuação da equipe" icon={<ShieldCheck size={16} />}>
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Evento</Th>
                            <Th>Tipo</Th>
                            <Th>Papel</Th>
                            <Th>Turno</Th>
                            <Th>Status</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {designations.map((designation) => {
                            const event = designation.eventOperation.event;
                            return (
                                <Tr key={designation.id}>
                                    <Td>{event.title}</Td>
                                    <Td><Badge $tone="info">{KIND_LABEL[event.kind]}</Badge></Td>
                                    <Td>{designation.role}</Td>
                                    <Td>
                                        {format(new Date(designation.shiftStart), 'dd/MM HH:mm')} –{' '}
                                        {format(new Date(designation.shiftEnd), 'HH:mm')}
                                    </Td>
                                    <Td><Badge $tone={STATUS_TONE[designation.status]}>{STATUS_LABEL[designation.status]}</Badge></Td>
                                    <Td>
                                        {designation.status === 'PENDING' && (
                                            <>
                                                <Button
                                                    $variant="ghost"
                                                    disabled={statusMutation.isPending}
                                                    onClick={() =>
                                                        statusMutation.mutate({ eventId: event.id, designationId: designation.id, status: 'CONFIRMED' })
                                                    }
                                                >
                                                    Confirmar
                                                </Button>
                                                <Button
                                                    $variant="ghost"
                                                    disabled={statusMutation.isPending}
                                                    onClick={() =>
                                                        statusMutation.mutate({ eventId: event.id, designationId: designation.id, status: 'DECLINED' })
                                                    }
                                                >
                                                    Recusar
                                                </Button>
                                            </>
                                        )}
                                    </Td>
                                </Tr>
                            );
                        })}
                    </tbody>
                </Table>
                {!isLoading && designations.length === 0 && <EmptyState>Nenhuma designação no momento.</EmptyState>}
            </TableWrapper>
        </PageLayout>
    );
}
