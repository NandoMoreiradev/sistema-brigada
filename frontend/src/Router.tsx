// frontend/src/Router.tsx
//
// Router novo e enxuto para este produto — NÃO é uma cópia do Router.tsx do
// maskotCrmEdu (aquele tinha ~150+ rotas de CRM/WhatsApp/marketing que não
// existem aqui). Estrutura:
//   - Pública: /login, /badge/:token (validação de crachá, sem exigir login)
//   - Privada: /dashboard, /courses, /events, /staff, /students
//   - Privada + SUPER_ADMIN: /admin/organizations (painel de plataforma)

import { Routes, Route, Navigate } from 'react-router-dom';

import Login from '@/pages/Login';
import BadgePage from '@/pages/public/BadgePage';
import Dashboard from '@/pages/Dashboard';
import Courses from '@/pages/Courses';
import CourseDetail from '@/pages/CourseDetail';
import Events from '@/pages/Events';
import EventDetail from '@/pages/EventDetail';
import Staff from '@/pages/Staff';
import Students from '@/pages/Students';
import Certificates from '@/pages/Certificates';
import Organizations from '@/pages/admin/Organizations';

import { ProtectedRoute, SuperAdminRoute } from '@/components/common/ProtectedRoute';

export function Router() {
    return (
        <Routes>
            {/* Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/badge/:token" element={<BadgePage />} />

            {/* Privadas */}
            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/courses/:id" element={<CourseDetail />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/students" element={<Students />} />
                <Route path="/certificates" element={<Certificates />} />
            </Route>

            {/* Privadas — só SUPER_ADMIN */}
            <Route element={<SuperAdminRoute />}>
                <Route path="/admin/organizations" element={<Organizations />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
