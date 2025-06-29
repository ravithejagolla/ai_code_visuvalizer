import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css';
import ReactDiffViewer from "react-diff-viewer";
import './App.css';

const PARAGRAPH_BREAK_TOKEN = "__PARAGRAPH_BREAK__";

function App() {
  const [code, setCode] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [requestType, setRequestType] = useState('explain');
  const [response, setResponse] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlightedLines, setHighlightedLines] = useState([]);

  const imageRef = useRef(null);
  const [imageLoading, setImageLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/code/history`);
      setHistory(res.data.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);
    setHighlightedLines([]);

    const payload = { requestType };
    if (requestType === 'generateImage') {
      if (!imagePrompt.trim()) {
        setError('Please enter an image prompt.');
        setLoading(false);
        return;
      }
      payload.imagePrompt = imagePrompt.trim();
      setImageLoading(true);
    } else {
      if (!code.trim()) {
        setError('Please enter some code.');
        setLoading(false);
        return;
      }
      payload.code = code.trim();
    }

    try {
      const res = await axios.post(`http://localhost:5000/api/code/process`, payload);
      setResponse(res.data.data);
      setHighlightedLines(res.data.data.highlights || []);
      fetchHistory();
    } catch (err) {
      console.error('Error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'An unexpected error occurred.');
      setImageLoading(false);
    } finally {
      setLoading(false);
      if (requestType !== 'generateImage') {
        setImageLoading(false);
      }
    }
  };

  const renderAsParagraphs = (text) => {
    if (!text) return null;
    return text.split(PARAGRAPH_BREAK_TOKEN).map((p, i) => (
      <p key={i} style={{ marginTop: i > 0 ? '1rem' : 0 }}>{p.trim()}</p>
    ));
  };

  const highlightCode = (codeToHighlight) => {
    const lines = codeToHighlight.split('\n');
    const lang = languages.javascript || languages.clike;
    let highlightedHtml = '';

    lines.forEach((line, index) => {
      const isHighlighted = highlightedLines.some(range =>
        index + 1 >= range.start_line && index + 1 <= range.end_line
      );
      const lineClass = isHighlighted ? 'bg-highlight' : '';
      const lineContent = highlight(line, lang, 'javascript');
      highlightedHtml += `<span class="editor-line ${lineClass}">${lineContent}</span>\n`;
    });

    return (
      <pre className="language-javascript" style={{ margin: 0, padding: 0 }}>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    );
  };

  return (
    <div className="container">
      <header>
        <h1>AI Code Visualizer</h1>
      </header>

      <main>
        <section>
          <h2>{requestType === 'generateImage' ? 'Enter Image Prompt' : 'Enter Your Code'}</h2>
          <form onSubmit={handleSubmit}>
            {requestType === 'generateImage' ? (
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder="Describe the image you want to generate."
                className="textarea"
              />
            ) : (
              <div className="code-editor">
                <Editor
                  value={code}
                  onValueChange={setCode}
                  highlight={highlightCode}
                  padding={16}
                  textareaClassName="textarea"
                  style={{
                    fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
                    fontSize: 14,
                    lineHeight: '1.5em',
                    minHeight: '20rem',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <select
                value={requestType}
                onChange={(e) => {
                  setRequestType(e.target.value);
                  setResponse(null);
                  setHighlightedLines([]);
                  setError(null);
                  setImageLoading(false);
                }}
                className="select-control"
              >
                <option value="explain">Explain Code</option>
                <option value="improve">Improve Code</option>
                <option value="debug">Find Bugs</option>
                <option value="test">Generate Tests</option>
                <option value="generateImage">Generate Image</option>
              </select>
              <button type="submit" disabled={loading}>
                {loading ? 'Processing...' : (requestType === 'generateImage' ? 'Generate Image' : 'Analyze Code')}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2>AI Response</h2>
          {loading && !response && <p style={{ fontWeight: 'bold', color: '#2563eb' }}>Getting insights from AI...</p>}
          {error && <p style={{ fontWeight: 'bold', color: 'red' }}>Error: {error}</p>}

          {response && (
            <div className="response-box">
              {response.generatedImage ? (
                <>
                  <h3>Generated Image:</h3>
                  {imageLoading ? (
                    <div style={{ textAlign: 'center', minHeight: '200px' }}>
                      <p style={{ fontWeight: 'bold', color: '#2563eb' }}>Generating image...</p>
                    </div>
                  ) : (
                    <div className="image-wrapper">
                      <img
                        ref={imageRef}
                        src={`data:image/png;base64,${response.generatedImage}`}
                        alt={response.imagePrompt || "Generated by AI"}
                        onLoad={() => setImageLoading(false)}
                        onError={() => {
                          setImageLoading(false);
                          if (imageRef.current) {
                            imageRef.current.src = "https://placehold.co/400x300/e0e0e0/555555?text=Image+Failed+to+Load";
                          }
                        }}
                      />
                      {response.imagePrompt && (
                        <p className="text-muted">Prompt: "{response.imagePrompt}"</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(requestType === 'improve' || requestType === 'debug') && response.modifiedCode ? (
                    <>
                      <h3>Code Changes:</h3>
                      <ReactDiffViewer
                        oldValue={code}
                        newValue={response.modifiedCode}
                        splitView={true}
                        showDiffOnly={false}
                        useLines={true}
                        leftTitle="Original Code"
                        rightTitle="AI Suggested Code"
                      />
                      <h3>{requestType === 'improve' ? 'Improvements Explanation:' : 'Bugs Explanation:'}</h3>
                      {renderAsParagraphs(response.improvements || response.bugs)}
                    </>
                  ) : requestType === 'test' && response.testCases ? (
                    <>
                      <h3>Generated Test Cases:</h3>
                      <pre className="response-box">{response.testCases}</pre>
                    </>
                  ) : (
                    <>
                      <h3>Explanation:</h3>
                      {renderAsParagraphs(response.explanation)}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {!response && !loading && !error && (
            <p className="text-muted">Submit code to see the AI's response or generated image.</p>
          )}
        </section>
      </main>

      <aside>
        <h2>Recent History</h2>
        {history.length === 0 ? (
          <p className="text-muted">No recent history. Analyze some code or generate an image!</p>
        ) : (
          <ul style={{ padding: 0, listStyle: 'none' }}>
            {history.map((item) => (
              <li key={item.id} className="history-item">
                <div>
                  <strong>{item.requestType.charAt(0).toUpperCase() + item.requestType.slice(1)}:</strong>{' '}
                  {item.requestType === 'generateImage' ? (
                    <span>{item.imagePrompt.slice(0, 60)}{item.imagePrompt.length > 60 ? '...' : ''}</span>
                  ) : (
                    <span style={{ fontFamily: 'monospace' }}>{item.code.slice(0, 60)}{item.code.length > 60 ? '...' : ''}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  ({new Date(item.createdAt).toLocaleString()})
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

export default App;
