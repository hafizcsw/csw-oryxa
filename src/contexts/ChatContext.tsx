import { createContext, useContext, useState, ReactNode } from "react";

type ChatCtx = { 
  isOpen: boolean; 
  open: (initialMessage?: string) => void; 
  close: () => void; 
  toggle: () => void;
  pendingMessage: string | null;
  consumePendingMessage: () => string | null;
};
const Ctx = createContext<ChatCtx | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const open = (initialMessage?: string) => {
    if (initialMessage) setPendingMessage(initialMessage);
    setOpen(true);
  };

  const consumePendingMessage = () => {
    const msg = pendingMessage;
    setPendingMessage(null);
    return msg;
  };

  const api: ChatCtx = { 
    isOpen, 
    open, 
    close: () => setOpen(false), 
    toggle: () => setOpen(v => !v),
    pendingMessage,
    consumePendingMessage,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useChat(){ 
  const v = useContext(Ctx); 
  if(!v) throw new Error("Wrap with <ChatProvider>"); 
  return v; 
}
