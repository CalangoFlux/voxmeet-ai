# VoxMeet AI 🎙️🤖

**VoxMeet AI** é um assistente de reuniões inteligente que utiliza a **Gemini 2.5 Flash Native Audio API** para fornecer tradução simultânea de áudio com baixíssima latência, além de integração total com o ecossistema Google (Calendar, Drive e Docs).

## 🚀 Funcionalidades

- **Tradução em Tempo Real**: Tradução bidirecional (PT-BR <-> EN) via áudio nativo.
- **Integração com Google Calendar**: Lista automaticamente suas próximas reuniões do Google Meet.
- **Sumários Automáticos**: Gera atas de reunião formatadas e as salva diretamente no seu Google Docs.
- **Dashboard "Mission Control"**: Interface técnica e profissional para monitoramento de áudio e transcrição.

## 🛠️ Tecnologias

- **Frontend**: React, Vite, Tailwind CSS, Motion.
- **Backend**: Node.js, Express, Google APIs Client.
- **IA**: Google Gemini 2.5 Flash Native Audio (Live API).
- **Autenticação**: Google OAuth2.

## 📋 Pré-requisitos

Antes de rodar o projeto, você precisará de:
1. Uma conta no [Google Cloud Console](https://console.cloud.google.com/).
2. Uma API Key do [Google AI Studio (Gemini)](https://aistudio.google.com/).

## ⚙️ Configuração

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/CalangoFlux/vox-meet-ai.git
   cd vox-meet-ai
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente**:
   Crie um arquivo `.env` na raiz do projeto com as seguintes chaves:
   ```env
   GEMINI_API_KEY="Sua_Chave_Gemini"
   GOOGLE_CLIENT_ID="Seu_Google_Client_ID"
   GOOGLE_CLIENT_SECRET="Seu_Google_Client_Secret"
   APP_URL="http://localhost:3000"
   SESSION_SECRET="uma-chave-aleatoria-e-segura"
   ```

4. **Configure o Google Cloud Console**:
   - Ative as APIs: **Google Calendar API**, **Google Drive API** e **Google Docs API**.
   - Em **Credentials**, crie um **OAuth 2.0 Client ID** (Web Application).
   - Adicione a URI de redirecionamento: `http://localhost:3000/auth/callback` (ou a URL do seu deploy).

## 🏃 Como Rodar

```bash
npm run dev
```
O app estará disponível em `http://localhost:3000`.

## 📄 Licença

Este projeto está sob a licença MIT.
