import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Type, SchemaType } from '@google/genai';

export interface Question {
  question: string;
  options: string[];
  answer: number; // Index 0-3
}

export interface QuizModule {
  id: string;
  title: string;
  content: string;
  questions: Question[];
  highScore: number;
}

export interface ImagePart {
  data: string; // Base64 string
  mimeType: string;
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private genAI: GoogleGenAI;

  // State Signals
  currentUser = signal<string | null>(null);
  modules = signal<QuizModule[]>([]);
  currentModule = signal<QuizModule | null>(null);
  
  // Mock Data for Demo
  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: process.env['API_KEY']! });
    
    // Add a demo module
    this.modules.set([
      {
        id: '1',
        title: 'Capital Cities',
        content: 'Demo content about capitals.',
        highScore: 850,
        questions: [
          { question: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], answer: 2 },
          { question: 'What is the capital of Japan?', options: ['Beijing', 'Seoul', 'Bangkok', 'Tokyo'], answer: 3 },
          { question: 'What is the capital of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], answer: 2 }
        ]
      }
    ]);
  }

  login(username: string) {
    this.currentUser.set(username);
  }

  logout() {
    this.currentUser.set(null);
  }

  async generateQuiz(title: string, textContent: string, images: ImagePart[] = [], questionCount: number = 5): Promise<QuizModule> {
    const parts: any[] = [];

    // Construct the prompt
    const promptText = `You are an expert study aid generator. 
    Analyze the provided content (text notes and/or images of tests/reviews).
    Identify the most important concepts, facts, and questions.
    Generate a set of ${questionCount} distinct, high-quality multiple-choice questions based on this information.
    
    If images are provided, extract the questions or information directly from them.
    
    Text Context: "${textContent.substring(0, 5000)}"`;

    // Add text part
    parts.push({ text: promptText });

    // Add image parts
    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      });
    });

    try {
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING }
                },
                answer: { 
                  type: Type.INTEGER, 
                  description: "The zero-based index (0, 1, 2, or 3) of the correct option." 
                }
              },
              required: ["question", "options", "answer"]
            }
          }
        }
      });

      const rawText = response.text || '[]';
      const questions = JSON.parse(rawText) as Question[];

      const newModule: QuizModule = {
        id: Date.now().toString(),
        title,
        content: textContent.substring(0, 100) + (images.length ? ` (+ ${images.length} images)` : ''),
        questions,
        highScore: 0
      };

      this.modules.update(mods => [newModule, ...mods]);
      return newModule;

    } catch (error) {
      console.error('Error generating quiz:', error);
      throw error;
    }
  }

  updateScore(moduleId: string, score: number) {
    this.modules.update(mods => mods.map(m => {
      if (m.id === moduleId) {
        return { ...m, highScore: Math.max(m.highScore, score) };
      }
      return m;
    }));
  }
}