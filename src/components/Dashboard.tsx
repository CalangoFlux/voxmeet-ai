import React, { useState, useEffect } from 'react';
import { Meeting, AuthStatus, HistoryItem } from '../types';
import { MeetingCard } from './MeetingCard';
import { LiveTranslator } from './LiveTranslator';
import { LayoutGrid, List, Settings, LogOut, ShieldCheck, RefreshCw, Info, X, History, FileText, Table, ExternalLink, AlertCircle, User, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Dashboard: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus & { configured?: boolean }>({ authenticated: false, configured: true });
  const [showLicense, setShowLicense] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [joinUrl, setJoinUrl] = useState('');

  const handleManualJoin = () => {
    if (!joinUrl) return;
    const manualMeeting: Meeting = {
      id: `manual-${Date.now()}`,
      summary: 'Reunião via Link',
      description: 'Conectado manualmente via URL',
      start: { dateTime: new Date().toISOString() },
      end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
      hangoutLink: joinUrl
    };
    setActiveMeeting(manualMeeting);
    setJoinUrl('');
  };

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      const data = await res.json();
      setAuthStatus(data);
      if (data.authenticated) {
        fetchMeetings();
        fetchHistory();
      }
    } catch (err) {
      console.error("Error fetching auth status:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error("Error fetching meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthStatus();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchAuthStatus();
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    const interval = setInterval(() => {
      if (!authStatus.authenticated) {
        fetchAuthStatus();
      }
    }, 10000); // 10s polling

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, [authStatus.authenticated]);

  const handleConnect = async () => {
    const popup = window.open('about:blank', 'google_auth', 'width=600,height=700');
    if (!popup) {
      alert("Pop-up bloqueado! Por favor, autorize pop-ups para este site para conectar sua conta Google.");
      return;
    }
    
    popup.document.write(`
      <div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff;">
        <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="margin-top: 20px; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.7;">Conectando ao Google...</p>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      </div>
    `);

    try {
      const res = await fetch('/api/auth/url');
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Auth URL error (${res.status}): ${text.substring(0, 50)}`);
      }
      
      const { url } = await res.json();
      popup.location.href = url;
    } catch (err) {
      console.error("Auth error:", err);
      popup.close();
      alert(`Erro de Conexão: ${err instanceof Error ? err.message : "Não foi possível conectar ao servidor"}.`);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthStatus({ authenticated: false, configured: true });
      setMeetings([]);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  if (!authStatus.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center p-6 w-full h-full">
        <div className="max-w-md w-full border border-zinc-800 p-8 bg-zinc-900/20">
          <div className="mb-8">
            <div className="h-10 w-10 bg-zinc-100 flex items-center justify-center mb-4">
              <ShieldCheck className="text-zinc-950" />
            </div>
            <h1 className="text-2xl font-serif italic text-zinc-100 mb-2">VoxMeet AI</h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Conecte seu Google Workspace para habilitar tradução de reuniões em tempo real, 
              transcrição automática e resumos integrados ao Drive.
            </p>
          </div>
          
          {!authStatus.configured && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-mono uppercase tracking-widest">
              Aviso: GOOGLE_CLIENT_ID ou SECRET não configurados no ambiente.
            </div>
          )}
          
          <button 
            onClick={handleConnect}
            disabled={!authStatus.configured}
            className="w-full py-3 bg-zinc-100 text-zinc-950 font-mono uppercase tracking-widest text-xs hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer relative z-50"
          >
            Autorizar Acesso ao Google
          </button>

          <button 
            onClick={() => fetchAuthStatus()}
            className="w-full mt-3 py-2 border border-zinc-800 text-zinc-500 font-mono uppercase tracking-widest text-[10px] hover:text-zinc-300 hover:border-zinc-600 transition-all flex items-center justify-center gap-2 cursor-pointer relative z-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Verificar Status da Conexão
          </button>
          
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">
              Permissões Necessárias: Agenda (Leitura), Drive (Escrita), Docs (Escrita)
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">
            Desenvolvido por <span className="text-zinc-400">CalangoFlux</span>
          </p>
          <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-tighter">
            Licença MIT © 2026 • <button onClick={() => setShowLicense(true)} className="hover:text-zinc-500 underline cursor-pointer">Ver Termos</button>
          </p>
        </footer>

        {/* License Modal */}
        <AnimatePresence>
          {showLicense && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 p-8 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-mono uppercase tracking-widest text-zinc-100 flex items-center gap-2">
                    <Info size={14} /> Licença MIT
                  </h2>
                  <button onClick={() => setShowLicense(false)} className="text-zinc-500 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>
                <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
{`MIT License

Copyright (c) 2026 CalangoFlux

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
                </pre>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex">
      {/* Sidebar */}
      <aside className="w-16 border-r border-zinc-800 flex flex-col items-center py-6 gap-8 sticky top-0 h-screen z-[60] bg-zinc-950 shrink-0">
        <div className="h-8 w-8 bg-zinc-100 flex items-center justify-center font-serif italic text-zinc-950 font-bold">V</div>
        <nav className="flex flex-col gap-6">
          <button 
            onClick={() => setViewMode('grid')}
            title="Visualização em Grade"
            className={`p-2 transition-colors cursor-pointer pointer-events-auto ${viewMode === 'grid' ? 'text-zinc-100 bg-zinc-900 border border-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <LayoutGrid size={20} />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            title="Visualização em Lista"
            className={`p-2 transition-colors cursor-pointer pointer-events-auto ${viewMode === 'list' ? 'text-zinc-100 bg-zinc-900 border border-zinc-800' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <List size={20} />
          </button>
          <button 
            onClick={() => {
              const el = document.getElementById('meeting-link-input');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              el?.focus();
            }}
            title="Link Manual"
            className="p-2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors pointer-events-auto"
          >
            <ExternalLink size={20} />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            title="Configurações"
            className="p-2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors pointer-events-auto"
          >
            <Settings size={20} />
          </button>
        </nav>
        <div className="mt-auto">
          <button 
            onClick={handleLogout}
            title="Sair"
            className="p-2 text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors pointer-events-auto"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeMeeting ? (
          <LiveTranslator 
            meeting={activeMeeting} 
            onClose={() => setActiveMeeting(null)} 
          />
        ) : (
          <>
            <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8">
              <div className="flex items-center gap-4">
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">Painel de Controle</h2>
                <span className="h-4 w-[1px] bg-zinc-800" />
                <div className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Online</span>
                </div>
                {authStatus.user && (
                  <>
                    <span className="h-4 w-[1px] bg-zinc-800" />
                    <div className="flex items-center gap-2">
                      <img src={authStatus.user.picture} alt="" className="h-5 w-5 rounded-full border border-zinc-700" referrerPolicy="no-referrer" />
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">{authStatus.user.name}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 px-3 py-1 border border-zinc-800 bg-zinc-900/40">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Meet</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Drive</span>
                  </div>
                </div>
                <button 
                  onClick={() => { fetchMeetings(); fetchHistory(); }}
                  className="p-2 text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  <RefreshCw size={16} className={loading || historyLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto">
              <div className="max-w-5xl mx-auto py-12 px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  {/* Left: Meetings */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Link da Reunião Section */}
                    <div className="p-8 border border-zinc-800 bg-zinc-900/40 shadow-2xl shadow-emerald-500/5">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-zinc-100 flex items-center gap-2">
                          <Video size={16} className="text-emerald-500" /> Link da Reunião
                        </h3>
                        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Conexão Instantânea</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          id="meeting-link-input"
                          type="text" 
                          placeholder="Cole o link do Google Meet aqui (ex: meet.google.com/abc-defg-hij)"
                          value={joinUrl}
                          onChange={(e) => setJoinUrl(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-800 p-4 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 font-mono transition-all"
                        />
                        <button 
                          onClick={handleManualJoin}
                          disabled={!joinUrl}
                          className="px-8 py-4 bg-zinc-100 text-zinc-950 font-mono uppercase tracking-widest text-xs hover:bg-white transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-white/10"
                        >
                          Conectar Bot
                        </button>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">
                        <Info size={12} className="text-zinc-700" />
                        <span>O assistente entrará na reunião para traduzir e transcrever em tempo real.</span>
                      </div>
                    </div>

                    <div>
                      <div className="mb-8">
                        <h1 className="text-4xl font-serif italic text-zinc-100 mb-4">Próximas Reuniões</h1>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                          Selecione uma reunião do seu calendário para iniciar o Assistente VoxMeet.
                        </p>
                      </div>

                      <div className="border border-zinc-800 bg-zinc-900/10">
                        {viewMode === 'grid' ? (
                          <div className="grid grid-cols-[40px_1.5fr_1fr_1fr] p-4 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                            <div />
                            <div>Detalhes do Evento</div>
                            <div>Horário</div>
                            <div className="text-right">Ações</div>
                          </div>
                        ) : (
                          <div className="p-4 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                            Modo Lista
                          </div>
                        )}
                        
                        {loading ? (
                          <div className="p-12 text-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
                            Sincronizando Calendário...
                          </div>
                        ) : meetings.length > 0 ? (
                          <div className={viewMode === 'list' ? 'flex flex-col' : ''}>
                            {meetings.map(m => (
                              <MeetingCard key={m.id} meeting={m} onJoin={setActiveMeeting} />
                            ))}
                          </div>
                        ) : (
                          <div className="p-16 text-center space-y-4">
                            <p className="text-zinc-600 font-mono text-xs uppercase tracking-widest">Nenhuma reunião encontrada no calendário.</p>
                            <button 
                              onClick={() => {
                                const el = document.getElementById('meeting-link-input');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                el?.focus();
                              }}
                              className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest hover:text-emerald-400 underline"
                            >
                              Usar Link Manual
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: History & Drive */}
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                        <History size={14} /> Histórico Recente
                      </h3>
                      <div className="border border-zinc-800 bg-zinc-900/10 divide-y divide-zinc-800">
                        {historyLoading ? (
                          <div className="p-8 text-center text-zinc-700 font-mono text-[10px] uppercase">Carregando...</div>
                        ) : history.length > 0 ? (
                          history.map(item => (
                            <div key={item.id} className="p-4 hover:bg-zinc-900/50 transition-all group">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex gap-3">
                                  <div className="mt-1">
                                    {item.type === 'doc' ? <FileText size={14} className="text-blue-500" /> : <Table size={14} className="text-emerald-500" />}
                                  </div>
                                  <div>
                                    <h4 className="text-xs text-zinc-200 line-clamp-1 group-hover:text-white transition-colors">{item.title}</h4>
                                    <span className="text-[9px] font-mono text-zinc-600 uppercase">{new Date(item.date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="p-1 text-zinc-600 hover:text-zinc-300">
                                  <ExternalLink size={12} />
                                </a>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-zinc-700 font-mono text-[10px] uppercase italic">Nenhum arquivo gerado ainda.</div>
                        )}
                      </div>
                    </div>

                    <div className="p-8 border border-zinc-800 bg-zinc-900/40">
                      <h3 className="text-[11px] font-mono uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
                        <Info size={16} className="text-blue-500" /> Guia de Uso
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-100">01</div>
                          <h4 className="text-[10px] font-mono uppercase text-zinc-200">Conectar</h4>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Cole o link do Google Meet ou selecione uma reunião do calendário.
                          </p>
                        </div>
                        <div className="space-y-3">
                          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-100">02</div>
                          <h4 className="text-[10px] font-mono uppercase text-zinc-200">Ativar Bot</h4>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Clique em "Conectar Bot". O assistente abrirá a interface de tradução.
                          </p>
                        </div>
                        <div className="space-y-3">
                          <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-100">03</div>
                          <h4 className="text-[10px] font-mono uppercase text-zinc-200">Traduzir</h4>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            O VoxMeet traduzirá o áudio da reunião em tempo real para você.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 border border-zinc-800 bg-zinc-900/40">
                      <h3 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                        <ShieldCheck size={14} /> Google Drive
                      </h3>
                      <p className="text-[10px] text-zinc-500 leading-relaxed mb-4 italic">
                        Todos os seus resumos e transcrições são salvos automaticamente na pasta <span className="text-zinc-300">"VoxMeet AI"</span> no seu Drive.
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-500/70">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Pasta Gerada Automaticamente</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className="py-6 border-t border-zinc-800 text-center">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-1">
                Desenvolvido por <span className="text-zinc-400">CalangoFlux</span>
              </p>
              <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-tighter">
                Licença MIT © 2026 • <button onClick={() => setShowLicense(true)} className="hover:text-zinc-500 underline cursor-pointer">Ver Termos</button>
              </p>
            </footer>

            {/* Settings Modal */}
            <AnimatePresence>
              {showSettings && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8"
                  >
                    <div className="flex justify-between items-center mb-8">
                      <h2 className="text-sm font-mono uppercase tracking-widest text-zinc-100 flex items-center gap-2">
                        <Settings size={14} /> Configurações
                      </h2>
                      <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white cursor-pointer"><X size={18} /></button>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Idioma do Sistema</label>
                        <select className="w-full bg-zinc-950 border border-zinc-800 p-3 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600">
                          <option>Português (Brasil)</option>
                          <option>English (US)</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Voz do Assistente</label>
                        <select className="w-full bg-zinc-950 border border-zinc-800 p-3 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600">
                          <option>Zephyr (Padrão)</option>
                          <option>Puck</option>
                          <option>Charon</option>
                        </select>
                      </div>

                      <div className="pt-4 border-t border-zinc-800">
                        <button 
                          onClick={() => setShowSettings(false)}
                          className="w-full py-3 bg-zinc-100 text-zinc-950 font-mono uppercase tracking-widest text-xs hover:bg-white transition-all cursor-pointer"
                        >
                          Salvar Alterações
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* License Modal */}
            <AnimatePresence>
              {showLicense && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 p-8 max-h-[80vh] overflow-y-auto"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-sm font-mono uppercase tracking-widest text-zinc-100 flex items-center gap-2">
                        <Info size={14} /> Licença MIT
                      </h2>
                      <button onClick={() => setShowLicense(false)} className="text-zinc-500 hover:text-white cursor-pointer"><X size={18} /></button>
                    </div>
                    <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
{`MIT License

Copyright (c) 2026 CalangoFlux

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
                    </pre>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
};
