/**
 * tokenManager — singleton em memória para o access_token.
 *
 * Armazenar o JWT em memória (não no localStorage) impede que scripts
 * maliciosos (XSS) roubem o token diretamente via document/localStorage.
 * O token some ao fechar a aba; a sessão é restaurada silenciosamente
 * via refresh_token (cookie httpOnly) na próxima abertura.
 */
let _accessToken: string | null = null;
let _savedSuperAdminToken: string | null = null;

export const tokenManager = {
    set: (token: string | null) => { _accessToken = token; },
    get: () => _accessToken,
    clear: () => { _accessToken = null; },
    saveAdminToken: () => { _savedSuperAdminToken = _accessToken; },
    restoreAdminToken: () => { _accessToken = _savedSuperAdminToken; _savedSuperAdminToken = null; },
    isImpersonating: () => _savedSuperAdminToken !== null,
    clearAll: () => { _accessToken = null; _savedSuperAdminToken = null; },
};
