// frontend/src/Router.tsx
//
// Router novo e enxuto para este produto — NÃO é uma cópia do Router.tsx do
// maskotCrmEdu (aquele tinha ~150+ rotas de CRM/WhatsApp/marketing que não
// existem aqui). Estrutura:
//   - Pública: /login, /forgot-password, /reset-password, /badge/:token
//     (validação de crachá, sem exigir login)
//   - Privada (qualquer autenticado): /dashboard, /courses/:id, /events,
//     /events/:id, /roles, /my-courses, /my-certificates, /my-designations
//   - Privada + permissão de módulo (Fase 3, docs/decisoes.md): /courses,
//     /staff, /people, /certificates — listagem completa da organização,
//     só para quem administra aquele módulo (ou é admin). Quem não tem a
//     permissão usa o recorte pessoal em /my-*.
//   - Privada + SUPER_ADMIN: /admin/organizations (painel de plataforma)

import { Routes, Route, Navigate } from 'react-router-dom';

import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import BadgePage from '@/pages/public/BadgePage';
import Dashboard from '@/pages/Dashboard';
import Courses from '@/pages/Courses';
import CourseDetail from '@/pages/CourseDetail';
import Events from '@/pages/Events';
import EventDetail from '@/pages/EventDetail';
import Staff from '@/pages/Staff';
import People from '@/pages/People';
import Certificates from '@/pages/Certificates';
import Roles from '@/pages/Roles';
import Organizations from '@/pages/admin/Organizations';
import EmailsAndCommunications from '@/pages/admin/EmailsAndCommunications';
import EmailTemplateEditor from '@/pages/admin/EmailTemplateEditor';
import CommunicationEditor from '@/pages/admin/CommunicationEditor';
import MyCourses from '@/pages/MyCourses';
import MyCertificates from '@/pages/MyCertificates';
import MyDesignations from '@/pages/MyDesignations';
import Settings from '@/pages/Settings';

import { ProtectedRoute, PermissionRoute, SuperAdminRoute } from '@/components/common/ProtectedRoute';

export function Router() {
    return (
        <Routes>
            {/* Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/badge/:token" element={<BadgePage />} />

            {/* Privadas — qualquer autenticado */}
            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/courses/:id" element={<CourseDetail />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/roles" element={<Roles />} />
                <Route path="/my-courses" element={<MyCourses />} />
                <Route path="/my-certificates" element={<MyCertificates />} />
                <Route path="/my-designations" element={<MyDesignations />} />
                <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Privadas — listagem completa, só quem tem a permissão do módulo */}
            <Route element={<PermissionRoute permission="courses:manage" />}>
                <Route path="/courses" element={<Courses />} />
            </Route>
            <Route element={<PermissionRoute permission="staff:manage" />}>
                <Route path="/staff" element={<Staff />} />
            </Route>
            <Route element={<PermissionRoute permission="people:manage" />}>
                <Route path="/people" element={<People />} />
            </Route>
            <Route element={<PermissionRoute permission="certificates:manage" />}>
                <Route path="/certificates" element={<Certificates />} />
            </Route>

            {/* Privadas — só SUPER_ADMIN */}
            <Route element={<SuperAdminRoute />}>
                <Route path="/admin/organizations" element={<Organizations />} />
            </Route>

            {/* Privadas — communications:manage (ORG_ADMIN/GROUP_ADMIN/SUPER_ADMIN sempre têm
                acesso pleno via bypass, ver userHasPermission; cargo delegado também entra) */}
            <Route element={<PermissionRoute permission="communications:manage" />}>
                <Route path="/admin/emails" element={<EmailsAndCommunications />} />
                <Route path="/admin/email-templates/:id/edit" element={<EmailTemplateEditor />} />
                <Route path="/admin/communications/:id/edit" element={<CommunicationEditor />} />
            </Route>
            <Route path="/admin/email-templates" element={<Navigate to="/admin/emails" replace />} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}
