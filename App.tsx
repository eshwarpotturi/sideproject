
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Chat } from '@google/genai';
import { getAIResponse, startChat } from './services/geminiService';
import type { Message, ExampleChoice } from './types';
import { SendIcon, VedaVyasaIcon, ThumbsUpIcon, ThumbsDownIcon, PaintBrushIcon } from './components/icons';

const initialMessage: Message = {
  role: 'model',
  content: "Pranam! I am Veda Vyasa AI, a digital sage. My purpose is not simply to recount tales, but to help you uncover the profound life lessons woven into the fabric of our sacred texts. What challenges are you facing, or what wisdom do you seek? Share your question, and I will find stories to illuminate your path and explain the timeless guidance they offer.",
};

const FULL_PROMPT_LIST = [
    "How can I apply the principles of Dharma in my professional life?",
    "What do the texts teach about finding inner peace amidst chaos?",
    "How can the concept of Karma help me deal with setbacks?",
    "Explain the importance of selfless duty, using an example from the epics.",
    "What are the qualities of a true leader, according to the scriptures?",
    "How can I practice non-violence (Ahimsa) in my daily interactions?",
    "What is the lesson behind Arjuna's dilemma in the Bhagavad Gita?",
    "Tell me a story about overcoming adversity from the Mahabharata.",
    "What do the Upanishads say about the nature of true happiness?",
    "How does Ayurveda define a balanced and healthy lifestyle?",
    "What can the Ramayana teach us about loyalty and sacrifice?",
    "Explain the concept of Maya (illusion) and how it affects our lives.",
    "What are the duties of a student according to the ancient texts?",
    "Tell me a story about forgiveness from the Puranas.",
    "How do I cultivate detachment without becoming indifferent?",
    "What is the significance of a Guru in one's spiritual journey?",
];

const SACRED_TEXTS_KEYWORDS = [
  // Epics & Puranas
  "Bhagavad Gita", "Mahabharata", "Ramayana", "Bhagavatam", "Srimad Bhagavatam",
  "Vishnu Purana", "Shiva Purana", "Markandeya Purana", "Devi Mahatmyam", "Garuda Purana", "Agni Purana",

  // Vedas & Upanishads
  "Rigveda", "Samaveda", "Yajurveda", "Atharvaveda",
  "Upanishads", "Isa Upanishad", "Kena Upanishad", "Katha Upanishad", "Prashna Upanishad", "Mundaka Upanishad", "Mandukya Upanishad", "Taittiriya Upanishad", "Aitareya Upanishad", "Chandogya Upanishad", "Brihadaranyaka Upanishad",

  // Sutras & Philosophical Texts
  "Yoga Sutras of Patanjali", "Yoga Sutras", "Brahma Sutras", "Nyaya Sutras", "Vaisheshika Sutras", "Mimamsa Sutras", "Samkhya Karika",
  "Yoga Vasistha", "Narada Bhakti Sutra", "Tirukkural",

  // Dharmashastras & Ayurveda
  "Manusmriti", "Arthashastra",
  "Charaka Samhita", "Sushruta Samhita", "Ashtanga Hrudayam",

  // Historical Context
  "Chronology of India", "History of Indian Philosophy"
].map(t => t.toLowerCase());

type SendMessagePayload = string | { choice: ExampleChoice };
type Theme = 'surya' | 'chandra' | 'vana' | 'akasha';

