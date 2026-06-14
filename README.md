eno CRM — AI-Powered Customer Relationship Engine


Segment your audience in plain English. Launch campaigns in seconds. Watch results update live.




What Is This?

Xeno CRM is a full-stack, production-grade Customer Relationship Engine built for modern e-commerce businesses. It replaces the usual workflow of complex queries → slow segmentation → manual copywriting → delayed reporting with a single unified platform powered by Google Gemini and real-time event streaming.

The problem it solves: Businesses sit on enormous amounts of customer transaction data but can't act on it fast enough. Segmentation requires engineers. Campaign copy takes hours. And by the time analytics are ready, the opportunity has passed.

Xeno CRM fixes all three.


Live Features

📊 Real-Time Analytics Dashboard


Revenue trends across the last 120 days (area chart)
Audience growth curves (line chart)
Channel breakout by WhatsApp, Email, SMS, RCS (pie chart)
Automated churn risk alerts — customers inactive for 60+ days are flagged automatically
AI Recommendation Center — campaign suggestions generated from live metrics


🧠 Customer Intelligence


Server-side search and filtering across the full customer directory
One-click Customer Intelligence Drawer per profile
Real-time Health Score and Churn Probability — calculated dynamically from average order value and recency
Full purchase history aggregation
Behavioral tags: VIP, At Risk, Frequent Buyer, New Customer


✂️ AI-Powered Segment Builder


Type audience criteria in plain English — no SQL, no MongoDB queries
Gemini 1.5 Flash translates the input into a precise, executable MongoDB filter
Preview segment size before saving — see exactly how many contacts match
Saves segments for reuse across campaigns


📣 Campaign Engine


Multi-channel dispatch: WhatsApp, SMS, Email, RCS
AI Copywriter — Gemini drafts optimized campaign copy based on segment profile and selected brand tone (Professional, Exciting, Empathetic, Urgent)
Custom in-memory job queue with concurrency control (cap: 10) and exponential backoff retry logic
Live delivery metrics via Server-Sent Events — no page refresh needed
Campaign Funnel view: Sent → Delivered → Opened → Clicked
Auto-generated AI Campaign Summary — Gemini writes a plain-language performance report per campaign


🤖 Xeno AI Assistant


Conversational chatbot with direct database awareness
Backend injects live stats (revenue, churn count, VIP count, AOV) into Gemini's context before responding
Answers business questions accurately in natural language
Falls back to a rules-based NLP engine if the Gemini API is unavailable



Architecture

The application runs as three isolated services, mirroring a real-world production setup:

┌─────────────────────┐     SSE Stream      ┌──────────────────────────┐
│   React Frontend    │ ◄────────────────── │   Node / Express Backend  │
│   (Vite + Tailwind) │                     │   (MongoDB Atlas)         │
└─────────────────────┘                     └────────────┬─────────────┘
                                                         │ Webhooks
                                            ┌────────────▼─────────────┐
                                            │     Channel Service       │
                                            │  (Message Gateway Sim)    │
                                            └──────────────────────────┘

ServiceStackResponsibilityFrontendReact, Vite, Tailwind CSSUI, SSE consumer, chartingBackendNode.js, Express, MongoDB AtlasBusiness logic, AI orchestration, job queue, webhook processingChannel ServiceNode.jsSimulates message delivery, open, and click events with realistic delays; fires webhooks back to backend


Key Engineering Decisions

Server-Sent Events over WebSockets

Campaign delivery metrics update live in the browser without polling. SSE was chosen over WebSockets because all real-time data flows one-way — server to client — making it significantly lighter and natively compatible with standard HTTP infrastructure.

Custom In-Memory Job Queue

Rather than dispatching all campaign messages simultaneously (which would hammer external APIs), the backend maintains a concurrency-limited queue (max 10 parallel jobs). Failed jobs back off exponentially before retrying, preventing thundering herd issues during large sends.

Webhook Deduplication

Delivery receipts from the Channel Service can arrive out of order due to network latency — a READ status may arrive before DELIVERED. The backend compares status priority levels and ignores any update that would downgrade a message's current state, preventing race conditions.

Graceful AI Fallbacks

Every Gemini-powered feature has a deterministic local fallback:


Segment Builder → regex-based query parser
AI Assistant → rules-based NLP engine
AI Copywriter → template-based copy generator


The app remains fully functional regardless of external API availability.


Tech Stack

LayerTechnologyFrontendReact 18, Vite, Tailwind CSS, RechartsBackendNode.js, Express.jsDatabaseMongoDB Atlas (Aggregation Pipelines)AIGoogle Gemini 1.5 FlashReal-TimeServer-Sent Events (SSE)Message SimulationCustom Channel Service with Webhook callbacks


Getting Started

Prerequisites


Node.js v18+
MongoDB Atlas connection string
Google Gemini API key


Installation

bash# Clone the repository
git clone https://github.com/yourusername/xeno-crm.git
cd xeno-crm

# Install dependencies for all three services
cd frontend && npm install
cd ../backend && npm install
cd ../channel-service && npm install

Environment Variables

Create a .env file in /backend:

envMONGODB_URI=your_mongodb_atlas_connection_string
GEMINI_API_KEY=your_google_gemini_api_key
PORT=5000
CHANNEL_SERVICE_URL=http://localhost:5001

Create a .env file in /channel-service:

envBACKEND_WEBHOOK_URL=http://localhost:5000/api/webhooks/delivery
PORT=5001

Running the App

bash# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Channel Service
cd channel-service && npm run dev

# Terminal 3 — Frontend
cd frontend && npm run dev

Visit http://localhost:5173

Seed the Database

bashcd backend && npm run seed

This populates MongoDB with realistic customer records, transactions, and campaign history so all dashboard charts and analytics render with meaningful data.


Project Structure

xeno-crm/
├── frontend/
│   ├── src/
│   │   ├── components/       # Dashboard, Customers, Segments, Campaigns, Assistant
│   │   ├── hooks/            # useSSE — Server-Sent Events consumer
│   │   └── api/              # Axios API layer
├── backend/
│   ├── routes/               # customers, segments, campaigns, analytics, assistant
│   ├── services/
│   │   ├── geminiService.js  # All Gemini API calls + fallback logic
│   │   ├── queueService.js   # Concurrent job queue with retry/backoff
│   │   └── sseService.js     # SSE connection manager + event broadcaster
│   └── models/               # Mongoose schemas
└── channel-service/
    └── index.js              # Message simulator + webhook dispatcher


What I'd Build Next


Multi-tenant support — workspace isolation for multiple business accounts
Persistent queue with Redis for crash-safe job processing
A/B campaign testing — split sends with automated winner selection
Predictive churn scoring via a fine-tuned model replacing the current heuristic
Email/WhatsApp API integration replacing the simulator with live delivery



Author

Built by Arjit Raj as part of the Xeno engineering assignment.

For questions or feedback — arjitraj00@gmail.com
