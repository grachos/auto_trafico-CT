'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
import { Send, Bot, User, Sparkles, X, CheckCheck, RefreshCw } from 'lucide-react';
import { cleanAndFormatAIText } from '@/lib/format-utils';

interface TrafficChatProps {
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

export const TrafficChat: React.FC<TrafficChatProps> = ({
  isOpen,
  onClose,
  onActionComplete,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: '👋 ¡Hola! Soy tu **Agente IA de Tráfico ControlT**.\n\nPuedes darme instrucciones en lenguaje natural como:\n• *"Atiende las alarmas de los viajes a tiempo"*\n• *"Dame el reporte de semáforo ETA"*\n• *"¿Cuáles son las alarmas críticas activas?"*\n• *"Atiende la alarma del viaje 0101226621"*',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text }),
      });

      const data = await res.json();
      if (data.success && data.message) {
        setMessages(prev => [...prev, data.message]);
        if (data.message.actionTaken && onActionComplete) {
          onActionComplete();
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'system',
            text: `❌ Error al procesar: ${data.error || 'No se pudo conectar con el agente'}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'system',
          text: `❌ Error de red: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] z-50 bg-white shadow-2xl border-l border-slate-200 flex flex-col">
      
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              Agente IA de Control de Tráfico
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h2>
            <p className="text-[11px] text-slate-300">Conectado a ControlT API & Omnicanal</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Suggested Action Chips */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sugerencias:</span>
        <button
          onClick={() => handleSend('Atiende las alarmas de los viajes a tiempo')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all"
        >
          ⚡ Atender alarmas a tiempo
        </button>
        <button
          onClick={() => handleSend('Dame el reporte de semáforo ETA')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
        >
          📊 Reporte ETA
        </button>
        <button
          onClick={() => handleSend('¿Cuáles son las alarmas críticas activas?')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all"
        >
          🚨 Alarmas críticas
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white shadow-sm rounded-br-none'
                  : msg.sender === 'system'
                  ? 'bg-rose-50 text-rose-900 border border-rose-200'
                  : 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-bl-none'
              }`}
            >
              <div className="text-xs leading-relaxed">
                {renderFormattedMessage(msg.text, msg.sender === 'user')}
              </div>

              {msg.actionTaken && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Acción ejecutada: {msg.actionTaken.summary}</span>
                </div>
              )}

              <div
                className={`text-[10px] mt-1 text-right ${
                  msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex gap-3 items-center text-slate-400 text-xs pl-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>El agente está analizando y ejecutando la acción en ControlT...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe una instrucción (ej: atiende las alarmas a tiempo)..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Conectado al motor conversacional listo para integración con WhatsApp e Instagram.
        </p>
      </div>

    </div>
  );
};

function formatInlineText(text: string, isUser: boolean) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold ${
            isUser ? 'bg-blue-700 text-white' : 'bg-slate-200/90 text-indigo-700'
          }`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className={isUser ? 'font-bold text-white' : 'font-semibold text-slate-900'}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderFormattedMessage(rawText: string, isUser: boolean) {
  const text = cleanAndFormatAIText(rawText);
  const lines = text.split('\n');

  interface MessageBlock {
    type: 'card' | 'header' | 'bullet' | 'text';
    icon?: string;
    header?: string;
    bullets?: string[];
    content?: string;
  }

  const blocks: MessageBlock[] = [];
  let currentCard: MessageBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (currentCard) {
        blocks.push(currentCard);
        currentCard = null;
      }
      continue;
    }

    const isCardHeader = /^(🚛|🚨|📍|📊|🔹)\s+\*\*/.test(trimmed);
    const isBullet = trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ');

    if (isCardHeader) {
      if (currentCard) blocks.push(currentCard);
      currentCard = {
        type: 'card',
        icon: trimmed.slice(0, 2).trim(),
        header: trimmed,
        bullets: [],
      };
    } else if (isBullet && currentCard) {
      currentCard.bullets!.push(trimmed.replace(/^[•\-\*]\s*/, ''));
    } else {
      if (currentCard) {
        blocks.push(currentCard);
        currentCard = null;
      }
      if (trimmed.startsWith('#')) {
        blocks.push({ type: 'header', content: trimmed.replace(/^#+\s*/, '') });
      } else if (isBullet) {
        blocks.push({ type: 'bullet', content: trimmed.replace(/^[•\-\*]\s*/, '') });
      } else {
        blocks.push({ type: 'text', content: trimmed });
      }
    }
  }

  if (currentCard) blocks.push(currentCard);

  return (
    <div className="space-y-1.5">
      {blocks.map((block, idx) => {
        if (block.type === 'card') {
          const icon = block.icon || '🚛';

          let cardStyle = 'bg-white border border-slate-200/90 text-slate-800';
          let headerStyle = 'text-slate-900 border-slate-100';
          let bulletColor = 'text-indigo-600';

          if (isUser) {
            cardStyle = 'bg-blue-700/60 border border-blue-400/40 text-white';
            headerStyle = 'text-white border-blue-500/50';
            bulletColor = 'text-blue-200';
          } else if (icon === '🚨') {
            cardStyle = 'bg-rose-50/90 border border-rose-200 text-rose-950';
            headerStyle = 'text-rose-900 border-rose-100';
            bulletColor = 'text-rose-600';
          } else if (icon === '📊') {
            cardStyle = 'bg-indigo-50/70 border border-indigo-200 text-slate-800';
            headerStyle = 'text-indigo-950 border-indigo-100';
            bulletColor = 'text-indigo-600';
          } else if (icon === '📍') {
            cardStyle = 'bg-sky-50/70 border border-sky-200 text-slate-800';
            headerStyle = 'text-sky-950 border-sky-100';
            bulletColor = 'text-sky-600';
          }

          return (
            <div
              key={idx}
              className={`my-2 p-2.5 rounded-xl shadow-xs space-y-1.5 ${cardStyle}`}
            >
              <div className={`font-bold flex items-center gap-1.5 pb-1 border-b text-xs ${headerStyle}`}>
                {formatInlineText(block.header!, isUser)}
              </div>
              <div className="space-y-1 pl-0.5">
                {block.bullets!.map((bullet, bIdx) => (
                  <div key={bIdx} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                    <span className={`${bulletColor} font-bold mt-0.5`}>•</span>
                    <span className="flex-1">{formatInlineText(bullet, isUser)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (block.type === 'header') {
          return (
            <div
              key={idx}
              className={`font-bold mt-2 mb-1 text-xs ${isUser ? 'text-white' : 'text-slate-900'}`}
            >
              {formatInlineText(block.content!, isUser)}
            </div>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
              <span className={isUser ? 'text-blue-200 mt-0.5' : 'text-indigo-500 font-bold mt-0.5'}>•</span>
              <span className="flex-1 leading-relaxed text-xs">{formatInlineText(block.content!, isUser)}</span>
            </div>
          );
        }

        return (
          <div key={idx} className="leading-relaxed text-xs">
            {formatInlineText(block.content!, isUser)}
          </div>
        );
      })}
    </div>
  );
}

