// frontend/src/pages/course-detail/lessons/LessonMaterials.tsx
//
// Material de apoio de uma aula, mostrado conforme o tipo: imagens viram uma galeria com
// visualização ampliada, áudios tocam na própria página e documentos (PDF, Word, planilha,
// slides...) aparecem como cartões com o tipo, o tamanho e a ação de abrir.

import { useEffect, useState } from 'react';
import styled from 'styled-components';
import * as Dialog from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
    Archive,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    File as FileIcon,
    FileSpreadsheet,
    FileText,
    Image as ImageIcon,
    Music,
    Paperclip,
    Presentation,
    X,
    type LucideIcon,
} from 'lucide-react';
import type { CourseLessonFile } from '@/services/courses';
import { MATERIAL_KIND_LABEL, fileExtension, formatFileSize, materialKind, type MaterialKind } from './lessonMedia';

const KIND_STYLE: Record<MaterialKind, { icon: LucideIcon; color: string }> = {
    image: { icon: ImageIcon, color: '#7048e8' },
    audio: { icon: Music, color: '#0c8599' },
    pdf: { icon: FileText, color: '#e03131' },
    word: { icon: FileText, color: '#1c7ed6' },
    excel: { icon: FileSpreadsheet, color: '#2f9e44' },
    powerpoint: { icon: Presentation, color: '#e8590c' },
    archive: { icon: Archive, color: '#868e96' },
    text: { icon: FileText, color: '#868e96' },
    file: { icon: FileIcon, color: '#868e96' },
};

const Heading = styled.h4`
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0 0 0.6rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${({ theme }) => theme.colors.textMuted};

    small {
        padding: 0 0.45rem;
        border-radius: ${({ theme }) => theme.radii.pill};
        background: ${({ theme }) => theme.colors.backgroundMedium};
        font-size: 0.7rem;
        line-height: 1.5;
        letter-spacing: 0;
    }
`;

const Group = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
`;

const Gallery = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.6rem;
`;

const Thumb = styled.button`
    position: relative;
    padding: 0;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.backgroundMedium};
    cursor: zoom-in;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s ease;
    }

    &:hover img {
        transform: scale(1.04);
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.primary};
        outline-offset: 2px;
    }
`;

