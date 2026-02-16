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
  const logContainerRef = useRef(null);

  const {
    isConnected,
    status,
    messages,
    partialTranscript,
    ragSources,
    isAgentSpeaking,
    logs,
    isMuted,
    startCall,
    stopCall,
    toggleMic,
    updatePrompt
  } = useVoiceAgent();

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, partialTranscript]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

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
      {/* Sidebar: Navigation & Utility */}
      <aside>
        <div style={{ marginBottom: '2rem' }}>
          <h1 className="logo-text" style={{ fontSize: '1.8rem', textAlign: 'left' }}>Assessment</h1>
          <p className="subtitle" style={{ fontSize: '0.8rem', textAlign: 'left' }}>Voice AI Platform</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* KB Section */}
          <section>
            <h2 className="flex-row mb-4" style={{ fontSize: '1rem', justifyContent: 'flex-start', color: 'var(--text-primary)' }}>
              <FileUp size={18} className="text-secondary" />
              Knowledge Base
            </h2>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              accept=".txt,.md"
            />
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', background: 'rgba(255,255,255,0.05)' }}
              onClick={() => fileInputRef.current.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="animate-spin" size={14} /> : <FileUp size={14} />}
              {isUploading ? 'Ingesting...' : 'Upload Data'}
            </button>
            <AnimatePresence>
              {uploadStatus && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{
                    marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.5rem',
                    background: uploadStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    borderRadius: '8px', color: uploadStatus.type === 'success' ? 'var(--success)' : 'var(--error)'
                  }}
                >
                  {uploadStatus.message}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Logs Section */}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 className="flex-row mb-4" style={{ fontSize: '1rem', justifyContent: 'flex-start', color: 'var(--text-primary)' }}>
              <Settings size={18} className="text-secondary" />
              System Logs
            </h2>
            <div className="system-logs-container" ref={logContainerRef} style={{ flex: 1, height: 'auto', fontSize: '0.7rem' }}>
              {logs.map((log, i) => (
                <div key={i} className={`log-entry ${log.type === 'error' ? 'log-msg-error' : ''}`}>
                  <span className="log-time" style={{ fontSize: '0.65rem' }}>{log.time}</span>
                  <span className="log-msg" style={{ marginLeft: '4px' }}>{log.msg}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* Main Content Area */}
      <main>
        <div className="dashboard-header">
          <div className="flex-row">
            <div className={`status-badge ${isConnected ? 'status-online' : 'status-offline'}`}>
              {status === 'connected' ? '● System Online' : '○ System Idle'}
            </div>
          </div>
          <div className="flex-row" style={{ gap: '1rem' }}>
            {isConnected && (
              <button
                className={`btn ${isMuted ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleMic}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            {!isConnected ? (
              <button className="btn btn-primary" onClick={() => startCall(systemPrompt, language)} disabled={status === 'connecting'}>
                <Mic size={18} /> Start Voice Session
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopCall}>
                <MicOff size={18} /> Terminate Session
              </button>
            )}
          </div>
        </div>

        <section className="glass-card control-panel">
          <div className="interaction-grid">
            <div className="voice-section">
              <label style={{ fontSize: '0.75rem', opacity: 0.5, letterSpacing: '0.1rem' }}>VOICE FREQUENCY</label>
              <Visualizer />
            </div>

            <div className="settings-section" style={{ borderLeft: '1px solid var(--glass-border)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Agent Persona</label>
                <textarea
                  value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3} style={{ fontSize: '0.85rem' }}
                />
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', padding: '0.5rem' }} onClick={handleUpdatePrompt}>
                Apply Configuration
              </button>
            </div>
          </div>
        </section>

        {/* Transcript Area: Defined Height with internal scroll */}
        <section className="glass-card" style={{ height: '450px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="flex-row mb-4" style={{ padding: '0 1rem' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Live Conversation</h2>
          </div>
          <div className="transcript-area" style={{ flex: 1, background: 'rgba(0,0,0,0.1)', borderRadius: '16px', overflowY: 'auto' }}>
            {messages.length === 0 && !partialTranscript && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                <MessageSquare size={48} style={{ marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.9rem' }}>Begin a session to see real-time transcription</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`message ${msg.role === 'user' ? 'msg-user' : 'msg-agent'}`}>
                {msg.text}
              </motion.div>
            ))}
            {partialTranscript && (
              <div className="partial-transcript">{partialTranscript}...</div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </section>

        {/* RAG Sources: Floating footer when available */}
        <AnimatePresence>
          {ragSources.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              <div className="glass-card" style={{ padding: '1rem', borderTop: '2px solid var(--accent-primary)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Retrieved Context</h3>
                <div className="sources-container" style={{ flexDirection: 'row', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {ragSources.map((source, i) => (
                    <div key={i} className="source-item" style={{ minWidth: '250px', flex: '0 0 auto' }}>
                      <div className="source-title">{source.source}</div>
                      <div style={{ opacity: 0.8 }}>{source.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

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
