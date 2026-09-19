// frontend/src/components/auth/AuthFormControls.tsx
//
// Estilos de formulário compartilhados entre as telas públicas de autenticação
// (Login, ForgotPassword, ResetPassword) — extraído de Login.tsx pra não
// triplicar os mesmos styled-components a cada nova tela desse fluxo.

import styled from 'styled-components';
import { Link } from 'react-router-dom';

export const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: left;
`;

export const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
`;

export const Label = styled.label`
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
`;

export const InputWrapper = styled.div`
    position: relative;
    display: flex;
    align-items: center;
`;

export const InputIcon = styled.div`
    position: absolute;
    left: 0.85rem;
    display: flex;
    color: #adb5bd;
    pointer-events: none;
`;

export const Input = styled.input`
    width: 100%;
    padding: 0.7rem 0.85rem 0.7rem 2.5rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.92);
    font-size: 0.9375rem;
    box-sizing: border-box;
    transition: box-shadow 0.15s ease, border-color 0.15s ease;

    &:focus {
        outline: none;
        border-color: white;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
    }
`;

export const ToggleVisibilityButton = styled.button`
    position: absolute;
    right: 0.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #868e96;
    cursor: pointer;
    padding: 0.3rem;
    border-radius: 6px;

    &:hover {
        color: #495057;
        background: rgba(0, 0, 0, 0.06);
    }
`;

export const ErrorText = styled.span`
    font-size: 0.75rem;
    color: #FFD8D8;
`;

export const HelpText = styled.p`
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
    margin: 0;
`;

export const SubmitButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    border: none;
    background: white;
    color: #b02a1f;
    font-weight: 700;
    font-size: 0.9375rem;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;

    &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
    }

    &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
    }

    &:active:not(:disabled) {
        transform: translateY(0);
    }
`;

export const AuthLink = styled(Link)`
    color: white;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.8125rem;

    &:hover {
        opacity: 0.85;
    }
`;

export const LinkRow = styled.div`
    display: flex;
    justify-content: flex-end;
    margin-top: -0.5rem;
`;
