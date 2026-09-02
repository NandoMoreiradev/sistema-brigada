// frontend/src/components/ui/FormField.tsx
//
// Generaliza o padrão Field/Label/Input/ErrorText que já existia (duplicado)
// em Login.tsx, para as telas de formulário de gestão (Organizações, Alunos,
// Turmas...).

import styled from 'styled-components';

export const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
`;

export const Label = styled.label`
    font-size: 0.8125rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
`;

const inputStyles = `
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    border: 1px solid #ced4da;
    font-size: 0.875rem;
    font-family: inherit;
    color: inherit;

    &:focus {
        outline: none;
        border-color: #007BFF;
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
    }

    &:disabled {
        background: #f1f3f5;
        cursor: not-allowed;
    }
`;

export const Input = styled.input`
    ${inputStyles}
`;

export const Select = styled.select`
    ${inputStyles}
    background: white;
`;

export const Textarea = styled.textarea`
    ${inputStyles}
    resize: vertical;
    min-height: 80px;
`;

export const ErrorText = styled.span`
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.danger};
`;

export const HelpText = styled.span`
    font-size: 0.75rem;
    color: ${({ theme }) => theme.colors.textMuted};
`;

export const FieldRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.875rem;
`;

export const CheckboxField = styled.label`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textDark};
    cursor: pointer;
`;

export const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
`;

export const FormActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
`;
