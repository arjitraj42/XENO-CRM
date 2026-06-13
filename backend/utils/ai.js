const { GoogleGenerativeAI } = require('@google/generative-ai');


function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  try {
    const ai = new GoogleGenerativeAI(apiKey);
    return ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
  } catch (error) {
    console.error('Failed to initialize Gemini API:', error);
    return null;
  }
}


async function translateTextToFilter(promptText) {
  const model = getGeminiModel();
  
  if (!model) {
    console.log('[AI] API key not found. Using local mock filter compiler...');
    return mockCompileFilter(promptText);
  }

  try {
    const systemPrompt = `You are a CRM database expert. Translate the user's natural language audience segment description into a structured JSON query object.
Available JSON filter fields:
- "ltv_gt": (number) Lifetime value greater than
- "ltv_lt": (number) Lifetime value less than
- "city": (string or array of strings) Matches cities (e.g. "Mumbai", "Delhi", etc.)
- "age_gt": (number) Age greater than
- "age_lt": (number) Age less than
- "gender": (string) "Male" or "Female" or "Other"
- "tags": (array of strings) Customer must have these tags (e.g. ["VIP", "churn_risk"])
- "last_purchase_days_ago_gt": (number) Days since last purchase greater than (e.g. bought more than 30 days ago)
- "last_purchase_days_ago_lt": (number) Days since last purchase less than (e.g. bought in the last 90 days)

Examples:
1. "spent more than 5000 in the last 90 days but haven't purchased in 30 days"
   Response: { "ltv_gt": 5000, "last_purchase_days_ago_gt": 30, "last_purchase_days_ago_lt": 90 }
2. "customers from Mumbai or Pune who are younger than 30 years"
   Response: { "city": ["Mumbai", "Pune"], "age_lt": 30 }
3. "Female customers with tag VIP and lifetime value above 10000"
   Response: { "gender": "Female", "tags": ["VIP"], "ltv_gt": 10000 }

CRITICAL: Return ONLY valid, minified JSON. Do NOT include markdown code blocks, explanations, or any extra text.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser request: "${promptText}"` }] }
      ]
    });

    const responseText = result.response.text().trim();
    
    const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonStr);
  } catch (error) {
    console.error('[AI] Gemini segmentation error, falling back to mock compiler:', error);
    return mockCompileFilter(promptText);
  }
}


async function draftCampaignMessage({ channel, segmentDescription, brandTone, notes }) {
  const model = getGeminiModel();
  
  if (!model) {
    console.log('[AI] API key not found. Using local mock copywriter...');
    return mockDraftMessage({ channel, brandTone });
  }

  try {
    const prompt = `You are a professional CRM copywriter. Draft a personalized campaign message.
Channel: ${channel} (can be: whatsapp, sms, email, rcs)
Audience Segment: ${segmentDescription}
Brand Tone: ${brandTone} (e.g., Exciting, Professional, Casual, Urgency)
Additional Notes/Goal: ${notes || 'No specific notes'}

Available merge variables:
- {{name}} : Customer's name
- {{ltv}} : Customer's lifetime value in Rupees

Rules:
- For WhatsApp, keep it structured, concise, and professional, perhaps with some emojis.
- For SMS, keep it strictly under 160 characters.
- For Email, provide both Subject: and Body: lines.
- For RCS, make it highly interactive and engaging.
- Ensure the merge variables {{name}} and {{ltv}} are utilized naturally.

Return ONLY the final drafted text message copy (for Email, include Subject: [Subject] and then the Body). Do not include any meta comments, notes, or introductions.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    return result.response.text().trim();
  } catch (error) {
    console.error('[AI] Gemini copywriter error:', error);
    return mockDraftMessage({ channel, brandTone });
  }
}


async function generateCampaignSummary(stats) {
  const model = getGeminiModel();

  if (!model) {
    return `Campaign performance summary (Mock LLM Insight):
The campaign successfully reached ${stats.sentCount} customers over ${stats.channel.toUpperCase()}. 
It achieved a delivery rate of ${stats.deliveryRate.toFixed(1)}% and an open rate of ${stats.openRate.toFixed(1)}%. 
Importantly, ${stats.attributedOrders} orders were placed by recipients within 24 hours of receiving the message, driving a total Revenue Lift of ₹${stats.revenueLift.toLocaleString('en-IN')}. 
This represents a highly positive engagement and a clear ROI proxy for this campaign.`;
  }

  try {
    const prompt = `You are a senior marketing analyst. Analyze these campaign results and write a concise, premium insight summary (2-3 paragraphs) in plain English for a marketer dashboard. Explain the key success drivers (conversion funnel, attribution) and recommend actionable next steps.

Campaign Details:
- Channel: ${stats.channel}
- Total Dispatched: ${stats.sentCount}
- Delivered %: ${stats.deliveryRate}%
- Open Rate %: ${stats.openRate}%
- Read Rate %: ${stats.readRate}%
- Click Rate %: ${stats.clickRate}%
- Failed %: ${stats.failedRate}%
- Attributed Orders (placed within 24 hours): ${stats.attributedOrders}
- Revenue Lift (from attributed orders): ₹${stats.revenueLift}
- Estimated ROI Proxy: ₹${stats.revenueLift} total revenue from converts

Return ONLY the summary text, with elegant formatting, to be rendered directly on the dashboard.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    return result.response.text().trim();
  } catch (error) {
    console.error('[AI] Gemini summarizer error:', error);
    return `Campaign dispatched ${stats.sentCount} messages. Delivery: ${stats.deliveryRate}%, Conversions: ${stats.attributedOrders} orders, Revenue Lift: ₹${stats.revenueLift}.`;
  }
}



