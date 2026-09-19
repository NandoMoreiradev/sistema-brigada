// frontend/src/components/email-builder/EmailBuilder.tsx

import React, { useState, useMemo, useCallback, useReducer, memo } from 'react';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Editor } from '@tiptap/react';
import {
    Desktop,
    DeviceMobile,
    PaperPlaneTilt,
    Rows,
    Plugs,
    ArrowUUpLeft,
    ArrowUUpRight,
    ArrowLeft,
    SlidersHorizontal,
    Cube
} from 'phosphor-react';
import { useDebouncedCallback } from 'use-debounce';

// Importações do Reducer e componentes
import { emailBuilderReducer, ActionTypes, createNewBlock } from './emailBuilderReducer';
import { BlockRenderer } from './components/BlockRenderer';
import { EmailDropZone } from './components/EmailDropZone';
import { ComponentsSection } from './components/ComponentsSection';
import { SortableBlockItem } from './components/SortableBlockItem';
import { PropertiesPanel } from './components/PropertiesPanel';
import { GlobalDesignPanel } from './components/GlobalDesignPanel';
import { PaletteItem } from './components/PaletteItem';
import { PALETTE_ITEMS } from './constants';
import { EmailBuilderErrorBoundary } from './EmailBuilderErrorBoundary';

// Importações de tipos e estilos
import type { ExtendedBlock, ExtendedBlockProps, GlobalEmailSettings, BlockType } from './types';
import {
    EditorWrapper,
    TopBar,
    TopBarGroup,
    TopBarDivider,
    BackButton,
    SegmentGroup,
    SegmentButton,
    IconButton,
    GhostButton,
    EditorContent,
    LeftSidebar,
    MainCanvas,
    EmailPreview,
    EmptyState,
    RightSidebar,
    TabContainer,
    TabButton,
    TabContent,
    PlaceholderText,
    StyleSectionTitle
} from './styles';

type PaletteDragItem = { type: 'palette'; item: typeof PALETTE_ITEMS[0] };
type ActiveDragItem = PaletteDragItem | null;

interface EmailBuilderProps {
    initialBlocks?: ExtendedBlock[];
    onChange: (blocks: ExtendedBlock[], settings: GlobalEmailSettings) => void;
    onSendTest: () => void;
    isNewTemplate: boolean;
    initialSettings?: GlobalEmailSettings;
    // Slots da barra de topo unificada (injetados pelo modal hospedeiro)
    onBack?: () => void;
    headerTitle?: React.ReactNode;
    headerSettings?: React.ReactNode;
    headerActions?: React.ReactNode;
}

// Memoização de componentes pesados
const MemoizedBlockRenderer = memo(BlockRenderer);
const MemoizedSortableBlockItem = memo(SortableBlockItem);

