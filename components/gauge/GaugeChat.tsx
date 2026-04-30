"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  canPrepareGaugeDraftWrite,
  getGaugeDraftWriteLabel,
  type GaugeActionArtifact,
} from "@/lib/gauge/actions";
import type { GaugeDraftArtifact } from "@/lib/gauge/drafts";
import { apiFetch } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  drafts?: GaugeDraftArtifact[];
  actions?: GaugeActionArtifact[];
};

type ConversationSummary = {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  preview: string | null;
  messageCount: number;
  toolCallCount: number;
};

type ConversationDetail = {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  toolCallCount: number;
  messages: Array<{
    id: string;
    role: "USER" | "ASSISTANT";
    content: string;
    createdAt: string;
    drafts?: GaugeDraftArtifact[];
    actions?: GaugeActionArtifact[];
  }>;
};

type AssistantMessagePayload = {
  id: string;
  role: "ASSISTANT";
  content: string;
  drafts?: GaugeDraftArtifact[];
  actions?: GaugeActionArtifact[];
};

type GaugeChatResponse = {
  conversationId: string;
  provider: string;
  model: string;
  message?: AssistantMessagePayload;
  error?: string;
};

type GaugeActionResponse = {
  conversationId: string;
  message?: AssistantMessagePayload;
  error?: string;
};

type ConversationListResponse = {
  conversations: ConversationSummary[];
};

type ConversationDetailResponse = {
  conversation: ConversationDetail;
  error?: string;
};

type DraftWorkspace = {
  sourceId: string;
  title: string;
  body: string;
};

const welcomeMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "ASSISTANT",
    content:
      "Gauge is online in local-first mode. Ask about live shop data or ask me to draft a customer update, estimate suggestions, a KB article, or an internal note.",
  },
];

