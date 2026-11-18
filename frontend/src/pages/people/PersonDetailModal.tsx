// frontend/src/pages/people/PersonDetailModal.tsx
//
// Ficha da pessoa: tudo o que a academia sabe sobre ela num lugar só (antes só existia o
// formulário "Editar pessoa", sem e-mail, matrículas nem dados da conta). Dados vêm de
// GET /users/:id/overview. As ações (editar, alterar e-mail, redefinir senha, reenviar acesso)
// ficam no rodapé e delegam para quem abriu a ficha.

import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Table';
import { HelpText } from '@/components/ui/FormField';
import { peopleApi, type PersonOverview } from '@/services/people';
import { formatAppDate } from '@/utils/datetime';
import type { EnrollmentStatus, OrgPerson, PioneerStatus } from '@/types';

const Section = styled.section`
    margin-bottom: 1.1rem;
`;

const SectionTitle = styled.h3`
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textMuted ?? '#6b7280'};
`;

const Grid = styled.dl`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 0.6rem 1rem;
    margin: 0;
`;

const Item = styled.div`
    min-width: 0;
    dt {
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textMuted ?? '#6b7280'};
    }
    dd {
        margin: 0.1rem 0 0;
        font-size: 0.9rem;
        overflow-wrap: anywhere;
    }
`;

const Row = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.55rem 0.75rem;
    border: 1px solid rgba(128, 128, 128, 0.25);
    border-radius: 8px;
    margin-bottom: 0.4rem;
    font-size: 0.875rem;
`;

const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
`;

const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = { ACTIVE: 'Ativa', COMPLETED: 'Concluída', DROPPED: 'Cancelada' };
const ENROLLMENT_TONE: Record<EnrollmentStatus, 'success' | 'info' | 'danger'> = { ACTIVE: 'info', COMPLETED: 'success', DROPPED: 'danger' };
const PIONEER_LABEL: Record<PioneerStatus, string> = { AUXILIARY: 'Pioneiro auxiliar', REGULAR: 'Pioneiro regular' };
const CERT_LABEL: Record<string, string> = { VALID: 'Válido', EXPIRED: 'Vencido', REVOKED: 'Revogado' };

const date = (iso?: string | null) => (iso ? formatAppDate(iso, 'dd/MM/yyyy') : '—');
const dateTime = (iso?: string | null) => (iso ? formatAppDate(iso, 'dd/MM/yyyy HH:mm') : '—');

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Item>
            <dt>{label}</dt>
            <dd>{children || '—'}</dd>
        </Item>
    );
}

function roleLabels(person: PersonOverview): string[] {
    const roles: string[] = [];
    if (person.role === 'ORG_ADMIN') roles.push('Administrador');
    if (person.studentProfile) roles.push('Aluno');
    if (person.instructorAssignments.length > 0) roles.push('Instrutor');
    if (person.staffMember) roles.push(person.staffMember.category?.name ?? 'Equipe');
    person.roleAssignments?.forEach((r) => roles.push(`Cargo: ${r.name}`));
    return roles;
}

interface PersonDetailModalProps {
    person: OrgPerson | null;
    isSelf: boolean;
    onClose: () => void;
    onEdit: (person: OrgPerson) => void;
    onChangeEmail: (person: OrgPerson) => void;
    onResetPassword: (person: OrgPerson) => void;
    onResendAccess: (person: OrgPerson) => void;
}

