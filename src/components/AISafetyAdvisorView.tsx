import React, { useState, useRef, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import {
  Bot,
  Send,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  FileCheck,
  Compass,
  Lock,
  ChevronRight
} from 'lucide-react';
import { AIChatMessage } from '../types';

interface AISafetyAdvisorViewProps {
  onTriggerSOS: () => void;
}

export const AISafetyAdvisorView: React.FC<AISafetyAdvisorViewProps> = ({ onTriggerSOS }) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content: `Hello, I am the **Yuki AI Safety Advisor**.\n\nI can help you build personalized safety plans, recognize warning signs of harassment or trafficking, review digital safety practices, and structure incident details for formal reports.\n\n⚠️ **Immediate Danger Notice**: I am an AI guidance tool, not emergency services. If you are facing an active threat right now, please immediately call **112 (Police)**, **1091 (Women Helpline)**, or tap the emergency SOS button.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: [
        'Domestic Violence Safety Plan',
        'Night Travel & Commute Safety',
        'Detect Digital Stalking / Spyware',
        'Structure an Incident Report'
      ]
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage: AIChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const data = await apiRequest('/api/ai/safety-guidance', {
        method: 'POST',
        body: JSON.stringify({
          prompt: text,
          history: messages.slice(-4).map(m => ({ sender: m.sender, content: m.content }))
        })
      });

      const assistantMessage: AIChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: data.suggestedActions,
        isEmergencyAlert: data.isEmergencyAlert
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: 'assistant',
          content: `🚨 **Emergency Advisory**\n\nI was unable to retrieve a response. If you are experiencing any distress or danger, please immediately dial **112** (Police) or **1091** (Women Helpline).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEmergencyAlert: true,
          suggestedActions: ['Trigger One-Tap SOS', 'Call 112 Police']
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const presetTemplates = [
    {
      title: 'Domestic Safety Plan',
      desc: 'Exit plan, emergency grab-bag, code words',
      prompt: 'Help me create a comprehensive and discreet domestic safety exit plan.'
    },
    {
      title: 'Commute & Travel Safety',
      desc: 'Night transit, verifying cabs, safe waiting',
      prompt: 'What are essential precautions for commuting alone late at night in a city?'
    },
    {
      title: 'Detect Digital Stalking',
      desc: 'Checking AirTags, stalkerware, social tracking',
      prompt: 'How can I check if someone is tracking my phone, location, or using hidden AirTags?'
    },
    {
      title: 'Trafficking Red Flags',
      desc: 'Grooming, confiscation, travel promises',
      prompt: 'What are the recognized warning signs of human trafficking, coercive grooming, and illegal confinement?'
    }
  ];

  return (
    <div className="container-fluid max-w-7xl py-4 px-3">
      <div className="row g-4">
        {/* Left: Chat Window */}
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm rounded-4 bg-white d-flex flex-column" style={{ height: '700px' }}>
            {/* Header */}
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <div className="p-2 rounded-3 bg-danger bg-opacity-10 text-danger">
                  <Bot size={22} />
                </div>
                <div>
                  <h5 className="fw-bold mb-0">Yuki AI Safety Advisor</h5>
                  <span className="small text-muted">Powered by Gemini 3.8 Flash &bull; Trauma-Informed</span>
                </div>
              </div>

              <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle small py-1.5 px-2">
                Confidential &amp; Secure
              </span>
            </div>

            {/* Chat Body */}
            <div className="card-body p-3 overflow-y-auto flex-grow-1" style={{ backgroundColor: '#fcfcfd' }}>
              <div className="d-flex flex-column gap-3">
                {messages.map((m) => {
                  const isAssistant = m.sender === 'assistant';
                  return (
                    <div
                      key={m.id}
                      className={`d-flex ${isAssistant ? 'justify-content-start' : 'justify-content-end'}`}
                    >
                      <div
                        className={`p-3 rounded-4 shadow-xs ${
                          isAssistant
                            ? m.isEmergencyAlert
                              ? 'bg-danger-subtle border border-danger text-danger-emphasis'
                              : 'bg-white border text-dark'
                            : 'bg-danger text-white'
                        }`}
                        style={{ maxWidth: '85%', fontSize: '14.5px', lineHeight: '1.6' }}
                      >
                        {m.isEmergencyAlert && (
                          <div className="d-flex align-items-center gap-1.5 text-danger fw-bold mb-2 small">
                            <AlertTriangle size={16} />
                            <span>CRITICAL SAFETY ADVISORY</span>
                          </div>
                        )}

                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {m.content}
                        </div>

                        <div
                          className={`small mt-2 text-end ${
                            isAssistant ? 'text-muted' : 'text-white-50'
                          }`}
                          style={{ fontSize: '11px' }}
                        >
                          {m.timestamp}
                        </div>

                        {/* Action Chips */}
                        {isAssistant && m.suggestedActions && m.suggestedActions.length > 0 && (
                          <div className="d-flex flex-wrap gap-1.5 mt-3 pt-2 border-top">
                            {m.suggestedActions.map((action, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="btn btn-sm btn-outline-secondary bg-white text-dark rounded-pill py-0.5 px-2.5 small"
                                onClick={() => {
                                  if (action.includes('SOS')) {
                                    onTriggerSOS();
                                  } else {
                                    handleSendMessage(action);
                                  }
                                }}
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="d-flex justify-content-start">
                    <div className="bg-white border p-3 rounded-4 shadow-xs text-muted d-flex align-items-center gap-2 small">
                      <div className="spinner-border spinner-border-sm text-danger" role="status" />
                      <span>Generating trauma-informed safety guidance...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Bar */}
            <div className="card-footer bg-white border-top p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="d-flex gap-2"
              >
                <input
                  type="text"
                  className="form-control rounded-3 py-2.5 px-3"
                  placeholder="Ask for safety advice, travel protocols, or reporting guidance..."
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  className="btn btn-danger rounded-3 px-3 d-flex align-items-center gap-1 fw-bold"
                  disabled={!inputPrompt.trim() || isLoading}
                >
                  <Send size={18} />
                  <span className="d-none d-sm-inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right: Quick Safety Guide Templates & Disclaimers */}
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
            <div className="d-flex align-items-center gap-2 mb-3">
              <Sparkles className="text-danger" size={20} />
              <h5 className="fw-bold mb-0">Safety Topics</h5>
            </div>
            <p className="text-muted small mb-3">
              Tap any topic to receive structured advice:
            </p>

            <div className="d-flex flex-column gap-2">
              {presetTemplates.map((tmpl, index) => (
                <div
                  key={index}
                  className="p-2.5 rounded-3 border bg-light hover-bg-white transition-all cursor-pointer d-flex justify-content-between align-items-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSendMessage(tmpl.prompt)}
                >
                  <div>
                    <h6 className="fw-bold text-dark mb-0 small">{tmpl.title}</h6>
                    <span className="text-muted" style={{ fontSize: '11px' }}>{tmpl.desc}</span>
                  </div>
                  <ChevronRight size={16} className="text-muted flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Ethics & Boundaries Card */}
          <div className="card border-0 shadow-sm rounded-4 p-3.5 bg-white">
            <div className="d-flex align-items-center gap-2 text-secondary mb-2">
              <Lock size={16} />
              <span className="fw-bold small text-uppercase">Safety Protocol Mandate</span>
            </div>
            <p className="text-muted small mb-0" style={{ fontSize: '12px' }}>
              The Yuki AI is engineered under strict ethical guidelines. It never substitutes emergency responders, never guarantees immunity from crime, and prioritizes verified human intervention in life-critical situations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
