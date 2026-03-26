import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";

declare module "express-session" {
  interface SessionData {
    tokens: any;
  }
}

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "voxmeet-secret",
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: true, 
    sameSite: 'none',
    httpOnly: true 
  }
}));

// Google OAuth Setup
const getOAuthClient = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Auth will fail.");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/auth/callback`
  );
};

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents'
];

// Auth Routes
app.get("/api/auth/url", (req, res) => {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({ url });
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  const client = getOAuthClient();
  try {
    const { tokens } = await client.getToken(code as string);
    req.session.tokens = tokens;
    // Ensure session is saved before redirecting/closing
    req.session.save((err) => {
      if (err) throw err;
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).send("Authentication failed. Check server logs.");
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
    res.json(response.data.items);
  } catch (error) {
    console.error("Calendar API Error:", error);
    res.status(500).json({ error: "Failed to fetch meetings from Google Calendar" });
  }
});

// Summary API
app.post("/api/summary", async (req, res) => {
  if (!req.session.tokens) return res.status(401).json({ error: "Not authenticated" });
  
  const { title, content } = req.body;
  const client = getOAuthClient();
  client.setCredentials(req.session.tokens);
  
  const docs = google.docs({ version: 'v1', auth: client });
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    // Create Doc
    const doc = await docs.documents.create({
      requestBody: { title: `VoxMeet: ${title}` }
    });
    
    // Add content with basic formatting
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
    res.status(500).json({ error: "Failed to create or update Google Doc" });
  }
});

// Vite Setup
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
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Export for Vercel
export default app;

// Production static serving
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Only start the server if not running as a serverless function
if (process.env.NODE_ENV !== "production") {
  startServer();
}
