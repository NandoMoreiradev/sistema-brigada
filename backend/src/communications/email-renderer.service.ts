// backend/src/communications/email-renderer.service.ts
//
// Adaptado de maskotCrmEdu/backend/src/communications/email-renderer.service.ts. O
// `renderBlock`/switch por tipo de bloco é portado quase sem alteração — é o par server-side
// do designJson que o construtor visual do frontend produz (frontend/src/components/
// email-builder, também portado do maskotCrmEdu). Removido: o método `render()` baseado em
// @react-email/render (só usado pelo construtor de campanha/marketing, fora de escopo) e o
// link de descadastro no rodapé (`{{unsubscribe_url}}` — só faz sentido em e-mail de
// campanha; os 3 gatilhos deste produto são todos transacionais).

import { Injectable, Logger } from '@nestjs/common';
import { MergeTagService, MergeTagContext } from '../common/merge-tag.service';

interface BlockStyle {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    padding?: string;
    margin?: string;
    borderRadius?: string;
    borderColor?: string;
    borderWidth?: string;
    width?: string;
    [key: string]: any;
}

interface SocialNetwork {
    network: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'website';
    url: string;
}

interface ExtendedBlockProps {
    children?: string;
    href?: string;
    src?: string;
    alt?: string;
    text?: string;
    columns?: { id: string; content: string; width?: string }[];
    items?: any[];
    listType?: 'bullet' | 'numbered';
    tableHeaders?: string[];
    tableRows?: { id: string; cells: string[] }[];
    spacerHeight?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    website?: string;
    socialLinks?: any[];
    links?: Record<string, string>;
    networks?: SocialNetwork[];
    width?: string;
}

interface Block {
    id: string;
    type: 'heading' | 'text' | 'button' | 'image' | 'divider' | 'columns' | 'list' | 'table' | 'spacer' | 'social';
    props: ExtendedBlockProps;
    style?: BlockStyle;
}

export interface DesignJson {
    blocks: Block[];
    globalSettings?: any;
}

@Injectable()
export class EmailRendererService {
    private readonly logger = new Logger(EmailRendererService.name);

    constructor(private readonly mergeTagService: MergeTagService) {}

    async renderDesignJson(design: DesignJson | any, context: MergeTagContext): Promise<string> {
        try {
            if (!design || !design.blocks || !Array.isArray(design.blocks)) {
                this.logger.warn('Design JSON inválido ou vazio.');
                return '';
            }

            return design.blocks.map((block: Block) => this.renderBlock(block, context)).join('');
        } catch (error) {
            this.logger.error('Erro crítico ao processar JSON do construtor de e-mail.', error as any);
            return '<p>Erro ao carregar conteúdo do e-mail.</p>';
        }
    }

