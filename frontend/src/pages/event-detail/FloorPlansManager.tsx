// frontend/src/pages/event-detail/FloorPlansManager.tsx
//
// Plantas do evento (áreas/andares que funcionam ao mesmo tempo: térreo, mezanino, externa…).
// Cada posto pertence a uma só planta. Até 10 por evento; a partir da segunda o nome é obrigatório
// (vira a aba do mapa e o título da folha impressa). Não dá para excluir uma planta que ainda tem
// postos — mova os postos para outra planta antes.

import { useRef, useState } from 'react';
import styled from 'styled-components';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, HelpText } from '@/components/ui/FormField';
import { eventFloorPlansApi, MAX_FLOOR_PLANS, type EventFloorPlan } from '@/services/events';
import { mediaApi } from '@/services/media';
import { toast } from '@/utils/toast';
import { apiErrorMessage } from '@/utils/apiError';

const Item = styled.div`
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    padding: 0.6rem 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};

    img {
        width: 72px;
        height: 48px;
        object-fit: cover;
        border-radius: ${({ theme }) => theme.radii.sm};
        border: 1px solid ${({ theme }) => theme.colors.borderLight};
    }

    @media (max-width: 560px) {
        grid-template-columns: 56px minmax(0, 1fr);

        .actions {
            grid-column: 1 / -1;
        }
    }
`;

const Actions = styled.div`
    display: flex;
    gap: 0.3rem;
    flex-wrap: wrap;
`;

