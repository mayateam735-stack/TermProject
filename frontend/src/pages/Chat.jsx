import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Send } from "lucide-react";
import { api } from "../api.js";

const INTRO = {
  role: "assistant",
  text: "Hi! I'm your Health AI assistant. Describe how you're feeling and I'll suggest the right level of care — guidance, not diagnosis.",
};

export default function Chat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([INTRO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.chat(text);
      setMessages((m) => [...m, { role: "assistant", text: res.reply, urgency: res.urgency }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", text: `Sorry — ${err.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
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
          <div className="med-dose">Safety-first guidance</div>
        </div>
      </div>

      <div className="chat-thread">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role} ${m.urgency === "emergency" ? "alert" : ""}`}>
            {m.text}
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
