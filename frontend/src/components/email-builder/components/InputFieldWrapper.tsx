import React from 'react';

interface InputFieldWrapperProps {
    type?: string;
    name: string;
    value: string | number | readonly string[] | undefined;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    style?: React.CSSProperties;
}

// Wrapper para garantir que o input receba apenas valores válidos
export const InputFieldWrapper: React.FC<InputFieldWrapperProps> = ({
                                                                        type = "text",
                                                                        name,
                                                                        value,
                                                                        onChange,
                                                                        onKeyDown,
                                                                        placeholder,
                                                                        style
                                                                    }) => {
    // Converter valores complexos para string
    const getInputValue = (val: string | number | readonly string[] | undefined): string => {
        if (val === undefined || val === null) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'number') return val.toString();
        if (Array.isArray(val)) return val.join(', '); // Para arrays, juntar com vírgula
        return String(val);
    };

    return (
        <input
            type={type}
            name={name}
            value={getInputValue(value)}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            style={style}
        />
    );
};