// frontend/src/App.tsx
// Bem mais enxuto que o original do maskotCrmEdu: sem Sentry, Stripe, sockets
// (WhatsApp/Messenger/Instagram/voz) nem modais de limite de plano — nada
// disso existe neste produto ainda.

import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { Router } from './Router';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

function App() {
    return (
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <Router />
                    <Toaster
                        position="top-right"
                        toastOptions={{ duration: 4000 }}
                        containerStyle={{ top: 20, right: 20, zIndex: 99999 }}
                        gutter={12}
                    />
                </AuthProvider>
            </QueryClientProvider>
        </BrowserRouter>
    );
}

export default App;
