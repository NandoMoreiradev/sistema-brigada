// frontend/src/styles/theme.ts
//
// Base adaptada do design system do maskotCrmEdu, sem os namespaces
// específicos de CRM (whatsapp/messenger/inbox/campaigns/survey). Mantém a
// paleta neutra e os tokens de raio/sombra/fonte que sustentam o PageLayout.

export const theme = {
    colors: {
        primary: '#007BFF',
        primaryDark: '#0056b3',
        primaryLight: '#e0f2fe',
        secondary: '#28a745',
        accent: '#FD7E14',
        text: '#343A40',
        lightGray: '#f4f6f8',
        white: '#FFFFFF',
        danger: '#e03131',
        warning: '#FFC107',
        success: '#28a745',
        pageBackground: '#f4f6f8',
        textDark: '#212529',
        textMedium: '#6C757D',
        backgroundMedium: '#E9ECEF',

        border: '#DEE2E6',
        borderLight: '#DEE2E6',
        backgroundLight: '#f4f6f8',

        info: '#17a2b8',
        infoLight: '#e0f2fe',
        infoDark: '#0369a1',
        gray: '#6c757d',
        textMuted: '#6c757d',
    },

    radii: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '22px',
        pill: '999px',
    },

    shadows: {
        e1: '0 1px 2px rgba(21, 30, 50, 0.06), 0 1px 3px rgba(21, 30, 50, 0.05)',
        e2: '0 6px 20px rgba(21, 30, 50, 0.10), 0 2px 6px rgba(21, 30, 50, 0.06)',
        e3: '0 18px 50px rgba(21, 30, 50, 0.16)',
    },

    fonts: {
        main: 'Inter, sans-serif',
    },
};
