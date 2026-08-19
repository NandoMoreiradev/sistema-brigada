import { ShieldCheck } from 'lucide-react';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function Staff() {
    return (
        <PlaceholderPage
            title="Equipe"
            subtitle="Brigadistas, bombeiros e designações"
            icon={<ShieldCheck size={16} />}
        />
    );
}
