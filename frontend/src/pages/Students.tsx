import { Users } from 'lucide-react';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function Students() {
    return (
        <PlaceholderPage
            title="Alunos"
            subtitle="Cadastro e histórico de matrículas"
            icon={<Users size={16} />}
        />
    );
}
