const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { validateKey } = require('./keys');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are an expert Etsy SEO and listing optimization assistant. Your job is to help sellers create high-converting, search-optimized Etsy listings.

When generating listings, always follow these rules:
- TITLE: Max 140 characters. Lead with the most important keywords. Use commas or pipes to separate keyword phrases. Include material, style, occasion, and product type where relevant.
- DESCRIPTION: Start with the most important info. Use short paragraphs. Include keywords naturally. Cover: what it is, materials/dimensions, customization options, use cases, shipping info placeholder.
- TAGS: Always provide exactly 13 tags. Each tag max 20 characters. Use multi-word phrases (more specific = better). Think like a buyer searching. Cover: product type, style, material, occasion, recipient, use case.
- PRICING: Suggest competitive pricing based on category norms if asked.

Format responses clearly with sections labeled: TITLE, DESCRIPTION, TAGS.
Be conversational and helpful for follow-up questions.`;

router.post('/', async (req, res) => {
  const { key, messages, pageContext, image } = req.body;

  if (!key || !messages) {
    return res.status(400).json({ error: 'Missing key or messages' });
  }

  const keyStatus = await validateKey(key);
  if (!keyStatus.valid) {
    return res.status(keyStatus.expired ? 402 : 401).json({ message: keyStatus.message });
  }

  let formattedMessages = [...messages];
  if (pageContext && formattedMessages.length === 1) {
    formattedMessages[0] = {
      role: 'user',
      content: `${formattedMessages[0].content}\n\n[Current Etsy listing context:\n${pageContext}]`
    };
  }

  // Pro uses Gemini 1.5 Pro — higher quality, longer context, better copywriting
  const modelName = keyStatus.data.tier === 2 ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT
    });

    // Convert messages to Gemini format
    const history = formattedMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({ history });
    const lastMessage = formattedMessages[formattedMessages.length - 1].content;

    // If image attached, send as multimodal message
    const messageParts = image
      ? [{ text: lastMessage }, { inlineData: { data: image.data, mimeType: image.mimeType } }]
      : lastMessage;

    const result = await chat.sendMessage(messageParts);
    const reply = result.response.text();

    await keyStatus.incrementUsage();

    return res.json({ reply });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    return res.status(500).json({ error: 'AI service error' });
  }
});

module.exports = router;
