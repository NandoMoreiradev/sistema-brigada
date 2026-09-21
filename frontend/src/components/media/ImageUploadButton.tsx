// frontend/src/components/media/ImageUploadButton.tsx
//
// Botão de "enviar arquivo" pra complementar um campo de URL de imagem —
// mesmo padrão já usado no upload de avatar (settings/ProfileTab.tsx),
// extraído aqui pra reutilizar em outras telas (ex: personalização de
// certificado) sem duplicar a lógica de validação/upload.

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { mediaApi, type UploadContext } from '@/services/media';
import { toast } from '@/utils/toast';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

interface ImageUploadButtonProps {
    context: UploadContext;
    onUploaded: (fileUrl: string) => void;
    disabled?: boolean;
    label?: string;
}

export function ImageUploadButton({ context, onUploaded, disabled, label = 'Enviar arquivo' }: ImageUploadButtonProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // permite selecionar o mesmo arquivo de novo depois

        if (!file) return;

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            toast.error('Formato inválido. Envie uma imagem JPG, PNG, WEBP ou GIF.');
            return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
            toast.error('A imagem deve ter no máximo 5MB.');
            return;
        }

        setIsUploading(true);
        try {
            const { fileUrl } = await mediaApi.upload(file, context);
            onUploaded(fileUrl);
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Não foi possível enviar a imagem.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <Button type="button" $variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled || isUploading}>
                <Upload size={14} /> {isUploading ? 'Enviando...' : label}
            </Button>
            <input
                ref={inputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                style={{ display: 'none' }}
                onChange={handleChange}
            />
        </>
    );
}
