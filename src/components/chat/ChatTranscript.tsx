import type { ChatMessage } from "@/src/lib/types";

export function ChatTranscript({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-b border-foreground/10 pb-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`max-w-2xl whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
            message.role === "user"
              ? "self-end bg-foreground text-background"
              : "self-start bg-foreground/5 text-foreground"
          }`}
        >
          {message.content}
        </div>
      ))}
    </div>
  );
}
