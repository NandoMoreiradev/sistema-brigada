/**
 * Modal de Ajuda para Merge Tags
 * Documentação completa com exemplos
 */

import React from 'react';
import styled from 'styled-components';

// ===== STYLED COMPONENTS =====

const Overlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
`;

const Modal = styled.div`
    background: white;
    border-radius: 12px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
    padding: 20px 24px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const ModalTitle = styled.h2`
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 10px;
`;

const CloseButton = styled.button`
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
        background: #f0f0f0;
        color: #333;
    }
`;

const ModalContent = styled.div`
    padding: 24px;
    overflow-y: auto;
    flex: 1;
`;

const Section = styled.section`
    margin-bottom: 32px;

    &:last-child {
        margin-bottom: 0;
    }
`;

const SectionTitle = styled.h3`
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
`;

const SectionIcon = styled.span`
    font-size: 20px;
`;

const ExampleGrid = styled.div`
    display: grid;
    gap: 12px;
`;

const ExampleItem = styled.div`
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px;
`;

const ExampleLabel = styled.div`
    font-size: 13px;
    font-weight: 600;
    color: #666;
    margin-bottom: 6px;
`;

const CodeBlock = styled.code`
    display: block;
    background: #1e293b;
    color: #e2e8f0;
    padding: 12px;
    border-radius: 6px;
    font-size: 13px;
    font-family: 'Monaco', 'Courier New', monospace;
    overflow-x: auto;
    margin-bottom: 8px;
    line-height: 1.5;
`;

const ResultBlock = styled.div`
    background: white;
    border: 1px solid #d1d5db;
    padding: 10px;
    border-radius: 6px;
    font-size: 13px;
    color: #333;
`;

const InlineCode = styled.code`
    background: #f1f5f9;
    color: #2563eb;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'Monaco', 'Courier New', monospace;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
`;

const Th = styled.th`
    text-align: left;
    padding: 10px;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    font-weight: 600;
    color: #666;
`;

const Td = styled.td`
    padding: 10px;
    border: 1px solid #e0e0e0;
`;

const Note = styled.div`
    background: #eff6ff;
    border-left: 4px solid #2563eb;
    padding: 12px;
    border-radius: 4px;
    font-size: 13px;
    color: #1e40af;
    margin-top: 16px;
`;

// ===== INTERFACES =====

interface MergeTagHelperProps {
    isOpen: boolean;
    onClose: () => void;
}

// ===== COMPONENTE =====

