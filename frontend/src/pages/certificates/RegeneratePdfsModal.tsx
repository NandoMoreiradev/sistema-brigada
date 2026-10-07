// frontend/src/pages/certificates/RegeneratePdfsModal.tsx
//
// "Regerar PDFs": refaz em segundo plano os PDFs já emitidos (depois de mudar um
// modelo ou a identidade da academia) e mostra o progresso. Revogados ficam de fora.

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Label, Select, HelpText, FormActions } from '@/components/ui/FormField';
import { Segmented } from '@/components/ui/Segmented';
import { certificateDesignsApi, certificatesApi } from '@/services/certificates';
import { coursesApi } from '@/services/courses';
import { toast } from '@/utils/toast';
import { certificateErrorMessage } from './PdfPreview';

const Progress = styled.div<{ $percent: number }>`
    height: 10px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.lightGray};
    overflow: hidden;

    &::after {
        content: '';
        display: block;
        height: 100%;
        width: ${({ $percent }) => $percent}%;
        background: ${({ theme }) => theme.colors.primary};
        transition: width 0.3s ease;
    }
`;

type Scope = 'all' | 'course' | 'design';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RegeneratePdfsModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const [scope, setScope] = useState<Scope>('all');
    const [courseId, setCourseId] = useState('');
    const [designId, setDesignId] = useState('');

    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => coursesApi.list(), enabled: open && scope === 'course' });
    const { data: designs } = useQuery({ queryKey: ['certificate-designs'], queryFn: () => certificateDesignsApi.list(), enabled: open && scope === 'design' });

    // Acompanha enquanto roda; parado, consulta só ao abrir.
    const { data: status } = useQuery({
        queryKey: ['certificates', 'regeneration-status'],
        queryFn: () => certificatesApi.regenerationStatus(),
        enabled: open,
        refetchInterval: (query) => (query.state.data && !query.state.data.finishedAt ? 1500 : false),
    });
    const running = !!status && !status.finishedAt;

    const startMutation = useMutation({
        mutationFn: () =>
            certificatesApi.regenerateAll({
                courseId: scope === 'course' ? courseId : undefined,
                designId: scope === 'design' ? designId : undefined,
            }),
        onSuccess: (started) => {
            queryClient.setQueryData(['certificates', 'regeneration-status'], started);
            if (started.total === 0) toast.success('Nenhum certificado para regerar com esse filtro.');
        },
        onError: async (error) => toast.error(await certificateErrorMessage(error, 'Não foi possível iniciar a regeração.')),
    });

    // Terminou: a lista de certificados atrás do modal passa a mostrar os PDFs novos.
    const finishedAt = status?.finishedAt;
    useEffect(() => {
        if (finishedAt) queryClient.invalidateQueries({ queryKey: ['certificates'] });
    }, [finishedAt, queryClient]);

    const percent = status?.total ? Math.round(((status.done + status.failed) / status.total) * 100) : 100;
    const canStart = !running && (scope === 'all' || (scope === 'course' && courseId) || (scope === 'design' && designId));

    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Regerar PDFs dos certificados" width="520px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <HelpText>
                    Refaz os PDFs já emitidos com o modelo e a identidade atuais (o código de verificação não muda). Certificados revogados ficam de fora.
                </HelpText>

                <Segmented<Scope>
                    ariaLabel="Quais certificados"
                    value={scope}
                    onChange={setScope}
                    options={[
                        { value: 'all', label: 'Todos' },
                        { value: 'course', label: 'De uma turma' },
                        { value: 'design', label: 'De um modelo' },
                    ]}
                />
                {scope === 'course' && (
                    <Field>
                        <Label htmlFor="regenCourse">Turma</Label>
                        <Select id="regenCourse" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                            <option value="">Escolha…</option>
                            {(courses?.data ?? []).map((course) => (
                                <option key={course.id} value={course.id}>{course.event.title}</option>
                            ))}
                        </Select>
                    </Field>
                )}
                {scope === 'design' && (
                    <Field>
                        <Label htmlFor="regenDesign">Modelo</Label>
                        <Select id="regenDesign" value={designId} onChange={(e) => setDesignId(e.target.value)}>
                            <option value="">Escolha…</option>
                            {(designs ?? []).map((design) => (
                                <option key={design.id} value={design.id}>{design.name}{design.isDefault ? ' (padrão)' : ''}</option>
                            ))}
                        </Select>
                    </Field>
                )}

                {status && (
                    <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <Progress $percent={percent} />
                        <HelpText>
                            {running
                                ? `Regerando… ${status.done + status.failed} de ${status.total}`
                                : `Última regeração: ${status.done} de ${status.total} concluídos${status.failed ? `, ${status.failed} com falha (veja se o armazenamento está configurado)` : ''}.`}
                        </HelpText>
                    </div>
                )}

                <FormActions>
                    <Button type="button" $variant="secondary" onClick={() => onOpenChange(false)}>
                        {running ? 'Fechar (continua em segundo plano)' : 'Fechar'}
                    </Button>
                    <Button type="button" onClick={() => startMutation.mutate()} disabled={!canStart || startMutation.isPending}>
                        <RefreshCw size={14} /> {running ? 'Regerando…' : 'Regerar'}
                    </Button>
                </FormActions>
            </div>
        </Modal>
    );
}
