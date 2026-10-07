// frontend/src/pages/certificates/editor/MiniLayout.tsx
//
// Miniatura estática de um layout (lista de modelos, modelos prontos do editor).

import { PAGE_SIZE, type CertificateLayout } from '../layout/types';
import { ElementView, type RenderContext } from './ElementView';
import type { BaseRenderContext } from './useCertificateRenderContext';

export function MiniLayout({ layout, ctx, width }: { layout: CertificateLayout; ctx: BaseRenderContext; width: number }) {
    const page = PAGE_SIZE[layout.orientation];
    const scale = width / page.width;
    const renderCtx: RenderContext = { ...ctx, layout, scale, showVariables: false, thumbnail: true };
    return (
        <div
            aria-hidden
            style={{
                position: 'relative',
                width,
                height: page.height * scale,
                overflow: 'hidden',
                background: layout.background.color,
                boxShadow: '0 1px 3px rgba(0,0,0,.15)',
                pointerEvents: 'none',
                flexShrink: 0,
            }}
        >
            {layout.background.imageUrl && (
                <img src={layout.background.imageUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {layout.elements.map((element) =>
                element.hidden ? null : (
                    <div
                        key={element.id}
                        style={{
                            position: 'absolute',
                            left: element.x * scale,
                            top: element.y * scale,
                            width: element.w * scale,
                            height: element.h * scale,
                            opacity: element.opacity ?? 1,
                            transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                        }}
                    >
                        <ElementView element={element} ctx={renderCtx} />
                    </div>
                ),
            )}
        </div>
    );
}
