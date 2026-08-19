// frontend/src/components/common/ProtectedRoute.tsx
// Adaptado do maskotCrmEdu: sem SchoolProvider (não portado neste bootstrap —
// ver contexts/AuthContext.tsx), só o guard de autenticação + MainLayout.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';

const spin = keyframes`
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
    border: 4px solid rgba(0, 0, 0, 0.1);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-left-color: ${({ theme }) => theme.colors.primary};
    animation: ${spin} 1s ease infinite;
`;

const SpinnerContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    width: 100vw;
`;

export const ProtectedRoute = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <SpinnerContainer>
                <Spinner />
            </SpinnerContainer>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
};

/** Igual a ProtectedRoute, mas só deixa passar usuários SUPER_ADMIN. */
export const SuperAdminRoute = () => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <SpinnerContainer>
                <Spinner />
            </SpinnerContainer>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user?.role !== 'SUPER_ADMIN') {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <MainLayout>
            <Outlet />
        </MainLayout>
    );
};
