/**
 * frontend/src/utils/publicRouting.ts
 *
 * Versão enxuta do helper equivalente do maskotCrmEdu. Este projeto é um
 * portal único (sem subdomínio por organização), então só precisamos saber
 * se o pathname atual é uma rota pública (não exige sessão autenticada).
 */

// Prefixos de rotas que são abertas para o público
export const PUBLIC_ROUTE_PREFIXES = [
    '/login',
    '/badge/', // validação pública de crachá (/badge/:token)
];

export const isPublicPath = (pathname: string = window.location.pathname): boolean => {
    return PUBLIC_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix));
};

export const isPublicAccess = (location: Pick<Location, 'pathname'> = window.location): boolean => {
    return isPublicPath(location.pathname);
};
