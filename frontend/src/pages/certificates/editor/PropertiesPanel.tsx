// frontend/src/pages/certificates/editor/PropertiesPanel.tsx
//
// Painel da direita do editor: propriedades do elemento selecionado, ou da página
// (orientação, fundo, cores do tema, conteúdo programático) quando nada está
// selecionado.

import { forwardRef } from 'react';
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    ArrowDownToLine,
    ArrowUpToLine,
    Bold,
    BringToFront,
    Copy,
    Italic,
    Lock,
    SendToBack,
    Trash2,
    Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImageUploadButton } from '@/components/media/ImageUploadButton';
import {
    PAGE_SIZE,
    THEME_COLORS,
    type BackPage,
    type CertificateLayout,
    type PageBackground,
    type CertificateVariable,
    type FontFamily,
    type LayoutElement,
    type Orientation,
    type TextElement,
} from '../layout/types';
import { Check2, ColorField, Field, FlagButton, MmInput, NumberInput, PanelSection, Row, Toggles } from './fields';
import { ELEMENT_TYPE_LABEL, FONT_LABEL } from './layoutUtils';

export type ElementPatch = Partial<LayoutElement>;

interface ElementProps {
    element: LayoutElement;
    layout: CertificateLayout;
    variables: CertificateVariable[];
    hasLogo: boolean;
    /** Um passo de desfazer por chamada */
    onChange: (patch: ElementPatch) => void;
    /** Para digitação: começa/continua/termina um gesto (um passo de desfazer por edição) */
    onTypingStart: () => void;
    onTyping: (patch: ElementPatch) => void;
    onTypingEnd: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onArrange: (to: 'front' | 'back' | 'forward' | 'backward') => void;
}

const FONT_OPTIONS = Object.entries(FONT_LABEL) as Array<[FontFamily, string]>;

