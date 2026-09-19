import React from 'react';
import styled from 'styled-components';
import type { ExtendedBlockProps, BlockStyle } from '../../types';

const Container = styled.div`
    padding: 16px;
    background: #f0f0f0;
    border-radius: 8px;
`;

interface TextPropertiesSidebarProps {
    props: ExtendedBlockProps;
    style?: BlockStyle;
    blockType: 'heading' | 'text';
    onPropsChange: (newProps: ExtendedBlockProps) => void;
    onStyleChange?: (newStyle: BlockStyle) => void;
}

export const TextPropertiesSidebar: React.FC<TextPropertiesSidebarProps> = ({
    props,
    style,
    blockType,
    onPropsChange,
}) => {
    console.log('✅ TextPropertiesSidebar RENDERIZADO!', { props, style, blockType });

    return (
        <Container>
            <h3>✅ Editor de Texto Funcionando!</h3>
            <p>Tipo: {blockType}</p>
            <p>Conteúdo atual: {props.children}</p>

            <textarea
                style={{ width: '100%', minHeight: '200px', padding: '10px' }}
                value={props.children || ''}
                onChange={(e) => {
                    onPropsChange({ ...props, children: e.target.value });
                }}
                placeholder="Digite seu texto aqui..."
            />
        </Container>
    );
};
