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
    console.log('Requesting image generation');
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history: history,
        imageHistory: imageHistory,
        systemPrompt: imagePrompt
      })
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