const ThumbName = styled.span`
    position: absolute;
    inset: auto 0 0 0;
    padding: 1.2rem 0.5rem 0.35rem;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
    color: #fff;
    font-size: 0.7rem;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const FileCard = styled.a<{ $color: string }>`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.white};
    color: inherit;
    text-decoration: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover {
        border-color: ${({ $color }) => $color};
        box-shadow: ${({ theme }) => theme.shadows.e1};
    }

    &:focus-visible {
        outline: 2px solid ${({ theme }) => theme.colors.primary};
        outline-offset: 2px;
    }

    .tile {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: ${({ $color }) => `${$color}1f`};
        color: ${({ $color }) => $color};
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .name {
        font-size: 0.8125rem;
        font-weight: 600;
        color: ${({ theme }) => theme.colors.textDark};
        overflow-wrap: anywhere;
    }

    .meta {
        font-size: 0.7rem;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    .open {
        flex-shrink: 0;
        display: flex;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    &:hover .open {
        color: ${({ $color }) => $color};
    }
`;

const AudioCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme }) => theme.colors.white};

    strong {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8125rem;
        color: ${({ theme }) => theme.colors.textDark};
        overflow-wrap: anywhere;
    }

    audio {
        width: 100%;
    }
`;

const LightboxOverlay = styled(Dialog.Overlay)`
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(10, 12, 16, 0.88);
`;

const LightboxContent = styled(Dialog.Content)`
    position: fixed;
    inset: 0;
    z-index: 201;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3.5rem 1rem 1rem;
    outline: none;

    img {
        max-width: min(100%, 1100px);
        max-height: calc(100dvh - 8rem);
        object-fit: contain;
        border-radius: ${({ theme }) => theme.radii.sm};
        background: #fff;
    }
`;

const LightboxBar = styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 100%;
    color: #fff;
    font-size: 0.8125rem;

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    a {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        color: #fff;
        font-weight: 600;
        white-space: nowrap;
    }
`;

const RoundButton = styled.button<{ $side?: 'left' | 'right' | 'top' }>`
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    cursor: pointer;
    ${({ $side }) =>
        $side === 'top'
            ? 'top: 0.75rem; right: 0.75rem;'
            : $side === 'left'
              ? 'top: 50%; left: 0.75rem; transform: translateY(-50%);'
              : 'top: 50%; right: 0.75rem; transform: translateY(-50%);'}

    &:hover {
        background: rgba(255, 255, 255, 0.3);
    }
`;

function Lightbox({ images, index, onIndexChange, onClose }: { images: CourseLessonFile[]; index: number | null; onIndexChange: (index: number) => void; onClose: () => void }) {
    const current = index === null ? null : images[index];
    const step = (delta: number) => index !== null && onIndexChange((index + delta + images.length) % images.length);

    useEffect(() => {
        if (index === null) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'ArrowRight') step(1);
            if (event.key === 'ArrowLeft') step(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    return (
        <Dialog.Root open={index !== null} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <LightboxOverlay />
                <LightboxContent aria-describedby={undefined}>
                    <VisuallyHidden>
                        <Dialog.Title>{current?.name ?? 'Imagem'}</Dialog.Title>
                    </VisuallyHidden>
                    {current?.externalUrl && (
                        <>
                            <img src={current.externalUrl} alt={current.name} />
                            <LightboxBar>
                                <span>
                                    {current.name}
                                    {images.length > 1 && index !== null ? ` · ${index + 1} de ${images.length}` : ''}
                                </span>
                                <a href={current.externalUrl} target="_blank" rel="noreferrer">
                                    <ExternalLink size={14} /> Abrir original
                                </a>
                            </LightboxBar>
                        </>
                    )}
                    {images.length > 1 && (
                        <>
                            <RoundButton $side="left" type="button" onClick={() => step(-1)} aria-label="Imagem anterior">
                                <ChevronLeft size={22} />
                            </RoundButton>
                            <RoundButton $side="right" type="button" onClick={() => step(1)} aria-label="Próxima imagem">
                                <ChevronRight size={22} />
                            </RoundButton>
                        </>
                    )}
                    <Dialog.Close asChild>
                        <RoundButton $side="top" type="button" aria-label="Fechar">
                            <X size={20} />
                        </RoundButton>
                    </Dialog.Close>
                </LightboxContent>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export function LessonMaterials({ materials }: { materials: CourseLessonFile[] }) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    if (materials.length === 0) return null;

    const withKind = materials.map((file) => ({ file, kind: materialKind(file.mimeType, file.name) }));
    // Sem URL não há o que mostrar nem abrir: a imagem/áudio cai para a lista de documentos.
    const images = withKind.filter((m) => m.kind === 'image' && m.file.externalUrl).map((m) => m.file);
    const audios = withKind.filter((m) => m.kind === 'audio' && m.file.externalUrl);
    const documents = withKind.filter((m) => !(m.kind === 'image' && m.file.externalUrl) && !(m.kind === 'audio' && m.file.externalUrl));

    return (
        <section aria-label="Material de apoio">
            <Heading>
                <Paperclip size={13} /> Material de apoio <small>{materials.length}</small>
            </Heading>
            <Group>
                {images.length > 0 && (
                    <Gallery>
                        {images.map((image, index) => (
                            <Thumb key={image.id} type="button" onClick={() => setLightboxIndex(index)} aria-label={`Ampliar imagem ${image.name}`}>
                                <img src={image.externalUrl!} alt={image.name} loading="lazy" />
                                <ThumbName>{image.name}</ThumbName>
                            </Thumb>
                        ))}
                    </Gallery>
                )}

                {audios.map(({ file }) => (
                    <AudioCard key={file.id}>
                        <strong>
                            <Music size={14} color={KIND_STYLE.audio.color} /> {file.name}
                        </strong>
                        <audio controls preload="none" src={file.externalUrl!} />
                    </AudioCard>
                ))}

                {documents.map(({ file, kind }) => {
                    const { icon: Icon, color } = KIND_STYLE[kind];
                    const extension = fileExtension(file.name).toUpperCase();
                    const meta = [MATERIAL_KIND_LABEL[kind] === 'Arquivo' && extension ? extension : MATERIAL_KIND_LABEL[kind], formatFileSize(file.size)].filter(Boolean).join(' · ');
                    const content = (
                        <>
                            <span className="tile">
                                <Icon size={20} />
                            </span>
                            <span className="text">
                                <span className="name">{file.name}</span>
                                <span className="meta">{meta}</span>
                            </span>
                            {file.externalUrl && (
                                <span className="open" aria-hidden>
                                    <ExternalLink size={16} />
                                </span>
                            )}
                        </>
                    );
                    return file.externalUrl ? (
                        <FileCard key={file.id} $color={color} href={file.externalUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${file.name}`}>
                            {content}
                        </FileCard>
                    ) : (
                        <FileCard key={file.id} $color={color} as="div">
                            {content}
                        </FileCard>
                    );
                })}
            </Group>

            <Lightbox images={images} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
        </section>
    );
}
