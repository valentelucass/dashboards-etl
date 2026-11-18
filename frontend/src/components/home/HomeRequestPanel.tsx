import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Heading } from '@astryxdesign/core/Heading';
import { Selector } from '@astryxdesign/core/Selector';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { ClipboardList, Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { HomeRequestFormState, HomeRequestType } from '../../types/home';
import { FormTextField } from '../shared/FormTextField';

const REQUEST_TYPES: Array<{ value: HomeRequestType; label: string }> = [
  { value: 'MELHORIA', label: 'Melhoria de processo' },
  { value: 'AUTOMACAO', label: 'Automação' },
  { value: 'DASHBOARD', label: 'Novo dashboard ou relatório' },
  { value: 'CORRECAO', label: 'Correção' },
  { value: 'OUTRO', label: 'Outro' },
];
const EMPTY_FORM: HomeRequestFormState = {
  type: 'MELHORIA', title: '', description: '', expectedResult: '', applicationLocation: '', attachments: [],
};
const ATTACHMENT_TYPES = '.pdf,.png,.jpg,.jpeg,.xls,.xlsx,.csv,application/pdf,image/png,image/jpeg,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS_BYTES = 20 * 1024 * 1024;

export default function HomeRequestPanel({
  saving,
  error,
  requestCount,
  requestsLabel = 'Ver solicitações',
  onOpenRequests,
  onSubmit,
}: {
  saving: boolean;
  error: string | null;
  requestCount?: number;
  requestsLabel?: string;
  onOpenRequests?: () => void;
  onSubmit: (form: HomeRequestFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<HomeRequestFormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(false);
    try {
      await onSubmit(form);
      setForm(EMPTY_FORM);
      setAttachmentError(null);
      setSubmitted(true);
    } catch {
      // O erro é apresentado no formulário.
    }
  }

  function selectAttachments(files: File[] | File | null) {
    if (!files) return;
    const attachments = [...form.attachments, ...[files].flat()];
    if (attachments.length > MAX_ATTACHMENTS) {
      setAttachmentError('Envie no máximo 5 anexos por solicitação.');
      return;
    }
    if (attachments.some(attachment => attachment.size > MAX_ATTACHMENT_BYTES)) {
      setAttachmentError('Cada anexo pode ter no máximo 10 MB.');
      return;
    }
    if (attachments.reduce((total, attachment) => total + attachment.size, 0) > MAX_TOTAL_ATTACHMENTS_BYTES) {
      setAttachmentError('Os anexos somados podem ter no máximo 20 MB.');
      return;
    }
    setForm({ ...form, attachments });
    setAttachmentError(null);
  }

  return (
    <Card padding={5} aria-labelledby="home-request-title" className="home-request-body">
      <div className="home-request-heading">
        <div>
          <Heading level={2} id="home-request-title">Solicitar melhoria</Heading>
          <Text as="p" color="secondary">Descreva o que pode melhorar na sua rotina e como a equipe pode ajudar.</Text>
        </div>
        {onOpenRequests && (
          <Button label={requestsLabel + (requestCount != null ? ' (' + requestCount + ')' : '')}
            icon={<ClipboardList size={16} />} variant="secondary" onClick={onOpenRequests} />
        )}
      </div>
      <form className="home-fields home-request-form" onSubmit={event => void submit(event)}>
        <div className="home-form-columns">
          <Selector label="Tipo de melhoria" value={form.type} options={REQUEST_TYPES} width="100%"
            onChange={type => setForm({ ...form, type: type as HomeRequestType })} />
          <FormTextField label="O que você precisa?" value={form.title} onChange={title => setForm({ ...form, title })}
            placeholder="Ex.: automatizar conferência diária" maxLength={140} required />
        </div>
        <TextArea label="Contexto e impacto" placeholder="Como é feito hoje e qual dificuldade a melhoria resolve?"
          value={form.description} onChange={description => setForm({ ...form, description })} maxLength={2000}
          containerClassName="home-request-context"
          {...{ required: true }} isRequired width="100%" rows={4} />
        <div className="home-form-columns">
          <FormTextField label="Resultado esperado" value={form.expectedResult}
            onChange={expectedResult => setForm({ ...form, expectedResult })} maxLength={1000} isOptional />
          <FormTextField label="Onde será aplicado?" value={form.applicationLocation}
            onChange={applicationLocation => setForm({ ...form, applicationLocation })} maxLength={500} isOptional />
        </div>
        <div className="home-request-actions">
          <FileInput label="Anexos" isOptional isMultiple value={null} onChange={selectAttachments}
            accept={ATTACHMENT_TYPES} width="100%" placeholder="Adicionar anexos"
            containerClassName="home-request-upload"
            description="PDF, PNG, JPG, XLS, XLSX ou CSV. Até 5 arquivos." />
          <Button label={saving ? 'Enviando…' : 'Enviar solicitação'} type="submit" variant="primary"
            isDisabled={saving} icon={<Send size={16} />} />
        </div>
        {form.attachments.length > 0 && (
          <div className="home-actions" aria-label="Anexos selecionados">
            {form.attachments.map((attachment, index) => (
              <span className="home-attachment-chip" key={attachment.name + '-' + attachment.size + '-' + index}>
                <Badge label={attachment.name} variant="neutral" className="home-file-badge" />
                <Button isIconOnly icon={<X size={14} />} variant="ghost" size="sm"
                  label={'Remover ' + attachment.name} tooltip="Remover anexo"
                  onClick={() => {
                    setForm({ ...form, attachments: form.attachments.filter((_, itemIndex) => itemIndex !== index) });
                    setAttachmentError(null);
                  }} />
              </span>
            ))}
          </div>
        )}
        {attachmentError && <Banner status="error" title={attachmentError} />}
        {error && <Banner status="error" title={error} />}
        {submitted && !error && <Banner status="success" title="Solicitação enviada" />}
      </form>
    </Card>
  );
}
