import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { UserProfile, GeminiResponse, GeminiFlashcard } from '../types';

const API_KEY = 'AIzaSyAijXMaDR7mokooR0_UStJNWZAbNynZ9xk';

const ai = new GoogleGenAI({ apiKey: API_KEY });

const parseGeminiError = (error: any): { isRateLimit: boolean; message: string } => {
    let message = "An unexpected error occurred. Please try again.";
    let isRateLimit = false;

    const errorString = (typeof error === 'object' && error !== null) ? JSON.stringify(error) : String(error);

    if (errorString.includes('429') || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(errorString)) {
        isRateLimit = true;
        message = "API rate limit reached. Please wait a minute.";
    }

    try {
        let parsedError = (typeof error === 'object' && error !== null) ? error : JSON.parse(errorString.substring(errorString.indexOf('{')));
        if (parsedError?.error?.message) {
            message = parsedError.error.message;
        } else if (parsedError?.message) {
            message = parsedError.message;
        } else if (error instanceof Error) {
            message = error.message;
        }
    } catch (e) {
        if (!isRateLimit) {
            message = errorString;
        }
    }
    
    return { isRateLimit, message };
};

// Helper function to retry with exponential backoff
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            const errorString = JSON.stringify(error);
            
            // Don't retry on rate limits or auth errors
            if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
                throw error;
            }
            
            // Check if it's an overload error
            const isOverloaded = errorString.includes('503') || 
                                errorString.includes('overloaded') || 
                                errorString.includes('UNAVAILABLE');
            
            if (!isOverloaded || i === maxRetries - 1) {
                throw error;
            }
            
            // Wait with exponential backoff
            const delay = initialDelay * Math.pow(2, i);
            console.log(`Model overloaded, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

const getSystemInstruction = (userProfile: UserProfile): string => {
  const nativeLanguage = userProfile.native_language;
  const targetLanguage = userProfile.target_language;

  return `You are Toki, a friendly and adaptive AI language partner for the LingoBud AI app.

The user's native language (NL) is ${nativeLanguage}.
The user's target language (TL) is ${targetLanguage}.

You must ALWAYS follow these core rules:

**Rule 1: Primary Conversation in Native Language (NL).**
- Your main goal is to create an immersive experience. Converse with the user primarily in ${nativeLanguage}.
- Keep your language complexity appropriate for a ${userProfile.difficulty_level} learner.
- You should only switch to speaking ${targetLanguage} when the user asks you to, for example by saying "let's practice" or "say that in ${targetLanguage} for me".

**Rule 2: Use Native Language (NL) for Clarity.**
- If the user asks a question in ${nativeLanguage}, seems confused, or asks for a translation/explanation, you MUST respond in ${nativeLanguage} to clarify.

**Rule 3: Gently correct mistakes.**
- If the user makes an error in the TL, don't just point it out. Model the correct form naturally in your reply. For example, if they say "I goed to the store" in English (TL), you can say "Oh, you went to the store? What did you buy?".

**Rule 4: Identify and create flashcards for key vocabulary.**
- During the conversation, automatically identify 1-2 words or phrases in your response that a ${userProfile.difficulty_level} user might not know.
- For each flashcard, provide the word in TL, its translation in NL, a simple example sentence in TL, part of speech, and difficulty.
- For 'part_of_speech', use short codes like 'n', 'v', 'adj'.

**Rule 5: Provide pronunciation feedback.**
- Based on the user's text input (especially in the target language), identify potential pronunciation challenges.
- Offer a short, helpful tip in the 'pronunciation_feedback' field, written in ${nativeLanguage}.

**Rule 6: Be engaging.**
- Keep your responses concise, natural, and conversational, as if in a real-time dialogue. Ask questions to keep the conversation flowing.

**Rule 7: Streamed Dialogue Flow & Output Format.**
- Your response MUST be streamed. First, stream the conversational 'reply' text. 
- After you have finished streaming the entire reply, you MUST output a special delimiter: \`_||_\`.
- Immediately after this delimiter, provide the rest of the required data as a single, minified JSON object without any markdown formatting. The JSON object must NOT contain the 'reply' field. The JSON structure must be: { "flashcards": [...], "emotion": "...", "avatar_action": "...", "pronunciation_feedback": "..." }
`;
};


export const getAIResponseStream = async (
    transcript: string,
    userProfile: UserProfile,
    callbacks: {
        onTextChunk: (textChunk: string) => void;
        onComplete: (fullResponse: GeminiResponse) => void;
        onError: (errorDetails: { isRateLimit: boolean; message: string }) => void;
    }
) => {
    try {
        const responseStream = await retryWithBackoff(() => 
            ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: transcript,
                config: {
                    systemInstruction: getSystemInstruction(userProfile),
                },
            })
        );

        let fullReply = "";
        let jsonBuffer = "";
        const delimiter = "_||_";
        let delimiterFound = false;

        for await (const chunk of responseStream) {
            const textChunk = chunk.text;
            
            if (!textChunk) continue;
            
            if (delimiterFound) {
                // After delimiter, collect JSON data
                jsonBuffer += textChunk;
                continue;
            }

            // Check if this chunk contains the delimiter
            if (textChunk.includes(delimiter)) {
                delimiterFound = true;
                const parts = textChunk.split(delimiter);
                const textPart = parts[0];
                const jsonPart = parts.slice(1).join(delimiter); // In case delimiter appears in JSON
                
                // Send the text part before delimiter
                if (textPart) {
                   callbacks.onTextChunk(textPart);
                   fullReply += textPart;
                }
                
                // Start collecting JSON
                jsonBuffer += jsonPart;
            } else {
                // Normal text streaming - send immediately
                callbacks.onTextChunk(textChunk);
                fullReply += textChunk;
            }
        }
        
        // Parse the JSON metadata
        let jsonData: Partial<Omit<GeminiResponse, 'reply'>> = {};
        if (jsonBuffer.trim()) {
            try {
                jsonData = JSON.parse(jsonBuffer.trim());
            } catch (error) {
                console.error("Failed to parse JSON part of the stream:", error);
                console.error("Invalid JSON received:", jsonBuffer);
                // Provide a default fallback
                jsonData = {
                    flashcards: [],
                    emotion: 'confused',
                    avatar_action: 'smile',
                    pronunciation_feedback: "I had a little trouble with my thoughts just now."
                };
            }
        } else {
            // No JSON received, use defaults
            jsonData = {
                flashcards: [],
                emotion: 'happy',
                avatar_action: 'talk',
                pronunciation_feedback: '',
            };
        }
        
        const finalResponse: GeminiResponse = {
            reply: fullReply.trim(),
            flashcards: jsonData.flashcards || [],
            emotion: jsonData.emotion || 'happy',
            avatar_action: jsonData.avatar_action || 'talk',
            pronunciation_feedback: jsonData.pronunciation_feedback || '',
        };

        callbacks.onComplete(finalResponse);

    } catch (error: any) {
        console.error("Error getting AI response stream:", error);
        const errorDetails = parseGeminiError(error);
        callbacks.onError(errorDetails);
    }
};


