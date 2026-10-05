// frontend/src/pages/course-detail/RoomSelect.tsx
//
// Select de sala com o cadastro de salas "ao lado" ("Gerenciar salas"), usado na criação/edição
// da turma (sala padrão) e no agendamento de aula. As salas são da academia, não da turma: a
// mesma sala serve a várias turmas, e o backend recusa duas aulas na mesma sala e horário.
// Não há exclusão — sala com aulas antigas só é desativada, para o histórico continuar legível.

import { useState, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, HelpText, ErrorText } from '@/components/ui/FormField';
import { roomsApi } from '@/services/courses';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';
import type { Room } from '@/types';

const Row = styled.div`
    display: flex;
    gap: 0.5rem;
    align-items: center;

    select {
        flex: 1;
        min-width: 0;
    }
`;

const RoomList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
`;

const RoomRow = styled.div<{ $inactive?: boolean }>`
    display: grid;
    grid-template-columns: 1fr 110px auto;
    gap: 0.5rem;
    align-items: center;
    opacity: ${({ $inactive }) => ($inactive ? 0.6 : 1)};
`;

const NewRoomRow = styled(RoomRow)`
    padding-bottom: 1rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
`;

const capacityOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

function RoomEditor({ room }: { room: Room }) {
    const queryClient = useQueryClient();
    const [name, setName] = useState(room.name);
    const [capacity, setCapacity] = useState(room.capacity ? String(room.capacity) : '');

    const updateMutation = useMutation({
        mutationFn: (input: { name?: string; capacity?: number | null; active?: boolean }) => roomsApi.update(room.id, input),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
        onError: (error: unknown) => {
            toast.error(apiErrorMessage(error, 'Não foi possível salvar a sala.'));
            setName(room.name);
            setCapacity(room.capacity ? String(room.capacity) : '');
        },
    });

    // Salva ao sair do campo, sem botão "salvar" por linha.
    const saveIfChanged = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setName(room.name);
            return;
        }
        const newCapacity = capacityOrNull(capacity);
        if (trimmed !== room.name || newCapacity !== (room.capacity ?? null)) {
            updateMutation.mutate({ name: trimmed, capacity: newCapacity });
        }
    };

    return (
        <RoomRow $inactive={!room.active}>
            <Input aria-label="Nome da sala" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveIfChanged} />
            <Input
                aria-label="Capacidade"
                type="number"
                min={1}
                placeholder="lugares"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                onBlur={saveIfChanged}
            />
            <Button
                type="button"
                $variant={room.active ? 'ghost' : 'secondary'}
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ active: !room.active })}
            >
                {room.active ? 'Desativar' : 'Reativar'}
            </Button>
        </RoomRow>
    );
}

function RoomsModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (room: Room) => void }) {
    const queryClient = useQueryClient();
    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list(), enabled: open });
    const [name, setName] = useState('');
    const [capacity, setCapacity] = useState('');

    const createMutation = useMutation({
        mutationFn: () => roomsApi.create({ name: name.trim(), capacity: capacity ? Number(capacity) : undefined }),
        onSuccess: (room) => {
            toast.success(`Sala "${room.name}" cadastrada.`);
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setName('');
            setCapacity('');
            onCreated(room);
        },
        onError: (error: unknown) => toast.error(apiErrorMessage(error, 'Não foi possível cadastrar a sala.')),
    });

    const create = () => {
        if (name.trim()) createMutation.mutate();
    };
    // Este modal abre por cima de outro formulário: Enter aqui não pode enviar o formulário de trás.
    const createOnEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            create();
        }
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Salas da academia" width="520px">
            <HelpText>As salas valem para todas as turmas. Duas aulas não podem usar a mesma sala no mesmo horário.</HelpText>
            <RoomList>
                <NewRoomRow>
                    <Input aria-label="Nome da nova sala" placeholder="Nova sala (ex: Sala 2, Pátio de treino)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={createOnEnter} />
                    <Input aria-label="Capacidade da nova sala" type="number" min={1} placeholder="lugares" value={capacity} onChange={(e) => setCapacity(e.target.value)} onKeyDown={createOnEnter} />
                    <Button type="button" onClick={create} disabled={!name.trim() || createMutation.isPending}>
                        <Plus size={14} /> Adicionar
                    </Button>
                </NewRoomRow>
                {(rooms ?? []).length === 0 && <HelpText>Nenhuma sala cadastrada ainda.</HelpText>}
                {(rooms ?? []).map((room) => (
                    <RoomEditor key={`${room.id}-${room.name}-${room.capacity}`} room={room} />
                ))}
            </RoomList>
        </Modal>
    );
}

interface RoomSelectProps {
    id: string;
    value: string;
    onChange: (roomId: string) => void;
    emptyLabel: string;
    /** Vagas da turma: avisa quando a sala escolhida comporta menos gente. */
    vacancies?: number | null;
}

export function RoomSelect({ id, value, onChange, emptyLabel, vacancies }: RoomSelectProps) {
    const [manageOpen, setManageOpen] = useState(false);
    const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list() });

    const selected = (rooms ?? []).find((room) => room.id === value);
    // Sala desativada some da lista, a não ser que já seja a escolhida (aula/turma antiga).
    const options = (rooms ?? []).filter((room) => room.active || room.id === value);

    return (
        <>
            <Row>
                <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
                    <option value="">{emptyLabel}</option>
                    {options.map((room) => (
                        <option key={room.id} value={room.id}>
                            {room.name}
                            {room.capacity ? ` (${room.capacity} lugares)` : ''}
                            {room.active ? '' : ' — desativada'}
                        </option>
                    ))}
                </Select>
                <Button type="button" $variant="secondary" onClick={() => setManageOpen(true)} title="Cadastrar ou editar salas">
                    <Settings2 size={14} /> Gerenciar salas
                </Button>
            </Row>
            {rooms && options.length === 0 && <HelpText>Nenhuma sala cadastrada. Use “Gerenciar salas” para cadastrar as salas da academia.</HelpText>}
            {selected?.capacity && vacancies && selected.capacity < vacancies ? (
                <ErrorText>A sala comporta {selected.capacity} pessoas, mas a turma tem {vacancies} vagas.</ErrorText>
            ) : null}
            <RoomsModal
                open={manageOpen}
                onOpenChange={setManageOpen}
                onCreated={(room) => {
                    // Sala recém-cadastrada já fica escolhida: quem abriu o cadastro queria usá-la.
                    onChange(room.id);
                    setManageOpen(false);
                }}
            />
        </>
    );
}
