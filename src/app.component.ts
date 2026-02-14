import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService, QuizModule } from './services/quiz.service';
import { GameComponent } from './components/game.component';

type ViewState = 'login' | 'dashboard' | 'create' | 'game' | 'result';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, GameComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  quizService = inject(QuizService);
  
  view = signal<ViewState>('login');
  
  // Login Form
  loginUsername = signal('');
  
  // Create Form
  newModuleTitle = signal('');
  newModuleContent = signal('');
  uploadedImages = signal<{data: string, mimeType: string, name: string}[]>([]);
  questionCount = signal(5);
  isGenerating = signal(false);
  
  // Active Game State
  activeModule = signal<QuizModule | null>(null);
  lastScore = signal(0);
  
  login() {
    if (this.loginUsername().trim()) {
      this.quizService.login(this.loginUsername());
      this.view.set('dashboard');
    }
  }

  goToCreate() {
    this.newModuleTitle.set('');
    this.newModuleContent.set('');
    this.uploadedImages.set([]);
    this.questionCount.set(5);
    this.view.set('create');
  }

  backToDashboard() {
    this.view.set('dashboard');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      
      if (file.type.startsWith('image/')) {
        reader.onload = (e: any) => {
           // Extract base64 part
           const result = e.target.result as string;
           const base64String = result.split(',')[1];
           
           this.uploadedImages.update(imgs => [...imgs, {
             data: base64String,
             mimeType: file.type,
             name: file.name
           }]);
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'text/plain') {
        reader.onload = (e: any) => {
          const text = e.target.result;
          // Append text to the content area
          this.newModuleContent.update(c => (c ? c + '\n\n' : '') + `[File: ${file.name}]\n` + text);
        };
        reader.readAsText(file);
      }
    });
    
    // Reset input so same file can be selected again if needed
    input.value = '';
  }

  removeImage(index: number) {
    this.uploadedImages.update(imgs => imgs.filter((_, i) => i !== index));
  }

  async createQuiz() {
    // Allow generation if there is text OR images
    if (!this.newModuleTitle() || (!this.newModuleContent() && this.uploadedImages().length === 0)) return;
    
    this.isGenerating.set(true);
    try {
      await this.quizService.generateQuiz(
        this.newModuleTitle(), 
        this.newModuleContent(),
        this.uploadedImages(),
        Number(this.questionCount())
      );
      this.view.set('dashboard');
    } catch (e) {
      alert('Failed to generate quiz. Please check your inputs and try again.');
      console.error(e);
    } finally {
      this.isGenerating.set(false);
    }
  }

  playModule(module: QuizModule) {
    this.activeModule.set(module);
    this.view.set('game');
  }

  handleGameComplete(result: {score: number, total: number}) {
    this.lastScore.set(result.score);
    if (this.activeModule()) {
      this.quizService.updateScore(this.activeModule()!.id, result.score);
    }
    this.view.set('result');
  }
}