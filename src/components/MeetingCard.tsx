import React from 'react';
import { Calendar, Clock, Video, FileText, ExternalLink } from 'lucide-react';
import { Meeting } from '../types';
import { cn } from '../lib/utils';

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (meeting: Meeting) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, onJoin }) => {
  const startTime = meeting.start.dateTime 
    ? new Date(meeting.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'All Day';

  return (
    <div className="group flex flex-col border-b border-zinc-800 p-4 hover:bg-zinc-900/50 transition-all cursor-default">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
              {meeting.start.dateTime ? new Date(meeting.start.dateTime).toLocaleDateString() : 'Today'}
            </span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <Clock size={10} /> {startTime}
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-100 group-hover:text-white transition-colors">
            {meeting.summary}
          </h3>
          {meeting.description && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1 italic font-serif">
              {meeting.description}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          {meeting.hangoutLink && (
            <button 
              onClick={() => onJoin(meeting)}
              className="px-3 py-1.5 bg-zinc-100 text-zinc-950 text-[11px] font-mono uppercase tracking-tighter hover:bg-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Video size={12} /> Iniciar Assistente
            </button>
          )}
          <a 
            href={meeting.hangoutLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-1.5 border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};
