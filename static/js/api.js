export async function sendMessage(content, author, history, selectedKeywords) {
  try {
    const storytellerPrompt = localStorage.getItem('storytellerPrompt') || '';
    console.log('Making API request:', { content, author, history, selectedKeywords, storytellerPrompt });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        author,
        history,
        selectedKeywords,
        systemPrompt: storytellerPrompt
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

export async function generateImage(history, imageHistory) {
  try {
    const imagePrompt = localStorage.getItem('imagePrompt') || '';
    const imageMode = localStorage.getItem('imageGenerationMode') || 'regular';
    console.log('Requesting image generation');
    
    const endpoint = imageMode === 'comfy' ? '/api/image/comfyui' : '/api/image/generate';
    const requestBody = {
      history: history,
      imageHistory: imageHistory,
      systemPrompt: imagePrompt
    };

    // Add ComfyUI specific fields if needed
    if (imageMode === 'comfy') {
      requestBody.workflow = JSON.parse(localStorage.getItem('comfyWorkflow') || '{}');
      requestBody.positivePromptPlaceholder = localStorage.getItem('positivePromptPlaceholder') || '{positive_prompt}';
      requestBody.negativePromptPlaceholder = localStorage.getItem('negativePromptPlaceholder') || '{negative_prompt}';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const data = await response.json();
    
    // Validate response format
    if (!data.urls || !Array.isArray(data.urls) || !data.prompt) {
      throw new Error('Invalid response format from image generation');
    }

    return data;
  } catch (error) {
    console.error('Failed to generate images:', error);
    throw error;
  }
}