export const MergeTagHelper: React.FC<MergeTagHelperProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <Overlay onClick={onClose}>
            <Modal onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                    <ModalTitle>
                        <SectionIcon>📚</SectionIcon>
                        Guia de Merge Tags
                    </ModalTitle>
                    <CloseButton onClick={onClose}>×</CloseButton>
                </ModalHeader>

                <ModalContent>
                    {/* Básico */}
                    <Section>
                        <SectionTitle>
                            <SectionIcon>📝</SectionIcon>
                            Merge Tags Básicas
                        </SectionTitle>

                        <p>
                            Use <InlineCode>{'{{'}variavel{'}}'}</InlineCode> para inserir dados
                            dinâmicos no seu email.
                        </p>

                        <Table>
                            <thead>
                                <tr>
                                    <Th>Tag</Th>
                                    <Th>Descrição</Th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <Td>
                                        <InlineCode>{'{{lead.name}}'}</InlineCode>
                                    </Td>
                                    <Td>Nome do lead</Td>
                                </tr>
                                <tr>
                                    <Td>
                                        <InlineCode>{'{{lead.email}}'}</InlineCode>
                                    </Td>
                                    <Td>Email do lead</Td>
                                </tr>
                                <tr>
                                    <Td>
                                        <InlineCode>{'{{school.name}}'}</InlineCode>
                                    </Td>
                                    <Td>Nome da escola</Td>
                                </tr>
                                <tr>
                                    <Td>
                                        <InlineCode>{'{{user.name}}'}</InlineCode>
                                    </Td>
                                    <Td>Nome do consultor</Td>
                                </tr>
                            </tbody>
                        </Table>
                    </Section>

                    {/* Transformações */}
                    <Section>
                        <SectionTitle>
                            <SectionIcon>🔧</SectionIcon>
                            Transformações
                        </SectionTitle>

                        <p>
                            Use <InlineCode>|</InlineCode> para aplicar transformações aos dados.
                        </p>

                        <ExampleGrid>
                            <ExampleItem>
                                <ExampleLabel>Maiúsculas:</ExampleLabel>
                                <CodeBlock>{'{{lead.name | uppercase}}'}</CodeBlock>
                                <ResultBlock>MARIA SILVA</ResultBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <ExampleLabel>Minúsculas:</ExampleLabel>
                                <CodeBlock>{'{{lead.name | lowercase}}'}</CodeBlock>
                                <ResultBlock>maria silva</ResultBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <ExampleLabel>Capitalizar:</ExampleLabel>
                                <CodeBlock>{'{{lead.name | capitalize}}'}</CodeBlock>
                                <ResultBlock>Maria Silva</ResultBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <ExampleLabel>Formatação de Data:</ExampleLabel>
                                <CodeBlock>{"{{lead.createdAt | date('DD/MM/YYYY')}}"}</CodeBlock>
                                <ResultBlock>15/01/2025</ResultBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <ExampleLabel>Formatação de Moeda:</ExampleLabel>
                                <CodeBlock>{'{{lead.value | currency}}'}</CodeBlock>
                                <ResultBlock>R$ 1.500,00</ResultBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <ExampleLabel>Valor Padrão:</ExampleLabel>
                                <CodeBlock>{"{{lead.parentName | default('Responsável')}}"}</CodeBlock>
                                <ResultBlock>Maria Silva (ou "Responsável" se vazio)</ResultBlock>
                            </ExampleItem>
                        </ExampleGrid>
                    </Section>

                    {/* Condicionais */}
                    <Section>
                        <SectionTitle>
                            <SectionIcon>🔀</SectionIcon>
                            Condicionais
                        </SectionTitle>

                        <p>Use condicionais para exibir conteúdo baseado em critérios.</p>

                        <ExampleGrid>
                            <ExampleItem>
                                <ExampleLabel>If Simples:</ExampleLabel>
                                <CodeBlock>
                                    {`{{#if lead.score > 70}}
  🔥 Lead Quente!
{{/if}}`}
                                </CodeBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <ExampleLabel>If/Else:</ExampleLabel>
                                <CodeBlock>
                                    {`{{#if lead.score > 70}}
  🔥 Você é um lead prioritário!
{{else}}
  Obrigado pelo interesse!
{{/if}}`}
                                </CodeBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <ExampleLabel>Operadores Suportados:</ExampleLabel>
                                <CodeBlock>
                                    {`>  (maior que)
<  (menor que)
>= (maior ou igual)
<= (menor ou igual)
== (igual)
!= (diferente)`}
                                </CodeBlock>
                            </ExampleItem>
                        </ExampleGrid>
                    </Section>

                    {/* Custom Fields */}
                    <Section>
                        <SectionTitle>
                            <SectionIcon>🏷️</SectionIcon>
                            Custom Fields
                        </SectionTitle>

                        <p>Acesse campos personalizados do lead:</p>

                        <ExampleGrid>
                            <ExampleItem>
                                <CodeBlock>{'{{lead.customFields.cpf}}'}</CodeBlock>
                                <ResultBlock>123.456.789-00</ResultBlock>
                            </ExampleItem>

                            <ExampleItem>
                                <CodeBlock>{'{{lead.customFields.rg}}'}</CodeBlock>
                                <ResultBlock>12.345.678-9</ResultBlock>
                            </ExampleItem>
                        </ExampleGrid>
                    </Section>

                    {/* Exemplo Completo */}
                    <Section>
                        <SectionTitle>
                            <SectionIcon>✨</SectionIcon>
                            Exemplo Completo
                        </SectionTitle>

                        <CodeBlock>
                            {`Assunto: Matrícula - {{school.name | uppercase}}

Olá {{lead.name | capitalize}},

Sua matrícula foi realizada em {{lead.createdAt | date('DD/MM/YYYY às HH:mm')}}.

Valor total: {{lead.value | currency}}

{{#if lead.score > 70}}
🎉 Parabéns! Você é um aluno prioritário e terá benefícios exclusivos!
{{else}}
Obrigado pelo interesse em nossa escola!
{{/if}}

Atenciosamente,
{{user.name | default('Equipe')}}
{{school.name}}`}
                        </CodeBlock>

                        <Note>
                            💡 <strong>Dica:</strong> Digite <InlineCode>{'{{'}</InlineCode> para
                            abrir o autocomplete com todas as opções disponíveis!
                        </Note>
                    </Section>
                </ModalContent>
            </Modal>
        </Overlay>
    );
};