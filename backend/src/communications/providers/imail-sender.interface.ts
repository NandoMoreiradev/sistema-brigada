// backend/src/communications/providers/imail-sender.interface.ts
//
// Adaptado de maskotCrmEdu/backend/src/communications/providers/imail-sender.interface.ts,
// sem `sendBatch` (envio em lote/campanha não existe neste produto — fora de escopo).

export interface SingleSendOptions {
    from: string;
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
}

/**
 * Abstração de provedor de envio de e-mail. Hoje só existe `ResendSender`, mas
 * qualquer novo provedor (Postmark, SES...) só precisa implementar esta
 * interface — nenhum outro arquivo do módulo `communications` muda.
 */
export interface IMailSender {
    readonly providerName: string;
    sendSingle(options: SingleSendOptions): Promise<{ providerMessageId: string }>;
}
