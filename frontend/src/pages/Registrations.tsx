// frontend/src/pages/Registrations.tsx
//
// Cadastros de novas pessoas: revisão dos pedidos do link público e convites dirigidos.
// Permissão própria registrations:manage, gated no Router.tsx.
//
// - Cadastros: "Aprovar" abre um modal onde se escolhe o papel (aluno, instrutor ou equipe) e,
//   para aluno, se completam os dados de perfil; "Recusar" pede um motivo opcional e avisa a
//   pessoa por e-mail (dá para desmarcar). Nos aprovados aparece se o e-mail de acesso saiu, com
//   "Reenviar acesso".
// - Convites: convida um e-mail já com o papel definido; o link vale 7 dias e, ao ser preenchido,
//   a conta é criada na hora (o convite é a autorização).

import { useState } from 'react';
import { UserPlus, Send, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { Field, Label, Input, Select, Textarea, Form, FormActions, HelpText, FieldRow, CheckboxField, ErrorText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { registrationsApi } from '@/services/registrations';
import { toast } from '@/utils/toast';
import { KIND_LABEL, KIND_HINT, KIND_ORDER } from '@/utils/registrationKinds';
import type { RegistrationRequest, RegistrationInvite, RegistrationKind } from '@/types';

const STATUS_LABEL: Record<RegistrationRequest['status'], string> = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovado',
    REJECTED: 'Recusado',
};

const STATUS_TONE: Record<RegistrationRequest['status'], 'warning' | 'success' | 'danger'> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
};

const INVITE_STATUS_LABEL: Record<RegistrationInvite['status'], string> = {
    PENDING: 'Aguardando',
    USED: 'Concluído',
    EXPIRED: 'Vencido',
    REVOKED: 'Cancelado',
};

const INVITE_STATUS_TONE: Record<RegistrationInvite['status'], 'warning' | 'success' | 'neutral' | 'danger'> = {
    PENDING: 'warning',
    USED: 'success',
    EXPIRED: 'neutral',
    REVOKED: 'danger',
};

const approveSchema = z.object({
    baptismDate: z.string().optional(),
    pioneerStatus: z.enum(['', 'AUXILIARY', 'REGULAR']).optional(),
    signedPetitions: z.string().optional(),
    profession: z.string().optional(),
});
type ApproveFormData = z.infer<typeof approveSchema>;

const inviteSchema = z.object({
    email: z.string().email('E-mail inválido'),
    name: z.string().optional(),
});
type InviteFormData = z.infer<typeof inviteSchema>;

/** Situação do e-mail de acesso de um cadastro aprovado. */
function AccessEmailBadge({ request }: { request: RegistrationRequest }) {
    if (request.status !== 'APPROVED' || !request.accessEmailStatus) return null;
    return request.accessEmailStatus === 'SENT'
        ? <Badge $tone="success" title={request.accessEmailAt ? format(new Date(request.accessEmailAt), 'dd/MM/yyyy HH:mm') : undefined}>E-mail enviado</Badge>
        : <Badge $tone="danger" title="O e-mail de acesso não saiu. Confira Minha Conta › Academia › E-mail e reenvie.">E-mail falhou</Badge>;
}