const AddBox = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.75rem;
`;

interface Props {
    eventId: string;
    plans: EventFloorPlan[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged: () => void;
}

export function FloorPlansManager({ eventId, plans, open, onOpenChange, onChanged }: Props) {
    const [names, setNames] = useState<Record<string, string>>({});
    const [newName, setNewName] = useState('');
    const addInputRef = useRef<HTMLInputElement>(null);
    const replaceRef = useRef<HTMLInputElement>(null);
    const replacingId = useRef<string | null>(null);

    const done = (message: string) => { toast.success(message); onChanged(); };
    const fail = (fallback: string) => (error: unknown) => toast.error(apiErrorMessage(error, fallback));

    const nameOf = (plan: EventFloorPlan) => names[plan.id] ?? plan.name;
    const nameRequired = plans.length >= 1; // a próxima planta seria a 2ª ou mais
    const full = plans.length >= MAX_FLOOR_PLANS;

    const addMutation = useMutation({
        mutationFn: async (file: File) => {
            const { storageKey, fileUrl } = await mediaApi.upload(file, 'event-floor-plan');
            return eventFloorPlansApi.create(eventId, { name: newName.trim() || undefined, imageKey: storageKey, imageUrl: fileUrl });
        },
        onSuccess: () => { setNewName(''); done('Planta adicionada.'); },
        onError: fail('Não foi possível adicionar a planta.'),
    });

    const renameMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => eventFloorPlansApi.update(eventId, id, { name }),
        onSuccess: (_d, { id }) => { setNames((n) => Object.fromEntries(Object.entries(n).filter(([key]) => key !== id))); done('Nome atualizado.'); },
        onError: fail('Não foi possível renomear a planta.'),
    });

    const replaceMutation = useMutation({
        mutationFn: async ({ id, file }: { id: string; file: File }) => {
            const { storageKey, fileUrl } = await mediaApi.upload(file, 'event-floor-plan');
            return eventFloorPlansApi.update(eventId, id, { imageKey: storageKey, imageUrl: fileUrl });
        },
        onSuccess: () => done('Imagem da planta trocada. Os postos continuam nas mesmas posições.'),
        onError: fail('Não foi possível trocar a imagem.'),
    });

    const reorderMutation = useMutation({
        mutationFn: (ids: string[]) => eventFloorPlansApi.reorder(eventId, ids),
        onSuccess: () => onChanged(),
        onError: fail('Não foi possível reordenar as plantas.'),
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => eventFloorPlansApi.remove(eventId, id),
        onSuccess: () => done('Planta removida.'),
        onError: fail('Não foi possível remover a planta.'),
    });

    const move = (index: number, delta: -1 | 1) => {
        const ids = plans.map((p) => p.id);
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        reorderMutation.mutate(ids);
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Plantas do evento" width="640px">
            <HelpText>
                Use uma planta para cada área ou andar que funciona ao mesmo tempo (ex.: Térreo, Mezanino, Externa). Cada posto pertence a uma só planta;
                se um local precisa aparecer em duas, cadastre dois postos. Máximo de {MAX_FLOOR_PLANS} plantas.
            </HelpText>

            <div>
                {plans.map((plan, index) => {
                    const posts = plan._count?.posts ?? 0;
                    const dirty = nameOf(plan).trim() !== plan.name;
                    return (
                        <Item key={plan.id}>
                            <img src={plan.imageUrl} alt="" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <Input
                                        aria-label={`Nome da planta ${index + 1}`}
                                        value={nameOf(plan)}
                                        onChange={(e) => setNames((n) => ({ ...n, [plan.id]: e.target.value }))}
                                        style={{ padding: '0.3rem 0.5rem' }}
                                    />
                                    <Button
                                        type="button"
                                        $variant="secondary"
                                        aria-label="Salvar nome"
                                        title="Salvar nome"
                                        disabled={!dirty || !nameOf(plan).trim() || renameMutation.isPending}
                                        onClick={() => renameMutation.mutate({ id: plan.id, name: nameOf(plan).trim() })}
                                    >
                                        <Save size={14} />
                                    </Button>
                                </div>
                                <HelpText>{posts} posto(s) nesta planta</HelpText>
                            </div>
                            <Actions className="actions">
                                <Button type="button" $variant="ghost" aria-label="Subir" title="Subir" disabled={index === 0 || reorderMutation.isPending} onClick={() => move(index, -1)}>
                                    <ArrowUp size={14} />
                                </Button>
                                <Button type="button" $variant="ghost" aria-label="Descer" title="Descer" disabled={index === plans.length - 1 || reorderMutation.isPending} onClick={() => move(index, 1)}>
                                    <ArrowDown size={14} />
                                </Button>
                                <Button
                                    type="button"
                                    $variant="secondary"
                                    disabled={replaceMutation.isPending}
                                    onClick={() => { replacingId.current = plan.id; replaceRef.current?.click(); }}
                                >
                                    <Upload size={14} /> Trocar imagem
                                </Button>
                                <Button
                                    type="button"
                                    $variant="danger"
                                    aria-label="Remover planta"
                                    title={posts > 0 ? 'Mova os postos para outra planta antes de remover' : 'Remover planta'}
                                    disabled={posts > 0 || removeMutation.isPending}
                                    onClick={() => { if (window.confirm(`Remover a planta "${plan.name}"?`)) removeMutation.mutate(plan.id); }}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </Actions>
                        </Item>
                    );
                })}
            </div>

            <AddBox>
                <strong style={{ fontSize: '0.8125rem' }}>Adicionar planta</strong>
                <Input
                    aria-label="Nome da nova planta"
                    placeholder={nameRequired ? 'Nome (obrigatório) — ex.: Mezanino' : 'Nome (opcional na primeira planta)'}
                    value={newName}
                    disabled={full}
                    onChange={(e) => setNewName(e.target.value)}
                />
                <div>
                    <Button
                        type="button"
                        $variant="primary"
                        disabled={full || addMutation.isPending || (nameRequired && !newName.trim())}
                        onClick={() => addInputRef.current?.click()}
                    >
                        <Plus size={14} /> {addMutation.isPending ? 'Enviando…' : 'Escolher imagem e adicionar'}
                    </Button>
                </div>
                {full && <HelpText>Limite de {MAX_FLOOR_PLANS} plantas atingido.</HelpText>}
                {!full && nameRequired && !newName.trim() && <HelpText>Dê um nome para a nova planta — ele vira a aba do mapa e o título da folha impressa.</HelpText>}
            </AddBox>

            <input
                ref={addInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) addMutation.mutate(f); e.target.value = ''; }}
            />
            <input
                ref={replaceRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && replacingId.current) replaceMutation.mutate({ id: replacingId.current, file: f });
                    e.target.value = '';
                }}
            />
        </Modal>
    );
}
