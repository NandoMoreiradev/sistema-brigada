// frontend/src/utils/dom.ts

/** Espera todas as imagens de `root` carregarem (e dois frames de pintura). */
export async function waitForImages(root: ParentNode | null): Promise<void> {
    const images = Array.from(root?.querySelectorAll('img') ?? []);
    await Promise.all(images.map((img) => (img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = () => resolve(null); }))));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
