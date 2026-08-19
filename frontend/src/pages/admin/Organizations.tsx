import { Building2 } from 'lucide-react';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

// Painel de plataforma — visível apenas para SUPER_ADMIN (ver SuperAdminRoute
// em src/components/common/ProtectedRoute.tsx). Equivalente ao
// AdminController/SchoolOperationsController do maskotCrmEdu, escopado para
// gestão de academias-clientes (decisões 3 e 5 de docs/decisoes.md).
export default function Organizations() {
    return (
        <PlaceholderPage
            title="Academias"
            subtitle="Gestão de academias-clientes da plataforma"
            icon={<Building2 size={16} />}
        />
    );
}
