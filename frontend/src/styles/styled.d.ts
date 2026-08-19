// frontend/src/styles/styled.d.ts
import 'styled-components';

declare module 'styled-components' {
    export interface DefaultTheme {
        colors: {
            primary: string;
            primaryDark: string;
            primaryLight: string;
            secondary: string;
            accent: string;
            text: string;
            lightGray: string;
            white: string;
            danger: string;
            warning: string;
            success: string;
            pageBackground: string;
            textDark: string;
            textMedium: string;
            backgroundMedium: string;
            border: string;
            borderLight: string;
            backgroundLight: string;

            info: string;
            infoLight: string;
            infoDark: string;
            gray: string;
            textMuted: string;
        };
        radii: {
            sm: string;
            md: string;
            lg: string;
            xl: string;
            pill: string;
        };
        shadows: {
            e1: string;
            e2: string;
            e3: string;
        };
        fonts: {
            main: string;
        };
    }
}
