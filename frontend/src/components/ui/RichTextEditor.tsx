// frontend/src/components/ui/RichTextEditor.tsx
//
// Editor de texto rico mínimo, para descrição/conteúdo de vídeo-aula (negrito,
// itálico, sublinhado, listas, link). Tiptap já era dependência do projeto
// (usado só como tipo pelo email-builder) mas nunca tinha uma instância real
// (useEditor()) em lugar nenhum — este é o primeiro editor de verdade.

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import styled from 'styled-components';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

const Wrapper = styled.div`
    border: 1px solid ${({ theme }) => theme.colors.borderLight};
    border-radius: ${({ theme }) => theme.radii.sm};
    overflow: hidden;
`;

const Toolbar = styled.div`
    display: flex;
    gap: 0.25rem;
    padding: 0.375rem;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderLight};
    background: ${({ theme }) => theme.colors.lightGray};
`;

const ToolbarButton = styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: ${({ theme }) => theme.radii.sm};
    background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : 'transparent')};
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    cursor: pointer;

    &:hover {
        background: ${({ theme }) => theme.colors.primaryLight};
    }
`;

const EditorArea = styled.div`
    padding: 0.6rem 0.75rem;
    min-height: 120px;
    font-size: 0.875rem;

    .ProseMirror {
        outline: none;
    }
    .ProseMirror p {
        margin: 0 0 0.5em;
    }
    .ProseMirror ul,
    .ProseMirror ol {
        margin: 0 0 0.5em;
        padding-left: 1.25rem;
    }
    .ProseMirror a {
        color: ${({ theme }) => theme.colors.primary};
    }
    .ProseMirror img,
    .ProseMirror video,
    .ProseMirror iframe {
        max-width: 100%;
        max-height: 360px;
        height: auto;
    }
`;

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    disabled?: boolean;
}

export function RichTextEditor({ value, onChange, disabled }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [StarterKit, Underline, Link.configure({ openOnClick: false, autolink: true })],
        content: value,
        editable: !disabled,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    if (!editor) return null;

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('URL do link:', previousUrl ?? '');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().unsetLink().run();
            return;
        }
        editor.chain().focus().setLink({ href: url }).run();
    };

    return (
        <Wrapper>
            <Toolbar>
                <ToolbarButton type="button" $active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
                    <Bold size={14} />
                </ToolbarButton>
                <ToolbarButton type="button" $active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
                    <Italic size={14} />
                </ToolbarButton>
                <ToolbarButton type="button" $active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado">
                    <UnderlineIcon size={14} />
                </ToolbarButton>
                <ToolbarButton type="button" $active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
                    <List size={14} />
                </ToolbarButton>
                <ToolbarButton type="button" $active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
                    <ListOrdered size={14} />
                </ToolbarButton>
                <ToolbarButton type="button" $active={editor.isActive('link')} onClick={setLink} title="Link">
                    <LinkIcon size={14} />
                </ToolbarButton>
            </Toolbar>
            <EditorArea>
                <EditorContent editor={editor} />
            </EditorArea>
        </Wrapper>
    );
}