export default function Registrations() {
    const queryClient = useQueryClient();
    const [view, setView] = useState<'requests' | 'invites'>('requests');
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
    const [approving, setApproving] = useState<RegistrationRequest | null>(null);
    const [approveKind, setApproveKind] = useState<RegistrationKind>('STUDENT');
    const [rejecting, setRejecting] = useState<RegistrationRequest | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectNotify, setRejectNotify] = useState(true);
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteKind, setInviteKind] = useState<RegistrationKind>('STUDENT');

    const { data, isLoading } = useQuery({
        queryKey: ['registrations', statusFilter],
        queryFn: () => registrationsApi.list(statusFilter),
        enabled: view === 'requests',
    });
    const requests = data?.data ?? [];

    const { data: invites, isLoading: invitesLoading } = useQuery({
        queryKey: ['registrations', 'invites'],
        queryFn: () => registrationsApi.listInvites(),
        enabled: view === 'invites',
    });

    const { register, handleSubmit, reset } = useForm<ApproveFormData>({
        resolver: zodResolver(approveSchema),
        defaultValues: { baptismDate: '', pioneerStatus: '', signedPetitions: '', profession: '' },
    });
    const inviteForm = useForm<InviteFormData>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', name: '' } });

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['registrations'] });
    };

    const openApprove = (request: RegistrationRequest) => {
        setApproving(request);
        setApproveKind(request.requestedKind ?? 'STUDENT');
        reset({
            baptismDate: request.baptismDate ? request.baptismDate.slice(0, 10) : '',
            pioneerStatus: request.pioneerStatus ?? '',
            signedPetitions: request.signedPetitions.join(', '),
            profession: request.profession ?? '',
        });
    };

    const approveMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: ApproveFormData }) =>
            registrationsApi.approve(id, {
                kind: approveKind,
                ...(approveKind === 'STUDENT'
                    ? {
                          baptismDate: data.baptismDate || undefined,
                          pioneerStatus: data.pioneerStatus || undefined,
                          signedPetitions: data.signedPetitions
                              ? data.signedPetitions.split(',').map((item) => item.trim()).filter(Boolean)
                              : undefined,
                          profession: data.profession || undefined,
                      }
                    : {}),
            }),
        onSuccess: (approved) => {
            if (approved.accessEmailStatus === 'FAILED') {
                toast.error('Cadastro aprovado, mas o e-mail de acesso não saiu. Confira a configuração de e-mail e use "Reenviar acesso".');
            } else {
                toast.success('Cadastro aprovado — a pessoa recebeu um e-mail com o link de acesso.');
            }
            refresh();
            setApproving(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível aprovar o cadastro.'),
    });

    const rejectMutation = useMutation({
        mutationFn: (id: string) => registrationsApi.reject(id, { reason: rejectReason.trim() || undefined, notify: rejectNotify }),
        onSuccess: () => {
            toast.success(rejectNotify ? 'Cadastro recusado — a pessoa foi avisada por e-mail.' : 'Cadastro recusado.');
            refresh();
            setRejecting(null);
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível recusar o cadastro.'),
    });

    const resendAccessMutation = useMutation({
        mutationFn: (id: string) => registrationsApi.resendAccess(id),
        onSuccess: (result) => {
            (result.sent ? toast.success : toast.error)(result.message);
            refresh();
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível reenviar o acesso.'),
    });

    const inviteResult = (result: { sent: boolean; invite: RegistrationInvite }, verb: string) => {
        if (result.sent) toast.success(`${verb} para ${result.invite.email}.`);
        else toast.error(`Convite salvo, mas o e-mail não saiu. Confira a configuração de e-mail da academia e reenvie.`);
        refresh();
    };

    const createInviteMutation = useMutation({
        mutationFn: (data: InviteFormData) => registrationsApi.createInvite({ email: data.email, name: data.name || undefined, kind: inviteKind }),
        onSuccess: (result) => {
            inviteResult(result, 'Convite enviado');
            setInviteOpen(false);
            setView('invites');
        },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível criar o convite.'),
    });

    const resendInviteMutation = useMutation({
        mutationFn: (id: string) => registrationsApi.resendInvite(id),
        onSuccess: (result) => inviteResult(result, 'Convite reenviado'),
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível reenviar o convite.'),
    });

    const revokeInviteMutation = useMutation({
        mutationFn: (id: string) => registrationsApi.revokeInvite(id),
        onSuccess: () => { toast.success('Convite cancelado.'); refresh(); },
        onError: (error: any) => toast.error(error?.response?.data?.message || 'Não foi possível cancelar o convite.'),
    });

    const openInvite = () => {
        inviteForm.reset({ email: '', name: '' });
        setInviteKind('STUDENT');
        setInviteOpen(true);
    };

    const kindOptions = KIND_ORDER.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }));

    return (
        <PageLayout
            title="Cadastros"
            subtitle="Pedidos do link público e convites para novas pessoas"
            icon={<UserPlus size={16} />}
            actions={
                <>
                    {view === 'requests' && (
                        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={{ width: '160px' }}>
                            <option value="PENDING">Pendentes</option>
                            <option value="APPROVED">Aprovados</option>
                            <option value="REJECTED">Recusados</option>
                        </Select>
                    )}
                    <Button onClick={openInvite}><Send size={16} /> Convidar pessoa</Button>
                </>
            }
        >
            <div style={{ marginBottom: '0.75rem' }}>
                <Segmented
                    ariaLabel="Visão"
                    value={view}
                    onChange={setView}
                    options={[{ value: 'requests', label: 'Pedidos de cadastro' }, { value: 'invites', label: 'Convites enviados' }]}
                />
            </div>

            {view === 'requests' ? (
                <TableWrapper>
                    <Table>
                        <Thead>
                            <tr>
                                <Th>Nome</Th>
                                <Th>E-mail</Th>
                                <Th>Papel</Th>
                                <Th>Enviado em</Th>
                                <Th>Status</Th>
                                <Th></Th>
                            </tr>
                        </Thead>
                        <tbody>
                            {requests.map((request) => {
                                const kind = request.approvedKind ?? request.requestedKind ?? 'STUDENT';
                                return (
                                    <Tr key={request.id}>
                                        <Td>
                                            {request.name}
                                            <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{request.phone}</div>
                                        </Td>
                                        <Td>{request.email}</Td>
                                        <Td>
                                            <Badge $tone={kind === 'STUDENT' ? 'neutral' : 'info'}>{KIND_LABEL[kind]}</Badge>
                                            {request.inviteId && <div style={{ fontSize: '0.7rem', color: '#6c757d' }}>via convite</div>}
                                        </Td>
                                        <Td>{format(new Date(request.createdAt), 'dd/MM/yyyy HH:mm')}</Td>
                                        <Td>
                                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                <Badge $tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                                                <AccessEmailBadge request={request} />
                                            </div>
                                            {request.status === 'REJECTED' && request.rejectionReason && (
                                                <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: 2 }}>{request.rejectionReason}</div>
                                            )}
                                        </Td>
                                        <Td>
                                            {request.status === 'PENDING' && (
                                                <>
                                                    <Button $variant="ghost" onClick={() => openApprove(request)}>Aprovar</Button>
                                                    <Button
                                                        $variant="ghost"
                                                        onClick={() => { setRejecting(request); setRejectReason(''); setRejectNotify(true); }}
                                                    >
                                                        Recusar
                                                    </Button>
                                                </>
                                            )}
                                            {request.status === 'APPROVED' && request.createdUserId && (
                                                <Button
                                                    $variant={request.accessEmailStatus === 'FAILED' ? 'secondary' : 'ghost'}
                                                    disabled={resendAccessMutation.isPending}
                                                    onClick={() => resendAccessMutation.mutate(request.id)}
                                                    title="Envia um novo link de acesso (vale 7 dias)"
                                                >
                                                    <Mail size={14} /> Reenviar acesso
                                                </Button>
                                            )}
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </tbody>
                    </Table>
                    {!isLoading && requests.length === 0 && <EmptyState>Nenhum cadastro por aqui.</EmptyState>}
                </TableWrapper>
            ) : (
                <TableWrapper>
                    <Table>
                        <Thead>
                            <tr>
                                <Th>Convidado</Th>
                                <Th>Papel</Th>
                                <Th>Enviado por</Th>
                                <Th>Validade</Th>
                                <Th>Situação</Th>
                                <Th></Th>
                            </tr>
                        </Thead>
                        <tbody>
                            {(invites ?? []).map((invite) => (
                                <Tr key={invite.id}>
                                    <Td>
                                        {invite.name || invite.email}
                                        {invite.name && <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{invite.email}</div>}
                                    </Td>
                                    <Td><Badge $tone={invite.kind === 'STUDENT' ? 'neutral' : 'info'}>{KIND_LABEL[invite.kind]}</Badge></Td>
                                    <Td>{invite.createdBy?.name ?? '—'}<div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{format(new Date(invite.createdAt), 'dd/MM/yyyy')}</div></Td>
                                    <Td>{format(new Date(invite.expiresAt), 'dd/MM/yyyy')}</Td>
                                    <Td>
                                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                            <Badge $tone={INVITE_STATUS_TONE[invite.status]}>{INVITE_STATUS_LABEL[invite.status]}</Badge>
                                            {invite.emailStatus === 'FAILED' && <Badge $tone="danger" title="O e-mail do convite não saiu. Reenvie depois de conferir a configuração de e-mail.">E-mail falhou</Badge>}
                                        </div>
                                    </Td>
                                    <Td>
                                        {(invite.status === 'PENDING' || invite.status === 'EXPIRED') && (
                                            <>
                                                <Button $variant="ghost" disabled={resendInviteMutation.isPending} onClick={() => resendInviteMutation.mutate(invite.id)}>
                                                    Reenviar
                                                </Button>
                                                <Button
                                                    $variant="ghost"
                                                    disabled={revokeInviteMutation.isPending}
                                                    onClick={() => { if (window.confirm(`Cancelar o convite de ${invite.email}? O link deixa de funcionar.`)) revokeInviteMutation.mutate(invite.id); }}
                                                >
                                                    Cancelar
                                                </Button>
                                            </>
                                        )}
                                    </Td>
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                    {!invitesLoading && (invites ?? []).length === 0 && <EmptyState>Nenhum convite enviado ainda. Use "Convidar pessoa" para começar.</EmptyState>}
                </TableWrapper>
            )}

            {/* Aprovar */}
            <Modal open={!!approving} onOpenChange={(open) => !open && setApproving(null)} title={`Aprovar cadastro de ${approving?.name ?? ''}`} width="500px">
                <Form onSubmit={handleSubmit((data) => { if (approving) approveMutation.mutate({ id: approving.id, data }); })}>
                    <Field>
                        <Label>Entra como</Label>
                        <Segmented ariaLabel="Papel" value={approveKind} onChange={setApproveKind} options={kindOptions} />
                        <HelpText>
                            {KIND_HINT[approveKind]}
                            {approving && approving.requestedKind !== approveKind && ` (a pessoa pediu: ${KIND_LABEL[approving.requestedKind ?? 'STUDENT']}.)`}
                        </HelpText>
                    </Field>

                    {approveKind === 'STUDENT' && (
                        <>
                            <HelpText>Complete ou ajuste os dados antes de aprovar — a conta é criada com o que estiver aqui.</HelpText>
                            <FieldRow>
                                <Field>
                                    <Label htmlFor="approve-baptismDate">Data de batismo</Label>
                                    <Input id="approve-baptismDate" type="date" {...register('baptismDate')} />
                                </Field>
                                <Field>
                                    <Label htmlFor="approve-pioneerStatus">Pioneiro</Label>
                                    <Select id="approve-pioneerStatus" {...register('pioneerStatus')}>
                                        <option value="">Não é pioneiro</option>
                                        <option value="AUXILIARY">Pioneiro auxiliar</option>
                                        <option value="REGULAR">Pioneiro regular</option>
                                    </Select>
                                </Field>
                            </FieldRow>
                            <Field>
                                <Label htmlFor="approve-profession">Profissão ou área de estudo</Label>
                                <Input id="approve-profession" {...register('profession')} />
                            </Field>
                            <Field>
                                <Label htmlFor="approve-signedPetitions">Petições assinadas</Label>
                                <Input id="approve-signedPetitions" placeholder="Ex: Pioneiro regular, Emissário" {...register('signedPetitions')} />
                                <HelpText>Separe múltiplas petições por vírgula.</HelpText>
                            </Field>
                        </>
                    )}

                    <HelpText>A pessoa recebe um e-mail com o link para definir a senha (vale 7 dias).</HelpText>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setApproving(null)}>Cancelar</Button>
                        <Button type="submit" disabled={approveMutation.isPending}>{approveMutation.isPending ? 'Aprovando...' : 'Aprovar e criar conta'}</Button>
                    </FormActions>
                </Form>
            </Modal>

            {/* Recusar */}
            <Modal open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)} title={`Recusar cadastro de ${rejecting?.name ?? ''}`} width="460px">
                <Form onSubmit={(e) => { e.preventDefault(); if (rejecting) rejectMutation.mutate(rejecting.id); }}>
                    <Field>
                        <Label htmlFor="reject-reason">Motivo (opcional)</Label>
                        <Textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex: fora do público desta academia" />
                    </Field>
                    <CheckboxField>
                        <input type="checkbox" checked={rejectNotify} onChange={(e) => setRejectNotify(e.target.checked)} />
                        Avisar a pessoa por e-mail{rejectReason.trim() ? ' (com o motivo)' : ''}
                    </CheckboxField>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setRejecting(null)}>Cancelar</Button>
                        <Button type="submit" $variant="danger" disabled={rejectMutation.isPending}>{rejectMutation.isPending ? 'Recusando...' : 'Recusar cadastro'}</Button>
                    </FormActions>
                </Form>
            </Modal>

            {/* Convidar */}
            <Modal open={inviteOpen} onOpenChange={setInviteOpen} title="Convidar pessoa" width="480px">
                <Form onSubmit={inviteForm.handleSubmit((data) => createInviteMutation.mutate(data))}>
                    <Field>
                        <Label htmlFor="invite-email">E-mail</Label>
                        <Input id="invite-email" type="email" autoFocus {...inviteForm.register('email')} />
                        {inviteForm.formState.errors.email && <ErrorText>{inviteForm.formState.errors.email.message}</ErrorText>}
                    </Field>
                    <Field>
                        <Label htmlFor="invite-name">Nome (opcional)</Label>
                        <Input id="invite-name" {...inviteForm.register('name')} />
                    </Field>
                    <Field>
                        <Label>Convidar como</Label>
                        <Segmented ariaLabel="Papel do convite" value={inviteKind} onChange={setInviteKind} options={kindOptions} />
                        <HelpText>{KIND_HINT[inviteKind]}</HelpText>
                    </Field>
                    <HelpText>A pessoa recebe um link pessoal, válido por 7 dias. Ao preencher, a conta é criada na hora e ela recebe o acesso por e-mail.</HelpText>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createInviteMutation.isPending}>{createInviteMutation.isPending ? 'Enviando...' : 'Enviar convite'}</Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
