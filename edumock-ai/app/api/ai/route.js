import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

// Initialize Hugging Face client
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export async function POST(request) {
  try {
    // 1. Parse the request body
    const body = await request.json();
    const { question, correctAnswer, options } = body;

    // 2. Validate required fields
    if (!question || !correctAnswer) {
      return NextResponse.json(
        { error: 'Question and correct answer are required.' },
        { status: 400 }
      );
    }

    // 3. Create the prompt for the AI
    const prompt = `You are an expert educational assistant. Provide a clear, concise explanation for why the correct answer is right.

Question: ${question}

${options ? `Options:
${options.join('\n')}` : ''}

Correct Answer: ${correctAnswer}

Explanation (keep it under 100 words):`;

    // 4. Call Hugging Face Inference API
    const response = await hf.textGeneration({
      model: 'microsoft/Phi-3-mini-4k-instruct',
      inputs: prompt,
      parameters: {
        max_new_tokens: 150,
        temperature: 0.3,
        return_full_text: false,
      },
    });

    // 5. Clean up the response
    let explanation = response.generated_text.trim();
    
    // Remove any leftover prompt text if present
    if (explanation.includes('Explanation:')) {
      explanation = explanation.split('Explanation:')[1].trim();
    }

    // 6. Return the explanation
    return NextResponse.json({
      explanation: explanation,
      question: question,
      correctAnswer: correctAnswer,
    });

  } catch (error) {
    console.error('AI explanation error:', error);
    
    // Return a fallback message if AI fails
    return NextResponse.json(
      { 
        error: 'Failed to generate explanation. Please try again.',
        explanation: 'The correct answer is: ' + (body?.correctAnswer || 'N/A'),
      },
      { status: 500 }
    );
  }
}