function mockCompileFilter(text) {
  const query = {};
  const lowercase = text.toLowerCase();

  
  const ltvGtMatch = lowercase.match(/(?:spent|ltv|revenue|more than|above|>)\s*(\d+)/i);
  if (ltvGtMatch) {
    query.ltv_gt = parseInt(ltvGtMatch[1], 10);
  }

  
  const daysAgoGtMatch = lowercase.match(/(?:not purchased|haven't bought|no order|ago\s*>\s*|last purchased more than|more than)\s*(\d+)\s*(?:days|day)/i);
  if (daysAgoGtMatch) {
    query.last_purchase_days_ago_gt = parseInt(daysAgoGtMatch[1], 10);
  }
  const daysAgoLtMatch = lowercase.match(/(?:purchased in|bought in|last purchased in|within|last)\s*(\d+)\s*(?:days|day)/i);
  if (daysAgoLtMatch) {
    query.last_purchase_days_ago_lt = parseInt(daysAgoLtMatch[1], 10);
  }

  // Parse Cities
  const cities = ['mumbai', 'delhi', 'bangalore', 'kolkata', 'chennai', 'pune', 'hyderabad', 'ahmedabad'];
  const matchedCities = [];
  cities.forEach(city => {
    if (lowercase.includes(city)) {
      matchedCities.push(city.charAt(0).toUpperCase() + city.slice(1));
    }
  });
  if (matchedCities.length > 0) {
    query.city = matchedCities.length === 1 ? matchedCities[0] : matchedCities;
  }

  // Parse Age
  const ageGtMatch = lowercase.match(/(?:age older than|age >|above|older than)\s*(\d+)/i);
  if (ageGtMatch) {
    query.age_gt = parseInt(ageGtMatch[1], 10);
  }
  const ageLtMatch = lowercase.match(/(?:age younger than|age <|below|younger than|under)\s*(\d+)/i);
  if (ageLtMatch) {
    query.age_lt = parseInt(ageLtMatch[1], 10);
  }

  // Parse Gender
  if (lowercase.includes('female') || lowercase.includes('women')) {
    query.gender = 'Female';
  } else if (lowercase.includes('male') || lowercase.includes('men')) {
    query.gender = 'Male';
  }

  // Parse Tags
  const tags = ['vip', 'new', 'churn_risk', 'active', 'inactive', 'loyal'];
  const matchedTags = [];
  tags.forEach(tag => {
    if (lowercase.includes(tag)) {
      matchedTags.push(tag.toUpperCase());
    }
  });
  if (matchedTags.length > 0) {
    query.tags = matchedTags;
  }

  // Ensure default is returned if nothing matches
  if (Object.keys(query).length === 0) {
    // Return a dummy empty object
    return {};
  }

  return query;
}

function mockDraftMessage({ channel, brandTone }) {
  const toneText = brandTone || 'Exciting';
  
  if (channel === 'whatsapp') {
    return `Hi *{{name}}*! 👋 We noticed you are one of our top customers (LTV: ₹{{ltv}}). We have an exclusive deal just for you! Use code *VIP20* for 20% off your next purchase. Valid this weekend only. 🛍️`;
  }
  if (channel === 'sms') {
    return `Hi {{name}}, standard VIP alert! Grab 15% off your next purchase. Use code EXCL15 at checkout. Min purchase ₹1000. Shop now!`;
  }
  if (channel === 'email') {
    return `Subject: Special VIP Offer Just for You, {{name}}! 🌟\n\nDear {{name}},\n\nWe wanted to say thank you for being a valued customer. Since your total lifetime purchases are ₹{{ltv}}, you qualify for our premium VIP benefits program.\n\nEnjoy 20% off our entire catalog with code: VIP20.\n\nWarm regards,\nThe Xeno Team`;
  }
  return `Hi {{name}}! 🚀 Grab the ultimate discount code. Since you spent ₹{{ltv}} with us, you're a priority member. Use code NEON25. [Shop Now] [Opt Out]`;
}

/**
 * Generates an intelligent chat response using Gemini or mock fallback.
 */
async function generateGeneralChatResponse({ message, history, context }) {
  const model = getGeminiModel();
  
  const formattedContext = context ? `
CRM Database Context:
- Total Customers: ${context.totalCustomers || 500}
- Total Orders Placed: ${context.totalOrders || 2000}
- Total Revenue: ₹${context.totalRevenue ? context.totalRevenue.toLocaleString('en-IN') : '13,26,556'}
- Average Order Value (AOV): ₹${context.averageOrderValue || '5,412'}
- Churn Risk Customers Count: ${context.churnRiskCount || 85}
- WhatsApp Campaign conversion multiplier: 2.1x over SMS
- Supported communication channels: whatsapp, sms, email, rcs
` : '';

  if (!model) {
    console.log('[AI] API key not found or model failure. Using smart rules-based chatbot responses...');
    return mockChatResponse(message);
  }

  try {
    const systemPrompt = `You are Xeno AI CRM Assistant, an advanced conversational intelligence copilot for the Xeno CRM platform.
Your goals are:
- Help users analyze customer segments, build campaign copy, forecast revenue, and find intelligence.
- Answer any generic or CRM questions. If they type/ask anything, provide a clear, helpful, and premium response.
- Be concise (2-4 sentences or short bullet points preferred) so the chat stays readable.
- Use markdown formatting (bold, bullet points, headers, inline code) appropriately.
${formattedContext}

Conversation History:
${(history || []).map(h => `${h.sender.toUpperCase()}: ${h.text}`).join('\n')}

Analyze the user's latest query and respond. Keep it highly relevant, professional, and friendly.`;

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser: "${message}"` }] }
      ]
    });

    return result.response.text().trim();
  } catch (error) {
    console.error('[AI] Gemini chat response error:', error);
    return mockChatResponse(message);
  }
}

function mockChatResponse(message) {
  const lowercase = message.toLowerCase();
  
  if (lowercase.includes('hello') || lowercase.includes('hi ') || lowercase.includes('hey')) {
    return "Hello! I am your Xeno AI Assistant. How can I help you optimize your CRM, analyze metrics, or query customers today? 😊";
  }
  if (lowercase.includes('joke')) {
    return "Why did the CRM developer break up with MongoDB? Because they wanted a relationship! 🥁";
  }
  if (lowercase.includes('help')) {
    return "Here are the things you can ask me:\n- 'Show churn-risk customers' to see dormant buyers.\n- 'Explain revenue changes' for business growth metrics.\n- 'Show top customers' to see our VIP list.\n- Ask about specific names or cities to search our live database!";
  }
  
  return `I've analyzed your query: "${message}". Currently, I am operating in a rules-assisted offline copilot mode. 
For database queries, you can search for a customer by typing their name (e.g. Pooja, Deepak), location (e.g. Mumbai, Chennai), tags, or phone.
For general CRM queries, let me know if you would like me to draft campaign templates, suggest high-value customer segments, or analyze channel performance!`;
}

module.exports = {
  translateTextToFilter,
  draftCampaignMessage,
  generateCampaignSummary,
  generateGeneralChatResponse
};