function TextProperties({
    element,
    variables,
    onChange,
    onTypingStart,
    onTyping,
    onTypingEnd,
    textareaRef,
}: Pick<ElementProps, 'variables' | 'onChange' | 'onTypingStart' | 'onTyping' | 'onTypingEnd'> & {
    element: TextElement;
    textareaRef: React.Ref<HTMLTextAreaElement>;
}) {
    const insertVariable = (key: string) => {
        if (!key) return;
        const textarea = document.getElementById(`text-content-${element.id}`) as HTMLTextAreaElement | null;
        const token = `{{${key}}}`;
        const start = textarea?.selectionStart ?? element.content.length;
        const end = textarea?.selectionEnd ?? element.content.length;
        onChange({ content: element.content.slice(0, start) + token + element.content.slice(end) });
        requestAnimationFrame(() => {
            textarea?.focus();
            textarea?.setSelectionRange(start + token.length, start + token.length);
        });
    };

    return (
        <>
            <Field label="Texto">
                <textarea
                    id={`text-content-${element.id}`}
                    ref={textareaRef}
                    rows={4}
                    value={element.content}
                    onFocus={onTypingStart}
                    onChange={(e) => onTyping({ content: e.target.value })}
                    onBlur={onTypingEnd}
                />
            </Field>
            <Field label="Inserir variável">
                <select value="" onChange={(e) => insertVariable(e.target.value)}>
                    <option value="">Escolha para inserir no cursor…</option>
                    {variables.map((variable) => (
                        <option key={variable.key} value={variable.key}>
                            {variable.label} — {`{{${variable.key}}}`}
                        </option>
                    ))}
                </select>
            </Field>
            <Row>
                <Field label="Fonte">
                    <select value={element.font} onChange={(e) => onChange({ font: e.target.value as FontFamily })}>
                        {FONT_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </Field>
                <Field label="Tamanho">
                    <NumberInput value={element.size} min={4} max={200} onCommit={(size) => onChange({ size })} suffix="pt" />
                </Field>
            </Row>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <FlagButton active={element.bold} title="Negrito" onClick={() => onChange({ bold: !element.bold })}><Bold size={14} /></FlagButton>
                <FlagButton active={element.italic} title="Itálico" onClick={() => onChange({ italic: !element.italic })}><Italic size={14} /></FlagButton>
                <FlagButton active={!!element.uppercase} title="Tudo em maiúsculas" onClick={() => onChange({ uppercase: !element.uppercase })}>AA</FlagButton>
                <Toggles
                    ariaLabel="Alinhamento horizontal"
                    value={element.align}
                    onChange={(align) => onChange({ align })}
                    options={[
                        { value: 'left', label: <AlignLeft size={14} />, title: 'À esquerda' },
                        { value: 'center', label: <AlignCenter size={14} />, title: 'Centralizado' },
                        { value: 'right', label: <AlignRight size={14} />, title: 'À direita' },
                        { value: 'justify', label: <AlignJustify size={14} />, title: 'Justificado' },
                    ]}
                />
            </div>
            <Field label="Alinhamento vertical na caixa">
                <Toggles
                    ariaLabel="Alinhamento vertical"
                    value={element.valign}
                    onChange={(valign) => onChange({ valign })}
                    options={[
                        { value: 'top', label: 'Topo', title: 'No topo da caixa' },
                        { value: 'middle', label: 'Meio', title: 'No meio da caixa' },
                        { value: 'bottom', label: 'Base', title: 'Na base da caixa' },
                    ]}
                />
            </Field>
            <Row>
                <Field label="Espaço entre linhas">
                    <NumberInput value={element.lineGap ?? 0} min={0} max={50} onCommit={(lineGap) => onChange({ lineGap })} suffix="pt" />
                </Field>
                <Field label="Espaço entre letras">
                    <NumberInput value={element.letterSpacing ?? 0} min={-5} max={30} onCommit={(letterSpacing) => onChange({ letterSpacing })} suffix="pt" />
                </Field>
            </Row>
            <Check2>
                <input type="checkbox" checked={element.autoShrink} onChange={(e) => onChange({ autoShrink: e.target.checked })} />
                Diminuir a fonte para caber na caixa (nomes longos)
            </Check2>
        </>
    );
}

export const ElementProperties = forwardRef<HTMLTextAreaElement, ElementProps>(function ElementProperties(props, textareaRef) {
    const { element, layout, hasLogo, onChange, onDelete, onDuplicate, onArrange } = props;
    const page = PAGE_SIZE[layout.orientation];

    return (
        <>
            <PanelSection>
                <h4>{ELEMENT_TYPE_LABEL[element.type]}</h4>
                <Field label="Nome na lista de camadas">
                    <input value={element.name ?? ''} placeholder="(automático)" onChange={(e) => onChange({ name: e.target.value || undefined })} maxLength={80} />
                </Field>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <Button type="button" $variant="secondary" onClick={onDuplicate} title="Duplicar (Ctrl+D)"><Copy size={14} /></Button>
                    <Button type="button" $variant="secondary" onClick={() => onChange({ locked: !element.locked })} title={element.locked ? 'Destravar' : 'Travar posição'}>
                        {element.locked ? <Unlock size={14} /> : <Lock size={14} />}
                    </Button>
                    <Button type="button" $variant="secondary" onClick={() => onArrange('front')} title="Trazer para a frente de tudo"><BringToFront size={14} /></Button>
                    <Button type="button" $variant="secondary" onClick={() => onArrange('forward')} title="Uma camada para a frente"><ArrowUpToLine size={14} /></Button>
                    <Button type="button" $variant="secondary" onClick={() => onArrange('backward')} title="Uma camada para trás"><ArrowDownToLine size={14} /></Button>
                    <Button type="button" $variant="secondary" onClick={() => onArrange('back')} title="Mandar para trás de tudo"><SendToBack size={14} /></Button>
                    <Button type="button" $variant="danger" onClick={onDelete} title="Excluir (Delete)"><Trash2 size={14} /></Button>
                </div>
            </PanelSection>

            <PanelSection>
                <h4>Posição e tamanho</h4>
                <Row>
                    <Field label="Esquerda"><MmInput pt={element.x} onCommit={(x) => onChange({ x })} /></Field>
                    <Field label="Topo"><MmInput pt={element.y} onCommit={(y) => onChange({ y })} /></Field>
                    <Field label="Largura"><MmInput pt={element.w} min={0} onCommit={(w) => onChange({ w })} /></Field>
                    <Field label="Altura"><MmInput pt={element.h} min={0} onCommit={(h) => onChange({ h })} /></Field>
                    <Field label="Rotação">
                        <NumberInput value={element.rotation ?? 0} min={-360} max={360} onCommit={(rotation) => onChange({ rotation })} suffix="°" />
                    </Field>
                    <Field label="Opacidade">
                        <NumberInput value={Math.round((element.opacity ?? 1) * 100)} min={0} max={100} onCommit={(value) => onChange({ opacity: value / 100 })} suffix="%" />
                    </Field>
                </Row>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <Button type="button" $variant="ghost" onClick={() => onChange({ x: Math.round(((page.width - element.w) / 2) * 10) / 10 })}>Centralizar na horizontal</Button>
                    <Button type="button" $variant="ghost" onClick={() => onChange({ y: Math.round(((page.height - element.h) / 2) * 10) / 10 })}>na vertical</Button>
                </div>
            </PanelSection>

            <PanelSection>
                <h4>Aparência</h4>
                {element.type === 'text' && (
                    <>
                        <TextProperties {...props} element={element} textareaRef={textareaRef} />
                        <ColorField label="Cor" value={element.color} layout={layout} onChange={(color) => onChange({ color: color ?? '#000000' })} />
                    </>
                )}

                {element.type === 'image' && (
                    <>
                        <Field label="Imagem">
                            <select value={element.source} onChange={(e) => onChange({ source: e.target.value as 'logo' | 'url' })}>
                                <option value="logo">Logo da academia{hasLogo ? '' : ' (não cadastrada)'}</option>
                                <option value="url">Outra imagem</option>
                            </select>
                        </Field>
                        {element.source === 'url' && (
                            <Field label="Endereço da imagem (PNG ou JPG)">
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <input value={element.url ?? ''} placeholder="https://..." onChange={(e) => onChange({ url: e.target.value || null })} />
                                    <ImageUploadButton context="organization-branding" pdfSafe label="Enviar" onUploaded={(url) => onChange({ url })} />
                                </div>
                            </Field>
                        )}
                        <Field label="Encaixe">
                            <Toggles
                                ariaLabel="Encaixe da imagem"
                                value={element.fit}
                                onChange={(fit) => onChange({ fit })}
                                options={[
                                    { value: 'contain', label: 'Inteira', title: 'Mostra a imagem inteira dentro da caixa' },
                                    { value: 'cover', label: 'Preencher', title: 'Preenche a caixa, cortando as sobras' },
                                    { value: 'stretch', label: 'Esticar', title: 'Estica para o tamanho exato da caixa' },
                                ]}
                            />
                        </Field>
                    </>
                )}

                {element.type === 'signature' && (
                    <>
                        <Field label="Quem assina">
                            <select value={element.source} onChange={(e) => onChange({ source: e.target.value as 'template' | 'custom' | 'student' })}>
                                <option value="template">Assinatura da personalização da academia</option>
                                <option value="custom">Outra pessoa (definir aqui)</option>
                                <option value="student">O aluno (linha em branco com o nome dele)</option>
                            </select>
                        </Field>
                        {element.source === 'custom' && (
                            <>
                                <Field label="Nome (aceita variáveis)">
                                    <input value={element.signerName ?? ''} onChange={(e) => onChange({ signerName: e.target.value })} maxLength={120} />
                                </Field>
                                <Field label="Imagem da assinatura (opcional)">
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        <input value={element.imageUrl ?? ''} placeholder="https://..." onChange={(e) => onChange({ imageUrl: e.target.value || null })} />
                                        <ImageUploadButton context="organization-branding" pdfSafe label="Enviar" onUploaded={(imageUrl) => onChange({ imageUrl })} />
                                    </div>
                                </Field>
                            </>
                        )}
                        <Row>
                            <Field label="Cargo">
                                <input value={element.role} onChange={(e) => onChange({ role: e.target.value })} maxLength={120} />
                            </Field>
                            <Field label="Fonte">
                                <select value={element.font ?? 'Helvetica'} onChange={(e) => onChange({ font: e.target.value as FontFamily })}>
                                    {FONT_OPTIONS.map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </Field>
                        </Row>
                        <ColorField label="Cor da linha" value={element.lineColor} layout={layout} onChange={(lineColor) => onChange({ lineColor: lineColor ?? '#ADB5BD' })} />
                        <ColorField label="Cor do nome" value={element.nameColor} layout={layout} onChange={(nameColor) => onChange({ nameColor: nameColor ?? '#000000' })} />
                        <ColorField label="Cor do cargo" value={element.roleColor} layout={layout} onChange={(roleColor) => onChange({ roleColor: roleColor ?? '#6C757D' })} />
                    </>
                )}

                {element.type === 'qrcode' && (
                    <>
                        <Check2>
                            <input type="checkbox" checked={element.showCode} onChange={(e) => onChange({ showCode: e.target.checked })} />
                            Mostrar o código e o endereço de validação abaixo do QR
                        </Check2>
                        <ColorField label="Cor do QR" value={element.color} layout={layout} onChange={(color) => onChange({ color: color ?? '#000000' })} />
                        <ColorField label="Cor dos textos" value={element.labelColor} layout={layout} onChange={(labelColor) => onChange({ labelColor: labelColor ?? '#6C757D' })} />
                    </>
                )}

                {element.type === 'shape' && (
                    <>
                        <Field label="Forma">
                            <Toggles
                                ariaLabel="Forma"
                                value={element.shape}
                                onChange={(shape) => onChange({ shape })}
                                options={[
                                    { value: 'rect', label: 'Retângulo', title: 'Retângulo' },
                                    { value: 'ellipse', label: 'Círculo', title: 'Círculo / elipse' },
                                    { value: 'line', label: 'Linha', title: 'Linha (de um canto ao outro da caixa)' },
                                ]}
                            />
                        </Field>
                        {element.shape !== 'line' && (
                            <ColorField label="Preenchimento" value={element.fill} layout={layout} allowNone onChange={(fill) => onChange({ fill })} />
                        )}
                        <ColorField label="Contorno" value={element.stroke} layout={layout} allowNone onChange={(stroke) => onChange({ stroke, strokeWidth: stroke && !element.strokeWidth ? 1 : element.strokeWidth })} />
                        <Row>
                            <Field label="Espessura do contorno">
                                <NumberInput value={element.strokeWidth} min={0} max={50} onCommit={(strokeWidth) => onChange({ strokeWidth })} suffix="pt" />
                            </Field>
                            {element.shape === 'rect' && (
                                <Field label="Cantos arredondados">
                                    <NumberInput value={element.radius ?? 0} min={0} max={300} onCommit={(radius) => onChange({ radius })} suffix="pt" />
                                </Field>
                            )}
                        </Row>
                    </>
                )}

                {element.type === 'seal' && (
                    <>
                        <Field label="Dentro do selo">
                            <Toggles
                                ariaLabel="Conteúdo do selo"
                                value={element.content}
                                onChange={(content) => onChange({ content })}
                                options={[
                                    { value: 'logo', label: 'Logo', title: 'A logo da academia (iniciais, se não houver logo)' },
                                    { value: 'initials', label: 'Iniciais', title: 'As iniciais do nome da academia' },
                                ]}
                            />
                        </Field>
                        <Check2>
                            <input type="checkbox" checked={element.showRibbon} onChange={(e) => onChange({ showRibbon: e.target.checked })} />
                            Mostrar a fita
                        </Check2>
                        <ColorField label="Cor do selo" value={element.color} layout={layout} onChange={(color) => onChange({ color: color ?? '#1B2A4A' })} />
                        <ColorField label="Cor do aro" value={element.ringColor} layout={layout} onChange={(ringColor) => onChange({ ringColor: ringColor ?? '#C9A227' })} />
                        <ColorField label="Cor da fita" value={element.ribbonColor} layout={layout} onChange={(ribbonColor) => onChange({ ribbonColor: ribbonColor ?? '#3A4F7A' })} />
                    </>
                )}

                {element.type === 'syllabus' && (
                    <>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                            Mostra o conteúdo programático cadastrado na turma. O que não couber na caixa continua numa página seguinte, com o mesmo desenho do verso.
                        </p>
                        <Row>
                            <Field label="Fonte">
                                <select value={element.font} onChange={(e) => onChange({ font: e.target.value as FontFamily })}>
                                    {FONT_OPTIONS.map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </Field>
                            <Field label="Tamanho">
                                <NumberInput value={element.size} min={4} max={72} onCommit={(size) => onChange({ size })} suffix="pt" />
                            </Field>
                            <Field label="Colunas">
                                <Toggles
                                    ariaLabel="Colunas"
                                    value={String(element.columns) as '1' | '2' | '3'}
                                    onChange={(value) => onChange({ columns: Number(value) })}
                                    options={[
                                        { value: '1', label: '1', title: 'Uma coluna' },
                                        { value: '2', label: '2', title: 'Duas colunas' },
                                        { value: '3', label: '3', title: 'Três colunas' },
                                    ]}
                                />
                            </Field>
                            <Field label="Espaço entre colunas">
                                <NumberInput value={element.columnGap} min={0} max={200} onCommit={(columnGap) => onChange({ columnGap })} suffix="pt" />
                            </Field>
                            <Field label="Espaço entre linhas">
                                <NumberInput value={element.lineGap} min={0} max={50} onCommit={(lineGap) => onChange({ lineGap })} suffix="pt" />
                            </Field>
                            <Field label="Alinhamento">
                                <Toggles
                                    ariaLabel="Alinhamento do conteúdo"
                                    value={element.align}
                                    onChange={(align) => onChange({ align })}
                                    options={[
                                        { value: 'left', label: <AlignLeft size={14} />, title: 'À esquerda' },
                                        { value: 'justify', label: <AlignJustify size={14} />, title: 'Justificado' },
                                    ]}
                                />
                            </Field>
                        </Row>
                        <Check2>
                            <input type="checkbox" checked={element.autoShrink} onChange={(e) => onChange({ autoShrink: e.target.checked })} />
                            Diminuir a fonte para caber numa página só
                        </Check2>
                        {element.autoShrink && (
                            <Field label="Até no mínimo">
                                <NumberInput value={element.minSize} min={4} max={element.size} onCommit={(minSize) => onChange({ minSize })} suffix="pt" />
                            </Field>
                        )}
                        <ColorField label="Cor" value={element.color} layout={layout} onChange={(color) => onChange({ color: color ?? '#212529' })} />
                    </>
                )}

                {element.type === 'ornament' && (
                    <>
                        <Field label="Canto">
                            <select value={element.corner} onChange={(e) => onChange({ corner: e.target.value as typeof element.corner })}>
                                <option value="top-left">Superior esquerdo</option>
                                <option value="top-right">Superior direito</option>
                                <option value="bottom-left">Inferior esquerdo</option>
                                <option value="bottom-right">Inferior direito</option>
                            </select>
                        </Field>
                        <ColorField label="Cor interna" value={element.color} layout={layout} onChange={(color) => onChange({ color: color ?? '#1B2A4A' })} />
                        <ColorField label="Cor externa" value={element.accentColor} layout={layout} onChange={(accentColor) => onChange({ accentColor: accentColor ?? '#E4C465' })} />
                    </>
                )}
            </PanelSection>
        </>
    );
});

export type EditorSide = 'front' | 'back';

interface PageProps {
    layout: CertificateLayout;
    side: EditorSide;
    onChange: (change: (layout: CertificateLayout) => CertificateLayout) => void;
}

/** Troca a orientação mantendo cada elemento na mesma posição relativa da página. */
function reorient(elements: LayoutElement[], from: Orientation, to: Orientation): LayoutElement[] {
    const a = PAGE_SIZE[from];
    const b = PAGE_SIZE[to];
    return elements.map((element) => {
        const w = Math.min(element.w, b.width);
        const h = Math.min(element.h, b.height);
        const cx = ((element.x + element.w / 2) / a.width) * b.width;
        const cy = ((element.y + element.h / 2) / a.height) * b.height;
        return { ...element, w, h, x: Math.round((cx - w / 2) * 10) / 10, y: Math.round((cy - h / 2) * 10) / 10 };
    });
}

export function PageProperties({ layout, side, onChange }: PageProps) {
    const background = side === 'front' ? layout.background : layout.backPage.background;
    const setBackground = (patch: Partial<PageBackground>) =>
        onChange((l) =>
            side === 'front'
                ? { ...l, background: { ...l.background, ...patch } }
                : { ...l, backPage: { ...l.backPage, background: { ...l.backPage.background, ...patch } } },
        );
    const setBack = (patch: Partial<BackPage>) => onChange((l) => ({ ...l, backPage: { ...l.backPage, ...patch } }));

    const changeOrientation = (orientation: Orientation) => {
        if (orientation === layout.orientation) return;
        onChange((current) => ({
            ...current,
            orientation,
            elements: reorient(current.elements, current.orientation, orientation),
            backPage: { ...current.backPage, elements: reorient(current.backPage.elements, current.orientation, orientation) },
        }));
    };

    return (
        <>
            {side === 'back' && (
                <PanelSection>
                    <h4>Verso</h4>
                    <Check2>
                        <input type="checkbox" checked={layout.backPage.enabled} onChange={(e) => setBack({ enabled: e.target.checked })} />
                        Imprimir o verso
                    </Check2>
                    {layout.backPage.enabled && (
                        <Check2>
                            <input type="checkbox" checked={layout.backPage.onlyWithSyllabus} onChange={(e) => setBack({ onlyWithSyllabus: e.target.checked })} />
                            Só quando a turma tiver conteúdo programático
                        </Check2>
                    )}
                    <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                        Os textos do verso aceitam as mesmas variáveis da frente — por exemplo {'{{curso.cargaHoraria}}'}. O conteúdo programático vem do cadastro da turma.
                    </p>
                </PanelSection>
            )}

            <PanelSection>
                <h4>{side === 'front' ? 'Página (frente)' : 'Página (verso)'}</h4>
                {side === 'front' && (
                    <Field label="Orientação (frente e verso)">
                        <Toggles
                            ariaLabel="Orientação da página"
                            value={layout.orientation}
                            onChange={changeOrientation}
                            options={[
                                { value: 'landscape', label: 'Deitada', title: 'A4 deitado (paisagem)' },
                                { value: 'portrait', label: 'Em pé', title: 'A4 em pé (retrato)' },
                            ]}
                        />
                    </Field>
                )}
                <ColorField label="Cor de fundo" value={background.color} layout={layout} onChange={(color) => setBackground({ color: color ?? '#FFFFFF' })} />
                <Field label="Arte de fundo (página inteira, PNG ou JPG)">
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input value={background.imageUrl ?? ''} placeholder="https://..." onChange={(e) => setBackground({ imageUrl: e.target.value || null })} />
                        <ImageUploadButton context="organization-branding" pdfSafe label="Enviar" onUploaded={(imageUrl) => setBackground({ imageUrl })} />
                    </div>
                </Field>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                    Dica: se a academia já tem um certificado desenhado (Canva, Photoshop…), exporte em PNG/JPG no tamanho A4 e use como fundo — depois é só posicionar os textos com as variáveis por cima.
                </p>
            </PanelSection>

            <PanelSection>
                <h4>Cores do tema</h4>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>Valem para a frente e o verso: elementos que usam uma cor do tema mudam juntos.</p>
                <Row>
                    {THEME_COLORS.map(({ key, label }) => (
                        <Field key={key} label={label}>
                            <input
                                type="color"
                                value={layout.theme[key]}
                                onChange={(e) => onChange((l) => ({ ...l, theme: { ...l.theme, [key]: e.target.value.toUpperCase() } }))}
                                style={{ height: '2rem', padding: 2, cursor: 'pointer' }}
                            />
                        </Field>
                    ))}
                </Row>
            </PanelSection>
        </>
    );
}
