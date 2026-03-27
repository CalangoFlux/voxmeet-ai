import express from "express";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import cors from "cors";

const app = express();
const PORT = 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.APP_URL || true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Cookie Session - Stateless and perfect for Vercel Serverless
app.set('trust proxy', 1); // Trust Vercel proxy
app.use(cookieSession({
  name: 'voxmeet-session',
  keys: [process.env.SESSION_SECRET || "voxmeet-production-secret-key-2026"],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: true,
  sameSite: 'none',
  httpOnly: true,
}));

// Google OAuth Setup
const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables.");
  }
  
  if (!appUrl) {
    throw new Error("Missing APP_URL environment variable.");
  }

  const redirectUri = `${appUrl.replace(/\/$/, '')}/auth/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      appUrl: process.env.APP_URL
    }
  });
});

// Auth Routes
app.get("/api/auth/url", (req, res) => {
  try {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    res.json({ url });
  } catch (error) {
    console.error("Error generating Auth URL:", error);
    res.status(500).json({ error: "Failed to generate Google Auth URL", details: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided");

  const client = getOAuthClient();
  try {
    const { tokens } = await client.getToken(code as string);
    // @ts-ignore - cookie-session uses req.session directly
    req.session.tokens = tokens;
    
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <div style="text-align: center;">
            <h2 style="font-weight: 300; letter-spacing: 0.1em; text-transform: uppercase; font-size: 14px;">Conexão Estabelecida</h2>
            <p style="opacity: 0.4; font-size: 10px; letter-spacing: 0.05em; margin-top: 8px;">Esta janela será fechada automaticamente.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Auth callback error:", error);
    res.status(500).send("Authentication failed. Please check server logs.");
  }
});

app.get("/api/auth/status", async (req, res) => {
  // @ts-ignore
  const authenticated = !!(req.session && req.session.tokens);
  let user = null;

  if (authenticated) {
    try {
      const client = getOAuthClient();
      // @ts-ignore
      client.setCredentials(req.session.tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const userInfo = await oauth2.userinfo.get();
      user = {
        name: userInfo.data.name,
        email: userInfo.data.email,
        picture: userInfo.data.picture
      };
    } catch (e) {
      console.error("Failed to fetch user info:", e);
    }
  }

  res.json({ 
    authenticated,
    configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    user
  });
});

app.post("/api/auth/logout", (req, res) => {
  // @ts-ignore
  req.session = null;
  res.json({ success: true });
});

// Calendar API
app.get("/api/meetings", async (req, res) => {
  // @ts-ignore
  if (!req.session || !req.session.tokens) return res.status(401).json({ error: "Not authenticated" });
  
  const client = getOAuthClient();
  // @ts-ignore
  client.setCredentials(req.session.tokens);
  const calendar = google.calendar({ version: 'v3', auth: client });
  
  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 15,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json(response.data.items || []);
  } catch (error) {
    console.error("Calendar API Error:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

// Drive & History API
app.get("/api/history", async (req, res) => {
  // @ts-ignore
  if (!req.session || !req.session.tokens) return res.status(401).json({ error: "Not authenticated" });
  
  const client = getOAuthClient();
  // @ts-ignore
  client.setCredentials(req.session.tokens);
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet'",
      pageSize: 10,
      fields: 'files(id, name, mimeType, webViewLink, createdTime)',
      orderBy: 'createdTime desc'
    });

    const history = (response.data.files || []).map(file => ({
      id: file.id,
      title: file.name,
      date: file.createdTime,
      type: file.mimeType === 'application/vnd.google-apps.document' ? 'doc' : 'sheet',
      link: file.webViewLink
    }));

    res.json(history);
  } catch (error) {
    console.error("Drive API Error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Summary API
app.post("/api/summary", async (req, res) => {
  // @ts-ignore
  if (!req.session || !req.session.tokens) return res.status(401).json({ error: "Not authenticated" });
  
  const { title, content, type = 'doc' } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Missing title or content" });

  const client = getOAuthClient();
  // @ts-ignore
  client.setCredentials(req.session.tokens);
  
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    // 1. Find or Create VoxMeet Folder
    let folderId = '';
    const folderSearch = await drive.files.list({
      q: "name='VoxMeet AI' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)'
    });

    if (folderSearch.data.files && folderSearch.data.files.length > 0) {
      folderId = folderSearch.data.files[0].id!;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: 'VoxMeet AI',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      folderId = folder.data.id!;
    }

    if (type === 'sheet') {
      const sheets = google.sheets({ version: 'v4', auth: client });
      const spreadsheet = await drive.files.create({
        requestBody: {
          name: `VoxMeet: ${title}`,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [folderId]
        },
        fields: 'id'
      });

      const spreadsheetId = spreadsheet.data.id!;
      
      // Add content to sheet
      const lines = content.split('\n').map((line: string) => [line]);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['VOXMEET MEETING SUMMARY'], [''], ...lines] }
      });

      return res.json({ success: true, id: spreadsheetId, type: 'sheet' });
    } else {
      const docs = google.docs({ version: 'v1', auth: client });
      const doc = await drive.files.create({
        requestBody: {
          name: `VoxMeet: ${title}`,
          mimeType: 'application/vnd.google-apps.document',
          parents: [folderId]
        },
        fields: 'id'
      });
      
      const documentId = doc.data.id!;

      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: `VOXMEET MEETING SUMMARY\n========================\n\n${content}`
              }
            }
          ]
        }
      });

      return res.json({ success: true, id: documentId, type: 'doc' });
    }
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Failed to save to Google Drive" });
  }
});

// Vite Setup for Development and Production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VoxMeet Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
