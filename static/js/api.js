export async function sendMessage(content, author, history, selectedKeywords) {
  try {
    console.log('Making API request:', { content, author, history, selectedKeywords });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        author,
        history,
        selectedKeywords
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

export async function generateImage(history) {
  try {
    console.log('Requesting image generation');
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history: history,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to generate image:', error);
    throw error;
  }
}
