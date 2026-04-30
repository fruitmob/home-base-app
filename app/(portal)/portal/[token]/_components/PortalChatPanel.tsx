"use client";

import { useState, useRef, useEffect } from "react";
import { PortalMessage, User } from "@/generated/prisma/client";
import { format } from "date-fns";

type MessageWithAuthor = PortalMessage & {
  author: User | null;
};

export default function PortalChatPanel({
  initialMessages,
  token,
}: {
  initialMessages: MessageWithAuthor[];
  token: string;
}) {
  const [messages, setMessages] = useState<MessageWithAuthor[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/portal/${token}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newMessage.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
      } else {
        alert("Failed to send message. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-800">
      <h2 className="text-xl font-semibold flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-indigo-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        Shop Messages
      </h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[500px]">
        {/* Messages List */}
        <div
          ref={scrollRef}
          className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-gray-900/20"
        >
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
              No messages yet. Send a message to the shop!
            </div>
          ) : (
            messages.map((msg) => {
              const isCustomer = msg.authorType === "CUSTOMER";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[80%] ${
                    isCustomer ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isCustomer
                        ? "bg-indigo-500 text-white rounded-br-none"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none"
                    }`}
                  >
                    {msg.body}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 px-1">
                    {!isCustomer && (msg.author?.email || "Shop Staff") + " • "}
                    {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-100 dark:bg-gray-900 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 rounded-full px-4 py-2"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 text-white p-2 rounded-full transition-colors flex items-center justify-center w-10 h-10"
            >
              <svg
                className="w-5 h-5 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
