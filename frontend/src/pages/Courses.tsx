import { GraduationCap } from 'lucide-react';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function Courses() {
    return (
        <PlaceholderPage
            title="Turmas"
            subtitle="Cursos, aulas e matrículas"
            icon={<GraduationCap size={16} />}
        />
    );
}
