import { CalendarClock } from 'lucide-react';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';

export default function Events() {
    return (
        <PlaceholderPage
            title="Eventos"
            subtitle="Assembleias, congressos e atuações da brigada"
            icon={<CalendarClock size={16} />}
        />
    );
}
