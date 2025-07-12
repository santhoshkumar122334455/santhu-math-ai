const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Translate } = require('@google-cloud/translate').v2;
const fs = require('fs');
const path = require('path');

// --- STEP 1: LOAD CREDENTIALS (MORE ROBUST METHOD) ---
const credentialsPath = path.join(__dirname, 'google-credentials.json');
let translate;

// Check if the credentials file exists before initializing
if (fs.existsSync(credentialsPath)) {
    // FIX: Initialize the translator by directly pointing to the key file. This is more reliable.
    translate = new Translate({
        keyFilename: credentialsPath
    });
    console.log("Translation service initialized successfully.");
} else {
    console.error("FATAL ERROR: `google-credentials.json` file not found.");
    console.error("Translation service will not work. Please add the file to your project folder.");
    // Create a dummy translator to prevent the app from crashing if the file is missing
    translate = { translate: () => Promise.reject(new Error("Translator not configured")) };
}

// This securely reads your Gemini API key from the environment variable.
const API_KEY = process.env.GOOGLE_API_KEY; 
if (!API_KEY) {
    console.error("FATAL ERROR: GOOGLE_API_KEY environment variable is not set.");
    console.log("Please set it using the command: setx GOOGLE_API_KEY \"YOUR_API_KEY_HERE\"");
    process.exit(1);
}

// --- STEP 2: INITIALIZE SERVICES & SERVER ---
const app = express();
app.use(express.json()); 
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;

const genAI = new GoogleGenerativeAI(API_KEY);
const generativeModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: {
        role: "system",
        parts: [{
            text: `You are Santhu Math AI, a world-class mathematician AI created for Santhosh. Your capabilities are:
            1.  **Solve Anything:** Solve any mathematical problem, from basic arithmetic to advanced calculus, linear algebra, and differential equations.
            2.  **Show Your Work:** Always provide a clear, step-by-step explanation of how you arrived at the answer. This is mandatory.
            3.  **Handle Natural Language:** Understand questions asked in plain English.
            4.  **Format for Clarity:** Use Markdown for formatting. Use code blocks for equations.
            5.  **Be Concise:** Be direct and to the point.
            If a question is not related to mathematics, politely state that you can only answer math-related questions.`
        }]
    },
    generationConfig: { temperature: 0.2, topK: 1, topP: 1, maxOutputTokens: 8192 },
});

// --- STEP 3: DEFINE API ENDPOINTS ---
app.post('/translate', async (req, res) => {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) return res.status(400).json({ error: 'Missing text or target language' });
    try {
        let [translations] = await translate.translate(text, targetLanguage);
        res.json({ translatedText: Array.isArray(translations) ? translations[0] : translations });
    } catch (error) {
        console.error("Translation API Error:", error.message);
        res.status(500).json({ error: 'Failed to translate text. Check server credentials.' });
    }
});

app.use(express.static('public'));
app.get('/', (req, res) => { res.sendFile(__dirname + '/public/index.html'); });

// --- STEP 4: HANDLE REAL-TIME CHAT CONNECTION ---
io.on('connection', (socket) => {
    console.log('A user connected.');
    const chat = generativeModel.startChat({ history: [] }); 
    socket.on('disconnect', () => { console.log('User disconnected.'); });
    socket.on('chat message', async (msg) => {
        console.log(`Message received: "${msg}"`);
        try {
            const result = await chat.sendMessage(msg);
            socket.emit('ai response', result.response.text());
        } catch (error) {
            console.error("Gemini API Error:", error);
            socket.emit('ai response', "Sorry, I encountered an error with the AI model.");
        }
    });
});

// --- STEP 5: START THE SERVER ---
server.listen(port, () => { console.log(`AI-powered server is running on http://localhost:${port}`); });