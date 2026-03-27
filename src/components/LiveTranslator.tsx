import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { Meeting } from '../types';
import { Mic, MicOff, Video, Save, X, Activity, MessageSquare, Languages, FileText, Table } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LiveTranslatorProps {
  meeting: Meeting;
  onClose: () => void;
}

export const LiveTranslator: React.FC<LiveTranslatorProps> = ({ meeting, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<{ text: string; translation: string; timestamp: string }[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startSession = async () => {
    if (!process.env.GEMINI_API_KEY) {
      setError("GEMINI_API_KEY not found in environment.");
      return;
    }
    setStatus('connecting');
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `Você é um tradutor profissional de reuniões em tempo real. 
          Seu objetivo é fornecer tradução perfeita entre Português e Inglês.
          - Se o falante estiver falando Português, traduza para Inglês.
          - Se o falante estiver falando Inglês, traduza para Português.
          - Forneça APENAS a tradução no turno do modelo.
          - Se o áudio não estiver claro, forneça a melhor interpretação possível.
          - Mantenha um tom profissional e prestativo.`,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
        callbacks: {
          onopen: () => {
            setStatus('active');
            setIsRecording(true);
            startAudioCapture();
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              const text = message.serverContent.modelTurn.parts[0].text;
              setTranscript(prev => [{
                text: "Entrada de Áudio...",
                translation: text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }, ...prev]);
            }
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Erro de conexão. Verifique sua chave de API e rede.");
            stopSession();
          },
          onclose: () => {
            setStatus('idle');
            setIsRecording(false);
          }
        }
      });
      sessionRef.current = session;
    } catch (err) {
      console.error(err);
      setError("Falha ao conectar à API Gemini Live.");
      setStatus('idle');
    }
  };

  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);

      const updateVolume = () => {
        if (!isRecording) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(average);
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      processor.onaudioprocess = (e) => {
        if (sessionRef.current && isRecording) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          sessionRef.current.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error("Mic error:", err);
      setError("Acesso ao microfone negado. Verifique as permissões do navegador.");
    }
  };

  const stopSession = () => {
    setIsRecording(false);
    if (sessionRef.current) sessionRef.current.close();
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setStatus('idle');
  };

  const saveSummary = async (type: 'doc' | 'sheet' = 'doc') => {
    setStatus('saving');
    const content = `
      RESUMO DA REUNIÃO: ${meeting.summary}
      DATA: ${new Date().toLocaleString('pt-BR')}
      
      TRANSCRIÇÃO E TRADUÇÃO:
      ${transcript.map(t => `[${t.timestamp}] ${t.translation}`).join('\n')}
    `;

    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: meeting.summary, content, type })
      });
      if (res.ok) {
        alert(`Resumo salvo no Google Drive como ${type === 'doc' ? 'Documento' : 'Planilha'}!`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatus('active');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-100 cursor-pointer"><X size={18} /></button>
          <div className="flex flex-col">
            <h2 className="text-sm font-medium text-zinc-100">{meeting.summary}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Sessão Ativa</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span className="text-[10px] font-mono text-emerald-500 uppercase">Ao Vivo</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="flex border border-zinc-800">
            <button 
              onClick={() => saveSummary('doc')}
              disabled={status === 'saving' || transcript.length === 0}
              title="Salvar como Documento"
              className="px-3 py-1.5 border-r border-zinc-800 text-[11px] font-mono uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FileText size={14} /> {status === 'saving' ? '...' : 'DOC'}
            </button>
            <button 
              onClick={() => saveSummary('sheet')}
              disabled={status === 'saving' || transcript.length === 0}
              title="Salvar como Planilha"
              className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Table size={14} /> {status === 'saving' ? '...' : 'SHEET'}
            </button>
          </div>
          <button 
            onClick={isRecording ? stopSession : startSession}
            className={cn(
              "px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer",
              isRecording 
                ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" 
                : "bg-zinc-100 text-zinc-950 hover:bg-white"
            )}
          >
            {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
            {isRecording ? 'Parar Bot' : 'Iniciar Bot'}
          </button>
        </div>
      </header>

      {/* Main View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Feed */}
        <div className="flex-1 flex flex-col border-r border-zinc-800">
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <AnimatePresence initial={false}>
              {transcript.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 group"
                >
                  <div className="w-12 pt-1">
                    <span className="text-[10px] font-mono text-zinc-600">{item.timestamp}</span>
                  </div>
                  <div className="flex-1 border-l border-zinc-800 pl-6 pb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Languages size={12} className="text-zinc-500" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Tradução</span>
                    </div>
                    <p className="text-lg font-serif italic text-zinc-100 leading-relaxed">
                      "{item.translation}"
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {transcript.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-full border border-dashed border-zinc-800 flex items-center justify-center mb-6">
                  <Activity className="text-zinc-700" />
                </div>
                <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 mb-2">Aguardando Áudio</h3>
                <p className="text-xs text-zinc-600 max-w-xs">
                  O assistente VoxMeet está ouvindo. Comece a falar ou entre na chamada do Google Meet para iniciar a tradução em tempo real.
                </p>
              </div>
            )}
          </div>
          
          {/* Status Bar */}
          <div className="h-12 border-t border-zinc-800 bg-zinc-900/20 px-8 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={cn("h-1.5 w-1.5 rounded-full", isRecording ? "bg-emerald-500 animate-pulse" : "bg-zinc-700")} />
                <span className="text-[10px] font-mono uppercase text-zinc-500">Status do Mic</span>
              </div>
              
              {isRecording && (
                <div className="flex items-center gap-1 h-3">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i}
                      className="w-1 bg-emerald-500/50 rounded-full transition-all duration-75"
                      style={{ 
                        height: `${Math.min(100, (volume / 128) * (100 + Math.random() * 50) * (1 - Math.abs(i-3.5)/4))}%` 
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Activity size={12} className="text-zinc-600" />
                <span className="text-[10px] font-mono uppercase text-zinc-500">Latência: 120ms</span>
              </div>
            </div>
            {error && <span className="text-[10px] font-mono uppercase text-red-500">{error}</span>}
          </div>
        </div>

        {/* Right: Info Panel */}
        <aside className="w-80 bg-zinc-900/10 p-8 hidden lg:block">
          <div className="mb-10">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-4 flex items-center gap-2">
              <FileText size={12} /> Contexto da Reunião
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-700 block mb-1">Assunto</label>
                <p className="text-xs text-zinc-300">{meeting.summary}</p>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-700 block mb-1">Idiomas Alvo</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['PT-BR', 'EN', 'ES'].map(lang => (
                    <span key={lang} className="px-2 py-0.5 border border-zinc-800 text-[9px] font-mono text-zinc-500 uppercase">{lang}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border border-zinc-800 bg-zinc-900/40">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-3 flex items-center gap-2">
              <MessageSquare size={12} /> Instruções do Bot
            </h4>
            <p className="text-[10px] text-zinc-500 leading-relaxed italic">
              "Traduza todas as falas não inglesas para o inglês. Traduza as falas em inglês para o português. 
              Foque na precisão técnica e mantenha um tom profissional."
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
