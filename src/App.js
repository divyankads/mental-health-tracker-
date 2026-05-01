
import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import WebcamDetector from './WebcamDetector';
import './App.css';

const MOODS = [
  { emoji: '😢', label: 'Sad', value: 'sad' },
  { emoji: '😕', label: 'Anxious', value: 'anxious' },
  { emoji: '😐', label: 'Neutral', value: 'neutral' },
  { emoji: '🙂', label: 'Good', value: 'good' },
  { emoji: '🌟', label: 'Great', value: 'great' }
];

const COPING_RESOURCES = [
  {
    title: '4-7-8 Breathing',
    desc: 'Inhale for 4s, hold for 7s, exhale for 8s. Helps reduce anxiety.'
  },
  {
    title: '5-4-3-2-1 Grounding',
    desc: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.'
  },
  {
    title: 'Self-Compassion Break',
    desc: 'Acknowledge this is a moment of suffering, and remind yourself you are not alone.'
  }
];

function App() {
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [aiAdvice, setAiAdvice] = useState('');
  const [showWebcam, setShowWebcam] = useState(false);

  const handleWebcamMood = (mood) => {
    setSelectedMood(mood);
    setShowWebcam(false);
  };

  const analyzeMoodWithAI = async () => {
    if (!note.trim()) {
      alert("Please write a journal entry first so the AI can analyze your mood!");
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const apiKey = process.env.REACT_APP_Groq_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || "YOUR_GROQ_API_KEY";
      if (apiKey === "YOUR_GROQ_API_KEY") {
        alert("Please add your API key to your .env file as REACT_APP_Groq_API_KEY to use AI.");
        setIsAnalyzing(false);
        return;
      }

      const prompt = `Analyze this journal entry and determine the author's primary mood. 
      Return ONLY ONE of these exact words that best fits: sad, anxious, neutral, good, great.
      Do not include any punctuation or extra text.
      Entry: "${note}"`;
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || response.statusText;
        throw new Error(`Groq API error (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      const responseText = data.choices[0].message.content.trim().toLowerCase();
      
      // Clean up response if the model added punctuation
      const cleanResponse = responseText.replace(/[^a-z]/g, '');
      const matchedMood = MOODS.find(m => m.value === cleanResponse);
      
      if (matchedMood) {
        setSelectedMood(matchedMood);
      } else {
        alert(`AI guessed: "${cleanResponse}", which didn't perfectly match our list.`);
      }
    } catch (error) {
      console.error("AI Error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateCopingStrategy = async () => {
    if (!selectedMood && !note.trim()) {
      alert("Please select a mood or write a journal entry first so the AI can help you!");
      return;
    }
    
    setIsGeneratingAdvice(true);
    try {
      const apiKey = process.env.REACT_APP_Groq_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || "YOUR_GROQ_API_KEY";
      if (apiKey === "YOUR_GROQ_API_KEY") {
        alert("Please add your API key to your .env file as REACT_APP_Groq_API_KEY.");
        setIsGeneratingAdvice(false);
        return;
      }

      const currentMoodText = selectedMood ? `I am feeling ${selectedMood.label}.` : '';
      const prompt = `${currentMoodText} Here is my journal entry: "${note}".
      Provide a short, empathetic 2-3 sentence piece of advice or coping strategy on how to deal with this feeling or maintain it. Do not use markdown.`;
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || response.statusText;
        throw new Error(`Groq API error (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      setAiAdvice(data.choices[0].message.content.trim());
    } catch (error) {
      console.error("AI Error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  // Load entries from Firestore on mount
  useEffect(() => {
    try {
      const q = query(collection(db, 'entries'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const entriesData = [];
        querySnapshot.forEach((doc) => {
          entriesData.push({ id: doc.id, ...doc.data() });
        });
        setEntries(entriesData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching entries:", error);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase is likely not configured yet:", error);
      setLoading(false);
    }
  }, []);

  const handleSaveEntry = async () => {
    if (!selectedMood && !note.trim()) return;

    const newEntry = {
      mood: selectedMood || null,
      note: note.trim(),
      advice: aiAdvice,
      date: new Date().toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: Date.now()
    };

    try {
      await addDoc(collection(db, 'entries'), newEntry);
      
      // Reset form
      setSelectedMood(null);
      setNote('');
      setAiAdvice('');
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to save entry. Make sure Firebase is configured correctly.");
    }
  };

  const moodValues = { sad: 1, anxious: 2, neutral: 3, good: 4, great: 5 };
  
  const chartData = [...entries]
    .filter(entry => entry.mood)
    .reverse() // Oldest to newest for the graph
    .map(entry => ({
      date: entry.date.split(',')[0], // Extract just the date part
      moodValue: moodValues[entry.mood.value],
      emoji: entry.mood.emoji
    }));

  return (
    <>
      <div className="app-container">
        <header>
          <h1>Mental Health Tracker</h1>
          <div className="subtitle">Your safe space for reflection and growth</div>
        </header>

      <div className="dashboard">
        {/* Left Column: Input */}
        <div className="input-section" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="card">
            <h2>How are you feeling right now?</h2>
            <div className="mood-selector">
              {MOODS.map((mood) => (
                <button
                  key={mood.value}
                  className={`mood-btn ${selectedMood?.value === mood.value ? 'selected' : ''}`}
                  onClick={() => setSelectedMood(mood)}
                  title={mood.label}
                >
                  {mood.emoji}
                </button>
              ))}
            </div>

            <div style={{ margin: '1.5rem 0' }}>
              <button
                className="ai-btn"
                onClick={() => setShowWebcam(true)}
                style={{
                  background: 'transparent', border: '1px dashed var(--accent-base)',
                  color: 'var(--accent-base)', padding: '0.8rem 1rem',
                  borderRadius: '0.8rem', cursor: 'pointer', width: '100%',
                  fontSize: '1rem', transition: 'all 0.3s ease'
                }}
              >
                📷 Detect via Webcam (CNN · runs in browser)
              </button>
            </div>

            <h2>Journal Entry</h2>
            <textarea
              className="journal-input"
              placeholder="What's on your mind? Write it down here..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button 
              className="ai-btn" 
              onClick={analyzeMoodWithAI}
              disabled={isAnalyzing || !note.trim()}
              style={{ 
                marginBottom: '1rem', 
                background: 'rgba(34, 197, 94, 0.1)', 
                color: 'var(--text-primary)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '0.8rem',
                padding: '0.8rem 1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                fontSize: '1rem',
                transition: 'all 0.3s ease'
              }}
            >
              {isAnalyzing ? '🧠 Analyzing...' : '🧠 Detect Mood with AI'}
            </button>

            <button 
              className="save-btn" 
              onClick={handleSaveEntry}
              disabled={!selectedMood && !note.trim()}
              style={{ opacity: (!selectedMood && !note.trim()) ? 0.5 : 1 }}
            >
              Save Entry
            </button>
          </div>

          <div className="card" style={{ border: '2px solid var(--accent-base)', background: 'rgba(34, 197, 94, 0.05)' }}>
            <h2 style={{ color: 'var(--accent-base)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💡 AI Coping Coach
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Want personalized advice on how to handle your current mood?
            </p>
            <button 
              className="ai-btn" 
              onClick={generateCopingStrategy}
              disabled={isGeneratingAdvice || (!note.trim() && !selectedMood)}
              style={{ 
                background: 'rgba(34, 197, 94, 0.1)', 
                color: 'var(--text-primary)',
                border: '1px solid var(--accent-base)',
                borderRadius: '0.8rem',
                padding: '0.8rem 1rem',
                cursor: 'pointer',
                width: '100%',
                fontSize: '1rem',
                transition: 'all 0.3s ease'
              }}
            >
              {isGeneratingAdvice ? 'Generating Advice...' : '💡 Get Coping Strategy'}
            </button>
            
            {aiAdvice && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.8rem' }}>
                <p style={{ lineHeight: 1.6, fontSize: '1.05rem', margin: 0 }}>
                  {aiAdvice}
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <h2>Quick Coping Tools</h2>
            <ul className="resources-list">
              {COPING_RESOURCES.map((resource, index) => (
                <li key={index} className="resource-item">
                  <div className="resource-title">{resource.title}</div>
                  <p className="resource-desc">{resource.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: History & Stats */}
        <div className="stats-section" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="card">
            <h2>📊 Mood Trends</h2>
            {chartData.length > 0 ? (
              <div style={{ height: '250px', width: '100%', marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis 
                      domain={[1, 5]} 
                      ticks={[1, 2, 3, 4, 5]} 
                      stroke="var(--text-secondary)"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', color: '#000', borderRadius: '10px' }}
                      formatter={(value, name, props) => [props.payload.emoji, 'Mood']}
                      labelStyle={{ color: '#000' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="moodValue" 
                      stroke="var(--accent-base)" 
                      strokeWidth={3}
                      dot={{ r: 5, fill: 'var(--accent-base)' }}
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">Not enough data to generate a graph yet. Save some entries!</div>
            )}
          </div>

          <div className="card">
            <h2>📜 Recent Check-ins</h2>
          {loading ? (
            <div className="empty-state">
              Loading entries from Firebase...
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              No entries yet. Start by tracking how you feel today.
            </div>
          ) : (
            <div className="history-list">
              {entries.map((entry) => (
                <div key={entry.id} className="history-item">
                  <div className="history-mood">
                    {entry.mood ? entry.mood.emoji : '📝'}
                  </div>
                  <div className="history-content">
                    <div className="history-date">{entry.date}</div>
                    {entry.note && <p className="history-note">{entry.note}</p>}
                    {entry.advice && (
                      <div style={{ marginTop: '0.8rem', padding: '0.8rem', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '0.5rem', fontSize: '0.9rem', borderLeft: '3px solid var(--accent-base)' }}>
                        <strong>💡 AI Tip:</strong> {entry.advice}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>

      {showWebcam && (
        <WebcamDetector
          onMoodDetected={handleWebcamMood}
          onClose={() => setShowWebcam(false)}
        />
      )}
    </>
  );
}

export default App;
