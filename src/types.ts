export interface Meeting {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  hangoutLink?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: {
    name: string;
    email: string;
    picture: string;
  };
}

export interface HistoryItem {
  id: string;
  title: string;
  date: string;
  type: 'doc' | 'sheet';
  link: string;
}
