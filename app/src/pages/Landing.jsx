import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./landing.css";

const WHATSAPP_NUMBER = "5532999061102";
const WHATSAPP_DISPLAY = "(32) 99906-1102";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Olá! Vi o site do Robô de LED JF e quero um orçamento para a minha festa.",
)}`;
const INSTAGRAM_LINK = "https://www.instagram.com/robodeledjf/";

// Drop the real photos in app/public/images/robodeledjf/ using these file names.
const GALLERY = [
  { file: "robo-1.jpg", caption: "Robô de LED na pista", icon: "🤖" },
  { file: "robo-2.jpg", caption: "Entrada dos noivos", icon: "💍" },
  { file: "balanco-1.jpg", caption: "Balanço de LED personalizado", icon: "✨" },
  { file: "festa-1.jpg", caption: "Aniversário infantil", icon: "🎂" },
  { file: "festa-2.jpg", caption: "Nome do aniversariante no painel", icon: "💡" },
  { file: "tequileiro-1.jpg", caption: "Mega tequileiro", icon: "🍹" },
];

const SERVICES = [
  {
    icon: "🤖",
    title: "Robô de LED",
    text: "O robô entra na pista, dança com os convidados e transforma qualquer momento da festa em atração principal.",
    items: ["Painel de LED com o nome do evento", "Interação com o público", "Ideal para entrada e abertura de pista"],
  },
  {
    icon: "🎠",
    title: "Balanço de LED",
    text: "Balanço iluminado e personalizado: o cenário preferido para as fotos que todo mundo leva da festa.",
    items: ["Iluminação personalizada", "Cenário pronto para fotos", "Montagem e desmontagem inclusas"],
  },
  {
    icon: "🍹",
    title: "Mega tequileiro",
    text: "Atração extra para animar a pista e surpreender os convidados junto com os robôs de LED.",
    items: ["Animação da pista", "Combina com os demais serviços", "Sob consulta de disponibilidade"],
  },
];

const STEPS = [
  { title: "Fale no WhatsApp", text: "Conte a data, o horário e o tipo de festa. O atendimento é direto com a equipe." },
  { title: "Monte o pacote", text: "Escolha entre robôs de LED, balanço de LED e as atrações extras." },
  { title: "Reserve a data", text: "Confirmamos a disponibilidade dos equipamentos e reservamos a sua data." },
  { title: "Curta a festa", text: "A equipe chega antes, monta tudo e cuida da atração do começo ao fim." },
];

function GalleryTile({ item }) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="lp-tile">
      {failed ? (
        <div className="lp-tile-empty">
          <span aria-hidden="true">{item.icon}</span>
          <small>Adicione a foto<br />{item.file}</small>
        </div>
      ) : (
        <img
          src={`/images/robodeledjf/${item.file}`}
          alt={item.caption}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption>{item.caption}</figcaption>
    </figure>
  );
}

function RobotArt() {
  return (
    <svg viewBox="0 0 320 400" role="img" aria-label="Ilustração de um robô de LED">
      <defs>
        <linearGradient id="lpBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5f3ff" />
          <stop offset="100%" stopColor="#a99fd6" />
        </linearGradient>
        <linearGradient id="lpPanel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id="lpGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="160" cy="372" rx="96" ry="15" fill="#8b5cf6" opacity=".2" />

      <g filter="url(#lpGlow)">
        <rect x="96" y="30" width="128" height="104" rx="30" fill="url(#lpBody)" />
        <rect x="112" y="54" width="96" height="58" rx="20" fill="#12082c" />
        <circle cx="140" cy="83" r="10" fill="#22d3ee" />
        <circle cx="180" cy="83" r="10" fill="#22d3ee" />
        <rect x="152" y="10" width="16" height="24" rx="8" fill="url(#lpBody)" />
        <circle cx="160" cy="8" r="9" fill="#f472b6" />
      </g>

      <rect x="146" y="132" width="28" height="20" rx="8" fill="#7c6ba8" />

      <g filter="url(#lpGlow)">
        <rect x="82" y="150" width="156" height="140" rx="34" fill="url(#lpBody)" />
        <rect x="104" y="176" width="112" height="88" rx="18" fill="#0d0426" />
        <rect x="116" y="192" width="88" height="9" rx="4" fill="url(#lpPanel)" />
        <rect x="116" y="212" width="66" height="9" rx="4" fill="url(#lpPanel)" opacity=".8" />
        <rect x="116" y="232" width="78" height="9" rx="4" fill="url(#lpPanel)" opacity=".6" />
      </g>

      <g fill="url(#lpBody)">
        <rect x="40" y="164" width="34" height="104" rx="17" transform="rotate(-12 57 216)" />
        <rect x="246" y="164" width="34" height="104" rx="17" transform="rotate(12 263 216)" />
        <rect x="104" y="292" width="40" height="76" rx="18" />
        <rect x="176" y="292" width="40" height="76" rx="18" />
      </g>

      <g fill="#22d3ee" filter="url(#lpGlow)">
        <circle cx="47" cy="278" r="11" />
        <circle cx="273" cy="278" r="11" />
      </g>
    </svg>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  // Once signed in, the corner button goes straight to the dashboard.
  // `loading` is only true while an existing token is being verified.
  const signedIn = Boolean(user) || loading;
  const loginTarget = signedIn ? "/admin" : "/login";
  const loginLabel = signedIn ? "Dashboard" : "Login";

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap" style={{ alignItems: "center", display: "flex", width: "100%" }}>
          <a className="lp-brand" href="#topo">
            <span className="lp-brand-mark" aria-hidden="true">🤖</span>
            <span>
              <strong>Robô de LED JF</strong>
              <span>Robôs e balanço de LED</span>
            </span>
          </a>
          <nav className="lp-nav-links">
            <a href="#servicos">Serviços</a>
            <a href="#galeria">Galeria</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#contato">Contato</a>
          </nav>
          <div className="lp-nav-actions">
            <Link className="lp-btn lp-btn-login" to={loginTarget}>{loginLabel}</Link>
          </div>
        </div>
      </header>

      <main id="topo">
        <section className="lp-wrap lp-hero">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">Juiz de Fora e região</span>
            <h1>Robôs de LED que <em>animam e surpreendem</em> seus convidados.</h1>
            <p>
              Robôs de LED e balanço de LED personalizado para casamentos, aniversários e festas
              em geral. A gente entra na pista, interage com todo mundo e deixa a noite inesquecível.
            </p>
            <div className="lp-hero-actions">
              <a className="lp-btn lp-btn-whats" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                Pedir orçamento no WhatsApp
              </a>
              <a className="lp-btn lp-btn-ghost" href="#galeria">Ver a galeria</a>
            </div>
            <p className="lp-hero-note">Atendimento direto pelo WhatsApp {WHATSAPP_DISPLAY} · @robodeledjf</p>
          </div>

          <div className="lp-stage">
            <div className="lp-chip lp-chip-a">
              <span aria-hidden="true">💡</span>
              <span>
                <strong>Painel personalizado</strong>
                <small>Nome e mensagem no LED</small>
              </span>
            </div>
            <RobotArt />
            <div className="lp-chip lp-chip-b">
              <span aria-hidden="true">🎉</span>
              <span>
                <strong>Show na pista</strong>
                <small>Interação com os convidados</small>
              </span>
            </div>
          </div>
        </section>

        <div className="lp-wrap">
          <div className="lp-strip">
            <div><strong>8</strong><span>Robôs de LED disponíveis</span></div>
            <div><strong>1</strong><span>Balanço de LED personalizado</span></div>
            <div><strong>100%</strong><span>Personalizado para o seu evento</span></div>
            <div><strong>JF</strong><span>Juiz de Fora e região</span></div>
          </div>
        </div>

        <section className="lp-wrap lp-section" id="servicos">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Serviços</span>
            <h2>Atrações de LED para qualquer tipo de festa</h2>
            <p>
              Casamento, aniversário infantil, 15 anos, formatura ou evento corporativo: montamos o
              pacote de acordo com o tamanho da festa e o horário do seu evento.
            </p>
          </div>
          <div className="lp-cards">
            {SERVICES.map((service) => (
              <article className="lp-card" key={service.title}>
                <div className="lp-card-icon" aria-hidden="true">{service.icon}</div>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
                <ul>
                  {service.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-wrap lp-section" id="galeria">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Galeria</span>
            <h2>Momentos das festas que já animamos</h2>
            <p>Acompanhe os bastidores e os vídeos completos no Instagram @robodeledjf.</p>
          </div>
          <div className="lp-gallery">
            {GALLERY.map((item) => <GalleryTile item={item} key={item.file} />)}
          </div>
          <p className="lp-gallery-hint">
            Veja mais no <a href={INSTAGRAM_LINK} target="_blank" rel="noreferrer">Instagram @robodeledjf</a>.
          </p>
        </section>

        <section className="lp-wrap lp-section" id="como-funciona">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Como funciona</span>
            <h2>Da primeira mensagem até a hora da festa</h2>
          </div>
          <div className="lp-steps">
            {STEPS.map((step) => (
              <article className="lp-step" key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-wrap lp-section" id="contato">
          <div className="lp-cta">
            <div>
              <h2>Vamos reservar a sua data?</h2>
              <p>
                Chame no WhatsApp com a data, o horário e o local do evento. Respondemos com a
                disponibilidade dos equipamentos e o orçamento completo.
              </p>
            </div>
            <div className="lp-cta-actions">
              <a className="lp-btn lp-btn-whats" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                WhatsApp {WHATSAPP_DISPLAY}
              </a>
              <a className="lp-btn lp-btn-primary" href={INSTAGRAM_LINK} target="_blank" rel="noreferrer">
                Seguir @robodeledjf
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-grid">
            <div className="lp-brand">
              <span className="lp-brand-mark" aria-hidden="true">🤖</span>
              <span>
                <strong>Robô de LED JF</strong>
                <span>Robôs e balanço de LED</span>
              </span>
            </div>
            <div className="lp-footer-links">
              <a href="#servicos">Serviços</a>
              <a href="#galeria">Galeria</a>
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer">WhatsApp</a>
              <a href={INSTAGRAM_LINK} target="_blank" rel="noreferrer">Instagram</a>
              <Link to={loginTarget}>{loginLabel}</Link>
            </div>
          </div>
          <small>© {new Date().getFullYear()} Robô de LED JF · Juiz de Fora / MG</small>
        </div>
      </footer>
    </div>
  );
}
