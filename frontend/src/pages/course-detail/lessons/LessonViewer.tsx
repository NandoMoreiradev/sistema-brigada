// frontend/src/pages/course-detail/lessons/LessonViewer.tsx
//
// Conteúdo de UMA aula: um player por vez (com a lista dos outros vídeos ao lado/abaixo),
// o texto da aula e o material de apoio. Usado pelo player do aluno e pela prévia da gestão.
//
// Vídeo enviado toca no <video> e avisa quando termina (é assim que o progresso é marcado).
// YouTube/Vimeo tocam embutidos; qualquer outro link abre em outra aba — e, nesses dois casos
// de link, o sistema não sabe quando o aluno terminou, então quem marca é ele.

import { useState } from 'react';
import styled from 'styled-components';
import { CheckCircle2, ExternalLink, Film, Link2, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RichTextViewer } from '@/components/ui/RichTextViewer';
import type { CourseLesson, CourseLessonVideo } from '@/services/courses';
import { LessonMaterials } from './LessonMaterials';
import { embeddedVideoFor } from './lessonMedia';

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
`;

const Stage = styled.div`
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: ${({ theme }) => theme.radii.md};
    background: #0b0d10;
    box-shadow: ${({ theme }) => theme.shadows.e2};

    video,
    iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: #0b0d10;
    }

    video {
        object-fit: contain;
    }
`;

const ExternalPrompt = styled.div`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 1rem;
    text-align: center;
    color: #fff;
    background: radial-gradient(circle at 30% 20%, #25303d, #0b0d10 70%);

    strong {
        font-size: 1rem;
    }

    span {
        max-width: 28rem;
        font-size: 0.8125rem;
        color: rgba(255, 255, 255, 0.7);
        overflow-wrap: anywhere;
    }
`;

const VideoList = styled.ol`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
`;

const VideoOption = styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.borderLight)};
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.white)};
    color: ${({ theme }) => theme.colors.textDark};
    text-align: left;
    cursor: pointer;

    &:hover {
        border-color: ${({ theme }) => theme.colors.primary};
    }

    .badge {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.backgroundMedium)};
        color: ${({ theme, $active }) => ($active ? '#fff' : theme.colors.textMedium)};
        font-size: 0.75rem;
        font-weight: 700;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .kind {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.7rem;
        font-weight: 500;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    .done {
        flex-shrink: 0;
        display: flex;
        color: ${({ theme }) => theme.colors.success};
    }
`;

const About = styled.section`
    h4 {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: ${({ theme }) => theme.colors.textMuted};
    }

    /* O texto da aula tem a largura de uma coluna de leitura, não da tela inteira. */
    > div {
        max-width: 70ch;
        font-size: 0.9375rem;
        line-height: 1.65;
    }
`;

const EmptyNote = styled.div`
    padding: 1.5rem 1rem;
    border: 1px dashed ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.md};
    text-align: center;
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.colors.textMuted};
`;

function videoLabel(video: CourseLessonVideo, index: number, total: number) {
    return video.title || (total > 1 ? `Vídeo ${index + 1}` : 'Vídeo da aula');
}

function VideoStage({ video, label, autoPlay, onEnded }: { video: CourseLessonVideo; label: string; autoPlay: boolean; onEnded: () => void }) {
    if (video.storageKey) {
        return (
            <Stage>
                <video key={video.id} controls playsInline preload="metadata" src={video.url} autoPlay={autoPlay} onEnded={onEnded} aria-label={label} />
            </Stage>
        );
    }

    const embedded = embeddedVideoFor(video.url);
    if (embedded) {
        return (
            <Stage>
                <iframe
                    key={video.id}
                    src={embedded.embedUrl}
                    title={`${label} (${embedded.provider})`}
                    loading="lazy"
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            </Stage>
        );
    }

    let host = video.url;
    try {
        host = new URL(video.url).hostname.replace(/^www\./, '');
    } catch {
        // link fora do padrão: mostra do jeito que foi colado
    }
    return (
        <Stage>
            <ExternalPrompt>
                <ExternalLink size={30} />
                <strong>{label}</strong>
                <span>Este vídeo fica em {host} e abre em outra aba.</span>
                <Button as="a" href={video.url} target="_blank" rel="noreferrer">
                    <PlayCircle size={16} /> Assistir vídeo
                </Button>
            </ExternalPrompt>
        </Stage>
    );
}

export function LessonViewer({
    lesson,
    watchedVideoIds = [],
    onVideoEnded,
}: {
    lesson: CourseLesson;
    watchedVideoIds?: string[];
    /** Chamado quando um vídeo enviado chega ao fim (o aluno ainda não tinha assistido). */
    onVideoEnded?: (videoId: string) => void;
}) {
    const videos = lesson.videos ?? [];
    const materials = lesson.files ?? [];
    const hasContent = Boolean(lesson.content && lesson.content !== '<p></p>');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    // Só toca sozinho depois que a pessoa escolheu outro vídeo — nunca ao abrir a aula.
    const [userPicked, setUserPicked] = useState(false);

    const selected = videos.find((video) => video.id === selectedId) ?? videos[0];
    const selectedIndex = selected ? videos.indexOf(selected) : -1;

    return (
        <Wrapper>
            {selected && (
                <>
                    <VideoStage
                        video={selected}
                        label={videoLabel(selected, selectedIndex, videos.length)}
                        autoPlay={userPicked}
                        onEnded={() => {
                            if (selected.storageKey && !watchedVideoIds.includes(selected.id)) onVideoEnded?.(selected.id);
                        }}
                    />
                    {videos.length > 1 && (
                        <VideoList aria-label="Vídeos desta aula">
                            {videos.map((video, index) => {
                                const watched = watchedVideoIds.includes(video.id);
                                return (
                                    <li key={video.id}>
                                        <VideoOption
                                            type="button"
                                            $active={video.id === selected.id}
                                            aria-current={video.id === selected.id}
                                            onClick={() => {
                                                setSelectedId(video.id);
                                                setUserPicked(true);
                                            }}
                                        >
                                            <span className="badge">{index + 1}</span>
                                            <span className="text">
                                                <span className="title">{videoLabel(video, index, videos.length)}</span>
                                                <span className="kind">
                                                    {video.storageKey ? <Film size={11} /> : <Link2 size={11} />}
                                                    {video.storageKey ? 'Vídeo da aula' : embeddedVideoFor(video.url)?.provider ?? 'Link externo'}
                                                </span>
                                            </span>
                                            {watched && (
                                                <span className="done" title="Assistido">
                                                    <CheckCircle2 size={16} aria-label="Assistido" />
                                                </span>
                                            )}
                                        </VideoOption>
                                    </li>
                                );
                            })}
                        </VideoList>
                    )}
                </>
            )}

            {hasContent && (
                <About>
                    <h4>Sobre esta aula</h4>
                    <RichTextViewer html={lesson.content!} />
                </About>
            )}

            <LessonMaterials materials={materials} />

            {!selected && !hasContent && materials.length === 0 && <EmptyNote>Esta aula ainda não tem conteúdo.</EmptyNote>}
        </Wrapper>
    );
}
