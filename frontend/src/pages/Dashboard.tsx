import { LayoutDashboard } from 'lucide-react';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function Dashboard() {
    return (
        <PlaceholderPage
            title="Painel"
            subtitle="Visão geral da academia"
            icon={<LayoutDashboard size={16} />}
        />
    );
}
