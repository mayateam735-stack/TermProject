import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Send } from "lucide-react";
import { api } from "../api.js";
import { SOURCE_LABELS } from "./SymptomChecker.jsx";

const INTRO = {
  role: "assistant",
  text: "Hi! I'm your Health AI assistant. Describe how you're feeling and I'll suggest the right level of care — guidance, not diagnosis.",
};

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([INTRO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState(null);
  const endRef = useRef(null);
  const seededRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    api.aiStatus().then(setEngine).catch(() => setEngine(null));
  }, []);

  // Started from a Recent-activity tap: auto-send that symptom as the first message.
  useEffect(() => {
    const seed = location.state?.seed;
    if (seed && !seededRef.current) {
      seededRef.current = true;
      sendMessage(seed);
      navigate(".", { replace: true, state: null }); // clear so reload won't resend
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text) {
    const msg = (text ?? "").trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.chat(msg);
      setMessages((m) => [...m, { role: "assistant", text: res.reply, urgency: res.urgency, source: res.source }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `Sorry — ${err.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function send(e) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <section className="chat-page">
      <button className="back-link" onClick={() => navigate("/home")}>
        <ArrowLeft size={16} /> Home
      </button>

      <div className="chat-head">
        <span className="chat-avatar"><Bot size={20} /></span>
        <div>
          <div className="med-name">Health AI</div>
          <div className="med-dose">
            Safety-first guidance{engine ? ` · ${engine.label}` : ""}
          </div>
        </div>
      </div>

      <div className="chat-thread">
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column" }}>
            <div className={`bubble ${m.role} ${m.urgency === "emergency" ? "alert" : ""}`}>
              {m.text}
            </div>
            {m.role === "assistant" && m.source && (
              <span className="bubble-source">🧠 {SOURCE_LABELS[m.source] ?? m.source}</span>
            )}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant typing">
            <span></span><span></span><span></span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="chat-input" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your symptoms…"
          autoFocus
        />
        <button type="submit" className="icon-btn primary" disabled={busy || !input.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