    /**
     * Decodifica entidades HTML em múltiplas passagens até estabilizar (ex: aninhadas
     * como &amp;lt; → &lt; → <).
     */
    private decodeHtmlContent(raw: string): string {
        if (!raw) return '';
        let result = raw;
        let prev: string;
        let iterations = 0;
        do {
            prev = result;
            result = result
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/gi, "'")
                .replace(/&apos;/gi, "'")
                .replace(/&nbsp;/gi, ' ');
            result = result.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
            result = result.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
            iterations++;
        } while (result !== prev && iterations < 10);
        return result;
    }

    private resolveSpacing(style: any): { padding: string; margin: string } {
        const hasPerSidePad =
            style.paddingTop !== undefined || style.paddingRight !== undefined || style.paddingBottom !== undefined || style.paddingLeft !== undefined;
        const padding = hasPerSidePad
            ? `${style.paddingTop ?? 8}px ${style.paddingRight ?? 8}px ${style.paddingBottom ?? 8}px ${style.paddingLeft ?? 8}px`
            : style.padding || '10px';

        const hasPerSideMar = style.marginTop !== undefined || style.marginBottom !== undefined;
        const margin = hasPerSideMar ? `${style.marginTop ?? 0}px 0 ${style.marginBottom ?? 0}px 0` : style.margin || '0';

        return { padding, margin };
    }

    private renderBlock(block: Block, context: MergeTagContext): string {
        const style = block.style || {};
        const { padding, margin } = this.resolveSpacing(style);

        const cssStyles = this.objToCss({
            'background-color': style.backgroundColor,
            color: style.textColor || '#333333',
            'font-size': style.fontSize || '16px',
            'font-family': style.fontFamily || 'Arial, sans-serif',
            'text-align': style.textAlign || 'left',
            padding,
            margin,
            'border-radius': style.borderRadius,
            border: style.borderWidth ? `${style.borderWidth} solid ${style.borderColor || '#e0e0e0'}` : undefined,
        });

        switch (block.type) {
            case 'heading': {
                const headingDecoded = this.decodeHtmlContent(block.props.children || '');
                const headingStripped = headingDecoded.replace(/<span[^>]*>({{[^}]+}})<\/span>/g, '$1');
                const headingText = this.mergeTagService.process(headingStripped, context);
                return `<h2 style="${cssStyles}; font-weight: bold; margin: 0 0 16px 0;">${headingText}</h2>`;
            }

            case 'text': {
                const decoded = this.decodeHtmlContent(block.props.children || '');
                const stripped = decoded.replace(/<span[^>]*>({{[^}]+}})<\/span>/g, '$1');
                const textContent = this.mergeTagService.process(stripped, context);
                return `<div style="${cssStyles}; line-height: 1.5;">${textContent}</div>`;
            }

            case 'button': {
                const btnLabel = this.mergeTagService.process(block.props.children || 'Clique Aqui', context);
                const btnUrl = this.mergeTagService.process(block.props.href || '#', context);

                const btnBg = style.backgroundColor || '#007bff';
                const btnColor = style.textColor || '#ffffff';
                const btnRadius = style.borderRadius || '6px';
                const btnPadding = style.padding || '12px 24px';

                return `
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="${style.textAlign || 'center'}">
                <a href="${btnUrl}" target="_blank" style="display: inline-block; background-color: ${btnBg}; color: ${btnColor}; padding: ${btnPadding}; border-radius: ${btnRadius}; text-decoration: none; font-weight: bold; font-family: Arial, sans-serif;">
                  ${btnLabel}
                </a>
              </td>
            </tr>
          </table>
          <div style="height: 20px;">&nbsp;</div>
        `;
            }

            case 'image': {
                const imgSrc = block.props.src || '';
                const imgAlt = block.props.alt || 'Imagem';
                const widthStyle = block.props.width || style.width || '100%';
                return `
                  <div style="text-align: ${style.textAlign || 'center'}; margin-bottom: 20px; background-color: #ffffff;">
                    <img
                        src="${imgSrc}"
                        alt="${this.escapeAttr(imgAlt)}"
                        style="width: ${widthStyle}; max-width: 100%; height: auto; border-radius: ${style.borderRadius || '0'}; border: ${style.borderWidth ? `${style.borderWidth} solid ${style.borderColor}` : 'none'}; display: inline-block; background-color: #ffffff;"
                        border="0"
                    />
                  </div>
                `;
            }

            case 'spacer': {
                const height = block.props.spacerHeight || '40px';
                return `<div style="height: ${height}; line-height: ${height}; font-size: 0;">&nbsp;</div>`;
            }

            case 'social': {
                const networks: { type: string; url: string }[] = [];
                const props = block.props;

                if (props.socialLinks && Array.isArray(props.socialLinks)) {
                    props.socialLinks.forEach((link) => {
                        if (link.id && link.url) networks.push({ type: link.id, url: link.url });
                    });
                }

                if (networks.length === 0) {
                    if (props.facebook) networks.push({ type: 'facebook', url: props.facebook });
                    if (props.instagram) networks.push({ type: 'instagram', url: props.instagram });
                    if (props.twitter) networks.push({ type: 'twitter', url: props.twitter });
                    if (props.linkedin) networks.push({ type: 'linkedin', url: props.linkedin });
                    if (props.youtube) networks.push({ type: 'youtube', url: props.youtube });
                    if (props.website) networks.push({ type: 'website', url: props.website });
                }

                if (networks.length === 0 && props.networks && Array.isArray(props.networks)) {
                    props.networks.forEach((n) => networks.push({ type: n.network, url: n.url }));
                }

                if (networks.length === 0) return '';

                const iconSize = '24px';
                const iconStyle = `width: ${iconSize}; height: ${iconSize}; display: inline-block; margin: 0 8px;`;

                const iconsHtml = networks
                    .map((net) => {
                        let iconUrl = '';
                        switch (net.type.toLowerCase()) {
                            case 'facebook':
                                iconUrl = 'https://cdn-icons-png.flaticon.com/512/124/124010.png';
                                break;
                            case 'instagram':
                                iconUrl = 'https://cdn-icons-png.flaticon.com/512/174/174855.png';
                                break;
                            case 'twitter':
                                iconUrl = 'https://cdn-icons-png.flaticon.com/512/124/124021.png';
                                break;
                            case 'linkedin':
                                iconUrl = 'https://cdn-icons-png.flaticon.com/512/174/174857.png';
                                break;
                            case 'youtube':
                                iconUrl = 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png';
                                break;
                            case 'whatsapp':
                                iconUrl = 'https://cdn-icons-png.flaticon.com/512/124/124034.png';
                                break;
                            case 'website':
                                iconUrl = 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png';
                                break;
                            default:
                                return '';
                        }

                        const url = this.mergeTagService.process(net.url, context);
                        return `
             <a href="${url}" target="_blank" style="text-decoration: none;">
               <img src="${iconUrl}" alt="${net.type}" style="${iconStyle} border: 0;" />
             </a>
           `;
                    })
                    .join('');

                return `
          <div style="text-align: ${style.textAlign || 'center'}; padding: 10px 0;">
            ${iconsHtml}
          </div>
        `;
            }

            case 'columns': {
                if (!block.props.columns || !Array.isArray(block.props.columns)) return '';

                const cols = block.props.columns
                    .map((col) => {
                        const colContent = this.mergeTagService.process(unescape(col.content || ''), context);
                        const width = col.width || `${100 / block.props.columns!.length}%`;

                        return `
             <td width="${width}" valign="top" style="padding: 5px; font-family: Arial, sans-serif; font-size: 14px; color: ${style.textColor || '#333'};">
               ${colContent}
             </td>
           `;
                    })
                    .join('');

                return `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
            <tr>${cols}</tr>
          </table>
        `;
            }

            case 'list': {
                const items = block.props.items || [];
                const listTag = block.props.listType === 'numbered' ? 'ol' : 'ul';
                const listItemsHtml = items
                    .map((item) => `<li style="margin-bottom: 8px;">${this.mergeTagService.process(item.text, context)}</li>`)
                    .join('');

                return `
          <div style="${cssStyles}">
            <${listTag} style="padding-left: 20px; margin: 0;">
              ${listItemsHtml}
            </${listTag}>
          </div>
        `;
            }

            case 'table': {
                const headers = block.props.tableHeaders || [];
                const rows = block.props.tableRows || [];

                const thHtml = headers
                    .map((h) => `<th style="padding: 8px; background-color: ${style.backgroundColor || '#007bff'}; color: #fff; border: 1px solid #ddd;">${h}</th>`)
                    .join('');

                const rowsHtml = rows
                    .map((row) => {
                        const cellsHtml = row.cells
                            .map((c) => `<td style="padding: 8px; border: 1px solid #ddd; color: ${style.textColor || '#333'};">${this.mergeTagService.process(c, context)}</td>`)
                            .join('');
                        return `<tr>${cellsHtml}</tr>`;
                    })
                    .join('');

                return `
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif;">
            <thead><tr>${thHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
            }

            default:
                return '';
        }
    }

    private objToCss(styleObj: Record<string, string | undefined>): string {
        return Object.entries(styleObj)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${k}:${v}`)
            .join(';');
    }

    /** Envolve o HTML do corpo no layout padrão (cabeçalho/rodapé) usado em todo e-mail transacional. */
    async renderWithOrganizationLayout(
        bodyHtml: string,
        organization?: { name?: string | null; logoUrl?: string | null } | null,
        context?: MergeTagContext,
        options?: { senderIdentity?: 'organization' | 'platform' },
    ): Promise<string> {
        try {
            const organizationName = organization?.name ?? 'Sua academia';
            const isPlatformEmail = options?.senderIdentity === 'platform';

            const template = `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${this.escapeHtml(organizationName)}</title>
        <style>
          body { margin:0; padding:0; background-color:#f5f7fb; color:#333333; font-family: Arial, sans-serif; line-height: 1.6; }
          .container { width:100%; max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          .content { padding: 30px 20px; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #888888; background-color: #f9f9f9; border-top: 1px solid #eee; }
          a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <div style="background-color:#f5f7fb; padding: 20px 0;">
          <div class="container">
            <div class="content">
              ${bodyHtml}
            </div>
            <div class="footer">
              ${isPlatformEmail ? `<p>Enviado pela equipe da plataforma</p>` : `<p>Enviado por <strong>${this.escapeHtml(organizationName)}</strong></p>`}
            </div>
          </div>
        </div>
      </body>
      </html>`;

            return context ? this.mergeTagService.process(template, context) : template;
        } catch (err) {
            this.logger.error('Falha ao montar layout do e-mail.', err as any);
            return bodyHtml;
        }
    }

    private escapeHtml(input: string): string {
        if (!input) return '';
        return String(input).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    private escapeAttr(input: string): string {
        if (!input) return '';
        return String(input).replace(/"/g, '&quot;');
    }
}
