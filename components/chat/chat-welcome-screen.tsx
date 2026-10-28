import { Logo } from "@/components/ui/logo";
import { ChatInputBox } from "./chat-input-box";
import { APP_NAME, STARTER_QUESTIONS, WELCOME_SUBTITLE, WELCOME_TITLE } from "@/lib/brand";

interface ChatWelcomeScreenProps {
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onStarterClick: (question: string) => void;
}

export function ChatWelcomeScreen({
  message,
  onMessageChange,
  onSend,
  onStarterClick,
}: ChatWelcomeScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 md:px-8">
      <div className="w-full max-w-[640px] space-y-9 -mt-12">
        <div className="flex justify-center">
          <div className="flex items-center justify-center size-8 rounded-full">
            <Logo className="size-20" />
          </div>
        </div>

        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {WELCOME_TITLE}
          </h1>
          <p className="text-2xl text-foreground">
            {WELCOME_SUBTITLE}
          </p>
        </div>

        <ChatInputBox
          message={message}
          onMessageChange={onMessageChange}
          onSend={onSend}
        />

        <div className="grid gap-2 sm:grid-cols-2">
          {STARTER_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onStarterClick(question)}
              className="rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 text-center">
        <p className="text-sm text-muted-foreground">
          {APP_NAME} can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}

