// frontend/src/pages/certificates/editor/CertificateEditorPage.tsx
//
// Editor visual de um modelo de certificado (/certificates/designs/:designId). Edita o mesmo
// formato que o backend guarda e desenha (layout/types.ts); o canvas é uma
// aproximação em HTML, e "Pré-visualizar PDF" mostra o resultado exato.
//
// Atalhos: Ctrl+Z / Ctrl+Shift+Z (ou Ctrl+Y), Ctrl+S, Ctrl+D (duplicar),
// Delete, setas (1pt; Shift = 10pt), Esc (tira a seleção).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Braces,
    Circle,
    Eye,
    FileImage,
    Minus,
    PenLine,
    Plus,
    QrCode,
    Redo2,
    Save,
    Square,
    Stamp,
    Triangle,
    Type,
    Undo2,
    UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { certificateDesignsApi, certificateTemplateApi, type LayoutPreset } from '@/services/certificates';
import { coursesApi } from '@/services/courses';
import { toast } from '@/utils/toast';
import type { CertificateLayout, LayoutElement } from '../layout/types';
import { certificateErrorMessage, usePdfPreview } from '../PdfPreview';
import { EditorCanvas } from './EditorCanvas';
import { MiniLayout } from './MiniLayout';
import { useCertificateRenderContext } from './useCertificateRenderContext';
import { LayersPanel } from './LayersPanel';
import { ElementProperties, PageProperties, type ElementPatch } from './PropertiesPanel';
import { createElement, duplicateElement, NEW_ELEMENT_OPTIONS, type NewElementKind } from './elementFactory';
import { useHistory } from './useHistory';

const Shell = styled.div`
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.white};
    border-radius: ${({ theme }) => theme.radii.lg};
    box-shadow: ${({ theme }) => theme.shadows.e1};
    overflow: hidden;
`;

const Toolbar = styled.header`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.9rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    flex-wrap: wrap;

    h1 {
        margin: 0;
        font-size: 0.95rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    .dirty {
        font-size: 0.72rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    .spacer {
        flex: 1;
    }

    .zoom {
        font-size: 0.75rem;
        min-width: 3rem;
        text-align: center;
        color: ${({ theme }) => theme.colors.textMedium};
    }
`;

const Body = styled.div`
    flex: 1;
    min-height: 0;
    display: flex;
`;

const Side = styled.aside<{ $width: number }>`
    width: ${({ $width }) => $width}px;
    flex-shrink: 0;
    overflow-y: auto;
    border-color: ${({ theme }) => theme.colors.borderLight};
    border-style: solid;
    border-width: 0;
    background: ${({ theme }) => theme.colors.white};

    &:first-child {
        border-right-width: 1px;
    }

    &:last-child {
        border-left-width: 1px;
    }

    h3 {
        margin: 0;
        padding: 0.85rem 1rem 0.4rem;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const AddGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    padding: 0 0.75rem 0.5rem;

    button {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.5rem;
        border: 1px solid ${({ theme }) => theme.colors.borderLight};
        border-radius: 6px;
        background: ${({ theme }) => theme.colors.white};
        font-size: 0.75rem;
        color: ${({ theme }) => theme.colors.textDark};
        cursor: pointer;
        text-align: left;
    }

    button:hover {
        border-color: ${({ theme }) => theme.colors.primary};
        background: ${({ theme }) => theme.colors.primaryLight};
    }
`;

const PresetCard = styled.button`
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    width: calc(100% - 1.5rem);
    margin: 0 0.75rem 0.5rem;
    padding: 0.5rem;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.white};
    cursor: pointer;
    text-align: left;

    &:hover {
        border-color: ${({ theme }) => theme.colors.primary};
    }

    strong {
        font-size: 0.78rem;
        color: ${({ theme }) => theme.colors.textDark};
    }

    span {
        font-size: 0.7rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }
`;

const NarrowNotice = styled.div`
    display: none;
    padding: 0.6rem 0.9rem;
    font-size: 0.8rem;
    background: ${({ theme }) => theme.colors.infoLight};
    color: ${({ theme }) => theme.colors.infoDark};

    @media (max-width: 1100px) {
        display: block;
    }
`;

