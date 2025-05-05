// Function to encode the image buffer to base64
function encodeImageToBase64(imageBuffer) {
  return Buffer.from(imageBuffer).toString('base64');
}

// Function to get API key from localStorage
function getApiKey() {
  return localStorage.getItem('apiKey');
}

async function callVisionGPT(imagePaths, system = false, user = false, json = false) {
  console.log('callVisionGPT:', imagePaths);
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('API key not found in localStorage');
    }

    // Map over the imagePaths to read and encode each image as a base64 string if not already base64
    const imageUrls = await Promise.all(imagePaths.map(async (imagePath) => {
      if (imagePath.startsWith('data:image')) {
        return imagePath;
      } else { 
        const response = await fetch(imagePath);
        const imageBuffer = await response.arrayBuffer();
        const base64Image = encodeImageToBase64(imageBuffer);
        return `data:image/jpeg;base64,${base64Image}`;
      }
    }));

    const body = {
      model: 'gpt-4o',
      messages: [
        { role: 'system',
          content: [
            { type: 'text', 
              text: system || `You are a helpful vision assistant.`
            }
          ]
        },
        { role: 'user',
          content: [
            ...imageUrls.map(url => ({
              type: 'image_url',
              image_url: { url: url, }
            })),
            { type: 'text',
              text: user || `Extract all the text from the images. Do not leave anything out.`
            }
          ]
        }
      ],
      response_format: json ? { type: 'json_object' } : { type: 'text' },
      temperature: 1,
      max_completion_tokens: 4048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // Return the result from GPT
    let resp;
    try {
      resp = data.choices[0].message.content;
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      resp = { error: 'Error parsing response' };
    } 
    return resp;
  } catch (error) {
    console.error('Error with GPT Vision API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

async function callChatGPT(messages, json = true) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('API key not found in localStorage');
    }

    const body = {
      model: "gpt-4.1",
      messages: messages,
      max_tokens: 4000,
      temperature: 0,
      response_format: json ? { type: "json_object" } : { type: "text" }
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    let resp = data.choices[0].message.content;

    if (json) {
      try {
        resp = JSON.parse(resp);
      } catch (parseError) {
        console.error('Error parsing JSON response:', resp);
        throw parseError;
      }
    }

    return resp;
  } catch (error) {
    console.error('Error with ChatGPT API:', error);
    throw error;
  }
}

export { callChatGPT, callVisionGPT };
