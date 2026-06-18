import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const NREP_LOGO = 'https://nrep.ug/wp-content/uploads/2024/12/NREP-LOGO-COLORED-300x300.png';
const MEMD_LOGO = 'https://nrep.ug/wp-content/uploads/2023/06/MEMD_Logo-FIN.png';

let socket = null;
function getSocket() { if (!socket) socket = io(SOCKET_URL); return socket; }
function getSessionId() {
  let id = localStorage.getItem('rec_session');
  if (!id) { id = uuidv4(); localStorage.setItem('rec_session', id); }
  return id;
}

// ── Report links per REC edition ─────────────────────────────────────────────
const REPORT_LINKS = {
  REC22: { label: 'REC22 Report 2022', url: 'https://nrep.ug/rec/rec-2022/' },
  REC23: { label: 'REC23 Report 2023', url: 'https://nrep.ug/rec/rec-2023/' },
  REC24: { label: 'REC24 Report 2024', url: 'https://nrep.ug/rec/rec-2024/' },
  REC25: { label: 'REC25 Report 2025', url: 'https://nrep.ug/rec/rec-2025/' },
  REC26: { label: 'REC26 Info 2026',   url: 'https://nrep.ug/rec/' },
};

function getReportLink(content, edition) {
  if (!content) return null;
  const c = (content + ' ' + (edition || '')).toUpperCase();
  if (c.includes('REC26')) return REPORT_LINKS.REC26;
  if (c.includes('REC25')) return REPORT_LINKS.REC25;
  if (c.includes('REC24')) return REPORT_LINKS.REC24;
  if (c.includes('REC23')) return REPORT_LINKS.REC23;
  if (c.includes('REC22')) return REPORT_LINKS.REC22;
  return null;
}

// ── Follow-up suggestions ─────────────────────────────────────────────────────
function getFollowUps(content) {
  const c = content.toLowerCase();
  if (c.includes('rec22') || c.includes('2022'))
    return ['What was the venue for REC22?', 'What topics were at REC22?', 'When did REC23 happen?'];
  if (c.includes('rec23') || c.includes('2023'))
    return ['What topics were discussed at REC23?', 'Where was REC23 held?', 'What happened at REC24?'];
  if (c.includes('rec24') || c.includes('2024'))
    return ['What was the theme of REC24?', 'Where was REC24 held?', 'Tell me about REC25'];
  if (c.includes('rec25') || c.includes('2025'))
    return ['Where was REC25 held?', 'What were REC25 outcomes?', 'When is REC26?'];
  if (c.includes('rec26') || c.includes('2026'))
    return ['What is the theme of REC26?', 'Who are the sponsors of REC26?', 'How do I register for REC26?'];
  if (c.includes('theme'))
    return ['What was the theme of REC25?', 'What was the theme of REC24?', 'What is REC26 theme?'];
  if (c.includes('venue') || c.includes('held') || c.includes('kampala'))
    return ['Which editions were at Speke Resort?', 'Where is REC26 being held?', 'When did they move to Serena Hotel?'];
  if (c.includes('sponsor') || c.includes('partner'))
    return ['Who sponsors REC26?', 'Is GIZ involved in REC?', 'What role does NREP play?'];
  return ['When is REC26?', 'Who organises REC?', 'What was the theme of REC25?'];
}

// ── Copy Button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: 'none', border: '1px solid #D4EBD0', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: copied ? '#5BAD4E' : '#aaa', marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#5BAD4E'; e.currentTarget.style.color = '#5BAD4E'; }}
      onMouseLeave={e => { if (!copied) { e.currentTarget.style.borderColor = '#D4EBD0'; e.currentTarget.style.color = '#aaa'; } }}>
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  );
}

// ── Report Link Button ────────────────────────────────────────────────────────
function ReportButton({ link }) {
  if (!link) return null;
  return (
    <a href={link.url} target="_blank" rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'linear-gradient(135deg,#f0f9ee,#e0f5db)', border: '1px solid #b8ddb4', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: '#2d6b27', textDecoration: 'none', marginTop: 6, marginLeft: 6, fontWeight: 600, transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#5BAD4E,#3d8b32)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3d8b32'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#f0f9ee,#e0f5db)'; e.currentTarget.style.color = '#2d6b27'; e.currentTarget.style.borderColor = '#b8ddb4'; }}>
      📄 {link.label}
    </a>
  );
}

