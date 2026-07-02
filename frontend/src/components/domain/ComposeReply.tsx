import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import type { ComposeState, DraftReplyResult } from '@/types';
import { useDraftReply, useSendMessage } from '@/hooks/useDraftReply';

export interface ComposeReplyProps {
  contactNumber: string;
  /** Target is a monitored group (routes the send to the group chat). */
  isGroup?: boolean;
  messageCount: number;
  onMessageCountChange: (count: number) => void;
  composeState: ComposeState;
  onComposeStateChange: (state: ComposeState) => void;
}

const LANGUAGE_LABELS: Record<string, string> = { es: 'Spanish', en: 'English', he: 'Hebrew' };

export function ComposeReply({
  contactNumber,
  isGroup = false,
  messageCount,
  onMessageCountChange,
  composeState,
  onComposeStateChange,
}: ComposeReplyProps) {
  const [draft, setDraft] = useState('');
  const [englishDraft, setEnglishDraft] = useState('');
  const [translatedDraft, setTranslatedDraft] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [sendingWhich, setSendingWhich] = useState<'english' | 'translated' | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const draftReply = useDraftReply();
  const sendMessage = useSendMessage();

  const isEngaged = composeState !== 'idle';
  const showEditors = composeState === 'preview' || composeState === 'sending';
  const isBusy = composeState === 'generating' || composeState === 'sending';
  const needsTranslation = showEditors && translatedDraft.trim() !== '';
  const targetLangLabel = LANGUAGE_LABELS[targetLanguage] || targetLanguage;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [draft, englishDraft]);

  const resetState = () => {
    setDraft('');
    setEnglishDraft('');
    setTranslatedDraft('');
    setSendingWhich(null);
    onComposeStateChange('idle');
  };

  const doSend = (text: string, which: 'english' | 'translated') => {
    const messageToSend = text.trim();
    if (!messageToSend) return;
    setSendingWhich(which);
    onComposeStateChange('sending');
    sendMessage.mutate(
      { number: contactNumber, message: messageToSend, isGroup },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: 'Message sent' });
          resetState();
        },
        onError: (err: Error) => {
          toast({ tone: 'danger', title: 'Send failed', description: err.message });
          setSendingWhich(null);
          onComposeStateChange('preview');
        },
      },
    );
  };

  const handleGenerate = () => {
    if (!draft.trim()) return;
    onComposeStateChange('generating');
    draftReply.mutate(
      { number: contactNumber, draft: draft.trim(), messageCount },
      {
        onSuccess: (result: DraftReplyResult) => {
          setEnglishDraft(result.english);
          setTranslatedDraft(result.translated ?? '');
          setTargetLanguage(result.targetLanguage);
          onComposeStateChange('preview');
        },
        onError: (err: Error) => {
          toast({ tone: 'danger', title: 'Draft failed', description: err.message });
          onComposeStateChange('composing');
        },
      },
    );
  };

  const handleDirectSend = () => {
    if (!draft.trim() || isBusy) return;
    doSend(draft, 'english');
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (composeState === 'composing') handleGenerate();
    } else if (e.key === 'Enter' && !e.shiftKey && composeState === 'composing') {
      e.preventDefault();
      handleDirectSend();
    }
    if (e.key === 'Escape' && isEngaged) {
      e.preventDefault();
      resetState();
    }
  };

  const DraftRow = ({
    label,
    value,
    onChange,
    onSend,
    which,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    which: 'english' | 'translated';
  }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[11.5px] font-bold uppercase tracking-wider text-fg-muted">
          Send in {label}
        </span>
        <Button
          variant="primary"
          size="sm"
          icon="send"
          label="Send"
          loading={sendingWhich === which && composeState === 'sending'}
          disabled={!value.trim() || isBusy}
          onClick={onSend}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isBusy}
        rows={2}
        className="w-full resize-none rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13.5px] text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none disabled:opacity-60"
        placeholder="…"
      />
    </div>
  );

  return (
    <div className="shrink-0 border-t border-line-strong bg-surface">
      {showEditors && (
        <div className="flex flex-col gap-3 px-4 pt-3">
          {needsTranslation && (
            <DraftRow
              label={targetLangLabel}
              value={translatedDraft}
              onChange={setTranslatedDraft}
              which="translated"
              onSend={() => doSend(translatedDraft, 'translated')}
            />
          )}

          <DraftRow
            label="English"
            value={englishDraft}
            onChange={setEnglishDraft}
            which="english"
            onSend={() => doSend(englishDraft, 'english')}
          />

          <div className="flex items-center justify-between gap-2 pb-1">
            <Button variant="secondary" size="sm" icon="x" label="Cancel" onClick={resetState} disabled={isBusy} />
            {composeState === 'preview' && (
              <Button variant="secondary" size="sm" icon="sparkles" label="Retry" onClick={handleGenerate} />
            )}
          </div>
        </div>
      )}

      <div className={cn('px-4', showEditors ? 'pb-3' : 'py-3')}>
        <div className="flex items-start gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (composeState === 'idle') onComposeStateChange('composing');
              }}
              onFocus={() => {
                if (composeState === 'idle') onComposeStateChange('composing');
              }}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              rows={1}
              placeholder="Write what you want to say — AI will polish it into a natural reply…"
              className="w-full resize-none rounded-[10px] border border-line-strong bg-bg px-3 py-2 text-[13.5px] text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <div className="flex items-center gap-1.5 text-[11.5px] text-fg-muted">
              <span>Context:</span>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-[4px] border border-line-strong bg-bg text-fg-muted hover:text-fg disabled:opacity-40"
                disabled={isBusy || messageCount <= 1}
                onClick={() => onMessageCountChange(Math.max(1, messageCount - 1))}
              >
                <Icon name="minus" size={12} />
              </button>
              <span className="font-mono text-[12px] text-fg">{messageCount}</span>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-[4px] border border-line-strong bg-bg text-fg-muted hover:text-fg disabled:opacity-40"
                disabled={isBusy || messageCount >= 20}
                onClick={() => onMessageCountChange(Math.min(20, messageCount + 1))}
              >
                <Icon name="plus" size={12} />
              </button>
              <span>message{messageCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex items-start gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              icon="sparkles"
              label="Generate"
              loading={composeState === 'generating'}
              disabled={composeState === 'generating' || composeState === 'preview' || composeState === 'sending' || !draft.trim()}
              onClick={handleGenerate}
            />
            <Button
              variant="primary"
              size="sm"
              icon="send"
              label="Send"
              disabled={!draft.trim() || composeState === 'generating' || composeState === 'preview' || composeState === 'sending'}
              onClick={handleDirectSend}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
