import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Volume2, X, Loader2 } from 'lucide-react'

export default function VoiceInput({ onResult, placeholder = "Press and speak...", language = "en-IN" }) {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [error, setError] = useState('')
    const [isSupported, setIsSupported] = useState(false)
    const recognitionRef = useRef(null)

    useEffect(() => {
        // Check for browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (SpeechRecognition) {
            setIsSupported(true)
            recognitionRef.current = new SpeechRecognition()
            recognitionRef.current.continuous = false
            recognitionRef.current.interimResults = true
            recognitionRef.current.lang = language

            recognitionRef.current.onresult = (event) => {
                let finalTranscript = ''
                let interimTranscript = ''

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i]
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript
                    } else {
                        interimTranscript += result[0].transcript
                    }
                }

                setTranscript(finalTranscript || interimTranscript)

                if (finalTranscript && onResult) {
                    onResult(finalTranscript)
                }
            }

            recognitionRef.current.onerror = (event) => {
                setError(`Voice error: ${event.error}`)
                setIsListening(false)
            }

            recognitionRef.current.onend = () => {
                setIsListening(false)
            }
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [language, onResult])

    const toggleListening = () => {
        if (!isSupported) {
            setError('Voice input not supported in this browser')
            return
        }

        if (isListening) {
            recognitionRef.current.stop()
            setIsListening(false)
        } else {
            setTranscript('')
            setError('')
            recognitionRef.current.start()
            setIsListening(true)
        }
    }

    const clearTranscript = () => {
        setTranscript('')
        setError('')
    }

    if (!isSupported) {
        return null // Don't show if not supported
    }

    return (
        <div className="voice-input-container">
            <button
                className={`voice-btn ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                title={isListening ? 'Stop listening' : 'Start voice input'}
            >
                {isListening ? (
                    <>
                        <div className="pulse-ring"></div>
                        <MicOff size={20} />
                    </>
                ) : (
                    <Mic size={20} />
                )}
            </button>

            {(transcript || isListening) && (
                <div className="voice-transcript">
                    {isListening && <Loader2 size={14} className="spin" />}
                    <span>{transcript || placeholder}</span>
                    {transcript && (
                        <button className="clear-btn" onClick={clearTranscript}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            )}

            {error && <div className="voice-error">{error}</div>}

            <style>{`
        .voice-input-container { display: flex; align-items: center; gap: 12px; }
        
        .voice-btn {
          width: 44px; height: 44px;
          border-radius: 50%;
          border: 2px solid var(--border-default);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all var(--transition-fast);
          position: relative;
        }
        .voice-btn:hover { border-color: var(--primary-400); color: var(--primary-400); }
        .voice-btn.listening { 
          border-color: var(--error); 
          background: rgba(239, 68, 68, 0.1);
          color: var(--error);
        }
        
        .pulse-ring {
          position: absolute;
          width: 100%; height: 100%;
          border-radius: 50%;
          border: 2px solid var(--error);
          animation: pulse 1.5s ease-out infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        
        .voice-transcript {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          color: var(--text-secondary);
          max-width: 300px;
        }
        .clear-btn {
          background: none; border: none; padding: 4px;
          cursor: pointer; color: var(--text-tertiary);
          border-radius: 50%;
        }
        .clear-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
        
        .voice-error { color: var(--error); font-size: 0.75rem; margin-top: 4px; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
        </div>
    )
}
