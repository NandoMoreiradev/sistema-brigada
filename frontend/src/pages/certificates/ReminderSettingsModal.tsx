// frontend/src/pages/certificates/ReminderSettingsModal.tsx
//
// Configuração dos lembretes de vencimento da academia (backend:
// certificate-reminders.service.ts). A pré-visualização é recalculada pelo backend
// com os valores AINDA NÃO salvos, usando as mesmas regras do envio — o que aparece
// aqui é o que vai sair.

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { format } from 'date-fns';
import { X, Plus, Mail } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Field, Label, Input, Select, HelpText, CheckboxField, FormActions } from '@/components/ui/FormField';
import { certificateRemindersApi, type ReminderSettingsInput, type DigestFrequency } from '@/services/certificates';
import { peopleApi } from '@/services/people';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissions';
import { toast } from '@/utils/toast';

const Section = styled.section`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 0;
    border-top: 1px solid ${({ theme }) => theme.colors.borderLight};

    &:first-of-type {
        border-top: none;
        padding-top: 0;
    }

    h3 {
        margin: 0;
        font-size: 0.875rem;
        color: ${({ theme }) => theme.colors.textDark};
    }
`;

const Chips = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
`;

const Chip = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.35rem 0.25rem 0.65rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: 0.75rem;
    font-weight: 600;

    button {
        display: inline-flex;
        border: none;
        background: none;
        color: inherit;
        cursor: pointer;
        padding: 0.1rem;
        border-radius: 50%;
    }
`;

const AddRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0.4rem;

    input {
        width: 5.5rem;
    }
