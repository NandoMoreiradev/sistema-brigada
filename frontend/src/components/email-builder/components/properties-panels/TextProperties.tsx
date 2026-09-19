/**
 * TextProperties - VERSÃO SIMPLIFICADA (Canvas-First UX)
 *
 * FILOSOFIA:
 * - Edição de texto acontece DIRETAMENTE no canvas (RichTextEditor/TipTap)
 * - Sidebar fornece apenas HELPERS e ATALHOS
 * - Sem duplicação de funcionalidades
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { Info, BracketsCurly, Question } from 'phosphor-react';
import type { ExtendedBlockProps } from '../../types';
import { MergeTagPicker } from '../MergeTagPicker';
import { MergeTagHelper } from '../MergeTagHelper';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const InfoBox = styled.div`
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    border-radius: 8px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    
    svg {
        flex-shrink: 0;
        margin-top: 2px;
    }
`;

const InfoContent = styled.div`
    flex: 1;
`;

const InfoTitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
`;

const InfoText = styled.div`
    font-size: 13px;
    opacity: 0.95;
    line-height: 1.5;
`;

const HelpersSection = styled.div`
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 16px;
`;

const SectionTitle = styled.h4`
    font-size: 13px;
    font-weight: 600;
    color: #495057;
    margin: 0 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const ButtonGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
`;

const HelperButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #495057;
    transition: all 0.2s;

    &:hover {
        background: #e7f5ff;
        border-color: #2563eb;
        color: #2563eb;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    &:active {
        transform: translateY(0);
    }

    svg {
        flex-shrink: 0;
    }
`;

const TipsBox = styled.div`
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-left: 4px solid #ffc107;
    border-radius: 6px;
    padding: 12px;
`;

const TipTitle = styled.div`
    font-size: 13px;
    font-weight: 600;
    color: #856404;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
`;

const TipList = styled.ul`
    margin: 0;
    padding-left: 20px;
    font-size: 12px;
    color: #856404;

    li {
        margin-bottom: 4px;
        line-height: 1.5;

        &:last-child {
            margin-bottom: 0;
        }
    }

    code {
        background: rgba(0, 0, 0, 0.1);
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', monospace;
    }
`;

// =============================================================================
// INTERFACES
// =============================================================================

interface TextPropertiesProps {
    props: ExtendedBlockProps;
    blockType: 'heading' | 'text';
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// =============================================================================
// COMPONENTE
// =============================================================================

export const TextProperties: React.FC<TextPropertiesProps> = () => {
    const [showHelper, setShowHelper] = useState(false);

    const handleMergeTagInsert = (tag: string) => {
        // Esta função agora é apenas informativa
        // O usuário deve usar o editor inline no canvas
        alert(`💡 Dica: Para inserir merge tags, clique no bloco de texto no canvas e use:\n\n1. Digite "{{" para abrir o autocomplete\n2. Ou use o botão de merge tag no menu flutuante\n\nA merge tag {{${tag}}} foi copiada para a área de transferência!`);

        // Copiar para clipboard
        navigator.clipboard.writeText(`{{${tag}}}`);
    };

    return (
        <Container>
            {/* Info Principal */}
            <InfoBox>
                <Info size={24} weight="fill" />
                <InfoContent>
                    <InfoTitle>✨ Edite o texto diretamente no canvas</InfoTitle>
                    <InfoText>
                        Clique no bloco de texto à esquerda para editá-lo.
                        Use o menu flutuante para formatação e merge tags.
                    </InfoText>
                </InfoContent>
            </InfoBox>

            {/* Helpers */}
            <HelpersSection>
                <SectionTitle>🛠️ Ferramentas Auxiliares</SectionTitle>

                <ButtonGrid>
                    <MergeTagPicker onSelect={handleMergeTagInsert}>
                        <HelperButton type="button">
                            <BracketsCurly size={18} />
                            Merge Tags
                        </HelperButton>
                    </MergeTagPicker>

                    <HelperButton
                        type="button"
                        onClick={() => setShowHelper(true)}
                    >
                        <Question size={18} />
                        Ajuda
                    </HelperButton>
                </ButtonGrid>
            </HelpersSection>

            {/* Dicas de Uso */}
            <TipsBox>
                <TipTitle>💡 Dicas Rápidas</TipTitle>
                <TipList>
                    <li>
                        Digite <code>{'{{'}</code> no editor para abrir o autocomplete de merge tags
                    </li>
                    <li>
                        Selecione texto e use o menu flutuante para <strong>negrito</strong>, <em>itálico</em>, cores, etc.
                    </li>
                    <li>
                        Digite <code>/</code> para comandos rápidos (título, lista, tabela...)
                    </li>
                    <li>
                        Use <code>Ctrl+Z</code> para desfazer e <code>Ctrl+Y</code> para refazer
                    </li>
                </TipList>
            </TipsBox>

            {/* Modal de Ajuda */}
            <MergeTagHelper
                isOpen={showHelper}
                onClose={() => setShowHelper(false)}
            />
        </Container>
    );
};