export function PersonDetailModal({ person, isSelf, onClose, onEdit, onChangeEmail, onResetPassword, onResendAccess }: PersonDetailModalProps) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['people', 'overview', person?.id],
        queryFn: () => peopleApi.overview(person!.id),
        enabled: person !== null,
        staleTime: 0,
    });

    const roles = data ? roleLabels(data) : [];

    return (
        <Modal open={person !== null} onOpenChange={(open) => !open && onClose()} title={person?.name ?? 'Pessoa'} width="680px">
            {person && (
                <>
                    {isLoading && <HelpText>Carregando a ficha de {person.name}...</HelpText>}
                    {isError && <HelpText>Não foi possível carregar a ficha. Tente novamente.</HelpText>}

                    {data && (
                        <>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                <Badge $tone={data.isActive ? 'success' : 'neutral'}>{data.isActive ? 'Ativo' : 'Inativo'}</Badge>
                                {roles.length > 0 ? roles.map((r) => <Badge key={r} $tone="info">{r}</Badge>) : <Badge $tone="neutral">Sem papel</Badge>}
                            </div>

                            <Section>
                                <SectionTitle>Contato e conta</SectionTitle>
                                <Grid>
                                    <Field label="E-mail (login)">{data.email}</Field>
                                    <Field label="Telefone">{data.phone}</Field>
                                    <Field label="Cadastrado em">{date(data.createdAt)}</Field>
                                    <Field label="Origem">{data.origin === 'REGISTRATION' ? 'Autocadastro aprovado' : 'Cadastro manual'}</Field>
                                    <Field label="Último acesso">{data.lastAccessAt ? dateTime(data.lastAccessAt) : 'Nunca acessou'}</Field>
                                    <Field label="Verificação em duas etapas">{data.isTwoFactorEnabled ? 'Ativada' : 'Desativada'}</Field>
                                </Grid>
                            </Section>

                            <Section>
                                <SectionTitle>Dados pessoais</SectionTitle>
                                <Grid>
                                    <Field label="Nascimento">{date(data.personProfile?.birthDate)}</Field>
                                    <Field label="Batismo">{date(data.personProfile?.baptismDate)}</Field>
                                    <Field label="Pioneiro">{data.personProfile?.pioneerStatus ? PIONEER_LABEL[data.personProfile.pioneerStatus] : 'Não'}</Field>
                                    <Field label="Profissão / área de estudo">{data.personProfile?.profession}</Field>
                                    <Field label="Petições assinadas">{data.personProfile?.signedPetitions?.join(', ')}</Field>
                                    {data.studentProfile && (
                                        <>
                                            <Field label="Responsável">{data.studentProfile.guardianName}</Field>
                                            <Field label="Telefone do responsável">{data.studentProfile.guardianPhone}</Field>
                                        </>
                                    )}
                                </Grid>
                            </Section>

                            {data.studentProfile && (
                                <Section>
                                    <SectionTitle>Matrículas ({data.enrollments.length})</SectionTitle>
                                    {data.enrollments.length === 0 && <HelpText>Ainda não está matriculado(a) em nenhuma turma.</HelpText>}
                                    {data.enrollments.map((enrollment) => {
                                        const { attendance, certificate } = enrollment;
                                        return (
                                            <Row key={enrollment.id}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600 }}>{enrollment.course.event.title}</div>
                                                    <HelpText>
                                                        Desde {date(enrollment.enrolledAt)}
                                                        {enrollment.group ? ` · ${enrollment.group.name}` : ''}
                                                        {attendance.recorded > 0
                                                            ? ` · Presença: ${attendance.present}/${attendance.recorded}${attendance.justified ? ` (+${attendance.justified} justificada(s))` : ''}`
                                                            : ' · Sem presenças registradas'}
                                                    </HelpText>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                    <Badge $tone={ENROLLMENT_TONE[enrollment.status]}>{ENROLLMENT_LABEL[enrollment.status]}</Badge>
                                                    {certificate && (
                                                        <Badge $tone={certificate.status === 'VALID' ? 'success' : 'neutral'}>
                                                            Certificado {CERT_LABEL[certificate.status] ?? certificate.status}
                                                            {certificate.expiresAt ? ` · até ${date(certificate.expiresAt)}` : ''}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </Row>
                                        );
                                    })}
                                </Section>
                            )}

                            {data.instructorAssignments.length > 0 && (
                                <Section>
                                    <SectionTitle>Turmas que leciona ({data.instructorAssignments.length})</SectionTitle>
                                    {data.instructorAssignments.map(({ course }) => (
                                        <Row key={course.id}>{course.event.title}</Row>
                                    ))}
                                </Section>
                            )}

                            {data.externalCertifications.length > 0 && (
                                <Section>
                                    <SectionTitle>Certificações externas ({data.externalCertifications.length})</SectionTitle>
                                    {data.externalCertifications.map((cert) => (
                                        <Row key={cert.id}>
                                            <span>{cert.name}{cert.issuingOrg ? ` · ${cert.issuingOrg}` : ''}</span>
                                            <HelpText>
                                                {cert.issuedAt ? `Emitida em ${date(cert.issuedAt)}` : 'Sem data de emissão'}
                                                {cert.expiresAt ? ` · vence em ${date(cert.expiresAt)}` : ''}
                                            </HelpText>
                                        </Row>
                                    ))}
                                </Section>
                            )}
                        </>
                    )}

                    <Actions>
                        <Button type="button" $variant="ghost" onClick={() => onResetPassword(person)} disabled={!data}>Redefinir senha</Button>
                        <Button type="button" $variant="ghost" onClick={() => onResendAccess(person)} disabled={!data}>Reenviar acesso</Button>
                        {!isSelf && (
                            <Button type="button" $variant="secondary" onClick={() => onChangeEmail(person)} disabled={!data}>Alterar e-mail</Button>
                        )}
                        <Button type="button" onClick={() => onEdit(person)}>Editar</Button>
                    </Actions>
                </>
            )}
        </Modal>
    );
}