const EmailBuilderInner: React.FC<EmailBuilderProps> = ({
                                                            initialBlocks = [],
                                                            initialSettings,
                                                            onChange,
                                                            onSendTest,
                                                            isNewTemplate,
                                                            onBack,
                                                            headerTitle,
                                                            headerSettings,
                                                            headerActions
                                                        }) => {
    const [state, dispatch] = useReducer(emailBuilderReducer, {
        blocks: Array.isArray(initialBlocks) ? initialBlocks : [],
        selectedBlockIds: [],
        globalSettings: initialSettings || {
            backgroundColor: '#ffffff',
            maxWidth: '600px',
            fontFamily: 'Arial, sans-serif',
            primaryColor: '#007bff',
            secondaryColor: '#6c757d',
            textColor: '#333333'
        },
        history: [Array.isArray(initialBlocks) ? initialBlocks : []],
        historyIndex: 0,
    });

    const { blocks, selectedBlockIds, globalSettings } = state;

    // Estados locais
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem>(null);
    const [activeLeftTab, setActiveLeftTab] = useState<'components' | 'structure'>('components');
    const [activeRightTab, setActiveRightTab] = useState<'block' | 'email'>('email');

    // ✅ NOVO: Estado para armazenar instâncias dos editores de texto
    const [, setTextEditors] = useState<Map<string, Editor>>(new Map());

    const debouncedOnChange = useDebouncedCallback((blocks: ExtendedBlock[], settings: GlobalEmailSettings) => {
        onChange?.(blocks, settings);
    }, 500);

    React.useEffect(() => {
        debouncedOnChange(blocks, globalSettings);
    }, [blocks, globalSettings]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const isEmpty = blocks.length === 0;

    // ✅ NOVO: Callback para registrar editores de texto
    const handleEditorReady = useCallback((blockId: string, editor: Editor) => {
        setTextEditors(prev => {
            const newMap = new Map(prev);
            newMap.set(blockId, editor);
            return newMap;
        });
    }, []);

    // ✅ NOVO: Limpar editores quando blocos são deletados
    const handleDeleteBlock = useCallback((idToDelete: string) => {
        dispatch({ type: ActionTypes.DELETE_BLOCK, payload: { blockId: idToDelete } });
        setTextEditors(prev => {
            const newMap = new Map(prev);
            newMap.delete(idToDelete);
            return newMap;
        });
    }, []);

    const handleSelectBlock = useCallback((id: string, isMultiSelect: boolean = false) => {
        dispatch({ type: ActionTypes.SELECT_BLOCK, payload: { blockId: id, isMultiSelect } });
    }, []);

    const handleDeselectAll = useCallback(() => {
        dispatch({ type: ActionTypes.DESELECT_ALL });
    }, []);

    const handleDuplicateBlock = useCallback((idToDuplicate: string) => {
        dispatch({ type: ActionTypes.DUPLICATE_BLOCK, payload: { blockId: idToDuplicate } });
    }, []);

    const handleUpdateBlock = useCallback((id: string, newProps: ExtendedBlockProps, newStyle: any) => {
        dispatch({ type: ActionTypes.UPDATE_FULL_BLOCK, payload: { blockId: id, props: newProps, style: newStyle } });
    }, []);

    const handleBlockPropsUpdate = useCallback((blockId: string, newProps: ExtendedBlockProps) => {
        dispatch({ type: ActionTypes.UPDATE_BLOCK_PROPS, payload: { blockId, props: newProps } });
    }, []);

    const handleGlobalSettingsUpdate = useCallback((settings: Partial<GlobalEmailSettings>) => {
        dispatch({ type: ActionTypes.UPDATE_GLOBAL_SETTINGS, payload: { settings } });
    }, []);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const activeData = active.data.current;

        if (activeData?.type === 'palette-item') {
            const blockType = activeData.blockType as BlockType;
            setDraggedItem(blockType);
            const item = PALETTE_ITEMS.find(p => p.id === blockType);
            if (item) {
                setActiveDragItem({ type: 'palette', item });
            }
        }
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedItem(null);
        setActiveDragItem(null);
        if (!over) return;

        const activeData = active.data.current;
        const overData = over.data.current;

        if (activeData?.type === 'palette-item' && overData?.type === 'email-drop-zone') {
            const blockType = activeData.blockType as BlockType;
            const dropIndex = overData.index;
            const newBlock = createNewBlock(blockType);
            dispatch({ type: ActionTypes.ADD_BLOCK, payload: { block: newBlock, index: dropIndex } });
            // Seleciona o bloco recém-criado para abrir suas propriedades,
            // mantendo a paleta visível (sem trocar de aba à esquerda).
            dispatch({ type: ActionTypes.SELECT_BLOCK, payload: { blockId: newBlock.id, isMultiSelect: false } });
            return;
        }

        if (activeData?.type === 'structure-item' && overData?.type === 'structure-item' && active.id !== over.id) {
            const oldIndex = blocks.findIndex(block => `structure-${block.id}` === active.id);
            const newIndex = blocks.findIndex(block => `structure-${block.id}` === over.id);
            if (oldIndex > -1 && newIndex > -1) {
                dispatch({ type: ActionTypes.MOVE_BLOCK, payload: { oldIndex, newIndex } });
            }
        }
    }, [blocks]);

    const selectedBlock = useMemo(() => {
        if (selectedBlockIds.length === 1) {
            return blocks.find(b => b.id === selectedBlockIds[0]) || null;
        }
        return null;
    }, [blocks, selectedBlockIds]);

    // Alterna a sidebar direita conforme a seleção: 1 bloco → "Bloco", nenhum → "E-mail"
    React.useEffect(() => {
        if (selectedBlockIds.length === 1) setActiveRightTab('block');
        else if (selectedBlockIds.length === 0) setActiveRightTab('email');
    }, [selectedBlockIds.length]);

    const handleUndo = useCallback(() => dispatch({ type: ActionTypes.UNDO }), []);
    const handleRedo = useCallback(() => dispatch({ type: ActionTypes.REDO }), []);

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey) {
                if (event.key === 'z') {
                    event.preventDefault();
                    handleUndo();
                } else if (event.key === 'y') {
                    event.preventDefault();
                    handleRedo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    return (
        <EditorWrapper>
            <TopBar>
                <TopBarGroup>
                    {onBack && (
                        <BackButton type="button" onClick={onBack} aria-label="Voltar">
                            <ArrowLeft size={16} weight="bold" />
                            Voltar
                        </BackButton>
                    )}
                    {headerTitle}
                </TopBarGroup>

                <TopBarGroup className="center">
                    <SegmentGroup role="group" aria-label="Modo de visualização">
                        <SegmentButton
                            type="button"
                            $active={previewMode === 'desktop'}
                            onClick={() => setPreviewMode('desktop')}
                            aria-label="Visualizar no modo desktop"
                            title="Desktop"
                        >
                            <Desktop size={17} />
                        </SegmentButton>
                        <SegmentButton
                            type="button"
                            $active={previewMode === 'mobile'}
                            onClick={() => setPreviewMode('mobile')}
                            aria-label="Visualizar no modo mobile"
                            title="Mobile"
                        >
                            <DeviceMobile size={17} />
                        </SegmentButton>
                    </SegmentGroup>

                    <TopBarDivider />

                    <IconButton
                        type="button"
                        onClick={handleUndo}
                        disabled={state.historyIndex <= 0}
                        title="Desfazer (Ctrl+Z)"
                        aria-label="Desfazer última ação"
                    >
                        <ArrowUUpLeft size={18} />
                    </IconButton>
                    <IconButton
                        type="button"
                        onClick={handleRedo}
                        disabled={state.historyIndex >= state.history.length - 1}
                        title="Refazer (Ctrl+Y)"
                        aria-label="Refazer ação desfeita"
                    >
                        <ArrowUUpRight size={18} />
                    </IconButton>
                </TopBarGroup>

                <TopBarGroup className="right">
                    {headerSettings}
                    <GhostButton
                        type="button"
                        onClick={onSendTest}
                        disabled={isNewTemplate}
                        title={isNewTemplate ? "Salve o template primeiro para poder enviar um teste" : "Enviar e-mail de teste"}
                        aria-label="Enviar e-mail de teste"
                    >
                        <PaperPlaneTilt size={16} /> Teste
                    </GhostButton>
                    {headerActions}
                </TopBarGroup>
            </TopBar>

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <EditorContent>
                    <LeftSidebar>
                        <TabContainer role="tablist">
                            <TabButton
                                type="button"
                                $isActive={activeLeftTab === 'components'}
                                onClick={() => setActiveLeftTab('components')}
                                role="tab"
                                aria-selected={activeLeftTab === 'components'}
                                aria-label="Aba de componentes"
                            >
                                <Plugs size={16} style={{ marginRight: '8px' }} /> Componentes
                            </TabButton>
                            <TabButton
                                type="button"
                                $isActive={activeLeftTab === 'structure'}
                                onClick={() => setActiveLeftTab('structure')}
                                role="tab"
                                aria-selected={activeLeftTab === 'structure'}
                                aria-label="Aba de estrutura"
                            >
                                <Rows size={16} style={{ marginRight: '8px' }} /> Estrutura
                            </TabButton>
                        </TabContainer>

                        {activeLeftTab === 'components' && (
                            <TabContent role="tabpanel">
                                <ComponentsSection draggedItem={draggedItem} />
                            </TabContent>
                        )}
                        {activeLeftTab === 'structure' && (
                            <TabContent role="tabpanel">
                                <StyleSectionTitle>Estrutura do Email ({blocks.length})</StyleSectionTitle>
                                {blocks.length > 0 ? (
                                    <SortableContext items={blocks.map(b => `structure-${b.id}`)} strategy={verticalListSortingStrategy}>
                                        {blocks.map(block => (
                                            <MemoizedSortableBlockItem
                                                key={block.id}
                                                block={block}
                                                onSelect={(id, e) => handleSelectBlock(id, e.metaKey || e.ctrlKey)}
                                                onDelete={handleDeleteBlock}
                                                onDuplicate={handleDuplicateBlock}
                                                isSelected={selectedBlockIds.includes(block.id)}
                                            />
                                        ))}
                                    </SortableContext>
                                ) : (
                                    <PlaceholderText>Arraste componentes para começar.</PlaceholderText>
                                )}
                            </TabContent>
                        )}
                    </LeftSidebar>

                    <MainCanvas $previewMode={previewMode} onClick={(e) => {
                        e.stopPropagation();
                        handleDeselectAll();
                    }}>
                        <EmailPreview $previewMode={previewMode} $globalSettings={globalSettings} onClick={(e) => e.stopPropagation()}>
                            {isEmpty ? (
                                <EmptyState $isDragging={!!draggedItem}>
                                    <h3>Comece a criar seu e-mail</h3>
                                    <p>Arraste componentes da sidebar para esta área</p>
                                    <EmailDropZone index={0} isDragging={!!draggedItem} isEmpty={true} />
                                </EmptyState>
                            ) : (
                                <>
                                    <EmailDropZone index={0} isDragging={!!draggedItem} isEmpty={false} />
                                    {blocks.map((block, index) => (
                                        <React.Fragment key={block.id}>
                                            <MemoizedBlockRenderer
                                                block={block}
                                                isSelected={selectedBlockIds.includes(block.id)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelectBlock(block.id, e.metaKey || e.ctrlKey);
                                                }}
                                                globalSettings={globalSettings}
                                                onUpdateBlock={handleBlockPropsUpdate}
                                                onEditorReady={handleEditorReady} // ✅ NOVO
                                            />
                                            <EmailDropZone index={index + 1} isDragging={!!draggedItem} isEmpty={false} />
                                        </React.Fragment>
                                    ))}
                                </>
                            )}
                        </EmailPreview>
                    </MainCanvas>

                    <RightSidebar>
                        {selectedBlockIds.length > 1 ? (
                            <TabContent>
                                <StyleSectionTitle>
                                    {selectedBlockIds.length} Blocos Selecionados
                                </StyleSectionTitle>
                                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
                                    Clique em um bloco para editar suas propriedades individualmente.
                                </p>
                            </TabContent>
                        ) : (
                            <>
                                <TabContainer role="tablist">
                                    <TabButton
                                        type="button"
                                        $isActive={activeRightTab === 'block'}
                                        onClick={() => selectedBlock && setActiveRightTab('block')}
                                        disabled={!selectedBlock}
                                        role="tab"
                                        aria-selected={activeRightTab === 'block'}
                                    >
                                        <Cube size={15} style={{ marginRight: '6px' }} /> Bloco
                                    </TabButton>
                                    <TabButton
                                        type="button"
                                        $isActive={activeRightTab === 'email'}
                                        onClick={() => setActiveRightTab('email')}
                                        role="tab"
                                        aria-selected={activeRightTab === 'email'}
                                    >
                                        <SlidersHorizontal size={15} style={{ marginRight: '6px' }} /> E-mail
                                    </TabButton>
                                </TabContainer>
                                <TabContent role="tabpanel">
                                    {activeRightTab === 'block' && selectedBlock ? (
                                        <PropertiesPanel
                                            key={selectedBlock.id}
                                            block={selectedBlock}
                                            onUpdate={handleUpdateBlock}
                                            onClose={handleDeselectAll}
                                            globalSettings={globalSettings}
                                        />
                                    ) : (
                                        <GlobalDesignPanel settings={globalSettings} onUpdate={handleGlobalSettingsUpdate} />
                                    )}
                                </TabContent>
                            </>
                        )}
                    </RightSidebar>
                </EditorContent>

                <DragOverlay>
                    {activeDragItem && activeDragItem.type === 'palette' ? (
                        <PaletteItem
                            type={activeDragItem.item.id}
                            name={activeDragItem.item.name}
                            icon={activeDragItem.item.icon}
                            isDragging={true}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </EditorWrapper>
    );
};

export const EmailBuilder: React.FC<EmailBuilderProps> = (props) => {
    return (
        <EmailBuilderErrorBoundary>
            <EmailBuilderInner {...props} />
        </EmailBuilderErrorBoundary>
    );
};

export default EmailBuilder;