// ── Welcome message ───────────────────────────────────────────────────────────
const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  content: `👋 Hello! I am the REC Assistant — your guide to Uganda's Annual Renewable Energy Conference (REC).

I can answer questions about all REC editions from REC22 (2022) to REC26 (2026):

→ Conference themes, dates and venues
→ Sessions and topics discussed per edition
→ Sponsors, partners and exhibitors
→ Registration and exhibition information
→ Upcoming REC26 (October 2026) details

What would you like to know?`,
  sources: [],
  showFollowUps: true,
};

const QUICK_STARTS = [
  'When did REC start?',
  'What was the theme of REC24?',
  'Where was REC25 held?',
  'When is REC26?',
  'Who organises REC?',
  'How do I register for REC26?',
];

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onFollowUp }) {
  const isUser = msg.role === 'user';
  const reportLink = !isUser ? getReportLink(msg.content, msg.edition) : null;

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 18, alignItems: 'flex-start', gap: 10 }}>
      {!isUser && (
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#5BAD4E,#3d8b32)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(91,173,78,0.3)', marginTop: 2 }}>
          <img src={NREP_LOGO} alt="NREP" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 3 }} />
        </div>
      )}
      <div style={{ maxWidth: '74%' }}>
        {/* Bubble */}
        <div style={{ background: isUser ? 'linear-gradient(135deg,#5BAD4E,#3d8b32)' : '#FFFFFF', color: isUser ? '#fff' : '#1a2e1a', padding: '12px 16px', borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'left', boxShadow: isUser ? '0 2px 8px rgba(91,173,78,0.25)' : '0 1px 6px rgba(0,0,0,0.08)', border: !isUser ? '1px solid #E8F5E4' : 'none' }}>
          {msg.content}
          {msg.sources?.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #D4EBD0', fontSize: 11, color: '#5BAD4E', fontWeight: 500 }}>
              📚 {msg.sources.join(' · ')}
            </div>
          )}
        </div>

        {/* Action row: copy + report link */}
        {!isUser && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <CopyButton text={msg.content} />
            <ReportButton link={reportLink} />
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && msg.showFollowUps && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {getFollowUps(msg.content).map(q => (
              <button key={q} onClick={() => onFollowUp(q)}
                style={{ background: '#F0F9EE', border: '1px solid #D4EBD0', borderRadius: 16, padding: '5px 12px', fontSize: 12, color: '#2d5a27', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#5BAD4E'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#5BAD4E'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F0F9EE'; e.currentTarget.style.color = '#2d5a27'; e.currentTarget.style.borderColor = '#D4EBD0'; }}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef(null);
  const sessionId = useRef(getSessionId());
  const sources = useRef([]);

  useEffect(() => {
    const s = getSocket();
    s.removeAllListeners();
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('chat:response', data => {
      if (data.type === 'thinking') { setThinking(true); setStreaming(''); sources.current = []; }
      if (data.type === 'token') { setThinking(false); setIsStreaming(true); setStreaming(p => p + data.token); }
      if (data.type === 'sources') { sources.current = data.sources; }
      if (data.type === 'done') {
        setThinking(false);
        setIsStreaming(false);
        setStreaming(prev => {
          if (prev) {
            const finalSources = [...sources.current];
            setMessages(m => [...m, {
              id: uuidv4(),
              role: 'assistant',
              content: prev,
              sources: finalSources,
              showFollowUps: true
            }]);
          }
          return '';
        });
        sources.current = [];
      }
      if (data.type === 'error') {
        setThinking(false); setIsStreaming(false); setStreaming('');
        setMessages(m => [...m, { id: uuidv4(), role: 'assistant', content: `⚠️ ${data.message}`, sources: [], showFollowUps: false }]);
      }
    });
    s.emit('chat:history', { sessionId: sessionId.current });
    s.on('chat:history:response', ({ history }) => {
      if (history?.length > 0) {
        const loaded = history.map(h => ({
          id: h.$id || uuidv4(),
          role: h.role,
          content: h.content,
          sources: [],
          showFollowUps: h.role === 'assistant'
        }));
        setMessages([WELCOME, ...loaded]);
      }
    });
    return () => { s.removeAllListeners(); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming, thinking]);

  const send = (text) => {
    const q = (text || input).trim();
    if (!q || thinking || isStreaming) return;
    setMessages(m => [...m, { id: uuidv4(), role: 'user', content: q, sources: [], showFollowUps: false }]);
    setInput('');
    getSocket().emit('chat:message', { question: q, sessionId: sessionId.current });
  };

  const clearChat = () => {
    const newId = uuidv4();
    localStorage.setItem('rec_session', newId);
    sessionId.current = newId;
    setMessages([WELCOME]);
    setStreaming('');
    setThinking(false);
    setIsStreaming(false);
    setInput('');
    setMenuOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',-apple-system,sans-serif", overflow: 'hidden',
      background: 'linear-gradient(160deg, #f0faf0 0%, #e8f5e9 30%, #f5fbf5 60%, #ffffff 100%)' }}
      onClick={() => menuOpen && setMenuOpen(false)}>

      {/* ── Header ── */}
      <header style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '2px solid transparent', backgroundClip: 'padding-box', boxShadow: '0 2px 16px rgba(91,173,78,0.12)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, flexShrink: 0, zIndex: 10, position: 'relative',
        borderImage: 'linear-gradient(90deg, #5BAD4E, #2d8b27, #a8d5a2) 1' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* MEMD Logo */}
      <a href="https://www.memd.go.ug" target="_blank" rel="noreferrer" title="Ministry of Energy and Mineral Development">
      <img src={MEMD_LOGO} alt="MEMD"
      style={{ height: 50, width: 'auto', objectFit: 'contain' }}
      onError={e => { e.currentTarget.style.display = 'none'; }} />
      </a>

        {/* Divider */}
      <div style={{ width: 1, height: 36, background: '#D4EBD0' }} />

        {/* NREP Logo */}
      <a href="https://nrep.ug" target="_blank" rel="noreferrer" title="National Renewable Energy Platform">
        <img src={NREP_LOGO} alt="NREP"
      style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
      </a>

        {/* Divider */}
      <div style={{ width: 1, height: 36, background: '#D4EBD0' }} />

        {/* Title */}
      <div>
        <div style={{ color: '#1a2e1a', fontWeight: 700, fontSize: 15,
          background: 'linear-gradient(135deg, #2d6b27, #5BAD4E)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          REC Assistant
        </div>
        <div style={{ color: '#5BAD4E', fontSize: 10, fontWeight: 500 }}>
          Renewable Energy Conference · REC22 – REC26
        </div>
      </div>
    </div>

        {/* Right: links + status + menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="https://nrep.ug/rec/" target="_blank" rel="noreferrer"
            style={{ background: 'linear-gradient(135deg,#5BAD4E,#3d8b32)', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none', padding: '5px 10px', borderRadius: 8, display: 'none' }}
            className="expo-link">
            🎪 REC EXPO
          </a>
          <a href="https://nrep.ug/rec/" target="_blank" rel="noreferrer"
            style={{ background: 'linear-gradient(135deg,#5BAD4E,#3d8b32)', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', padding: '5px 12px', borderRadius: 8, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(91,173,78,0.25)' }}>
            🎪 REC26 & EXPO
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: connected ? '#5BAD4E' : '#e53935', fontWeight: 500 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#5BAD4E' : '#e53935', boxShadow: connected ? '0 0 6px rgba(91,173,78,0.6)' : 'none' }} />
            <span style={{ display: 'inline' }}>{connected ? 'Online' : 'Offline'}</span>
          </div>
          {/* Menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              style={{ background: 'none', border: '1px solid #D4EBD0', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 18, color: '#5BAD4E', lineHeight: 1 }}>
              ⋮
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 42, right: 0, background: '#fff', border: '1px solid #D4EBD0', borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 190 }}
                onClick={e => e.stopPropagation()}>
                <button onClick={clearChat}
                  style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '9px 14px', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#1a2e1a', borderRadius: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F0F9EE'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                   New Chat
                </button>
                <div style={{ height: 1, background: '#E8F5E4', margin: '4px 8px' }} />
               
                <a href="https://www.memd.go.ug" target="_blank" rel="noreferrer"
                  style={{ display: 'block', padding: '9px 14px', fontSize: 13, color: '#1a2e1a', textDecoration: 'none', borderRadius: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F0F9EE'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                   MEMD Website
                </a>
                <a href="https://nrep.ug" target="_blank" rel="noreferrer"
                  style={{ display: 'block', padding: '9px 14px', fontSize: 13, color: '#1a2e1a', textDecoration: 'none', borderRadius: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F0F9EE'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                   NREP Website
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Ombre banner ── */}
      <div style={{ background: 'linear-gradient(90deg, #2d6b27 0%, #5BAD4E 40%, #7cc96e 70%, #a8d5a2 100%)', padding: '7px 16px', textAlign: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.3px', textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
          Ministry of Energy and Mineral Development (MEMD) &amp; National Renewable Energy Platform (NREP) · nrep.ug
        </span>
      </div>

      {/* ── Quick start chips ── */}
      {messages.length <= 1 && (
      <div style={{ padding: '6px 16px', flexShrink: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(212,235,208,0.5)' }}>
      `<div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, color: '#aaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap', flexShrink: 0 }}>Quick Start</span>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
        {QUICK_STARTS.map(q => (
          <button key={q} onClick={() => send(q)}
            style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #D4EBD0', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#2d5a27', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#5BAD4E,#3d8b32)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3d8b32'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; e.currentTarget.style.color = '#2d5a27'; e.currentTarget.style.borderColor = '#D4EBD0'; }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  </div>
)}

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onFollowUp={send} />
        ))}

        {/* Streaming */}
        {streaming && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#5BAD4E,#3d8b32)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              <img src={NREP_LOGO} alt="NREP" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
            <div style={{ maxWidth: '74%', background: 'rgba(255,255,255,0.95)', color: '#1a2e1a', padding: '12px 16px', borderRadius: '4px 18px 18px 18px', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'left', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', border: '1px solid #E8F5E4' }}>
              {streaming}<span style={{ color: '#5BAD4E', fontWeight: 700 }}>▋</span>
            </div>
          </div>
        )}

        {/* Thinking */}
        {thinking && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#5BAD4E,#3d8b32)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <img src={NREP_LOGO} alt="NREP" style={{ width: 22, height: 22, objectFit: 'contain' }} />
            </div>
            <div style={{ background: 'rgba(255,255,255,0.95)', padding: '12px 16px', borderRadius: '4px 18px 18px 18px', display: 'flex', gap: 5, alignItems: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.08)', border: '1px solid #E8F5E4' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#5BAD4E', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
              ))}
              <span style={{ fontSize: 12, color: '#aaa', marginLeft: 4 }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(212,235,208,0.8)', padding: '12px 16px', boxShadow: '0 -2px 12px rgba(91,173,78,0.08)', flexShrink: 0 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about REC22, REC23, REC24, REC25, or REC26..."
            disabled={thinking || isStreaming}
            rows={1}
            style={{ flex: 1, background: 'rgba(247,249,247,0.9)', border: '1.5px solid #D4EBD0', borderRadius: 12, color: '#1a2e1a', padding: '11px 14px', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', minHeight: 44, maxHeight: 100, transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = '#5BAD4E'}
            onBlur={e => e.target.style.borderColor = '#D4EBD0'}
          />
          <button onClick={() => send()} disabled={!input.trim() || thinking || isStreaming}
            style={{ background: input.trim() && !thinking && !isStreaming ? 'linear-gradient(135deg,#5BAD4E,#3d8b32)' : '#D4EBD0', border: 'none', borderRadius: 12, width: 44, height: 44, cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: input.trim() ? '0 2px 8px rgba(91,173,78,0.35)' : 'none', transition: 'all 0.2s' }}>
            {thinking || isStreaming ? '⏳' : '➤'}
          </button>
        </div>
        {/* Bottom logos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
          <img src={MEMD_LOGO} alt="MEMD" style={{ height: 26, objectFit: 'contain' }} onError={e => e.currentTarget.style.display = 'none'} />
          <span style={{ color: '#ddd', fontSize: 12 }}>·</span>
          <img src={NREP_LOGO} alt="NREP" style={{ height: 22, objectFit: 'contain' }} />
          <span style={{ color: '#ccc', fontSize: 11, marginLeft: 4 }}>Only answers REC Uganda questions ·{' '}
            <a href="https://nrep.ug" target="_blank" rel="noreferrer" style={{ color: '#5BAD4E', textDecoration: 'none' }}>nrep.ug</a>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea::placeholder { color: #bbb; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D4EBD0; border-radius: 3px; }
.       .chips-row::-webkit-scrollbar { display: none; }
        @media (max-width: 600px) {
          header { padding: 0 10px !important; height: 56px !important; }
          textarea { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}