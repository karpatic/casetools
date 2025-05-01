import { callChatGPT } from './gpt.js';

async function processMessage(conversation, sessionId) {
  try {
    // Send the full conversation context to GPT
    const response = await callChatGPT(conversation, false);
    return response;
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I encountered an error processing your request.";
  }
}

function initializeChat(initialContext) {
  return [{ role: 'system', content: initialContext }];
}

export { processMessage, initializeChat };
