import { GoogleGenAI } from '@google/genai';

// Lazy client initialization to avoid crashes if GEMINI_API_KEY is not immediately provided
let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set in environment. Gemini features will return helpful safety fallback responses.');
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `You are the Yuki AI Safety Advisor, a trauma-informed, ethical, and responsible safety and emergency guidance assistant.

CRITICAL SAFETY DIRECTIVES:
1. NEVER claim to be police, medical services, or a substitute for emergency dispatchers.
2. NEVER guarantee absolute physical safety or make unsupported crime predictions.
3. IMMEDIATE DANGER DETECTION: If the user states or implies they are in immediate physical danger (e.g. "someone is following me right now", "he is trying to break in", "I am hiding in a bathroom", "they took my passport", "I am in a taxi that changed route"):
   - Put EMERGENCY HELPLINES at the very top:
     🚨 PAN-INDIA EMERGENCY: 112 | WOMEN HELPLINE: 1091 | NCW WHATSAPP: 7827170170 (US: 911 | UK: 999)
   - Strongly urge them to press the red SOS button immediately or call 112.
   - Advise discreet, urgent survival actions (move towards well-lit public areas, open stores, make noise, stay on an open phone line).
4. SAFETY PLANNING: Provide practical, step-by-step guidance for:
   - Domestic violence exit strategies (code words with trusted friends, packing emergency grab-bags with documents, hiding spare keys/cash, clearing browser history).
   - Commuting safely late at night (sharing live tracking tokens, verifying taxi license plates against the app, staying in middle train coaches).
   - Cyber harassment & stalking (documenting without deleting, taking full-screen screenshots with URLs and timestamps, locking down social media privacy, checking for hidden AirTags or stalkerware).
   - Recognizing subtle warning signs of trafficking and coercive control (forced isolation, confiscated phone/documents, promises of unrealistic jobs away from home).
5. INCIDENT DOCUMENTATION: Help users structure objective incident descriptions (5 Ws: Who, What, When, Where, Why/How) suitable for filing a police FIR (First Information Report) or legal aid consultation.
6. TONE: Calm, validating, respectful, clear, and reassuring without being patronizing. Use short readable paragraphs and bullet points.`;

export async function generateSafetyGuidance(prompt: string, history: Array<{ sender: 'user' | 'assistant'; content: string }> = []): Promise<{
  text: string;
  isEmergencyAlert: boolean;
  suggestedActions: string[];
}> {
  const client = getAIClient();

  // Basic client-side emergency trigger detection
  const lowerPrompt = prompt.toLowerCase();
  const emergencyKeywords = ['following me', 'breaking in', 'in danger', 'help me now', 'trapped', 'stalker behind', 'kidnap', 'chasing me', 'emergency', 'attack'];
  const isEmergency = emergencyKeywords.some(k => lowerPrompt.includes(k));

  if (!client) {
    // Graceful offline / fallback response if API key is not configured
    let fallbackText = `**Yuki Safety Response:**\n\n`;
    if (isEmergency) {
      fallbackText += `🚨 **IMMEDIATE EMERGENCY ASSISTANCE REQUIRED**\nIf you are in immediate danger, please do not wait:\n- **Call National Police Emergency: 112**\n- **Call Women Helpline: 1091**\n- **Press the Red SOS button in this app to alert your trusted contacts with your live location.**\n\nSeek shelter in the nearest well-lit public area, open shop, or bank ATM with security guards.`;
    } else {
      fallbackText += `For safety guidance regarding travel, digital privacy, or domestic concerns:\n- Keep your trusted contacts updated on your route.\n- If you notice suspicious activity, make a discrete note of timestamps and physical descriptions.\n- Dial **181** for Women's Crisis support or **1930** for cyber harassment.`;
    }
    return {
      text: fallbackText,
      isEmergencyAlert: isEmergency,
      suggestedActions: isEmergency
        ? ['Trigger One-Tap SOS Now', 'Call 112 Emergency', 'Call 1091 Women Helpline']
        : ['Create Domestic Safety Plan', 'Check Cyber Stalking Signs', 'Prepare Incident Report']
    };
  }

  try {
    // Construct prompt context with prior chat history
    let contents = '';
    if (history.length > 0) {
      contents += 'Prior Conversation Context:\n';
      history.slice(-4).forEach(h => {
        contents += `${h.sender.toUpperCase()}: ${h.content}\n`;
      });
      contents += `\nUser's Current Inquiry: ${prompt}`;
    } else {
      contents = prompt;
    }

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3, // Lower temperature for calm, consistent, reliable safety advice
      }
    });

    const responseText = response.text || 'Unable to generate response. If you are in distress, please dial 112 or 1091 immediately.';

    // Derive suggested action chips
    const suggestedActions: string[] = [];
    if (isEmergency) {
      suggestedActions.push('Trigger SOS Now', 'Call 112 Emergency', 'Send Live Location to Contacts');
    } else if (lowerPrompt.includes('stalk') || lowerPrompt.includes('follow') || lowerPrompt.includes('cyber')) {
      suggestedActions.push('Document in Incident Vault', 'Check for Hidden Tracking Devices', 'Call 1930 Cyber Helpline');
    } else if (lowerPrompt.includes('domestic') || lowerPrompt.includes('abuse') || lowerPrompt.includes('home')) {
      suggestedActions.push('Prepare Emergency Exit Bag', 'Call 181 One-Stop Center', 'Contact NCW at 7827170170');
    } else {
      suggestedActions.push('Draft Incident Report', 'Start Walk-With-Me Timer', 'View Verified Helplines');
    }

    return {
      text: responseText,
      isEmergencyAlert: isEmergency,
      suggestedActions
    };
  } catch (error: any) {
    console.error('Error querying Gemini API for safety guidance:', error);
    return {
      text: `🚨 **Emergency Safety Protocol Active**\n\nWe encountered a connection delay to the AI advisor. **If you are in immediate danger, please dial 112 or 1091 right away, or tap the SOS button to alert your verified emergency contacts.**`,
      isEmergencyAlert: true,
      suggestedActions: ['Trigger One-Tap SOS', 'Call 112', 'Call 1091 Women Helpline']
    };
  }
}
