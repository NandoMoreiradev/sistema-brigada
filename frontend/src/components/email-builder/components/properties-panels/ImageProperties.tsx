import React, { useState, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { UploadSimple, SpinnerGap, ArrowsOutLineHorizontal } from 'phosphor-react';
import { toast } from 'react-hot-toast';
import { useDebouncedCallback } from 'use-debounce';

import type { ExtendedBlockProps } from '../../types';
import { getPresignedUrl, uploadFileToPresignedUrl } from '@/services/media';
import { Label } from '../../styles';
import { MergeTagPicker } from '../MergeTagPicker';

// =============================================================================
// CONSTANTES
// =============================================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const InputWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
`;

const StyledInput = styled.input`
    width: 100%;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #ccc;
    font-size: 14px;
    flex-grow: 1;
    
    &:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
`;

const spin = keyframes`
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
`;

const ImageUploader = styled.div<{ $isUploading: boolean }>`
    width: 100%;
    border: 2px dashed #dee2e6;
    border-radius: 8px;
    padding: 24px 16px;
    text-align: center;
    cursor: ${props => props.$isUploading ? 'not-allowed' : 'pointer'};
    transition: all 0.2s ease;
    background-color: #f8f9fa;

    &:hover {
        border-color: ${props => props.$isUploading ? '#dee2e6' : '#007bff'};
        background-color: ${props => props.$isUploading ? '#f8f9fa' : '#f1f5ff'};
    }

    p {
        margin: 8px 0 0 0;
        font-size: 12px;
        color: #6c757d;
    }
`;

const ImagePreview = styled.div`
    margin-top: 16px;
    
    img {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        border: 1px solid #e9ecef;
    }
    
    p {
        font-size: 11px;
        color: #adb5bd;
        word-break: break-all;
        margin-top: 4px;
    }
`;

const UploadIcon = styled(UploadSimple)`
    color: #007bff;
`;

const LoadingSpinner = styled(SpinnerGap)`
    color: #007bff;
    animation: ${spin} 1s linear infinite;
`;

const FileInfo = styled.div`
    font-size: 12px;
    color: #6c757d;
    margin-top: 8px;
    padding: 8px;
    background-color: #e7f5ff;
    border-radius: 4px;
    
    strong {
        color: #004085;
    }
`;

const SliderContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const RangeInput = styled.input`
    width: 100%;
    cursor: pointer;
    accent-color: #007bff;
`;

const ValueDisplay = styled.span`
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: #333;
    min-width: 45px;
    text-align: right;
`;

// =============================================================================
// VALIDAÇÃO
// =============================================================================

interface FileValidation {
    isValid: boolean;
    error?: string;
}

function validateFile(file: File): FileValidation {
    // Validar tipo
    if (!ALLOWED_TYPES.includes(file.type)) {
        return {
            isValid: false,
            error: `Tipo de arquivo não permitido. Use: ${ALLOWED_EXTENSIONS.join(', ')}`
        };
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        return {
            isValid: false,
            error: `Arquivo muito grande (${sizeMB}MB). Tamanho máximo: 5MB`
        };
    }

    return { isValid: true };
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// =============================================================================
// INTERFACES
// =============================================================================

interface ImagePropertiesProps {
    props: ExtendedBlockProps;
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const ImageProperties: React.FC<ImagePropertiesProps> = ({ props, onPropsChange }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [localAlt, setLocalAlt] = useState(props.alt || '');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Debounced update para alt text
    const debouncedAltUpdate = useDebouncedCallback(
        (value: string) => {
            onPropsChange({ ...props, alt: value });
        },
        500
    );

    const handleAltChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setLocalAlt(newValue);
        debouncedAltUpdate(newValue);
    }, [debouncedAltUpdate]);

    const handleTagSelect = useCallback((tag: string, fieldName: keyof ExtendedBlockProps) => {
        if (fieldName === 'alt') {
            const newValue = `${localAlt}{{${tag}}}`;
            setLocalAlt(newValue);
            onPropsChange({ ...props, alt: newValue });
        }
    }, [localAlt, props, onPropsChange]);

    const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newWidth = `${e.target.value}%`;
        onPropsChange({ ...props, width: newWidth });
    };

    // Extrai o valor numérico atual (padrão 100)
    const currentWidthVal = props.width ? parseInt(props.width.replace('%', '')) : 100;

    const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validar arquivo
        const validation = validateFile(file);
        if (!validation.isValid) {
            toast.error(validation.error!);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        setIsUploading(true);
        const uploadToast = toast.loading('Preparando upload...');

        try {
            toast.loading('Solicitando permissão para upload...', { id: uploadToast });
            const { signedUrl, fileUrl } = await getPresignedUrl(file, 'email-templates');

            toast.loading(`Enviando ${file.name} (${formatFileSize(file.size)})...`, { id: uploadToast });
            await uploadFileToPresignedUrl(signedUrl, file);

            onPropsChange({ ...props, src: fileUrl });
            toast.success('Imagem enviada com sucesso!', { id: uploadToast });

        } catch (error: any) {
            console.error("Erro no upload da imagem:", error);
            toast.error(error?.response?.data?.message || 'Ocorreu um erro ao enviar a imagem. Tente novamente.', { id: uploadToast });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [props, onPropsChange]);

    const triggerFileSelect = useCallback(() => {
        if (!isUploading) {
            fileInputRef.current?.click();
        }
    }, [isUploading]);

    return (
        <>
            <div style={{ marginBottom: '1rem' }}>
                <Label>Enviar Imagem</Label>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept={ALLOWED_EXTENSIONS.join(',')}
                    style={{ display: 'none' }}
                    disabled={isUploading}
                    aria-label="Selecionar arquivo de imagem"
                />
                <ImageUploader
                    onClick={triggerFileSelect}
                    $isUploading={isUploading}
                    role="button"
                    tabIndex={isUploading ? -1 : 0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            triggerFileSelect();
                        }
                    }}
                    aria-label="Área de upload de imagem"
                >
                    {isUploading ? (
                        <>
                            <LoadingSpinner size={32} />
                            <p>Enviando...</p>
                        </>
                    ) : (
                        <>
                            <UploadIcon size={32} />
                            <p>Clique para enviar ou arraste uma imagem</p>
                            <FileInfo>
                                <strong>Formatos aceitos:</strong> PNG, JPG, GIF, WebP<br />
                                <strong>Tamanho máximo:</strong> 5MB
                            </FileInfo>
                        </>
                    )}
                </ImageUploader>
                {props.src && (
                    <ImagePreview>
                        <img src={props.src} alt={props.alt || 'Pré-visualização'} />
                        <p>{props.src}</p>
                    </ImagePreview>
                )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <Label>Texto Alternativo (alt)</Label>
                <InputWrapper>
                    <StyledInput
                        type="text"
                        name="alt"
                        value={localAlt}
                        onChange={handleAltChange}
                        placeholder="Descrição para acessibilidade"
                        aria-label="Texto alternativo da imagem (importante para acessibilidade)"
                    />
                    <MergeTagPicker onSelect={(tag) => handleTagSelect(tag, 'alt')}>
                        <button
                            type="button"
                            style={{
                                padding: '6px 8px',
                                background: 'white',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '16px',
                            }}
                            aria-label="Inserir merge tag no texto alternativo"
                        >
                            🏷️
                        </button>
                    </MergeTagPicker>
                </InputWrapper>
                <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                    💡 Dica: Descreva a imagem para usuários com deficiência visual
                </p>
            </div>

            <div style={{ marginBottom: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                <Label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowsOutLineHorizontal size={16} />
                    Tamanho da Imagem
                </Label>
                <SliderContainer>
                    <RangeInput
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={currentWidthVal}
                        onChange={handleWidthChange}
                        aria-label="Ajustar largura da imagem"
                    />
                    <ValueDisplay>{currentWidthVal}%</ValueDisplay>
                </SliderContainer>
                <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                    Ajuste a largura proporcionalmente
                </p>
            </div>
        </>
    );
};