export function GaugeChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(welcomeMessages);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [modelLabel, setModelLabel] = useState("mock");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<GaugeDraftArtifact | null>(null);
  const [draftWorkspace, setDraftWorkspace] = useState<DraftWorkspace | null>(null);
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [isPreparingWrite, setIsPreparingWrite] = useState(false);
  const [confirmingToolCallId, setConfirmingToolCallId] = useState<string | null>(null);

  useEffect(() => {
    void loadConversations();
  }, []);

  const draftWorkspaceActive =
    !!selectedDraft && !!draftWorkspace && draftWorkspace.sourceId === selectedDraft.id;

  const activeDraftBody = useMemo(() => {
    if (!selectedDraft) {
      return null;
    }

    if (draftWorkspaceActive && draftWorkspace) {
      return draftWorkspace.body;
    }

    return selectedDraft.body;
  }, [draftWorkspace, draftWorkspaceActive, selectedDraft]);

  async function loadConversations() {
    setIsLoadingConversations(true);

    try {
      const response = await fetch("/api/gauge/conversations", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({ conversations: [] }))) as ConversationListResponse;

      if (!response.ok) {
        throw new Error("Gauge could not load conversation history.");
      }

      setConversations(body.conversations ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gauge could not load conversation history.");
    } finally {
      setIsLoadingConversations(false);
    }
  }

  async function loadConversation(id: string, force = false) {
    if ((!force && id === conversationId) || isLoadingConversation) {
      return;
    }

    setIsLoadingConversation(true);
    setError(null);

    try {
      const response = await fetch(`/api/gauge/conversations/${id}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as ConversationDetailResponse;

      if (!response.ok || !body.conversation) {
        throw new Error(body.error ?? "Gauge could not load that conversation.");
      }

      setConversationId(body.conversation.id);
      setModelLabel(`${body.conversation.provider}:${body.conversation.model}`);
      setMessages(
        body.conversation.messages.length > 0
          ? body.conversation.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              drafts: message.drafts,
              actions: message.actions,
            }))
          : welcomeMessages,
      );
      resetDraftPanels();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gauge could not load that conversation.");
    } finally {
      setIsLoadingConversation(false);
    }
  }

  function openConversation(id: string) {
    void loadConversation(id);
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages(welcomeMessages);
    setModelLabel("mock");
    setInput("");
    setError(null);
    resetDraftPanels();
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "USER",
      content: message,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await apiFetch("/api/gauge/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          conversationId,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as GaugeChatResponse;

      if (!response.ok || !body.message) {
        throw new Error(body.error ?? "Gauge could not answer that yet.");
      }

      const assistantMessage = body.message;
      setConversationId(body.conversationId);
      setModelLabel(`${body.provider}:${body.model}`);
      setMessages((current) => [
        ...current,
        {
          id: assistantMessage.id,
          role: "ASSISTANT",
          content: assistantMessage.content,
          drafts: assistantMessage.drafts,
          actions: assistantMessage.actions,
        },
      ]);

      if (assistantMessage.drafts?.length) {
        setSelectedDraft(assistantMessage.drafts[0] ?? null);
        setDraftWorkspace(null);
      }

      void loadConversations();
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Gauge could not answer that yet.");
    } finally {
      setIsSending(false);
    }
  }

  async function copyDraft(draft: GaugeDraftArtifact, overrideBody?: string) {
    try {
      await navigator.clipboard.writeText(overrideBody ?? draft.body);
      setCopiedDraftId(draft.id);
      window.setTimeout(() => setCopiedDraftId((current) => (current === draft.id ? null : current)), 1800);
    } catch {
      setError("Gauge could not copy that draft to the clipboard.");
    }
  }

  function reviewDraft(draft: GaugeDraftArtifact) {
    setSelectedDraft(draft);
    setDraftWorkspace(null);
  }

  function createDraft(draft: GaugeDraftArtifact) {
    setSelectedDraft(draft);
    setDraftWorkspace({
      sourceId: draft.id,
      title: draft.title,
      body: draft.body,
    });
  }

  function resetDraftPanels() {
    setSelectedDraft(null);
    setDraftWorkspace(null);
    setCopiedDraftId(null);
  }

  async function prepareDraftWrite(draft: GaugeDraftArtifact) {
    if (!conversationId || isPreparingWrite) {
      return;
    }

    setIsPreparingWrite(true);
    setError(null);

    try {
      const response = await apiFetch("/api/gauge/actions/prepare", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          draft: writableDraft(draft),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as GaugeActionResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Gauge could not prepare that write yet.");
      }

      await loadConversation(conversationId, true);
      void loadConversations();
    } catch (writeError) {
      setError(writeError instanceof Error ? writeError.message : "Gauge could not prepare that write yet.");
    } finally {
      setIsPreparingWrite(false);
    }
  }

  async function confirmAction(toolCallId: string) {
    if (!conversationId || confirmingToolCallId) {
      return;
    }

    setConfirmingToolCallId(toolCallId);
    setError(null);

    try {
      const response = await apiFetch(`/api/gauge/tool-calls/${toolCallId}/confirm`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as GaugeActionResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Gauge could not confirm that write yet.");
      }

      await loadConversation(conversationId, true);
      void loadConversations();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Gauge could not confirm that write yet.");
    } finally {
      setConfirmingToolCallId(null);
    }
  }

  function writableDraft(draft: GaugeDraftArtifact) {
    if (!draftWorkspaceActive || !draftWorkspace || selectedDraft?.id !== draft.id) {
      return draft;
    }

    return {
      ...draft,
      title: draftWorkspace.title,
      body: draftWorkspace.body,
    };
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Recent chats</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Resume any thread without losing context.
              </p>
            </div>
            <button
              type="button"
              onClick={startNewConversation}
              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              New chat
            </button>
          </div>
        </div>

        <div className="max-h-[720px] overflow-y-auto px-3 py-3">
          {isLoadingConversations ? (
            <p className="px-2 py-3 text-sm text-slate-500 dark:text-slate-400">
              Loading conversation history...
            </p>
          ) : conversations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No saved conversations yet. Start a new chat and Gauge will keep the thread.
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation.id)}
                  className={
                    conversation.id === conversationId
                      ? "w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-3 text-left dark:border-blue-800 dark:bg-blue-950/40"
                      : "w-full rounded-lg border border-slate-200 px-3 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-sm font-black text-slate-950 dark:text-white">
                      {conversation.title}
                    </p>
                    <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {formatShortDate(conversation.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {conversation.preview ?? "No preview yet."}
                  </p>
                  <p className="mt-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {conversation.messageCount} messages / {conversation.toolCallCount} tool calls
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-[720px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950 dark:text-white">Gauge</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Local-first assistant with grounded shop search and draft workflows.
              </p>
            </div>
            <span className="self-start rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {modelLabel}
            </span>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 dark:bg-slate-950/30 sm:px-6">
          {messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === "USER"
                  ? "ml-auto max-w-3xl rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                  : "mr-auto max-w-3xl rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>

              {message.drafts?.length ? (
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  {message.drafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      copied={copiedDraftId === draft.id}
                      onCopy={() => void copyDraft(draft)}
                      onReview={() => reviewDraft(draft)}
                      onCreateDraft={() => createDraft(draft)}
                      onPrepareWrite={
                        canPrepareGaugeDraftWrite(draft) ? () => void prepareDraftWrite(draft) : undefined
                      }
                      prepareLabel={getGaugeDraftWriteLabel(draft)}
                      isPreparingWrite={isPreparingWrite}
                    />
                  ))}
                </div>
              ) : null}

              {message.actions?.length ? (
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  {message.actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      isConfirming={confirmingToolCallId === action.toolCallId}
                      onConfirm={
                        action.status === "pending_confirmation" && action.toolCallId
                          ? () => void confirmAction(action.toolCallId!)
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ))}

          {isLoadingConversation ? (
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Loading conversation...
            </p>
          ) : null}

          {isSending ? (
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Gauge is thinking...
            </p>
          ) : null}
        </div>

        {selectedDraft ? (
          <section className="border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  {draftWorkspaceActive ? "Draft Workspace" : "Draft Review"}
                </p>
                <h4 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                  {draftWorkspaceActive && draftWorkspace ? draftWorkspace.title : selectedDraft.title}
                </h4>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedDraft.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyDraft(selectedDraft, draftWorkspaceActive && draftWorkspace ? draftWorkspace.body : undefined)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {copiedDraftId === selectedDraft.id ? "Copied" : "Copy Draft"}
                </button>
                {draftWorkspaceActive ? (
                  <button
                    type="button"
                    onClick={() => setDraftWorkspace(null)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Review Mode
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => createDraft(selectedDraft)}
                    className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    Create Draft
                  </button>
                )}
                {canPrepareGaugeDraftWrite(selectedDraft) ? (
                  <button
                    type="button"
                    onClick={() => void prepareDraftWrite(selectedDraft)}
                    disabled={isPreparingWrite || !conversationId}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:disabled:bg-blue-900"
                  >
                    {isPreparingWrite ? "Preparing..." : getGaugeDraftWriteLabel(selectedDraft)}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={resetDraftPanels}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Close
                </button>
              </div>
            </div>

            {selectedDraft.relatedHref ? (
              <div className="mt-3">
                <Link
                  href={selectedDraft.relatedHref}
                  className="text-sm font-bold text-blue-600 hover:underline dark:text-blue-300"
                >
                  Review source: {selectedDraft.relatedLabel ?? "Open related record"}
                </Link>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                {draftWorkspaceActive && draftWorkspace ? (
                  <div className="space-y-3">
                    <input
                      value={draftWorkspace.title}
                      onChange={(event) =>
                        setDraftWorkspace((current) =>
                          current ? { ...current, title: event.target.value } : current,
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <textarea
                      value={draftWorkspace.body}
                      onChange={(event) =>
                        setDraftWorkspace((current) =>
                          current ? { ...current, body: event.target.value } : current,
                        )
                      }
                      rows={selectedDraft.format === "markdown" ? 16 : 12}
                      className="min-h-[260px] w-full rounded-lg border border-slate-300 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                    {activeDraftBody}
                  </pre>
                )}
              </div>

              <aside className="space-y-4">
                {selectedDraft.reviewItems?.length ? (
                  <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h5 className="text-sm font-black text-slate-950 dark:text-white">Review</h5>
                    <div className="mt-3 space-y-3 text-sm">
                      {selectedDraft.reviewItems.map((item) => (
                        <div key={`${selectedDraft.id}-${item.label}`}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            {item.label}
                          </p>
                          <p className="mt-1 text-slate-700 dark:text-slate-200">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {selectedDraft.lineItems?.length ? (
                  <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h5 className="text-sm font-black text-slate-950 dark:text-white">
                      Suggested Lines
                    </h5>
                    <div className="mt-3 space-y-3">
                      {selectedDraft.lineItems.map((line, index) => (
                        <div
                          key={`${selectedDraft.id}-${index}`}
                          className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                        >
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                            {line.lineType}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {line.description}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Qty {line.quantity} / {line.unitPrice == null ? "Price review needed" : `$${line.unitPrice.toFixed(2)}`}
                          </p>
                          {line.rationale ? (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {line.rationale}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}

        <form onSubmit={sendMessage} className="border-t border-slate-200 p-4 dark:border-slate-800 sm:p-6">
          {error ? (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            {[
              "Draft a customer follow-up for WO-202604-0001",
              "Draft estimate suggestions for a brake pulse complaint",
              "Draft a KB article from WO-202604-0001",
              "Draft an internal note for Unit 42",
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                className="rounded-full border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask: Draft a customer text update for WO-202604-0001, or draft change-order suggestions for the brake job."
              rows={2}
              className="min-h-[88px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending || isLoadingConversation}
              className="min-h-11 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}

function DraftCard({
  draft,
  copied,
  onCopy,
  onReview,
  onCreateDraft,
  onPrepareWrite,
  prepareLabel,
  isPreparingWrite,
}: {
  draft: GaugeDraftArtifact;
  copied: boolean;
  onCopy: () => void;
  onReview: () => void;
  onCreateDraft: () => void;
  onPrepareWrite?: () => void;
  prepareLabel: string;
  isPreparingWrite: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            {draft.kind.replaceAll("_", " ")}
          </p>
          <h5 className="mt-1 text-sm font-black text-slate-950 dark:text-white">{draft.title}</h5>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          {draft.format}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{draft.summary}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-500 dark:text-slate-400">
        {truncateDraftBody(draft.body)}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={onReview}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          Review
        </button>
        <button
          type="button"
          onClick={onCreateDraft}
          className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Create Draft
        </button>
        {onPrepareWrite ? (
          <button
            type="button"
            onClick={onPrepareWrite}
            disabled={isPreparingWrite}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:disabled:bg-blue-900"
          >
            {isPreparingWrite ? "Preparing..." : prepareLabel}
          </button>
        ) : null}
        {draft.relatedHref ? (
          <Link
            href={draft.relatedHref}
            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-black text-blue-600 transition hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            Open Record
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ActionCard({
  action,
  onConfirm,
  isConfirming,
}: {
  action: GaugeActionArtifact;
  onConfirm?: () => void;
  isConfirming: boolean;
}) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-300">
            {action.status === "completed" ? "write completed" : "confirmation required"}
          </p>
          <h5 className="mt-1 text-sm font-black text-slate-950 dark:text-white">{action.title}</h5>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          {action.kind.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{action.summary}</p>
      {action.body ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-500 dark:text-slate-400">
          {truncateDraftBody(action.body)}
        </p>
      ) : null}

      {action.reviewItems?.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {action.reviewItems.map((item) => (
            <div
              key={`${action.id}-${item.label}`}
              className="rounded-lg border border-blue-100 bg-white px-3 py-2 dark:border-blue-900 dark:bg-slate-900"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {onConfirm ? (
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:disabled:bg-blue-900"
          >
            {isConfirming ? "Confirming..." : action.confirmationLabel}
          </button>
        ) : null}
        {action.resultHref ? (
          <Link
            href={action.resultHref}
            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-white dark:border-blue-900 dark:text-blue-300 dark:hover:bg-slate-900"
          >
            Open Result
          </Link>
        ) : null}
        {action.relatedHref ? (
          <Link
            href={action.relatedHref}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Open Context
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function truncateDraftBody(value: string) {
  return value.length > 240 ? `${value.slice(0, 237)}...` : value;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
