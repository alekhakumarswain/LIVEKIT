import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Settings,
  FileUp,
  MessageSquare,
  Info,
  Send,
  Loader2,
  Trash2,
  Volume2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceAgent } from './hooks/useVoiceAgent';

const App = () => {
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful voice assistant. Keep answers concise. Respond in the user\'s language.');
  const [language, setLanguage] = useState('en-IN');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);
  const transcriptEndRef = useRef(null);

  const {
    isConnected,
    status,
    messages,
    partialTranscript,
    ragSources,
    isAgentSpeaking,
    startCall,
    stopCall,
    updatePrompt
  } = useVoiceAgent();

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, partialTranscript]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:3000/upload-kb", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        setUploadStatus({ type: 'success', message: `${file.name} indexed successfully!` });
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      setUploadStatus({ type: 'error', message: "Failed to upload document." });
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleUpdatePrompt = () => {
    updatePrompt(systemPrompt);
  };

  const Visualizer = () => (
    <div className="visualizer-container">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="visualizer-bar"
          animate={{
            height: isAgentSpeaking ? [20, 60, 20] : 20,
            opacity: isAgentSpeaking ? 1 : 0.3
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="app-container">
      {/* Left Column: Chat & Interaction */}
      <main>
        <header>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="logo-text"
          >
            Antigravity Voice
          </motion.h1>
          <p className="subtitle">Real-time WebRTC Agent with RAG</p>
        </header>

        <section className="glass-card mb-6">
          <div className="flex-row mb-4">
            <div className="flex-row">
              <div className={`status-badge ${isConnected ? 'status-online' : 'status-offline'}`}>
                {status}
              </div>
              {isAgentSpeaking && (
                <span className="status-badge status-online" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
                  <Volume2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Agent Speaking
                </span>
              )}
            </div>
            <div className="flex-row" style={{ gap: '0.5rem' }}>
              {!isConnected ? (
                <button
                  className="btn btn-primary"
                  onClick={() => startCall(systemPrompt, language)}
                  disabled={status === 'connecting'}
                >
                  {status === 'connecting' ? <Loader2 className="animate-spin" /> : <Mic size={18} />}
                  {status === 'connecting' ? 'Connecting...' : 'Start Session'}
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  onClick={stopCall}
                >
                  <MicOff size={18} />
                  End Session
                </button>
              )}
            </div>
          </div>

          <div className="visualizer-area" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '2rem' }}>
            <Visualizer />
          </div>

          <div className="transcript-area">
            {messages.length === 0 && !partialTranscript && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                <MessageSquare size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>No messages yet. Start a session and say something!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`message ${msg.role === 'user' ? 'msg-user' : 'msg-agent'}`}
              >
                {msg.text}
              </motion.div>
            ))}
            {partialTranscript && (
              <div className="partial-transcript">
                {partialTranscript}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ...
                </motion.span>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </section>

        <AnimatePresence>
          {ragSources.length > 0 && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card"
            >
              <h2 className="source-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                <Info size={18} /> Knowledge Retrieval (RAG)
              </h2>
              <div className="sources-container">
                {ragSources.map((source, i) => (
                  <div key={i} className="source-item">
                    <div className="source-title" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Source: {source.source}
                    </div>
                    <div>{source.text}</div>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Right Column: Settings & KB */}
      <aside>
        <section className="glass-card mb-6">
          <h2 className="flex-row mb-4" style={{ fontSize: '1.25rem' }}>
            <div className="flex-row" style={{ gap: '0.5rem' }}>
              <Settings size={20} className="text-accent" />
              Settings
            </div>
          </h2>

          <div className="mb-4">
            <label>Language Preset</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isConnected}
            >
              <option value="en-IN">English (India)</option>
              <option value="en-US">English (US)</option>
              <option value="hi-IN">Hindi (India)</option>
              <option value="es-ES">Spanish (Spain)</option>
              <option value="fr-FR">French (France)</option>
            </select>
          </div>

          <div className="mb-4">
            <label>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Define agent behavior..."
              rows={6}
            />
          </div>

          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={handleUpdatePrompt}
          >
            <CheckCircle2 size={16} />
            Update Prompt
          </button>
        </section>

        <section className="glass-card">
          <h2 className="flex-row mb-4" style={{ fontSize: '1.25rem' }}>
            <div className="flex-row" style={{ gap: '0.5rem' }}>
              <FileUp size={20} className="text-secondary" />
              Knowledge Base
            </div>
          </h2>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Upload documents to enrich the agent's knowledge.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            accept=".txt,.md"
          />

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '1rem' }}
            onClick={() => fileInputRef.current.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <FileUp size={16} />}
            {isUploading ? 'Ingesting...' : 'Upload Document'}
          </button>

          <AnimatePresence>
            {uploadStatus && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-row"
                style={{
                  fontSize: '0.8rem',
                  color: uploadStatus.type === 'success' ? 'var(--success)' : 'var(--error)',
                  padding: '0.5rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px'
                }}
              >
                <div className="flex-row" style={{ gap: '4px' }}>
                  {uploadStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {uploadStatus.message}
                </div>
                <button onClick={() => setUploadStatus(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                  <Trash2 size={12} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </aside>

      <style>{`
        .text-accent { color: var(--accent-primary); }
        .text-secondary { color: var(--accent-secondary); }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default App;
