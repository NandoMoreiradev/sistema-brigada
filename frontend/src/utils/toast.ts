// frontend/src/utils/toast.ts
//
// Wrapper simples sobre react-hot-toast. O original do maskotCrmEdu tinha
// variantes de toast específicas de WhatsApp/mensagens internas — removidas
// aqui por não existir chat/CRM neste produto. Mantido o suficiente para
// api.ts e o restante do app sinalizarem sucesso/erro/aviso.

import { toast as hotToast } from 'react-hot-toast';

export const toast = {
    success: (message: string) => hotToast.success(message),
    error: (message: string) => hotToast.error(message),
    info: (message: string) => hotToast(message),
    warning: (message: string) => hotToast(message, { icon: '⚠️' }),
    loading: (message: string) => hotToast.loading(message),
    dismiss: (toastId?: string) => hotToast.dismiss(toastId),
};

export { toast as hotToast } from 'react-hot-toast';
