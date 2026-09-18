// frontend/src/components/ui/Avatar.tsx
//
// Foto de perfil (User.avatarUrl) com fallback de iniciais — usado no topbar
// do MainLayout. Não existe fluxo de upload de foto no frontend ainda (o
// backend já suporta via PATCH /auth/profile + presigned URL do módulo de
// mídia), então hoje praticamente todo usuário cai no fallback.

import styled from 'styled-components';

const PALETTE = ['#d9480f', '#1971c2', '#2f9e44', '#9c36b5', '#e8590c', '#0c8599', '#c2255c', '#5c940d'];

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}

function colorOf(name: string): string {
    const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return PALETTE[sum % PALETTE.length];
}

const Circle = styled.div<{ $size: number; $bg: string }>`
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
    border-radius: ${({ theme }) => theme.radii.pill};
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${({ $bg }) => $bg};
    color: white;
    font-weight: 700;
    font-size: ${({ $size }) => Math.max(11, Math.round($size * 0.4))}px;
    letter-spacing: 0.02em;
    user-select: none;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
`;

interface AvatarProps {
    name?: string | null;
    avatarUrl?: string | null;
    size?: number;
    className?: string;
}

export function Avatar({ name, avatarUrl, size = 36, className }: AvatarProps) {
    const safeName = name || '?';
    return (
        <Circle $size={size} $bg={colorOf(safeName)} className={className}>
            {avatarUrl ? <img src={avatarUrl} alt={safeName} /> : initialsOf(safeName)}
        </Circle>
    );
}