const App: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examplePrompts, setExamplePrompts] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>('surya');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
  useEffect(() => {
    const shuffled = [...FULL_PROMPT_LIST].sort(() => 0.5 - Math.random());
    setExamplePrompts(shuffled.slice(0, 4));
  }, []);

  const handleSendMessage = useCallback(async (payload: SendMessagePayload) => {
    if (isLoading) return;

    let userMessageText: string;
    let messageToAI: string;

    if (typeof payload === 'string') {
        if (!payload.trim()) return;
        userMessageText = payload;
        messageToAI = payload;
        setInput('');
    } else {
        const choice = payload.choice;
        userMessageText = `Please tell me the story from the ${choice.source} and explain its lesson.`;
        messageToAI = `Excellent choice. Please now share the story from the **${choice.source}** regarding: "${choice.summary}". Be detailed, empathetic, and most importantly, provide a clear interpretation and life lesson as per your instructions.`;
    }

    setMessages(prev => {
        let updatedMessages = [...prev];
        if (typeof payload !== 'string') {
            updatedMessages = prev.map((msg, index) =>
                index === prev.length - 1 ? { ...msg, choices: undefined } : msg
            );
        }
        updatedMessages.push({ role: 'user', content: userMessageText });
        return updatedMessages;
    });

    setIsLoading(true);
    setError(null);

    try {
        let currentChat = chat;
        if (!currentChat) {
            const newChat = startChat();
            setChat(newChat);
            currentChat = newChat;
        }

        const response = await getAIResponse(currentChat, messageToAI);
        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.find(fc => fc.name === 'present_examples')) {
            const examplesCall = functionCalls.find(fc => fc.name === 'present_examples')!;
            const { introductory_sentence, examples } = examplesCall.args as { introductory_sentence: string, examples: ExampleChoice[] };
            const modelMessage: Message = {
                role: 'model',
                content: introductory_sentence,
                choices: examples,
            };
            setMessages(prev => [...prev, modelMessage]);
        } else {
            const text = response.text;
            const modelMessage: Message = { role: 'model', content: text };
            
            const suggestionsCall = functionCalls?.find(fc => fc.name === 'present_suggestions');
            if (suggestionsCall) {
                const { suggestions } = suggestionsCall.args as { suggestions: string[] };
                modelMessage.suggestions = suggestions;
            }
            
            setMessages(prev => [...prev, modelMessage]);
        }
    } catch (err) {
        const errorMessage = 'An error occurred. Please try again.';
        setError(errorMessage);
        setMessages(prev => [...prev, { role: 'model', content: errorMessage, isError: true }]);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [chat, isLoading]);
  
  const handleFeedback = (messageIndex: number, feedback: 'positive' | 'negative') => {
    setMessages(prevMessages => 
      prevMessages.map((msg, index) => 
        index === messageIndex ? { ...msg, feedback } : msg
      )
    );
    console.log(`Feedback received for message ${messageIndex}: ${feedback}`);
  };


  return (
    <div className={`theme-${theme} bg-gradient-to-br from-[--bg-start] to-[--bg-end] min-h-screen flex flex-col items-center justify-center p-4 font-poppins text-[--text-main]`}>
      <div className="w-full max-w-3xl h-[95vh] flex flex-col bg-[--container-bg]/70 backdrop-blur-lg rounded-2xl shadow-2xl border border-[--container-border]/30">
        <header className="p-4 border-b border-[--divider-color]/50 flex items-center space-x-4 bg-clip-padding relative">
          <div className="p-2 bg-gradient-to-br from-[--accent-start] to-[--accent-end] rounded-full text-white shadow-md">
            <VedaVyasaIcon className="w-8 h-8"/>
          </div>
          <div>
            <h1 className="text-xl font-bold font-lora text-[--text-header]">Veda Vyasa AI</h1>
            <p className="text-sm text-[--text-header-sub]">Your guide to Vedic Wisdom</p>
          </div>
          <ThemeSelector currentTheme={theme} setTheme={setTheme} />
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => (
            <ChatMessage 
              key={index} 
              message={msg} 
              index={index}
              onChoiceClick={(choice) => handleSendMessage({ choice })}
              onSuggestionClick={(suggestion) => handleSendMessage(suggestion)}
              onFeedback={handleFeedback} 
            />
          ))}
          {isLoading && <LoadingIndicator />}
          <div ref={chatEndRef} />
        </main>
        
        {messages.length <= 1 && (
          <div className="px-6 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                  className="text-left text-sm p-3 bg-[--model-bubble-bg]/50 rounded-lg hover:bg-[--hover-bg]/70 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-[--text-accent] border border-[--subtle-border]/80"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <footer className="p-4 border-t border-[--divider-color]/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about life and dharma..."
              className="flex-1 p-3 bg-[--input-bg]/80 rounded-lg border border-[--divider-color] text-[--text-main] placeholder:text-[--text-muted] focus:outline-none focus:ring-2 focus:ring-[--accent-start] transition-shadow"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-3 bg-gradient-to-br from-[--accent-start] to-[--accent-end] text-white rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              <SendIcon className="w-6 h-6" />
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
};

const themes: { id: Theme; name: string; colors: string[] }[] = [
    { id: 'surya', name: 'Surya (Sunrise)', colors: ['#FFF8E1', '#F59E0B'] },
    { id: 'chandra', name: 'Chandra (Moonlight)', colors: ['#0F172A', '#60A5FA'] },
    { id: 'vana', name: 'Vana (Forest)', colors: ['#f0fdf4', '#22C55E'] },
    { id: 'akasha', name: 'Akasha (Ether)', colors: ['#1e1b4b', '#8B5CF6'] },
];

interface ThemeSelectorProps {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ currentTheme, setTheme }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={selectorRef} className="ml-auto">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full hover:bg-[--hover-bg] text-[--text-header-sub] transition-colors"
                aria-label="Select theme"
            >
                <PaintBrushIcon className="w-6 h-6" />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[--container-bg] rounded-lg shadow-xl border border-[--divider-color] z-10">
                    <ul className="p-2">
                        {themes.map(theme => (
                            <li key={theme.id}>
                                <button
                                    onClick={() => {
                                        setTheme(theme.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[--hover-bg] ${currentTheme === theme.id ? 'font-semibold text-[--text-header]' : 'text-[--text-main]'}`}
                                >
                                    <span className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(to right, ${theme.colors[0]}, ${theme.colors[1]})` }} />
                                    {theme.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};


interface ChatMessageProps {
  message: Message;
  index: number;
  onChoiceClick: (choice: ExampleChoice) => void;
  onSuggestionClick: (suggestion: string) => void;
  onFeedback: (index: number, feedback: 'positive' | 'negative') => void;
}

const TRUNCATION_LIMIT = 400;

const ChatMessage: React.FC<ChatMessageProps> = ({ message, index, onChoiceClick, onSuggestionClick, onFeedback }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.role === 'user';
  const isError = message.isError ?? false;
  const hasChoices = message.choices && message.choices.length > 0;
  const hasSuggestions = message.suggestions && message.suggestions.length > 0;

  const isLongMessage = !isUser && !isError && message.content.length > TRUNCATION_LIMIT;
  
  const contentToShow = isLongMessage && !isExpanded
    ? `${message.content.substring(0, TRUNCATION_LIMIT)}...`
    : message.content;

  const containerClasses = `flex items-end gap-3 ${isUser ? 'justify-end' : 'justify-start'}`;
  const bubbleClasses = `max-w-xl p-4 rounded-2xl shadow-md leading-relaxed ${
    isUser
      ? 'bg-[--user-bubble-bg] text-[--user-bubble-text] rounded-br-none'
      : isError
      ? 'bg-red-100 text-red-800 border border-red-200 rounded-bl-none'
      : 'bg-[--model-bubble-bg] text-[--text-main] rounded-bl-none'
  }`;
  
  const formatContent = (content: string) => {
    const paragraphs = content.split(/\n+/).filter(p => p.trim() !== '');
    return paragraphs.map((paragraph, pIndex) => {
      const parts = paragraph.split(/(\*\*.*?\*\*)/g).filter(part => part);
      const formattedParts = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const text = part.slice(2, -2);
          const isSacredText = SACRED_TEXTS_KEYWORDS.some(keyword => text.toLowerCase().includes(keyword));
          if (!isUser && isSacredText) {
            return (
              <span key={i} className="inline-block bg-[--sacred-text-bg] text-[--sacred-text-color] font-lora italic font-medium px-2 py-0.5 rounded-md border border-[--subtle-border]/80 mx-1">
                {text}
              </span>
            );
          }
          return <strong key={i}>{text}</strong>;
        }
        return part;
      });
      return <p key={pIndex} className="mb-3 last:mb-0">{formattedParts}</p>;
    });
  };

  return (
    <div className={containerClasses}>
      {!isUser && (
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[--accent-start] to-[--accent-end] rounded-full text-white flex items-center justify-center shadow-md">
           <VedaVyasaIcon className="w-6 h-6"/>
        </div>
      )}
      <div className={bubbleClasses}>
        <div>{formatContent(contentToShow)}</div>
        {isLongMessage && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[--text-header-sub] font-semibold mt-3 text-sm hover:underline focus:outline-none"
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Read Less' : 'Read More'}
          </button>
        )}
        {hasChoices && (
          <div className="mt-4 pt-4 border-t border-[--subtle-border]/50 space-y-2">
            {message.choices!.map((choice, index) => (
              <button
                key={index}
                onClick={() => onChoiceClick(choice)}
                className="w-full text-left text-sm p-3 bg-[--model-bubble-bg] rounded-lg hover:bg-[--hover-bg] transition-colors duration-200 text-[--text-accent] border border-[--subtle-border]/80 shadow-sm"
              >
                <strong className="font-lora">{choice.source}</strong>: {choice.summary}
              </button>
            ))}
          </div>
        )}
        {!isUser && !isError && (
          <div className="mt-3 pt-3 border-t border-[--divider-color]/70">
            {!hasChoices && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onFeedback(index, 'positive')} 
                  disabled={!!message.feedback}
                  aria-label="Good response"
                  className="p-1 rounded-full disabled:cursor-not-allowed group"
                >
                  <ThumbsUpIcon className={`w-5 h-5 transition-colors ${message.feedback === 'positive' ? 'text-[--accent-color]' : 'text-[--text-muted] group-hover:text-[--text-main]'}`} />
                </button>
                <button 
                  onClick={() => onFeedback(index, 'negative')} 
                  disabled={!!message.feedback}
                  aria-label="Bad response"
                  className="p-1 rounded-full disabled:cursor-not-allowed group"
                >
                  <ThumbsDownIcon className={`w-5 h-5 transition-colors ${message.feedback === 'negative' ? 'text-[--accent-color]' : 'text-[--text-muted] group-hover:text-[--text-main]'}`} />
                </button>
              </div>
            )}
            {hasSuggestions && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-2">
                  {message.suggestions!.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => onSuggestionClick(suggestion)}
                      className="text-sm px-3 py-1.5 bg-[--suggestion-bg] rounded-full hover:bg-[--suggestion-hover-bg] transition-colors duration-200 text-[--text-header] border border-[--subtle-border]/80"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingIndicator: React.FC = () => (
  <div className="flex items-end gap-3 justify-start">
    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-[--accent-start] to-[--accent-end] rounded-full text-white flex items-center justify-center shadow-md">
        <VedaVyasaIcon className="w-6 h-6"/>
    </div>
    <div className="max-w-xl p-4 rounded-2xl shadow-md bg-[--model-bubble-bg] text-[--text-main] rounded-bl-none">
      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 bg-[--accent-color] rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
        <span className="w-2 h-2 bg-[--accent-color] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
        <span className="w-2 h-2 bg-[--accent-color] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
      </div>
    </div>
  </div>
);

export default App;
