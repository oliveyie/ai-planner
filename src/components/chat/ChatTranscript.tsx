import type { ChatMessage } from "@/src/lib/types";

export function ChatTranscript({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`max-w-2xl whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
            message.role === "user"
              ? "self-end bg-coral text-white shadow-[0_4px_16px_rgba(249,124,86,0.25)]"
              : "self-start border border-[#EDE2D4] bg-surface-low text-foreground"
          }`}
        >
          {message.content}
        </div>
      ))}
    </div>
  );
}
