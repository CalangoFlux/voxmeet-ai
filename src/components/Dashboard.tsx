import React, { useState, useEffect } from 'react';
import { Meeting, AuthStatus } from '../types';
import { MeetingCard } from './MeetingCard';
import { LiveTranslator } from './LiveTranslator';
import { LayoutGrid, List, Settings, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus & { configured?: boolean }>({ authenticated: false, configured: true });

  const fetchAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      setAuthStatus(data);
      if (data.authenticated) fetchMeetings();
    } catch (err) {
      console.error("Failed to fetch auth status:", err);
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
      console.error(err);
    } finally {
      setLoading(false);
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
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = async () => {
    const popup = window.open('about:blank', 'google_auth', 'width=600,height=700');
    if (!popup) {
      alert("Pop-up blocked! Please allow popups for this site to connect your Google account.");
      return;
    }
    
    popup.document.write(`
      <div style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff;">
        <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="margin-top: 20px; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.7;">Connecting to Google...</p>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      </div>
    `);

    try {
      const res = await fetch('/api/auth/url');
      if (!res.ok) {
        const text = await res.text();
        let errorMessage = "Failed to get auth URL";
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server Error (${res.status}): ${text.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }
      
      const { url } = await res.json();
      popup.location.href = url;
    } catch (err) {
      console.error("Auth error:", err);
      popup.close();
      alert(`Connection Error: ${err instanceof Error ? err.message : "Could not reach the server"}. Please check your internet connection and try again.`);
    }
  };

  if (!authStatus.authenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full border border-zinc-800 p-8 bg-zinc-900/20 backdrop-blur-sm">
          <div className="mb-8">
            <div className="h-10 w-10 bg-zinc-100 flex items-center justify-center mb-4">
              <ShieldCheck className="text-zinc-950" />
            </div>
            <h1 className="text-2xl font-serif italic text-zinc-100 mb-2">VoxMeet AI</h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Connect your Google Workspace to enable real-time meeting translation, 
              automated transcription, and Drive-integrated summaries.
            </p>
          </div>
          
          {!authStatus.configured && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-mono uppercase tracking-widest">
              Warning: GOOGLE_CLIENT_ID or SECRET not configured in environment.
            </div>
          )}
          
          <button 
            onClick={handleConnect}
            disabled={!authStatus.configured}
            className="w-full py-3 bg-zinc-100 text-zinc-950 font-mono uppercase tracking-widest text-xs hover:bg-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Authorize Google Access
          </button>
          
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">
              Required Scopes: Calendar (Read), Drive (Write), Docs (Write)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans flex">
      {/* Sidebar */}
      <aside className="w-16 border-r border-zinc-800 flex flex-col items-center py-6 gap-8">
        <div className="h-8 w-8 bg-zinc-100 flex items-center justify-center font-serif italic text-zinc-950 font-bold">V</div>
        <nav className="flex flex-col gap-6">
          <button className="p-2 text-zinc-100 bg-zinc-900 border border-zinc-800"><LayoutGrid size={20} /></button>
          <button className="p-2 text-zinc-500 hover:text-zinc-300"><List size={20} /></button>
          <button className="p-2 text-zinc-500 hover:text-zinc-300"><Settings size={20} /></button>
        </nav>
        <div className="mt-auto">
          <button className="p-2 text-zinc-600 hover:text-zinc-400"><LogOut size={20} /></button>
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
                <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-500">Mission Control</h2>
                <span className="h-4 w-[1px] bg-zinc-800" />
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">System Ready</span>
                </div>
              </div>
              <button 
                onClick={fetchMeetings}
                className="p-2 text-zinc-500 hover:text-zinc-100 transition-colors"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto py-12 px-8">
                <div className="mb-12">
                  <h1 className="text-4xl font-serif italic text-zinc-100 mb-4">Upcoming Meetings</h1>
                  <p className="text-zinc-500 max-w-xl text-sm leading-relaxed">
                    Select a meeting to launch the VoxMeet Assistant. The bot will join the Google Meet 
                    session and provide real-time translation for all participants.
                  </p>
                </div>

                <div className="border border-zinc-800 bg-zinc-900/10">
                  <div className="grid grid-cols-[40px_1.5fr_1fr_1fr] p-4 border-b border-zinc-800 text-[10px] font-mono uppercase tracking-widest text-zinc-600">
                    <div />
                    <div>Event Details</div>
                    <div>Schedule</div>
                    <div className="text-right">Actions</div>
                  </div>
                  
                  {loading ? (
                    <div className="p-12 text-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
                      Scanning Calendar...
                    </div>
                  ) : meetings.length > 0 ? (
                    meetings.map(m => (
                      <MeetingCard key={m.id} meeting={m} onJoin={setActiveMeeting} />
                    ))
                  ) : (
                    <div className="p-12 text-center text-zinc-600 font-mono text-xs uppercase tracking-widest">
                      No upcoming meetings found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