`;

const PreviewBox = styled.div`
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.lightGray};
    padding: 0.75rem;
    font-size: 0.8125rem;

    strong {
        color: ${({ theme }) => theme.colors.textDark};
    }

    ul {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    li {
        display: grid;
        grid-template-columns: 4.5rem 1fr auto;
        gap: 0.5rem;
        color: ${({ theme }) => theme.colors.textMedium};
    }

    li span:last-child {
        color: ${({ theme }) => theme.colors.textMuted};
        white-space: nowrap;
    }

    @media (max-width: 520px) {
        li {
            grid-template-columns: 4rem 1fr;
        }
        li span:last-child {
            grid-column: 2;
        }
    }
`;

const Footer = styled(FormActions)`
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;

    a {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.8125rem;
    }

    div {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
    }
`;

const DEFAULT_INPUT: ReminderSettingsInput = {
    enabled: true,
    daysBefore: [30],
    daysAfter: [],
    sendHour: 8,
    includeRecyclingSuggestion: true,
    digestFrequency: 'OFF',
    digestRecipientUserIds: [],
    digestWindowDays: 30,
};

const dayLabel = (days: number, after = false) =>
    days === 0 && !after ? 'No dia' : `${days} ${days === 1 ? 'dia' : 'dias'} ${after ? 'depois' : 'antes'}`;

const errorMessage = (error: unknown, fallback: string) => {
    const message = isAxiosError(error) ? error.response?.data?.message : undefined;
    return (Array.isArray(message) ? message[0] : message) || fallback;
};

interface DaysEditorProps {
    values: number[];
    onChange: (values: number[]) => void;
    min: number;
    max: number;
    after?: boolean;
    placeholder: string;
}

function DaysEditor({ values, onChange, min, max, after, placeholder }: DaysEditorProps) {
    const [draft, setDraft] = useState('');
    const sorted = [...values].sort((a, b) => (after ? a - b : b - a));
    const parsed = Number(draft);
    const canAdd = draft !== '' && Number.isInteger(parsed) && parsed >= min && parsed <= max && !values.includes(parsed);

    const add = () => {
        if (!canAdd) return;
        onChange([...values, parsed]);
        setDraft('');
    };

    return (
        <Chips>
            {sorted.map((days) => (
                <Chip key={days}>
                    {dayLabel(days, after)}
                    <button type="button" aria-label={`Remover ${dayLabel(days, after)}`} onClick={() => onChange(values.filter((v) => v !== days))}>
                        <X size={12} />
                    </button>
                </Chip>
            ))}
            <AddRow>
                <Input
                    type="number"
                    min={min}
                    max={max}
                    value={draft}
                    placeholder={placeholder}
                    aria-label={after ? 'Dias depois do vencimento' : 'Dias antes do vencimento'}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
                <Button type="button" $variant="secondary" onClick={add} disabled={!canAdd}>
                    <Plus size={14} /> Adicionar
                </Button>
            </AddRow>
        </Chips>
    );
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ReminderSettingsModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [form, setForm] = useState<ReminderSettingsInput>(DEFAULT_INPUT);
    const [loadedForOpen, setLoadedForOpen] = useState(false);
    const [debounced, setDebounced] = useState<ReminderSettingsInput>(DEFAULT_INPUT);

    const { data: saved, isSuccess } = useQuery({
        queryKey: ['certificate-reminder-settings'],
        queryFn: () => certificateRemindersApi.getSettings(),
        enabled: open,
    });

    const { data: roster } = useQuery({
        queryKey: ['users', 'roster'],
        queryFn: () => peopleApi.roster(),
        enabled: open && form.digestFrequency !== 'OFF',
    });

    // Preenche quando a configuração salva chega — uma vez por abertura, para um refetch
    // em segundo plano não desfazer o que está sendo editado.
    useEffect(() => {
        if (!open) {
            setLoadedForOpen(false);
            return;
        }
        if (isSuccess && saved && !loadedForOpen) {
            // Só os campos editáveis: a resposta traz também id, updatedAt etc., que o PUT recusa.
            const values: ReminderSettingsInput = {
                enabled: saved.enabled,
                daysBefore: saved.daysBefore,
                daysAfter: saved.daysAfter,
                sendHour: saved.sendHour,
                includeRecyclingSuggestion: saved.includeRecyclingSuggestion,
                digestFrequency: saved.digestFrequency,
                digestRecipientUserIds: saved.digestRecipientUserIds,
                digestWindowDays: saved.digestWindowDays,
            };
            setForm(values);
            setDebounced(values);
            setLoadedForOpen(true);
        }
    }, [open, isSuccess, saved, loadedForOpen]);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(form), 400);
        return () => clearTimeout(timer);
    }, [form]);

    const { data: preview, isFetching: previewLoading } = useQuery({
        queryKey: ['certificate-reminder-preview', debounced],
        queryFn: () => certificateRemindersApi.preview(debounced),
        enabled: open && loadedForOpen,
        placeholderData: (previous) => previous,
    });

    const saveMutation = useMutation({
        mutationFn: () => certificateRemindersApi.saveSettings(form),
        onSuccess: () => {
            toast.success('Lembretes de vencimento salvos.');
            queryClient.invalidateQueries({ queryKey: ['certificate-reminder-settings'] });
            onOpenChange(false);
        },
        onError: (error) => toast.error(errorMessage(error, 'Não foi possível salvar os lembretes.')),
    });

    const update = (patch: Partial<ReminderSettingsInput>) => setForm((current) => ({ ...current, ...patch }));

    const rosterById = new Map((roster ?? []).map((person) => [person.id, person.name]));
    const availableRecipients = (roster ?? []).filter((person) => !form.digestRecipientUserIds.includes(person.id));
    const digestMissingRecipients = form.digestFrequency !== 'OFF' && form.digestRecipientUserIds.length === 0;
    const canEditEmails = hasPermission(user, 'communications:manage');

    let body: ReactNode;
    if (!loadedForOpen) {
        body = <p>Carregando...</p>;
    } else {
        body = (
            <>
                <Section>
                    <h3>Lembretes para o aluno</h3>
                    <CheckboxField>
                        <input type="checkbox" checked={form.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
                        Enviar lembretes automáticos por e-mail (e no sino do sistema)
                    </CheckboxField>

                    <Field>
                        <Label>Antes do vencimento</Label>
                        <DaysEditor values={form.daysBefore} onChange={(daysBefore) => update({ daysBefore })} min={0} max={365} placeholder="Ex.: 60" />
                        <HelpText>Use 0 para avisar no próprio dia do vencimento.</HelpText>
                    </Field>

                    <Field>
                        <Label>Depois do vencimento</Label>
                        <DaysEditor
                            values={form.daysAfter}
                            onChange={(daysAfter) => update({ daysAfter })}
                            min={1}
                            max={365}
                            after
                            placeholder="Ex.: 7"
                        />
                        <HelpText>Usa o e-mail "Certificado vencido". Certificados vencidos há muito tempo não são avisados de novo.</HelpText>
                    </Field>

                    <Field>
                        <Label htmlFor="sendHour">Horário de envio</Label>
                        <Select id="sendHour" value={form.sendHour} onChange={(e) => update({ sendHour: Number(e.target.value) })} style={{ maxWidth: 160 }}>
                            {Array.from({ length: 24 }, (_, hour) => (
                                <option key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</option>
                            ))}
                        </Select>
                        <HelpText>Horário de Brasília.</HelpText>
                    </Field>

                    <CheckboxField>
                        <input
                            type="checkbox"
                            checked={form.includeRecyclingSuggestion}
                            onChange={(e) => update({ includeRecyclingSuggestion: e.target.checked })}
                        />
                        Sugerir no e-mail a próxima turma de reciclagem
                    </CheckboxField>
                    <HelpText style={{ marginTop: '-0.5rem' }}>
                        A turma de reciclagem indicada na turma; se ela já começou, a próxima turma da mesma categoria.
                    </HelpText>
                </Section>

                <Section>
                    <h3>Resumo para a gestão</h3>
                    <HelpText>Lista de quem vence nos próximos dias e de quem venceu recentemente. Só sai quando há alguém na lista.</HelpText>
                    <Segmented<DigestFrequency>
                        ariaLabel="Frequência do resumo"
                        value={form.digestFrequency}
                        onChange={(digestFrequency) => update({ digestFrequency })}
                        options={[
                            { value: 'OFF', label: 'Desligado' },
                            { value: 'DAILY', label: 'Diário' },
                            { value: 'WEEKLY', label: 'Semanal (segunda)' },
                        ]}
                    />

                    {form.digestFrequency !== 'OFF' && (
                        <>
                            <Field>
                                <Label htmlFor="digestRecipient">Quem recebe</Label>
                                <Chips>
                                    {form.digestRecipientUserIds.map((id) => (
                                        <Chip key={id}>
                                            {rosterById.get(id) ?? '…'}
                                            <button
                                                type="button"
                                                aria-label={`Remover ${rosterById.get(id) ?? ''}`}
                                                onClick={() => update({ digestRecipientUserIds: form.digestRecipientUserIds.filter((v) => v !== id) })}
                                            >
                                                <X size={12} />
                                            </button>
                                        </Chip>
                                    ))}
                                </Chips>
                                <Select
                                    id="digestRecipient"
                                    value=""
                                    onChange={(e) => e.target.value && update({ digestRecipientUserIds: [...form.digestRecipientUserIds, e.target.value] })}
                                >
                                    <option value="">Adicionar pessoa da academia...</option>
                                    {availableRecipients.map((person) => (
                                        <option key={person.id} value={person.id}>{person.name}</option>
                                    ))}
                                </Select>
                                {digestMissingRecipients && <HelpText style={{ color: '#c0392b' }}>Escolha pelo menos uma pessoa.</HelpText>}
                            </Field>
                            <Field>
                                <Label htmlFor="digestWindowDays">Incluir quem vence nos próximos</Label>
                                <Select
                                    id="digestWindowDays"
                                    value={form.digestWindowDays}
                                    onChange={(e) => update({ digestWindowDays: Number(e.target.value) })}
                                    style={{ maxWidth: 160 }}
                                >
                                    {[15, 30, 60, 90].map((days) => (
                                        <option key={days} value={days}>{days} dias</option>
                                    ))}
                                </Select>
                            </Field>
                        </>
                    )}
                </Section>

                <Section>
                    <h3>Próximos 30 dias</h3>
                    <PreviewBox aria-live="polite">
                        {!preview ? (
                            'Calculando...'
                        ) : !form.enabled ? (
                            'Lembretes automáticos desligados: nenhum e-mail será enviado aos alunos.'
                        ) : (
                            <>
                                <strong>
                                    {preview.total === 0
                                        ? 'Nenhum lembrete a enviar nos próximos 30 dias.'
                                        : `${preview.total} ${preview.total === 1 ? 'lembrete será enviado' : 'lembretes serão enviados'}.`}
                                </strong>
                                {previewLoading && ' Atualizando...'}
                                {preview.skippedAlreadyRenewed > 0 && (
                                    <div>{preview.skippedAlreadyRenewed} aluno(s) já renovaram o certificado e não serão lembrados.</div>
                                )}
                                {preview.items.length > 0 && (
                                    <ul>
                                        {preview.items.slice(0, 8).map((item) => (
                                            <li key={`${item.certificateId}-${item.stage}`}>
                                                <span>{format(new Date(item.date), 'dd/MM')}</span>
                                                <span>{item.studentName} · {item.courseName}</span>
                                                <span>{item.stageLabel}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {preview.total > 8 && <div style={{ marginTop: '0.35rem' }}>e mais {preview.total - 8}.</div>}
                            </>
                        )}
                    </PreviewBox>
                </Section>
            </>
        );
    }

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Lembretes de vencimento" width="640px">
            {body}
            <Footer>
                {canEditEmails && (
                    <Link to="/admin/emails" onClick={() => onOpenChange(false)}>
                        <Mail size={14} /> Editar o texto dos e-mails
                    </Link>
                )}
                <div>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        type="button"
                        onClick={() => saveMutation.mutate()}
                        disabled={!loadedForOpen || digestMissingRecipients || saveMutation.isPending}
                    >
                        {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                </div>
            </Footer>
        </Modal>
    );
}
