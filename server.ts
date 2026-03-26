import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import cors from "cors";

declare module "express-session" {
  interface SessionData {
    tokens: any;
  }
}

const app = express();
const PORT = 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow Gemini Live API and Google Fonts
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.APP_URL || true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Session Configuration optimized for Serverless/Vercel
app.use(session({
  secret: process.env.SESSION_SECRET || "voxmeet-production-secret-key-2026",
  resave: false,
  saveUninitialized: false, // Don't create session until something is stored
  name: 'voxmeet.sid',
  cookie: { 
    secure: true, // Required for SameSite=None
    sameSite: 'none', // Required for cross-origin iframe (AI Studio/Vercel)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Google OAuth Setup
const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.APP_URL}/auth/callback`;

  if (!clientId || !clientSecret) {
    console.error("CRITICAL: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents'
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
    res.status(500).json({ error: "Failed to generate Google Auth URL" });
  }
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided");

  const client = getOAuthClient();
  try {
    const { tokens } = await client.getToken(code as string);
    req.session.tokens = tokens;
    
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Session save failed");
      }
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
              <h2>Authenticated Successfully!</h2>
              <p>Closing this window...</p>
            </div>
          </body>
        </html>
      `);
    });
  } catch (error) {
    console.error("Auth callback error:", error);
    res.status(500).send("Authentication failed. Please check server logs.");
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json({ 
    authenticated: !!req.session.tokens,
    configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

// Calendar API
app.get("/api/meetings", async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: "Not authenticated" });
  
  const client = getOAuthClient();
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

// Summary API
app.post("/api/summary", async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: "Not authenticated" });
  
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Missing title or content" });

  const client = getOAuthClient();
  client.setCredentials(req.session.tokens);
  
  const docs = google.docs({ version: 'v1', auth: client });

  try {
    const doc = await docs.documents.create({
      requestBody: { title: `VoxMeet: ${title}` }
    });
    
    await docs.documents.batchUpdate({
      documentId: doc.data.documentId!,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `VOXMEET MEETING SUMMARY\n========================\n\n${content}`
            }
          },
          {
            updateTextStyle: {
              range: { startIndex: 1, endIndex: 25 },
              textStyle: { bold: true, fontSize: { magnitude: 18, unit: 'PT' } },
              fields: 'bold,fontSize'
            }
          }
        ]
      }
    });

    res.json({ success: true, docId: doc.data.documentId });
  } catch (error) {
    console.error("Docs API Error:", error);
    res.status(500).json({ error: "Failed to save summary to Google Docs" });
  }
});

// Vite Setup for Development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`VoxMeet Dev Server running on http://localhost:${PORT}`);
    });
  }
}

// Export for Vercel
export default app;

// Only start the server if not running as a serverless function
if (process.env.NODE_ENV !== "production") {
  startServer();
}
