// frontend/src/pages/admin/EmailTemplates.tsx
//
// Lista de templates de e-mail transacional — visível a SUPER_ADMIN (padrões globais e,
// com uma academia ativa selecionada, os overrides dela) e ORG_ADMIN (só o override da
// própria academia). Edição de conteúdo/design fica em EmailTemplateEditor.tsx (construtor
// visual, portado de MaskotCrmEdu) — esta tela só lista, cria e remove.

import { useState } from 'react';
import { Mail, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Label, Input, Select, ErrorText, Form, FormActions, HelpText } from '@/components/ui/FormField';
import { Table, TableWrapper, Thead, Tr, Th, Td, EmptyState, Badge } from '@/components/ui/Table';
import { emailTemplatesApi, type EmailTriggerType } from '@/services/emailTemplates';
import { toast } from '@/utils/toast';

const schema = z.object({
    name: z.string().min(1, 'Informe um nome para o template'),
    subject: z.string().min(1, 'Informe o assunto do e-mail'),
    trigger: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EmailTemplates() {
    const [modalOpen, setModalOpen] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['email-templates'],
        queryFn: () => emailTemplatesApi.list(),
    });

    const { data: triggers } = useQuery({
        queryKey: ['email-templates', 'triggers'],
        queryFn: () => emailTemplatesApi.getTriggers(),
    });

    const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const openCreate = () => {
        reset({ name: '', subject: '', trigger: '' });
        setModalOpen(true);
    };

    const createMutation = useMutation({
        mutationFn: (input: FormData) =>
            emailTemplatesApi.create({
                name: input.name,
                subject: input.subject,
                trigger: (input.trigger || undefined) as EmailTriggerType | undefined,
            }),
        onSuccess: (template) => {
            toast.success('Template criado com sucesso.');
            queryClient.invalidateQueries({ queryKey: ['email-templates'] });
            setModalOpen(false);
            navigate(`/admin/email-templates/${template.id}/edit`);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível criar o template.');
        },
    });

    const removeMutation = useMutation({
        mutationFn: (id: string) => emailTemplatesApi.remove(id),
        onSuccess: () => {
            toast.success('Template removido.');
            queryClient.invalidateQueries({ queryKey: ['email-templates'] });
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Não foi possível remover o template.');
        },
    });

    const onSubmit = (formData: FormData) => createMutation.mutate(formData);

    const templates = data?.data ?? [];
    const triggerLabels = Object.fromEntries((triggers ?? []).map((t) => [t.value, t.label]));

    return (
        <PageLayout
            title="Modelos de e-mail"
            subtitle="Templates dos e-mails transacionais (boas-vindas, redefinição de senha, vencimento de certificado)"
            icon={<Mail size={16} />}
            actions={
                <Button onClick={openCreate}>
                    <Plus size={16} /> Novo template
                </Button>
            }
        >
            <TableWrapper>
                <Table>
                    <Thead>
                        <tr>
                            <Th>Nome</Th>
                            <Th>Gatilho</Th>
                            <Th>Escopo</Th>
                            <Th></Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {templates.map((template) => (
                            <Tr key={template.id}>
                                <Td>{template.name}</Td>
                                <Td>{template.trigger ? triggerLabels[template.trigger] || template.trigger : '—'}</Td>
                                <Td>
                                    <Badge $tone={template.organizationId ? 'info' : 'neutral'}>
                                        {template.organizationId ? template.organization?.name || 'Academia' : 'Padrão global'}
                                    </Badge>
                                </Td>
                                <Td>
                                    <Button $variant="ghost" onClick={() => navigate(`/admin/email-templates/${template.id}/edit`)}>
                                        Editar
                                    </Button>
                                    {template.organizationId && (
                                        <Button
                                            $variant="ghost"
                                            onClick={() => {
                                                if (confirm(`Remover o template "${template.name}"?`)) removeMutation.mutate(template.id);
                                            }}
                                        >
                                            Remover
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </tbody>
                </Table>
                {!isLoading && templates.length === 0 && <EmptyState>Nenhum template cadastrado ainda.</EmptyState>}
            </TableWrapper>

            <Modal open={modalOpen} onOpenChange={setModalOpen} title="Novo template de e-mail">
                <Form onSubmit={handleSubmit(onSubmit)}>
                    <Field>
                        <Label htmlFor="name">Nome</Label>
                        <Input id="name" {...register('name')} />
                        {errors.name && <ErrorText>{errors.name.message}</ErrorText>}
                    </Field>

                    <Field>
                        <Label htmlFor="subject">Assunto do e-mail</Label>
                        <Input id="subject" {...register('subject')} />
                        {errors.subject && <ErrorText>{errors.subject.message}</ErrorText>}
                    </Field>

                    <Field>
                        <Label htmlFor="trigger">Gatilho (opcional)</Label>
                        <Select id="trigger" {...register('trigger')}>
                            <option value="">Nenhum (template manual)</option>
                            {(triggers ?? []).map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </Select>
                        <HelpText>
                            Vincular a um gatilho faz este template substituir o padrão nesse tipo de e-mail. Já existe um template para
                            cada gatilho por padrão — só crie um novo vinculado a um gatilho se quiser sobrescrevê-lo.
                        </HelpText>
                    </Field>

                    <FormActions>
                        <Button type="button" $variant="secondary" onClick={() => setModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Criando...' : 'Criar e editar'}
                        </Button>
                    </FormActions>
                </Form>
            </Modal>
        </PageLayout>
    );
}