const ADD_ICONS: Record<NewElementKind, typeof Type> = {
    text: Type,
    'variable-text': UserRound,
    image: FileImage,
    signature: PenLine,
    qrcode: QrCode,
    rect: Square,
    ellipse: Circle,
    line: Minus,
    seal: Stamp,
    ornament: Triangle,
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

export default function CertificateEditorPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const {
        value: layout,
        set: setLayout,
        reset: resetLayout,
        begin: beginGesture,
        preview: previewLayout,
        end: endGesture,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useHistory<CertificateLayout | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [showVariables, setShowVariables] = useState(false);
    const [previewCourseId, setPreviewCourseId] = useState('');
    const savedJson = useRef<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preview = usePdfPreview();

    const { designId = '' } = useParams<{ designId: string }>();
    const [name, setName] = useState('');
    const { ctx, template, variables } = useCertificateRenderContext(showVariables);
    const { data: design, error: designError } = useQuery({
        queryKey: ['certificate-designs', designId],
        queryFn: () => certificateDesignsApi.get(designId),
        enabled: !!designId,
        retry: false,
    });
    const { data: presets = [] } = useQuery({ queryKey: ['certificate-presets'], queryFn: () => certificateTemplateApi.presets() });
    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => coursesApi.list() });

    // Carrega o modelo salvo uma vez; depois disso o editor é a fonte da verdade até salvar.
    const savedName = useRef('');
    useEffect(() => {
        if (design && savedJson.current === null) {
            savedJson.current = JSON.stringify(design.layout);
            savedName.current = design.name;
            setName(design.name);
            resetLayout(design.layout);
        }
    }, [design, resetLayout]);

    const dirty = !!layout && savedJson.current !== null && (JSON.stringify(layout) !== savedJson.current || name.trim() !== savedName.current);

    // Aviso do navegador ao fechar/recarregar com alterações não salvas.
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const selected = layout?.elements.find((element) => element.id === selectedId) ?? null;

    // ---------------------------------------------------------------- edição

    const updateElement = useCallback(
        (id: string, patch: ElementPatch, coalesceKey?: string) =>
            setLayout(
                (current) => current && { ...current, elements: current.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as LayoutElement) : e)) },
                coalesceKey,
            ),
        [setLayout],
    );

    const previewElement = useCallback(
        (next: LayoutElement) => previewLayout((current) => current && { ...current, elements: current.elements.map((e) => (e.id === next.id ? next : e)) }),
        [previewLayout],
    );

    const addElement = (kind: NewElementKind) => {
        if (!layout) return;
        const element = createElement(kind, layout);
        setLayout({ ...layout, elements: [...layout.elements, element] });
        setSelectedId(element.id);
    };

    const deleteSelected = useCallback(() => {
        if (!selectedId) return;
        setLayout((current) => current && { ...current, elements: current.elements.filter((e) => e.id !== selectedId) });
        setSelectedId(null);
    }, [setLayout, selectedId]);

    const duplicateSelected = useCallback(() => {
        if (!selected || !layout) return;
        const copy = duplicateElement(selected);
        const index = layout.elements.findIndex((e) => e.id === selected.id);
        setLayout({ ...layout, elements: [...layout.elements.slice(0, index + 1), copy, ...layout.elements.slice(index + 1)] });
        setSelectedId(copy.id);
    }, [setLayout, layout, selected]);

    const arrange = (to: 'front' | 'back' | 'forward' | 'backward') => {
        if (!layout || !selected) return;
        const others = layout.elements.filter((e) => e.id !== selected.id);
        const index = layout.elements.findIndex((e) => e.id === selected.id);
        const target = { front: others.length, back: 0, forward: Math.min(others.length, index + 1), backward: Math.max(0, index - 1) }[to];
        setLayout({ ...layout, elements: [...others.slice(0, target), selected, ...others.slice(target)] });
    };

    const applyPreset = (preset: LayoutPreset) => {
        if (!window.confirm(`Trocar o layout atual pelo modelo "${preset.name}"? Dá para desfazer com Ctrl+Z enquanto não salvar.`)) return;
        setLayout(preset.layout);
        setSelectedId(null);
    };

    // ---------------------------------------------------------------- salvar

    const saveMutation = useMutation({
        mutationFn: (value: CertificateLayout) => certificateDesignsApi.update(designId, { name: name.trim() || savedName.current, layout: value }),
        onSuccess: (saved) => {
            savedJson.current = JSON.stringify(saved.layout);
            savedName.current = saved.name;
            setName(saved.name);
            resetLayout(saved.layout);
            queryClient.setQueryData(['certificate-designs', designId], saved);
            queryClient.invalidateQueries({ queryKey: ['certificate-designs'], exact: true });
            toast.success('Modelo salvo. Os próximos certificados já saem assim; use "Regerar PDFs" para os já emitidos.');
        },
        onError: async (error) => toast.error(await certificateErrorMessage(error, 'Não foi possível salvar o layout.')),
    });

    const save = useCallback(() => {
        if (layout && dirty && !saveMutation.isPending) saveMutation.mutate(layout);
    }, [dirty, layout, saveMutation]);

    // ---------------------------------------------------------------- teclado

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const mod = event.ctrlKey || event.metaKey;
            const key = event.key.toLowerCase();
            if (mod && key === 's') {
                event.preventDefault();
                save();
                return;
            }
            if (isTyping(event.target)) return;
            if (mod && key === 'z') {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
            } else if (mod && key === 'y') {
                event.preventDefault();
                redo();
            } else if (mod && key === 'd') {
                event.preventDefault();
                duplicateSelected();
            } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
                event.preventDefault();
                deleteSelected();
            } else if (event.key === 'Escape') {
                setSelectedId(null);
            } else if (selected && !selected.locked && event.key.startsWith('Arrow')) {
                event.preventDefault();
                const step = event.shiftKey ? 10 : 1;
                const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
                const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
                updateElement(selected.id, { x: selected.x + dx, y: selected.y + dy }, `nudge:${selected.id}`);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [save, undo, redo, duplicateSelected, deleteSelected, selected, updateElement]);

    const goBack = () => {
        if (dirty && !window.confirm('Sair sem salvar? As alterações no layout serão perdidas.')) return;
        navigate('/certificates');
    };

    if (designError) {
        return (
            <Shell style={{ alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                Modelo de certificado não encontrado.
                <Button type="button" $variant="secondary" onClick={() => navigate('/certificates')}>Voltar para Certificados</Button>
            </Shell>
        );
    }

    if (!layout || !template) {
        return <Shell style={{ alignItems: 'center', justifyContent: 'center' }}>Carregando editor...</Shell>;
    }

    const zoomIndex = ZOOM_STEPS.indexOf(zoom);

    return (
        <Shell>
            <Toolbar>
                <Button type="button" $variant="ghost" onClick={goBack} aria-label="Voltar para Certificados" title="Voltar para Certificados">
                    <ArrowLeft size={16} />
                </Button>
                <h1>Modelo:</h1>
                <input
                    aria-label="Nome do modelo"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    style={{ fontSize: '0.9rem', fontWeight: 600, padding: '0.3rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 6, minWidth: 0, width: 220 }}
                />
                <span className="dirty">{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</span>
                <span className="spacer" />
                <Button type="button" $variant="ghost" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">
                    <Undo2 size={16} />
                </Button>
                <Button type="button" $variant="ghost" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">
                    <Redo2 size={16} />
                </Button>
                <Button type="button" $variant="ghost" onClick={() => setZoom(ZOOM_STEPS[Math.max(0, zoomIndex - 1)])} disabled={zoomIndex <= 0} aria-label="Diminuir zoom">
                    <Minus size={16} />
                </Button>
                <button type="button" className="zoom" onClick={() => setZoom(1)} title="Ajustar à tela" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                    {Math.round(zoom * 100)}%
                </button>
                <Button type="button" $variant="ghost" onClick={() => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, zoomIndex + 1)])} disabled={zoomIndex >= ZOOM_STEPS.length - 1} aria-label="Aumentar zoom">
                    <Plus size={16} />
                </Button>
                <Button
                    type="button"
                    $variant={showVariables ? 'primary' : 'secondary'}
                    onClick={() => setShowVariables((value) => !value)}
                    title="Alterna entre os valores de exemplo e as variáveis ({{aluno.nome}}...)"
                >
                    <Braces size={14} /> {showVariables ? 'Vendo variáveis' : 'Ver variáveis'}
                </Button>
                <select
                    aria-label="Turma usada na pré-visualização"
                    value={previewCourseId}
                    onChange={(e) => setPreviewCourseId(e.target.value)}
                    style={{ maxWidth: 200, padding: '0.4rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                >
                    <option value="">Turma de exemplo</option>
                    {(courses?.data ?? []).map((course) => (
                        <option key={course.id} value={course.id}>{course.event.title}</option>
                    ))}
                </select>
                <Button type="button" $variant="secondary" onClick={() => preview.generate({ layout, courseId: previewCourseId || undefined })} disabled={preview.isGenerating}>
                    <Eye size={14} /> {preview.isGenerating ? 'Gerando...' : 'Pré-visualizar PDF'}
                </Button>
                <Button type="button" onClick={save} disabled={!dirty || saveMutation.isPending} title="Salvar (Ctrl+S)">
                    <Save size={14} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
            </Toolbar>
            <NarrowNotice>O editor funciona melhor numa tela larga (computador). Em telas menores, use o zoom e role a página.</NarrowNotice>

            <Body>
                <Side $width={232}>
                    <h3>Adicionar</h3>
                    <AddGrid>
                        {NEW_ELEMENT_OPTIONS.map(({ kind, label }) => {
                            const Icon = ADD_ICONS[kind];
                            return (
                                <button key={kind} type="button" onClick={() => addElement(kind)}>
                                    <Icon size={14} /> {label}
                                </button>
                            );
                        })}
                    </AddGrid>
                    <h3>Camadas</h3>
                    <LayersPanel
                        elements={layout.elements}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onToggle={(id, patch) => updateElement(id, patch)}
                        onReorder={(elements) => setLayout({ ...layout, elements })}
                    />
                    <h3>Modelos prontos</h3>
                    {presets.map((preset) => (
                        <PresetCard key={preset.id} type="button" onClick={() => applyPreset(preset)} title={`Usar o modelo ${preset.name}`}>
                            <MiniLayout layout={preset.layout} ctx={ctx} width={190} />
                            <strong>{preset.name}</strong>
                            <span>{preset.description}</span>
                        </PresetCard>
                    ))}
                </Side>

                <EditorCanvas
                    layout={layout}
                    ctx={ctx}
                    zoom={zoom}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onGestureStart={beginGesture}
                    onGestureChange={previewElement}
                    onGestureEnd={endGesture}
                    onEditText={(id) => {
                        setSelectedId(id);
                        requestAnimationFrame(() => textareaRef.current?.focus());
                    }}
                />

                <Side $width={300}>
                    {selected ? (
                        <ElementProperties
                            key={selected.id}
                            ref={textareaRef}
                            element={selected}
                            layout={layout}
                            variables={variables}
                            hasLogo={!!template.logoUrl}
                            onChange={(patch) => updateElement(selected.id, patch, `${selected.id}:${Object.keys(patch).sort().join(',')}`)}
                            onTypingStart={beginGesture}
                            onTyping={(patch) => previewElement({ ...selected, ...patch } as LayoutElement)}
                            onTypingEnd={endGesture}
                            onDelete={deleteSelected}
                            onDuplicate={duplicateSelected}
                            onArrange={arrange}
                        />
                    ) : (
                        <PageProperties layout={layout} onChange={(change) => setLayout((current) => current && change(current), 'page')} />
                    )}
                </Side>
            </Body>
            {preview.dialog}
        </Shell>
    );
}
