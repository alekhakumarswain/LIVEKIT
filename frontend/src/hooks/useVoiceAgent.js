import { useState, useRef, useCallback, useEffect } from 'react';
import * as LivekitClient from 'livekit-client';

const BACKEND_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const LIVEKIT_URL = 'wss://assesment-56xzmjy9.livekit.cloud';

export const useVoiceAgent = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [messages, setMessages] = useState([]);
    const [partialTranscript, setPartialTranscript] = useState('');
    const [ragSources, setRagSources] = useState([]);
    const [status, setStatus] = useState('disconnected'); // disconnected, connecting, connected
    const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

    const roomRef = useRef(null);
    const wsRef = useRef(null);
    const audioContextRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const currentSourceRef = useRef(null);

    const cleanup = useCallback(() => {
        if (roomRef.current) roomRef.current.disconnect();
        if (wsRef.current) wsRef.current.close();
        if (audioContextRef.current) audioContextRef.current.close();

        setIsConnected(false);
        setStatus('disconnected');
        setIsAgentSpeaking(false);
        setPartialTranscript('');
        setRagSources([]);
        audioQueueRef.current = [];
        isPlayingRef.current = false;
    }, []);

    const playNextAudio = async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsAgentSpeaking(false);
            return;
        }

        isPlayingRef.current = true;
        setIsAgentSpeaking(true);
        const audioData = audioQueueRef.current.shift();

        try {
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const buffer = await audioContextRef.current.decodeAudioData(audioData);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => {
                playNextAudio();
            };
            source.start(0);
            currentSourceRef.current = source;
        } catch (e) {
            console.error("Audio Playback Error:", e);
            playNextAudio();
        }
    };

    const setupWebSocket = async (mediaStreamTrack, initialPrompt, language) => {
        const ws = new WebSocket(WS_URL);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to Backend WS");
            ws.send(JSON.stringify({ type: "update_prompt", prompt: initialPrompt }));
            startAudioCapture(mediaStreamTrack, language);
        };

        ws.onmessage = async (event) => {
            if (event.data instanceof ArrayBuffer) {
                audioQueueRef.current.push(event.data);
                if (!isPlayingRef.current) playNextAudio();
            } else {
                const data = JSON.parse(event.data);

                if (data.type === "interrupt") {
                    audioQueueRef.current = [];
                    if (currentSourceRef.current) {
                        currentSourceRef.current.stop();
                        currentSourceRef.current = null;
                    }
                    isPlayingRef.current = false;
                    setIsAgentSpeaking(false);
                    return;
                }

                if (data.type === "transcript") {
                    if (data.isFinal) {
                        setPartialTranscript('');
                        setMessages(prev => [...prev, { role: 'user', text: data.text, timestamp: new Date() }]);
                    } else {
                        setPartialTranscript(data.text);
                    }
                } else if (data.type === "agent_text") {
                    setMessages(prev => [...prev, { role: 'agent', text: data.text, timestamp: new Date() }]);
                } else if (data.type === "rag_sources") {
                    setRagSources(data.sources);
                }
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from Backend WS");
            cleanup();
        };
    };

    const startAudioCapture = async (track, language) => {
        try {
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            await audioContext.resume();

            wsRef.current.send(JSON.stringify({
                type: "config",
                sampleRate: audioContext.sampleRate,
                language: language
            }));

            await audioContext.audioWorklet.addModule('/processor.js');
            const source = audioContext.createMediaStreamSource(new MediaStream([track]));
            const worklet = new AudioWorkletNode(audioContext, 'pcm-processor');

            source.connect(worklet);

            let audioBuffer = [];
            const CHUNKS_PER_SEND = 40;

            worklet.port.onmessage = (e) => {
                audioBuffer.push(e.data);
                if (audioBuffer.length >= CHUNKS_PER_SEND) {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        const combined = new Int16Array(audioBuffer.length * audioBuffer[0].length);
                        let offset = 0;
                        for (const chunk of audioBuffer) {
                            combined.set(chunk, offset);
                            offset += chunk.length;
                        }
                        wsRef.current.send(combined.buffer);
                    }
                    audioBuffer = [];
                }
            };
        } catch (err) {
            console.error("Audio Pipeline Error:", err);
            setStatus('error');
        }
    };

    const startCall = async (initialPrompt, language) => {
        setStatus('connecting');
        try {
            const identity = `user-${Math.floor(Math.random() * 1000)}`;
            const response = await fetch(`${BACKEND_URL}/getToken?identity=${identity}&roomName=demo-room`);
            const { token } = await response.json();

            const room = new LivekitClient.Room();
            roomRef.current = room;
            await room.connect(LIVEKIT_URL, token);
            await room.localParticipant.setMicrophoneEnabled(true);

            const track = Array.from(room.localParticipant.trackPublications.values())
                .find(p => p.kind === 'audio')?.track?.mediaStreamTrack;

            if (track) {
                setupWebSocket(track, initialPrompt, language);
                setIsConnected(true);
                setStatus('connected');
            } else {
                throw new Error("Microphone track not found");
            }
        } catch (error) {
            console.error("Connection Failed:", error);
            setStatus('error');
            cleanup();
        }
    };

    const stopCall = () => {
        cleanup();
    };

    const updatePrompt = (prompt) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "update_prompt",
                prompt: prompt
            }));
        }
    };

    return {
        isConnected,
        status,
        messages,
        partialTranscript,
        ragSources,
        isAgentSpeaking,
        startCall,
        stopCall,
        updatePrompt
    };
};
