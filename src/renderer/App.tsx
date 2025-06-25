import React, { useState } from 'react';
import { EnhancedSearchInterface } from './components/EnhancedSearchInterface';
import { MusicPlayer } from './components/MusicPlayer';
import { QueueManager } from './components/QueueManager';

/**
 * Week 4 Day 1: Main Application Component
 * 
 * Integrates the enhanced search interface with all
 * Week 3 features into the main application.
 */
function App() {
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="flex-1 flex flex-col">
        <div className="container mx-auto px-4 py-8 flex-1">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                2SEARX2COOL Music Library
              </h1>
              <p className="text-gray-600 mt-2">
                Your personal music library with intelligent search and scoring
              </p>
            </div>
            
            {/* Queue toggle button */}
            <button
              onClick={() => setIsQueueVisible(!isQueueVisible)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isQueueVisible 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300 shadow-sm`}
              title="Toggle queue"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Queue
              </div>
            </button>
          </header>
          
          <main className="flex-1 pb-32">
            <EnhancedSearchInterface />
          </main>
        </div>
        
        {/* Music Player - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <MusicPlayer />
        </div>
      </div>
      
      {/* Queue Manager - Slide-out panel */}
      <QueueManager 
        isVisible={isQueueVisible}
        onClose={() => setIsQueueVisible(false)}
      />
      
      {/* Footer */}
      <footer className="py-4 border-t border-gray-200 text-center text-sm text-gray-500 bg-white">
        <p>Powered by ACRCloud, SearXNG, and your listening habits</p>
      </footer>
    </div>
  );
}

export default App;