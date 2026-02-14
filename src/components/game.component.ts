import { Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Question, QuizModule } from '../services/quiz.service';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full bg-slate-900 text-white p-4">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div class="text-xl font-bold bg-white/10 px-4 py-2 rounded-full">
          {{ currentQuestionIndex() + 1 }} / {{ totalQuestions() }}
        </div>
        <div class="text-2xl font-black text-yellow-400">
          {{ score() }} pts
        </div>
      </div>

      <!-- Question Area -->
      <div class="flex-grow flex flex-col justify-center items-center mb-8">
        @if (timeLeft() > 0 && !showFeedback()) {
          <div class="w-full h-2 bg-white/20 rounded-full mb-6 overflow-hidden">
            <div class="h-full bg-purple-500 transition-all duration-1000 linear" 
                 [style.width.%]="(timeLeft() / 15) * 100"></div>
          </div>
        }
        
        <div class="bg-white text-slate-900 p-8 rounded-lg shadow-lg w-full max-w-2xl text-center min-h-[200px] flex items-center justify-center animate-pop">
          <h2 class="text-2xl md:text-3xl font-bold">{{ currentQuestion().question }}</h2>
        </div>
      </div>

      <!-- Options Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto w-full mb-8">
        @for (option of currentQuestion().options; track $index) {
          <button 
            (click)="selectAnswer($index)"
            [disabled]="showFeedback()"
            [class]="getButtonClass($index)"
            class="kahoot-btn p-6 rounded-lg text-xl font-bold text-white text-shadow flex items-center shadow-lg min-h-[80px]">
            
            <!-- Shape Icons -->
            <span class="mr-4 text-2xl opacity-80">
              @if ($index === 0) { ▲ }
              @else if ($index === 1) { ◆ }
              @else if ($index === 2) { ● }
              @else { ■ }
            </span>
            
            <span class="text-left leading-tight">{{ option }}</span>

            @if (showFeedback()) {
              <div class="ml-auto text-2xl">
                 @if ($index === currentQuestion().answer) { ✅ }
                 @else if ($index === selectedAnswerIndex()) { ❌ }
              </div>
            }
          </button>
        }
      </div>

      <!-- Feedback Overlay Message -->
      @if (showFeedback()) {
        <div class="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div class="bg-slate-900/90 p-8 rounded-xl shadow-2xl animate-pop text-center">
             <h3 class="text-4xl font-black mb-2" [class.text-green-500]="isCorrect()" [class.text-red-500]="!isCorrect()">
               {{ isCorrect() ? 'Correct!' : 'Incorrect' }}
             </h3>
             <p class="text-white text-xl mb-4">+{{ pointsEarned() }} points</p>
             <button (click)="nextQuestion()" class="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg kahoot-btn">
               {{ isLastQuestion() ? 'Finish Quiz' : 'Next Question' }}
             </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .text-shadow { text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
  `]
})
export class GameComponent {
  module = input.required<QuizModule>();
  onComplete = output<{score: number, total: number}>();

  // Game State
  currentQuestionIndex = signal(0);
  score = signal(0);
  timeLeft = signal(15);
  showFeedback = signal(false);
  selectedAnswerIndex = signal<number | null>(null);
  pointsEarned = signal(0);
  
  private timer: any;

  // Computed
  currentQuestion = computed(() => this.module().questions[this.currentQuestionIndex()]);
  totalQuestions = computed(() => this.module().questions.length);
  isLastQuestion = computed(() => this.currentQuestionIndex() === this.totalQuestions() - 1);
  isCorrect = computed(() => this.selectedAnswerIndex() === this.currentQuestion().answer);

  // Colors for the 4 buttons (Red, Blue, Yellow, Green)
  private colors = [
    'bg-red-500 hover:bg-red-600',
    'bg-blue-500 hover:bg-blue-600',
    'bg-yellow-500 hover:bg-yellow-600',
    'bg-green-500 hover:bg-green-600'
  ];

  constructor() {
    this.startTimer();
  }

  startTimer() {
    this.timeLeft.set(15);
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.timeLeft() > 0) {
        this.timeLeft.update(t => t - 1);
      } else {
        this.handleTimeout();
      }
    }, 1000);
  }

  handleTimeout() {
    clearInterval(this.timer);
    this.showFeedback.set(true);
    this.pointsEarned.set(0);
  }

  selectAnswer(index: number) {
    if (this.showFeedback()) return;
    
    clearInterval(this.timer);
    this.selectedAnswerIndex.set(index);
    
    // Calculate Score
    if (index === this.currentQuestion().answer) {
      // Base 1000 + time bonus
      const bonus = Math.floor((this.timeLeft() / 15) * 500);
      const points = 1000 + bonus;
      this.pointsEarned.set(points);
      this.score.update(s => s + points);
    } else {
      this.pointsEarned.set(0);
    }

    this.showFeedback.set(true);
  }

  nextQuestion() {
    if (this.isLastQuestion()) {
      this.onComplete.emit({ score: this.score(), total: this.totalQuestions() });
    } else {
      this.currentQuestionIndex.update(i => i + 1);
      this.showFeedback.set(false);
      this.selectedAnswerIndex.set(null);
      this.startTimer();
    }
  }

  getButtonClass(index: number): string {
    const base = this.colors[index % 4];
    
    if (!this.showFeedback()) {
      return base;
    }

    // Feedback State logic
    const correctIndex = this.currentQuestion().answer;
    
    if (index === correctIndex) {
      return 'bg-green-600 ring-4 ring-white scale-105'; // Highlight correct
    }
    
    if (index === this.selectedAnswerIndex() && index !== correctIndex) {
      return 'bg-red-600 opacity-50'; // Highlight wrong selection
    }

    return base + ' opacity-30'; // Dim others
  }
}