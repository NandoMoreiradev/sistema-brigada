// frontend/src/pages/course-detail/AssigneePicker.tsx
//
// Escolha dos responsáveis por uma atividade da programação: equipes fixas (ex.: "Equipe de Ana")
// e/ou pessoas avulsas (ex.: "Ubirajara"). As equipes são da academia e são cadastradas aqui
// mesmo ("Gerenciar equipes"), no mesmo esquema das salas em RoomSelect.

import { useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2, Plus, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, HelpText } from '@/components/ui/FormField';
import { teamsApi, type Team } from '@/services/schedule';
import { peopleApi } from '@/services/people';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';

export type AssigneeValue = { teamId?: string; userId?: string };

const Chips = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
`;

const Chip = styled.span<{ $team?: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.3rem 0.15rem 0.55rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme, $team }) => ($team ? theme.colors.primaryLight : theme.colors.backgroundMedium)};
    color: ${({ theme, $team }) => ($team ? theme.colors.infoDark : theme.colors.textDark)};
    font-size: 0.75rem;
    font-weight: 600;

    button {
        display: flex;
        background: transparent;
        border: none;
        cursor: pointer;
        color: inherit;
        padding: 0.1rem;
        border-radius: 50%;
    }
`;

const Row = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;

    select {
        flex: 1;
        min-width: 0;
    }
