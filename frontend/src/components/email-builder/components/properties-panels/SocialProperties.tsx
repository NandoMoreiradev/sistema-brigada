import React, { useState } from 'react';
import type { ExtendedBlockProps, SocialLink } from '../../types';
import styled from 'styled-components';
import {
    FacebookLogo, InstagramLogo, TwitterLogo, LinkedinLogo, YoutubeLogo,
    Link as LinkIconPhosphor, TiktokLogo, WhatsappLogo, TelegramLogo,
    GithubLogo, DribbbleLogo, BehanceLogo, At
} from 'phosphor-react';
import { StyleSection, StyleSectionTitle } from '../../styles';

// --- INÍCIO: Componentes de Estilo Locais ---
const SocialLinkRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
`;

const IconWrapper = styled.div`
    color: #495057;
    flex-shrink: 0;
`;

const FullWidthInput = styled.input`
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #dee2e6;
    font-size: 14px;
    transition: all 0.2s ease-in-out;

    &:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
`;
// --- FIM: Componentes de Estilo Locais ---


interface SocialPropertiesProps {
    props: ExtendedBlockProps;
    onPropsChange: (newProps: ExtendedBlockProps) => void;
}

// Lista de todas as redes sociais suportadas para renderizar o formulário
const ALL_SOCIAL_LINKS: SocialLink[] = [
    { id: 'facebook', name: 'Facebook', url: '' },
    { id: 'instagram', name: 'Instagram', url: '' },
    { id: 'twitter', name: 'Twitter / X', url: '' },
    { id: 'linkedin', name: 'LinkedIn', url: '' },
    { id: 'youtube', name: 'YouTube', url: '' },
    { id: 'tiktok', name: 'TikTok', url: '' },
    { id: 'whatsapp', name: 'WhatsApp', url: '' },
    { id: 'telegram', name: 'Telegram', url: '' },
    { id: 'github', name: 'GitHub', url: '' },
    { id: 'dribbble', name: 'Dribbble', url: '' },
    { id: 'behance', name: 'Behance', url: '' },
    { id: 'email', name: 'E-mail', url: '' },
    { id: 'website', name: 'Website', url: '' },
];

// Mapeamento de IDs para os componentes de ícone
const iconMap = {
    facebook: FacebookLogo,
    instagram: InstagramLogo,
    twitter: TwitterLogo,
    linkedin: LinkedinLogo,
    youtube: YoutubeLogo,
    tiktok: TiktokLogo,
    whatsapp: WhatsappLogo,
    telegram: TelegramLogo,
    github: GithubLogo,
    dribbble: DribbbleLogo,
    behance: BehanceLogo,
    email: At,
    website: LinkIconPhosphor,
};

const InfoBox = styled.div`
    background-color: #e7f3ff;
    border: 1px solid #b3e0ff;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 16px;
    font-size: 12px;
    color: #004085;
    line-height: 1.5;
`;

const PresetButton = styled.button`
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #dee2e6;
    background: white;
    color: #495057;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        background: #f8f9fa;
        border-color: #007bff;
    }
`;

export const SocialProperties: React.FC<SocialPropertiesProps> = ({ props, onPropsChange }) => {
    const currentLinks = props.socialLinks || [];
    const [showAll, setShowAll] = useState(false);

    // Redes sociais principais (sempre visíveis)
    const mainSocials = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube'];
    // Redes sociais secundárias (exibidas ao clicar em "Mostrar mais")
    const secondarySocials = ALL_SOCIAL_LINKS.filter(s => !mainSocials.includes(s.id));

    const handleUrlChange = (id: SocialLink['id'], newUrl: string) => {
        const existingLink = currentLinks.find(link => link.id === id);
        let updatedLinks: SocialLink[];

        if (existingLink) {
            updatedLinks = currentLinks.map(link =>
                link.id === id ? { ...link, url: newUrl } : link
            );
        } else {
            const newLinkTemplate = ALL_SOCIAL_LINKS.find(l => l.id === id)!;
            updatedLinks = [...currentLinks, { ...newLinkTemplate, url: newUrl }];
        }

        const finalLinks = updatedLinks.filter(link => link.url);
        onPropsChange({ ...props, socialLinks: finalLinks });
    };

    const renderSocialInputs = (socials: SocialLink[]) => {
        return socials.map(social => {
            const IconComponent = iconMap[social.id];
            const currentUrl = currentLinks.find(l => l.id === social.id)?.url || '';
            const placeholder = social.id === 'email' ? 'mailto:exemplo@email.com' :
                                social.id === 'whatsapp' ? 'https://wa.me/5511999999999' :
                                'https://...';

            return (
                <SocialLinkRow key={social.id}>
                    <IconWrapper title={social.name}>
                        <IconComponent size={24} />
                    </IconWrapper>
                    <FullWidthInput
                        type="url"
                        placeholder={placeholder}
                        value={currentUrl}
                        onChange={(e) => handleUrlChange(social.id, e.target.value)}
                        aria-label={`URL do ${social.name}`}
                    />
                </SocialLinkRow>
            );
        });
    };

    return (
        <StyleSection>
            <StyleSectionTitle>
                <LinkIconPhosphor size={16} />
                Links das Redes Sociais
            </StyleSectionTitle>
            <InfoBox>
                💡 <strong>Dica:</strong> Insira as URLs completas das suas redes sociais. Deixe em branco para não exibir o ícone no e-mail.
            </InfoBox>

            {renderSocialInputs(ALL_SOCIAL_LINKS.filter(s => mainSocials.includes(s.id)))}

            {showAll && renderSocialInputs(secondarySocials)}

            <PresetButton
                onClick={() => setShowAll(!showAll)}
                style={{ width: '100%', marginTop: '12px' }}
            >
                {showAll ? '▲ Mostrar menos' : '▼ Mostrar mais redes sociais'}
            </PresetButton>
        </StyleSection>
    );
};
