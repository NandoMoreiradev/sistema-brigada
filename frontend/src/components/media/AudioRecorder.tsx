// frontend/src/components/media/AudioRecorder.tsx
//
// Gravador de áudio reutilizável (MediaRecorder API) — usado na aba Arquivos
// de evento e na aba Ocorrências, pra facilitar registrar algo rápido sem
// precisar digitar. Ao terminar a gravação, entrega um `File` pronto pra
// passar pro mesmo fluxo de upload via presigned URL (mediaApi.upload).

import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Mic, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/utils/toast';

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

function pickSupportedMimeType(): string | undefined {
    if (typeof MediaRecorder === 'undefined') return undefined;
    return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatElapsed(totalSeconds: number): string {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

const Row = styled.div`
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
`;

const Timer = styled.span`
    font-variant-numeric: tabular-nums;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.875rem;
`;

interface AudioRecorderProps {
    onRecorded: (file: File | null) => void;
    disabled?: boolean;
}

export function AudioRecorder({ onRecorded, disabled }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startRecording = async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            toast.error('Gravação de áudio não é suportada neste navegador.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = pickSupportedMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            chunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                stream.getTracks().forEach((track) => track.stop());
                const type = recorder.mimeType?.split(';')[0] || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type });
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
                const file = new File([blob], `gravacao-${Date.now()}.${extension}`, { type });
                onRecorded(file);
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setElapsedSeconds(0);
            timerRef.current = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
        } catch {
            toast.error('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const discard = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setElapsedSeconds(0);
        onRecorded(null);
    };

    if (previewUrl) {
        return (
            <Row>
                <audio src={previewUrl} controls style={{ height: 32, maxWidth: 260 }} />
                <Button type="button" $variant="secondary" onClick={discard} disabled={disabled}>
                    <Trash2 size={16} /> Descartar e regravar
                </Button>
            </Row>
        );
    }

    return (
        <Row>
            {!isRecording ? (
                <Button type="button" $variant="secondary" onClick={startRecording} disabled={disabled}>
                    <Mic size={16} /> Gravar áudio
                </Button>
            ) : (
                <>
                    <Button type="button" $variant="danger" onClick={stopRecording}>
                        <Square size={16} /> Parar gravação
                    </Button>
                    <Timer>{formatElapsed(elapsedSeconds)}</Timer>
                </>
            )}
        </Row>
    );
}