export const createFlashcardForWord = async (word: string, contextSentence: string, userProfile: UserProfile): Promise<GeminiFlashcard | null> => {
    try {
        const instruction = `The user is learning ${userProfile.target_language} and their native language is ${userProfile.native_language}. Their level is ${userProfile.difficulty_level}.
        Create a single flashcard object for the word "${word}". The context is from the sentence: "${contextSentence}".
        Provide the translation, a simple example sentence in ${userProfile.target_language}, part of speech (using short codes like 'n', 'v', 'adj'), and difficulty.
        Your response MUST be a single JSON object. Do not wrap it in markdown backticks.`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                word: { type: Type.STRING, description: `The word/phrase in ${userProfile.target_language}.` },
                translation: { type: Type.STRING, description: `The translation of the word/phrase in ${userProfile.native_language}.` },
                example_sentence: { type: Type.STRING, description: `A simple example sentence using the word in ${userProfile.target_language}.` },
                part_of_speech: { type: Type.STRING, description: "e.g., 'n', 'v', 'adj'." },
                difficulty: { type: Type.STRING, enum: ['Beginner', 'Intermediate', 'Advanced'] },
            },
            required: ["word", "translation", "example_sentence", "part_of_speech", "difficulty"],
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: instruction,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        return JSON.parse(response.text.trim()) as GeminiFlashcard;
    } catch (error) {
        console.error("Error creating single flashcard:", error);
        return null;
    }
};

// Track TTS failures
let ttsFailureCount = 0;
let useBrowserTTS = false;

// Helper to get appropriate language code for browser TTS
const getLanguageCode = (targetLanguage: string): string => {
    const langMap: Record<string, string> = {
        'Japanese': 'ja-JP',
        'Spanish': 'es-ES',
        'French': 'fr-FR',
        'German': 'de-DE',
        'Chinese': 'zh-CN',
        'Korean': 'ko-KR',
        'Italian': 'it-IT',
        'Portuguese': 'pt-BR',
        'Russian': 'ru-RU',
        'Arabic': 'ar-SA',
        'English': 'en-US',
    };
    return langMap[targetLanguage] || 'en-US';
};

// Browser TTS fallback function
const speakWithBrowserTTS = (text: string, targetLanguage: string = 'English') => {
    if (!('speechSynthesis' in window)) {
        console.warn('Browser TTS not supported');
        return;
    }
    
    const langCode = getLanguageCode(targetLanguage);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    
    // Try to find a voice for the target language
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    
    if (targetVoice) {
        utterance.voice = targetVoice;
        console.log(`Using browser TTS voice: ${targetVoice.name} for ${targetLanguage}`);
    } else {
        console.warn(`No browser voice found for ${targetLanguage}, using default`);
    }
    
    window.speechSynthesis.speak(utterance);
};

export const generateAudio = async (text: string, voice: string, targetLanguage: string = 'English'): Promise<string | null> => {
    try {
        if (!text) return null;
        
        // If we've switched to browser TTS mode, use it directly
        if (useBrowserTTS) {
            speakWithBrowserTTS(text, targetLanguage);
            return null;
        }
        
        // Try Gemini TTS using the working pattern
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            ttsFailureCount = 0; // Reset on success
            return base64Audio;
        }
        
        throw new Error('No audio data returned');
    } catch (error) {
        console.error("Gemini TTS failed:", error);
        ttsFailureCount++;
        
        // After 5 failures, switch to browser TTS for the session
        if (ttsFailureCount >= 5) {
            console.log("Switching to browser TTS due to repeated Gemini TTS failures");
            useBrowserTTS = true;
        }
        
        // Use browser TTS as fallback
        speakWithBrowserTTS(text, targetLanguage);
        
        return null;
    }
};

const translationCache = new Map<string, string>();
export const getWordTranslation = async (word: string, userProfile: UserProfile): Promise<string> => {
    const cacheKey = `${word}:${userProfile.target_language}:${userProfile.native_language}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey)!;
    }

    const instruction = `Translate the following word from ${userProfile.target_language} to ${userProfile.native_language}: "${word}".
    Respond with ONLY the translated word(s). Do not add any extra text, explanation, or punctuation. If you cannot translate it, respond with the original word.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: instruction,
        });

        const translation = response.text.trim();
        if (translation) {
           translationCache.set(cacheKey, translation);
        }
        return translation || word;
    } catch (error) {
        console.error("Error getting word translation:", error);
        return word;
    }
};