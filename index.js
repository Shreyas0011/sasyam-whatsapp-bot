// index.js – Sasyam WhatsApp bot
// Supports:
// 1) Yellow.ai → Backend order flow (/api/message)
// 2) Meta WhatsApp Cloud API webhooks (/webhook)

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

// node-fetch v3 workaround for CommonJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(bodyParser.json());

// ENV variables
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const SUPPORT_NUMBER = process.env.SASYAM_SUPPORT_NUMBER;

// --------------------------------------------------
// Root test route
// --------------------------------------------------
app.get("/", (req, res) => {
  res.send("Sasyam WhatsApp bot server is running ✅");
});

// --------------------------------------------------
// YELLOW.AI → BACKEND API (MAIN ORDER FLOW)
// --------------------------------------------------
app.post("/api/message", (req, res) => {
  const { phone, message } = req.body;

  console.log("📩 Yellow.ai request:", phone, message);

  if (!message) {
    return res.json({
      reply: "Please send a valid message to continue."
    });
  }

  const text = message.toLowerCase().trim();

  // STEP 1: Greeting
  if (["hi", "hey", "hello"].includes(text)) {
    return res.json({
      reply:
        "Hey! 👋 Welcome to *Sasyam Edibles* 🌿\n\n" +
        "We sell *cold-pressed groundnut oil*.\n\n" +
        "Please choose the pack size:\n" +
        "• 1 litre\n" +
        "• 5 litre"
    });
  }

  // STEP 2: Pack size
  if (text === "1 litre" || text === "1 liter" || text === "1l") {
    return res.json({
      reply:
        "Great choice 👍\n\n" +
        "Each *1 litre* bottle costs ₹324.\n\n" +
        "How many bottles would you like to order?"
    });
  }

  if (text === "5 litre" || text === "5 liter" || text === "5l") {
    return res.json({
      reply:
        "Great choice 👍\n\n" +
        "Please enter the number of *5 litre* cans you want to order."
    });
  }

  // STEP 3: Quantity (number)
  if (!isNaN(text)) {
    const qty = Number(text);
    const pricePerBottle = 324;
    const total = qty * pricePerBottle;

    return res.json({
      reply:
        "🧾 *Order Summary*\n\n" +
        `• Pack size: 1 litre\n` +
        `• Quantity: ${qty}\n` +
        `• Price per bottle: ₹${pricePerBottle}\n` +
        `• Total amount: ₹${total}\n\n` +
        "Please share your *delivery address*."
    });
  }

  // STEP 4: Address
  if (text.length > 10) {
    const orderId = "SASYAM" + Date.now().toString().slice(-6);

    return res.json({
      reply:
        "✅ *Order Confirmed!*\n\n" +
        `Order ID: ${orderId}\n\n` +
        "You will receive your order within *24–48 hours* 🚚\n\n" +
        "Thank you for choosing *Sasyam Edibles* 🌿"
    });
  }

  // Fallback
  return res.json({
    reply:
      "I didn’t quite get that 🤔\n\n" +
      "Please reply with:\n" +
      "• Hi\n" +
      "• 1 litre\n" +
      "• 5 litre"
  });
});

// --------------------------------------------------
// META WHATSAPP CLOUD API – WEBHOOK VERIFICATION
// --------------------------------------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});


// --------------------------------------------------
// META WHATSAPP CLOUD API – MESSAGE HANDLER (FUTURE USE)
// --------------------------------------------------
async function sendWhatsAppText(to, body) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  };

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

["/webhook", "/whatsapp/webhook"].forEach((path) => {
  app.post(path, async (req, res) => {
    try {
      const msg =
        req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!msg || msg.type !== "text") {
        return res.sendStatus(200);
      }

      const from = msg.from;
      const text = msg.text.body;

      await sendWhatsAppText(
        from,
        "Hi 👋 Please place your order via our WhatsApp assistant."
      );

      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      res.sendStatus(500);
    }
  });
});

// --------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