`;

const TeamCard = styled.div<{ $inactive?: boolean }>`
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    opacity: ${({ $inactive }) => ($inactive ? 0.6 : 1)};
`;

type Person = { id: string; name: string };

/** Pessoas de uma equipe: chips + select para adicionar. Usado no cadastro e na edição. */
function MemberEditor({ people, memberIds, onChange }: { people: Person[]; memberIds: string[]; onChange: (ids: string[]) => void }) {
    const byId = new Map(people.map((p) => [p.id, p]));
    const candidates = people.filter((p) => !memberIds.includes(p.id));
    return (
        <>
            {memberIds.length > 0 && (
                <Chips>
                    {memberIds.map((id) => (
                        <Chip key={id}>
                            {byId.get(id)?.name ?? '…'}
                            <button type="button" aria-label={`Tirar ${byId.get(id)?.name ?? ''} da equipe`} onClick={() => onChange(memberIds.filter((m) => m !== id))}>
                                <X size={12} />
                            </button>
                        </Chip>
                    ))}
                </Chips>
            )}
            <Select aria-label="Adicionar pessoa à equipe" value="" onChange={(e) => e.target.value && onChange([...memberIds, e.target.value])}>
                <option value="">Adicionar pessoa…</option>
                {candidates.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </Select>
        </>
    );
}

function TeamEditor({ team, people }: { team: Team; people: Person[] }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState(team.name);
    const memberIds = team.members.map((m) => m.userId);

    const updateMutation = useMutation({
        mutationFn: (input: { name?: string; memberIds?: string[]; active?: boolean }) => teamsApi.update(team.id, input),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
        onError: (error: unknown) => {
            toast.error(apiErrorMessage(error, 'Não foi possível salvar a equipe.'));
            setName(team.name);
        },
    });

    return (
        <TeamCard $inactive={!team.active}>
            <Row>
                <Input
                    aria-label="Nome da equipe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => {
                        if (name.trim() && name.trim() !== team.name) updateMutation.mutate({ name: name.trim() });
                        else setName(team.name);
                    }}
                />
                <Button type="button" $variant={team.active ? 'ghost' : 'secondary'} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ active: !team.active })}>
                    {team.active ? 'Desativar' : 'Reativar'}
                </Button>
            </Row>
            <MemberEditor
                people={people}
                memberIds={memberIds}
                onChange={(ids) => {
                    if (ids.length === 0) {
                        toast.error('A equipe precisa de pelo menos uma pessoa. Para deixar de usar, desative.');
                        return;
                    }
                    updateMutation.mutate({ memberIds: ids });
                }}
            />
        </TeamCard>
    );
}

function TeamsModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (team: Team) => void }) {
    const queryClient = useQueryClient();
    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list(), enabled: open });
    const { data: roster } = useQuery({ queryKey: ['people', 'roster'], queryFn: () => peopleApi.roster(), enabled: open });
    const [name, setName] = useState('');
    const [memberIds, setMemberIds] = useState<string[]>([]);

    const createMutation = useMutation({
        mutationFn: () => teamsApi.create({ name: name.trim(), memberIds }),
        onSuccess: (team) => {
            toast.success(`Equipe "${team.name}" cadastrada.`);
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            setName('');
            setMemberIds([]);
            onCreated(team);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível cadastrar a equipe.')),
    });

    const people = roster ?? [];

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Equipes de instrutores" width="560px">
            <HelpText>As equipes valem para todas as turmas. Quem estiver numa equipe escolhida como responsável vira instrutor da turma.</HelpText>
            <TeamCard style={{ marginTop: '0.75rem' }}>
                <Input
                    aria-label="Nome da nova equipe"
                    placeholder="Nova equipe (ex: Equipe de Ana, Batista/Leandro)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    // Este modal abre por cima de outro formulário: Enter aqui não pode enviar o de trás.
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                />
                <MemberEditor people={people} memberIds={memberIds} onChange={setMemberIds} />
                <Button type="button" style={{ alignSelf: 'flex-start' }} disabled={!name.trim() || memberIds.length === 0 || createMutation.isPending} onClick={() => createMutation.mutate()}>
                    <Plus size={14} /> Cadastrar equipe
                </Button>
            </TeamCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                {(teams ?? []).map((team) => (
                    <TeamEditor key={`${team.id}-${team.name}-${team.members.length}`} team={team} people={people} />
                ))}
            </div>
        </Modal>
    );
}

interface AssigneePickerProps {
    value: AssigneeValue[];
    onChange: (value: AssigneeValue[]) => void;
}

export function AssigneePicker({ value, onChange }: AssigneePickerProps) {
    const [manageOpen, setManageOpen] = useState(false);
    const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });
    const { data: roster } = useQuery({ queryKey: ['people', 'roster'], queryFn: () => peopleApi.roster() });

    const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
    const personById = new Map((roster ?? []).map((p) => [p.id, p]));
    const selectedTeams = new Set(value.map((v) => v.teamId).filter(Boolean));
    const selectedPeople = new Set(value.map((v) => v.userId).filter(Boolean));

    const add = (encoded: string) => {
        const [type, id] = encoded.split(':');
        onChange([...value, type === 'team' ? { teamId: id } : { userId: id }]);
    };

    return (
        <>
            {value.length > 0 && (
                <Chips style={{ marginBottom: '0.4rem' }}>
                    {value.map((item) => {
                        const team = item.teamId ? teamById.get(item.teamId) : undefined;
                        const label = item.teamId ? (team?.name ?? 'Equipe') : (personById.get(item.userId!)?.name ?? 'Pessoa');
                        return (
                            <Chip key={item.teamId ?? item.userId} $team={Boolean(item.teamId)} title={team ? team.members.map((m) => m.user.name).join(', ') : undefined}>
                                {item.teamId && <Users size={12} />}
                                {label}
                                <button type="button" aria-label={`Tirar ${label}`} onClick={() => onChange(value.filter((v) => v !== item))}>
                                    <X size={12} />
                                </button>
                            </Chip>
                        );
                    })}
                </Chips>
            )}
            <Row>
                <Select aria-label="Adicionar responsável" value="" onChange={(e) => e.target.value && add(e.target.value)}>
                    <option value="">Adicionar equipe ou pessoa…</option>
                    <optgroup label="Equipes">
                        {(teams ?? []).filter((t) => t.active && !selectedTeams.has(t.id)).map((t) => (
                            <option key={t.id} value={`team:${t.id}`}>{t.name}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Pessoas">
                        {(roster ?? []).filter((p) => !selectedPeople.has(p.id)).map((p) => (
                            <option key={p.id} value={`user:${p.id}`}>{p.name}</option>
                        ))}
                    </optgroup>
                </Select>
                <Button type="button" $variant="secondary" onClick={() => setManageOpen(true)} title="Cadastrar ou editar equipes">
                    <Settings2 size={14} /> Gerenciar equipes
                </Button>
            </Row>
            <TeamsModal
                open={manageOpen}
                onOpenChange={setManageOpen}
                onCreated={(team) => {
                    // Equipe recém-cadastrada já entra como responsável: quem abriu o cadastro queria usá-la.
                    onChange([...value, { teamId: team.id }]);
                    setManageOpen(false);
                }}
            />
        </>
    );
}
