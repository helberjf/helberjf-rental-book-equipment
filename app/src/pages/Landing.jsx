import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./landing.css";

const WHATSAPP_NUMBER = "5532999061102";
const WHATSAPP_DISPLAY = "(32) 99906-1102";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Olá! Vi o site do Robô de LED JF e quero contratar os robôs para o meu evento.",
)}`;
const INSTAGRAM_LINK = "https://www.instagram.com/robodeledjf/";
const PHOTO_DIR = "/images/robodeledjf";

const HERO_PHOTO = { file: "hero-clean.png", alt: "Composição dos robôs de LED da Robô de LED JF" };

// Photographic windows from the owner's supplied event screenshots.
const GALLERY = [
  { file: "robot-experiences.png", caption: "Bumblebee", crop: 'bumblebee' },
  { file: "robot-experiences.png", caption: "Painel de LED personalizado", crop: 'green' },
  { file: "robot-experiences.png", caption: "Luzes que transformam a festa", crop: 'night' },
  { file: "event-types.png", caption: "Diversão para todas as idades", crop: 'kids' },
  { file: "event-types.png", caption: "Momentos inesquecíveis", crop: 'party' },
  { file: "event-effects.png", caption: "Eventos empresariais", crop: 'corporate' },
];

const ROBOTS = [
  {
    icon: "🍹",
    title: "Robô tequileiro",
    text: "O gigante da equipe: quase 3 metros de altura circulando pela festa e servindo os convidados.",
    tag: "Quase 3m de altura",
  },
  {
    icon: "📸",
    title: "Robô que tira fotos",
    text: "Câmeras embutidas no robô registram a festa de um ângulo que ninguém mais consegue.",
    tag: "Câmeras no robô",
  },
  {
    icon: "🤖",
    title: "Bumblebee",
    text: "O personagem preferido da criançada, todo iluminado e pronto para as fotos da festa.",
    tag: "Sucesso com as crianças",
  },
  {
    icon: "🎠",
    title: "Balanço de LED",
    text: "Balanço iluminado e personalizado: o cenário certo para as fotos que todo mundo leva da festa.",
    tag: "Personalizado",
  },
];

const EXTRAS = [
  { icon: "💨", title: "Disparos de CO₂", text: "Efeito de fumaça gelada para marcar os momentos altos da festa." },
  { icon: "🔦", title: "Lasers", text: "Feixes de luz que transformam a pista em um show." },
  { icon: "📷", title: "Câmeras nos robôs", text: "Fotografia em movimento, direto do ponto de vista do robô." },
  { icon: "🙌", title: "Interação constante", text: "Os robôs conversam, dançam e brincam com o público o tempo todo." },
];

const EVENT_TYPES = ["Festas", "15 anos", "Casamentos", "Formaturas", "Eventos empresariais"];

const STEPS = [
  { title: "Fale no WhatsApp", text: "Conte a data, o horário e o tipo de festa. O atendimento é direto com a equipe." },
  { title: "Monte a atração", text: "Escolha os robôs, o balanço de LED e os efeitos de CO₂ e laser." },
  { title: "Reserve a data", text: "Confirmamos a disponibilidade dos equipamentos e reservamos a sua data." },
  { title: "Curta a festa", text: "A equipe chega antes, monta tudo e cuida da atração do começo ao fim." },
];

function Photo({ file, alt, icon, className }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`lp-photo-empty ${className || ""}`.trim()}>
        <span aria-hidden="true">{icon}</span>
        <small>Robô de LED JF</small>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={`${PHOTO_DIR}/${file}`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function RobotArt() {
  return (
    <svg viewBox="0 0 320 400" role="img" aria-label="Ilustração de um robô de LED">
      <defs>
        <linearGradient id="lpBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eaf1ff" />
          <stop offset="100%" stopColor="#8fa4d8" />
        </linearGradient>
        <linearGradient id="lpPanel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff2e88" />
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

      <ellipse cx="160" cy="372" rx="96" ry="15" fill="#ff2e88" opacity=".22" />

      <g filter="url(#lpGlow)">
        <rect x="96" y="30" width="128" height="104" rx="30" fill="url(#lpBody)" />
        <rect x="112" y="54" width="96" height="58" rx="20" fill="#050d26" />
        <circle cx="140" cy="83" r="10" fill="#22d3ee" />
        <circle cx="180" cy="83" r="10" fill="#22d3ee" />
        <rect x="152" y="10" width="16" height="24" rx="8" fill="url(#lpBody)" />
        <circle cx="160" cy="8" r="9" fill="#ff2e88" />
      </g>

      <rect x="146" y="132" width="28" height="20" rx="8" fill="#6b7ba8" />

      <g filter="url(#lpGlow)">
        <rect x="82" y="150" width="156" height="140" rx="34" fill="url(#lpBody)" />
        <rect x="104" y="176" width="112" height="88" rx="18" fill="#040b23" />
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

      <g fill="#4ade80" filter="url(#lpGlow)">
        <circle cx="47" cy="278" r="11" />
        <circle cx="273" cy="278" r="11" />
      </g>
    </svg>
  );
}

function HeroStage() {
  const [failed, setFailed] = useState(false);

  return (
    <div className="lp-stage">
      {failed ? (
        <div className="lp-stage-art"><RobotArt /></div>
      ) : (
        <img
          src={`${PHOTO_DIR}/${HERO_PHOTO.file}`}
          alt={HERO_PHOTO.alt}
          loading="eager"
          fetchPriority="high"
          onError={() => setFailed(true)}
        />
      )}
    </div>
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
        <div className="lp-wrap lp-nav-inner">
          <a className="lp-brand" href="#topo">
            <span className="lp-brand-mark" aria-hidden="true">🤖</span>
            <span>
              <strong>Robô de LED JF</strong>
              <span>Experiências para eventos</span>
            </span>
          </a>
          <nav className="lp-nav-links">
            <a href="#robos">Os robôs</a>
            <a href="#extras">Efeitos</a>
            <a href="#eventos">Eventos</a>
            <a href="#galeria">Galeria</a>
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
            <h1>Robôs de <em>LED</em> para o seu evento{' '}<span className="lp-hero-location">Juiz de Fora e região</span></h1>
            <p>
              Alugue robôs de LED para casamentos, aniversários, festas de 15 anos,
              formaturas e eventos empresariais. Luzes, interação e uma experiência
              inesquecível para seus convidados.
            </p>
            <div className="lp-hero-actions">
              <a className="lp-btn lp-btn-whats lp-main-cta" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                <FaWhatsapp aria-hidden="true" focusable="false" /> Contrate para seu evento
              </a>
              <a className="lp-btn lp-btn-ghost" href="#galeria">Ver a galeria</a>
            </div>
            <p className="lp-hero-note">
              WhatsApp <strong>{WHATSAPP_DISPLAY}</strong> · Instagram <strong>@robodeledjf</strong>
            </p>
          </div>

          <div className="lp-frame">
            <div className="lp-chip lp-chip-a">
              <span aria-hidden="true">💡</span>
              <span>
                <strong>Painel personalizado</strong>
                <small>Nome e mensagem no LED</small>
              </span>
            </div>
            <HeroStage />
            <div className="lp-chip lp-chip-b">
              <span aria-hidden="true">🎉</span>
              <span>
                <strong>Interação com o público</strong>
                <small>Do início ao fim da festa</small>
              </span>
            </div>
          </div>
        </section>

        <div className="lp-wrap">
          <div className="lp-strip">
            <div><strong>3m</strong><span>Altura do robô tequileiro</span></div>
            <div><strong>8</strong><span>Robôs de LED disponíveis</span></div>
            <div><strong>5</strong><span>Tipos de evento atendidos</span></div>
            <div><strong>JF</strong><span>Juiz de Fora e região</span></div>
          </div>
        </div>

        <section className="lp-wrap lp-section" id="robos">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Os robôs</span>
            <h2>Um time de robôs iluminados, cada um com a sua atração</h2>
            <p>
              Escolha os personagens que mais combinam com a sua festa. Todos entram na pista,
              interagem com os convidados e levam o painel de LED personalizado.
            </p>
          </div>
          <div className="lp-cards">
            {ROBOTS.map((robot) => (
              <article className="lp-card" key={robot.title}>
                <div className="lp-card-icon" aria-hidden="true">{robot.icon}</div>
                <h3>{robot.title}</h3>
                <p>{robot.text}</p>
                <span className="lp-card-tag">{robot.tag}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-wrap lp-section" id="extras">
          <div className="lp-extras">
            <div className="lp-extras-copy">
              <span className="lp-eyebrow">Muito mais que robôs</span>
              <h2>Efeitos que fazem a festa inteira parar para olhar</h2>
              <p>
                Tudo pensado para criar uma experiência impactante, moderna e inesquecível — não é
                só o robô, é o show inteiro em volta dele.
              </p>
              <div className="lp-hero-actions">
                <a className="lp-btn lp-btn-whats" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                  <FaWhatsapp aria-hidden="true" focusable="false" /> Pedir orçamento no WhatsApp
                </a>
              </div>
            </div>
            <div className="lp-extra-list">
              {EXTRAS.map((extra) => (
                <div className="lp-extra" key={extra.title}>
                  <span aria-hidden="true">{extra.icon}</span>
                  <span>
                    <strong>{extra.title}</strong>
                    <small>{extra.text}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-section" id="eventos">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Para todos os tipos de evento</span>
            <h2>Leve essa experiência para o seu evento</h2>
            <p>
              Do aniversário na quadra do bairro à confraternização da empresa: a equipe monta a
              atração no tamanho da sua festa.
            </p>
            <div className="lp-events">
              {EVENT_TYPES.map((type) => <span className="lp-event-pill" key={type}>{type}</span>)}
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-section" id="galeria">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Galeria</span>
            <h2>Momentos das festas que já animamos</h2>
            <p>Acompanhe os bastidores e os vídeos completos no Instagram @robodeledjf.</p>
          </div>
          <div className="lp-gallery">
            {GALLERY.map((item) => (
              <figure className="lp-tile" key={item.crop}>
                <div className={`lp-photo-crop crop-${item.crop}`}><Photo file={item.file} alt={item.caption} /></div>
                <figcaption>{item.caption}</figcaption>
              </figure>
            ))}
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
              <h2>Contrate para seu evento</h2>
              <p>
                Chame no WhatsApp com a data, o horário e o local do evento. Respondemos com a
                disponibilidade dos robôs e o orçamento completo.
              </p>
            </div>
            <div className="lp-cta-actions">
              <a className="lp-btn lp-btn-whats" href={WHATSAPP_LINK} target="_blank" rel="noreferrer">
                <FaWhatsapp aria-hidden="true" focusable="false" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
              <a className="lp-btn lp-btn-pink" href={INSTAGRAM_LINK} target="_blank" rel="noreferrer">
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
                <span>Robôs de LED para eventos</span>
              </span>
            </div>
            <div className="lp-footer-links">
              <a href="#robos">Os robôs</a>
              <a href="#galeria">Galeria</a>
              <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer">WhatsApp</a>
              <a href={INSTAGRAM_LINK} target="_blank" rel="noreferrer">Instagram</a>
              <Link to={loginTarget}>{loginLabel}</Link>
            </div>
          </div>
          <small>© {new Date().getFullYear()} Robô de LED JF · Juiz de Fora / MG</small>
          <small className="lp-developer">Desenvolvido por <a href="https://www.linkedin.com/in/helber-soares/" target="_blank" rel="noopener noreferrer">Helber Soares ↗</a></small>
        </div>
      </footer>
    </div>
  );
}
