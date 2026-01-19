// index.js – Sasyam WhatsApp bot (order flow + custom message fallback)

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

// node-fetch v3 workaround for CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(bodyParser.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const SUPPORT_NUMBER = process.env.SASYAM_SUPPORT_NUMBER;

// Just to test root
app.get("/", (req, res) => {
  res.send("Sasyam WhatsApp bot server is running ✅");
});

// Helper: log basic info
function logRequest(req) {
  console.log("---- Incoming request ----");
  console.log("Path:", req.path);
  console.log("Query:", req.query);
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("--------------------------");
}

// ✅ GET webhook (verification) – for Meta
["/webhook", "/whatsapp/webhook"].forEach((path) => {
  app.get(path, (req, res) => {
    logRequest(req);

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("mode =", mode, "token =", token, "challenge =", challenge);

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified successfully");
      return res.status(200).send(challenge);
    } else {
      console.log("❌ Webhook verification failed");
      return res.sendStatus(403);
    }
  });
});

// Helper: send a WhatsApp text message using the Cloud API
async function sendWhatsAppText(to, body) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  };

  console.log("Sending WhatsApp message:", JSON.stringify(payload, null, 2));

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  console.log("WhatsApp API response:", JSON.stringify(data, null, 2));
}

// Very simple classifier: decide if message is an "order" or "custom query"
function isOrderMessage(text) {
  const t = text.toLowerCase();

  // keywords indicating they are trying to order groundnut oil
  const orderKeywords = [
    "order",
    "buy",
    "groundnut",
    "ground nut",
    "oil",
    "1l",
    "1 l",
    "1 litre",
    "1 liter",
    "5l",
    "5 l",
    "5 litre",
    "5 liter",
    "15l",
    "15 l",
    "15 litre",
    "15 liter",
  ];

  return orderKeywords.some((kw) => t.includes(kw));
}

// Create reply text for an order-type message
function buildOrderReply(text) {
  return (
    "🙏 Thank you for choosing Sasyam Edibles!\n\n" +
    "We currently sell *cold pressed groundnut oil*.\n\n" +
    "Please reply in one of these formats so we can process your order:\n" +
    "• `order 1L`\n" +
    "• `order 5L`\n" +
    "• `order 15L`\n\n" +
    "You can also mention quantity, for example: `order 3 x 5L`."
  );
}

// Fallback reply for custom / non-order messages
function buildCustomReply() {
  return (
    "Thank you for reaching out to *Sasyam Edibles*.\n\n" +
    "For custom queries, bulk orders, or anything else, " +
    `please contact us directly on this number:\n${SUPPORT_NUMBER}\n\n` +
    "We’ll be happy to help you there. 🙏"
  );
}

// ✅ POST webhook – when messages actually come from WhatsApp
["/webhook", "/whatsapp/webhook"].forEach((path) => {
  app.post(path, async (req, res) => {
    logRequest(req);

    try {
      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      // No message (could be status update etc.)
      if (!messages || messages.length === 0) {
        console.log("No incoming messages in this webhook.");
        return res.sendStatus(200);
      }

      const msg = messages[0];
      const from = msg.from; // customer WhatsApp number
      const type = msg.type;

      if (type === "text" && msg.text && msg.text.body) {
        const text = msg.text.body.trim();
        console.log("Received text:", text, "from:", from);

        let reply;

        if (isOrderMessage(text)) {
          // They are talking about ordering groundnut oil
          reply = buildOrderReply(text);
        } else {
          // Custom / random / query message -> send support number
          reply = buildCustomReply();
        }

        await sendWhatsAppText(from, reply);
      } else {
        console.log("Non-text message type received:", type);
      }

      // Always respond 200 to Meta quickly
      res.sendStatus(200);
    } catch (err) {
      console.error("Error handling webhook:", err);
      res.sendStatus(500);
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
