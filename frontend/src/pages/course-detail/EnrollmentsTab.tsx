// frontend/src/pages/course-detail/EnrollmentsTab.tsx
//
// Matrículas da turma. Alterar status e matricular exigem `courses:manage`; emitir certificado
// exige `certificates:manage`. Quem não tem a permissão vê o status só como leitura (antes o
// dropdown aparecia para todos e falhava com 403 ao mudar).

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Select, ErrorText, HelpText, Form, FormActions } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { enrollmentsApi } from '@/services/courses';
import { certificatesApi } from '@/services/certificates';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError';
import { ScrollX, Toolbar, ToolbarGroup, SearchInput, FilterChip, Muted } from './styles';
import type { Enrollment, EnrollmentStatus } from '@/types';

const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = { ACTIVE: 'Ativa', COMPLETED: 'Concluída', DROPPED: 'Cancelada' };
const ENROLLMENT_TONE: Record<EnrollmentStatus, 'success' | 'info' | 'danger'> = { ACTIVE: 'info', COMPLETED: 'success', DROPPED: 'danger' };

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface EnrollmentsTabProps {
    courseId: string;
    enrollments: Enrollment[];
    canManage: boolean;
    canIssueCertificates: boolean;
    onCourseChanged: () => void;
}

export function EnrollmentsTab({ courseId, enrollments, canManage, canIssueCertificates, onCourseChanged }: EnrollmentsTabProps) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'ALL'>('ALL');
    const [enrollModalOpen, setEnrollModalOpen] = useState(false);
    const [enrollUserIds, setEnrollUserIds] = useState<string[]>([]);
    const [studentSearch, setStudentSearch] = useState('');

    const { data: peopleData } = useQuery({
        queryKey: ['people', { hasStudentProfile: true }],
        queryFn: () => peopleApi.list({ hasStudentProfile: true }),
        enabled: canManage,
    });

    const invalidateEnrollments = () => queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'enrollments'] });

    const enrollMutation = useMutation({
        mutationFn: async (userIds: string[]) =>
            userIds.length === 1 ? [await enrollmentsApi.enroll(courseId, userIds[0])] : enrollmentsApi.enrollBulk(courseId, userIds),
        onSuccess: (_, userIds) => {
            toast.success(userIds.length > 1 ? `${userIds.length} alunos matriculados com sucesso.` : 'Aluno matriculado com sucesso.');
            invalidateEnrollments();
            onCourseChanged();
            setEnrollModalOpen(false);
            setEnrollUserIds([]);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível matricular os alunos selecionados.')),
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ enrollmentId, status }: { enrollmentId: string; status: string }) => enrollmentsApi.updateStatus(courseId, enrollmentId, status),
        onSuccess: () => {
            invalidateEnrollments();
            toast.success('Status da matrícula atualizado.');
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível atualizar a matrícula.')),
    });

    /**
     * Emissão manual (admin), fora do caminho automático por presença/aulas. Primeiro tenta sem
     * forçar — se a matrícula ainda não atingiu os critérios, pergunta se quer emitir mesmo assim.
     */
    const issueCertificateMutation = useMutation({
        mutationFn: ({ enrollmentId, force }: { enrollmentId: string; force?: boolean }) => certificatesApi.issue(enrollmentId, force),
        onSuccess: () => {
            toast.success('Certificado emitido.');
            invalidateEnrollments();
        },
        onError: (error: unknown, variables) => {
            const message = apiErrorMessage(error, '');
            if (!variables.force && apiErrorStatus(error) === 400 && message) {
                if (window.confirm(`${message}\n\nEmitir o certificado mesmo assim, ignorando esse critério?`)) {
                    issueCertificateMutation.mutate({ enrollmentId: variables.enrollmentId, force: true });
                }
                return;
            }
            toast.error(message || 'Não foi possível emitir o certificado.');
        },
    });

    const counts = useMemo(() => {
        const base = { ALL: enrollments.length, ACTIVE: 0, COMPLETED: 0, DROPPED: 0 };
        enrollments.forEach((e) => { base[e.status] += 1; });
        return base;
    }, [enrollments]);

    const visible = enrollments.filter((e) => {
        if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const term = normalize(search);
        return normalize(e.studentProfile.user.name).includes(term) || normalize(e.studentProfile.user.email).includes(term);
    });

    const enrolledUserIds = new Set(enrollments.map((e) => e.studentProfile.user.id));
    const availableStudents = (peopleData?.data ?? []).filter((p) => !enrolledUserIds.has(p.id));
    const filteredStudents = availableStudents.filter((p) => !studentSearch.trim() || normalize(`${p.name} ${p.email}`).includes(normalize(studentSearch)));

    const toggleUser = (id: string) => setEnrollUserIds((current) => (current.includes(id) ? current.filter((u) => u !== id) : [...current, id]));
    const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((p) => enrollUserIds.includes(p.id));
    const toggleAllFiltered = () =>
        setEnrollUserIds((current) =>
            allFilteredSelected
                ? current.filter((id) => !filteredStudents.some((p) => p.id === id))
                : [...new Set([...current, ...filteredStudents.map((p) => p.id)])],
        );

    return (
        <>
            <Toolbar>
                <ToolbarGroup>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }} />
                        <SearchInput
                            type="search"
                            placeholder="Buscar aluno por nome ou e-mail"
                            aria-label="Buscar aluno"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ paddingLeft: 30 }}
                        />
                    </div>
                    {(['ALL', 'ACTIVE', 'COMPLETED', 'DROPPED'] as const).map((status) => (
                        <FilterChip key={status} type="button" $active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                            {status === 'ALL' ? 'Todas' : ENROLLMENT_LABEL[status]} ({counts[status]})
                        </FilterChip>
                    ))}
                </ToolbarGroup>
                {canManage && (
                    <Button onClick={() => { setEnrollUserIds([]); setStudentSearch(''); setEnrollModalOpen(true); }}>
                        <Plus size={16} /> Matricular alunos
                    </Button>
                )}
            </Toolbar>

            <TableWrapper>
                <ScrollX>
                    <Table>
                        <Thead>
                            <tr>
                                <Th>Aluno</Th>
                                <Th>Status</Th>
                                {canIssueCertificates && <Th>Certificado</Th>}
                            </tr>
                        </Thead>
                        <tbody>
                            {visible.map((enrollment) => (
                                <Tr key={enrollment.id}>
                                    <Td>
                                        <div style={{ fontWeight: 600 }}>{enrollment.studentProfile.user.name}</div>
                                        <Muted>{enrollment.studentProfile.user.email}</Muted>
                                    </Td>
                                    <Td>
                                        {canManage ? (
                                            <Select
                                                aria-label={`Status da matrícula de ${enrollment.studentProfile.user.name}`}
                                                value={enrollment.status}
                                                disabled={updateStatusMutation.isPending}
                                                onChange={(e) => {
                                                    if (e.target.value === 'DROPPED' && !window.confirm(`Cancelar a matrícula de ${enrollment.studentProfile.user.name}?`)) return;
                                                    updateStatusMutation.mutate({ enrollmentId: enrollment.id, status: e.target.value });
                                                }}
                                            >
                                                <option value="ACTIVE">Ativa</option>
                                                <option value="COMPLETED">Concluída</option>
                                                <option value="DROPPED">Cancelada</option>
                                            </Select>
                                        ) : (
                                            <Badge $tone={ENROLLMENT_TONE[enrollment.status]}>{ENROLLMENT_LABEL[enrollment.status]}</Badge>
                                        )}
                                    </Td>
                                    {canIssueCertificates && (
                                        <Td>
                                            {enrollment.certificate ? (
                                                <Badge $tone="success">Emitido</Badge>
                                            ) : (
                                                <Button $variant="ghost" disabled={issueCertificateMutation.isPending} onClick={() => issueCertificateMutation.mutate({ enrollmentId: enrollment.id })}>
                                                    Emitir certificado
                                                </Button>
                                            )}
                                        </Td>
                                    )}
                                </Tr>
                            ))}
                        </tbody>
                    </Table>
                </ScrollX>
                {enrollments.length === 0 && <EmptyState>Nenhum aluno matriculado ainda.</EmptyState>}
                {enrollments.length > 0 && visible.length === 0 && <EmptyState>Nenhum aluno encontrado com esse filtro.</EmptyState>}
            </TableWrapper>

            <Modal open={enrollModalOpen} onOpenChange={setEnrollModalOpen} title="Matricular alunos" width="520px">
                <Form onSubmit={(e) => { e.preventDefault(); if (enrollUserIds.length > 0) enrollMutation.mutate(enrollUserIds); }}>
                    <Field>
                        <Label htmlFor="studentSearch">Alunos</Label>
                        <SearchInput
                            id="studentSearch"
                            type="search"
                            placeholder="Buscar por nome ou e-mail"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <HelpText>{enrollUserIds.length} selecionado(s) de {availableStudents.length} disponíveis</HelpText>
                            {filteredStudents.length > 0 && (
                                <Button type="button" $variant="ghost" onClick={toggleAllFiltered}>
                                    {allFilteredSelected ? 'Desmarcar exibidos' : 'Selecionar exibidos'}
                                </Button>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280, overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: 8 }}>
                            {filteredStudents.map((student) => (
                                <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8125rem', padding: '0.45rem 0.75rem', cursor: 'pointer', borderTop: '1px solid #f1f3f5' }}>
                                    <input type="checkbox" checked={enrollUserIds.includes(student.id)} onChange={() => toggleUser(student.id)} />
                                    <span>
                                        <strong>{student.name}</strong>
                                        <br />
                                        <Muted>{student.email}</Muted>
                                    </span>
                                </label>
                            ))}
                        </div>
                        {availableStudents.length === 0 && (
                            <ErrorText>Todos os alunos cadastrados já estão matriculados, ou nenhum aluno foi cadastrado ainda.</ErrorText>
                        )}
                        {availableStudents.length > 0 && filteredStudents.length === 0 && <HelpText>Nenhum aluno encontrado para “{studentSearch}”.</HelpText>}
                    </Field>
                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setEnrollModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={enrollUserIds.length === 0 || enrollMutation.isPending}>
                            {enrollMutation.isPending ? 'Matriculando...' : enrollUserIds.length > 1 ? `Matricular ${enrollUserIds.length} alunos` : 'Matricular'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </>
    );
}
