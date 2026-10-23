import React, { useState, useEffect, createContext, useContext, FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import {
  CalendarDays,
  LayoutDashboard,
  ClipboardList,
  Plus,
  LogOut,
  ArrowUpRight,
  ArrowLeft,
  Search,
  MapPin,
  Clock,
  Users,
  Check,
  Download,
  Settings,
  Leaf,
  Menu,
  X,
  ChevronRight,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api, send, statuses, date } from './api';
import './style.css';
const Auth = createContext<any>(null);
const Toast = createContext<(s: string, error?: boolean) => void>(() => {});
function Badge({ status }: { status: string }) {
  return <span className={'badge ' + status}>{statuses[status]}</span>;
}
function Empty({ text = 'Nenhum registro encontrado.' }: { text?: string }) {
  return (
    <div className="empty">
      <CalendarDays size={32} />
      <p>{text}</p>
    </div>
  );
}
function Loading() {
  return (
    <div className="empty" role="status">
      Carregando informações…
    </div>
  );
}
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      {message}
    </div>
  );
}
function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-icon">
        <Leaf size={23} />
      </span>
      <span>
        comitadus<small>EVENTOS INSTITUCIONAIS</small>
      </span>
    </Link>
  );
}
function useLoad<T = any>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setError('');
    setData(null);
    api<T>(url)
      .then((v) => {
        if (alive) setData(v);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [url, revision]);
  useEffect(() => {
    if (url !== '/public/events') return;
    const refresh = () => setRevision((v) => v + 1);
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [url]);
  return { data, error, reload: () => setRevision((v) => v + 1) };
}
function App() {
  const [user, setUser] = useState<any>(undefined),
    [toast, setToast] = useState<any>(null);
  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  return (
    <Auth.Provider value={{ user, setUser }}>
      <Toast.Provider value={(message, error = false) => setToast({ message, error })}>
        <Routes>
          <Route path="/" element={<PublicAgenda />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/app/*"
            element={
              user === undefined ? <Loading /> : user ? <Shell /> : <Navigate to="/login" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {toast && (
          <div role="status" className={'toast ' + (toast.error ? 'error' : '')}>
            <span>{toast.message}</span>
            <button
              className="icon-btn"
              aria-label="Fechar notificação"
              onClick={() => setToast(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </Toast.Provider>
    </Auth.Provider>
  );
}
function PublicAgenda() {
  const { user } = useContext(Auth);
  const { data, error } = useLoad<any[]>('/public/events');
  const [q, setQ] = useState(''),
    [month, setMonth] = useState('all'),
    [view, setView] = useState('list'),
    [selected, setSelected] = useState<any>(null);
  const now = new Date();
  const months = [0, 1, 2].map((i) => new Date(now.getFullYear(), now.getMonth() + i, 1));
  const rows = (data || []).filter(
    (e) =>
      (month === 'all' || e.eventDate?.slice(0, 7) === month) &&
      `${e.title} ${e.theme?.name}`.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="public">
      <header className="public-header">
        <Brand />
        <nav>
          <span className="nav-active">Agenda de eventos</span>
          <Link className="button small secondary" to={user ? '/app' : '/login'}>
            {user ? 'Meu painel' : 'Acesso ao sistema'}
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main className="public-main">
        <section className="hero">
          <div>
            <div className="eyebrow">
              <span className="dot" /> UNIVILLE · CAMPUS SÃO BENTO DO SUL
            </div>
            <h1>
              Conhecimento que
              <br />
              <em>conecta pessoas.</em>
            </h1>
            <p>
              Encontros, ideias e experiências que fazem parte
              <br className="desktop" /> da nossa comunidade. Encontre seu próximo evento.
            </p>
            <a href="#agenda" className="button">
              Explorar a agenda <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit o1" />
            <div className="orbit o2" />
            <div className="art-card">
              <CalendarDays size={35} />
              <span>
                ESPAÇO PARA
                <br />
                <b>novas conexões.</b>
              </span>
              <div className="art-dots">● ● ● ● ●</div>
            </div>
            <span className="floating f1">Ideias que inspiram ↗</span>
            <span className="floating f2">Juntos, vamos além.</span>
          </div>
        </section>
        <section id="agenda" className="agenda-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">ACONTECE NA UNIVILLE</div>
              <h2>
                Agenda de eventos<span className="count">{data?.length || 0}</span>
              </h2>
              <p>Programação aprovada para este mês e os próximos dois meses.</p>
            </div>
            <div className="segmented">
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
                Lista
              </button>
              <button
                className={view === 'calendar' ? 'active' : ''}
                onClick={() => setView('calendar')}
              >
                Calendário
              </button>
            </div>
          </div>
          <div className="toolbar">
            <div className="tabs">
              <button className={month === 'all' ? 'active' : ''} onClick={() => setMonth('all')}>
                Todos os meses
              </button>
              {months.map((m) => {
                const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
                return (
                  <button
                    key={key}
                    className={month === key ? 'active' : ''}
                    onClick={() => setMonth(key)}
                  >
                    {m.toLocaleDateString('pt-BR', { month: 'long' })}
                  </button>
                );
              })}
            </div>
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Buscar evento"
                placeholder="Buscar evento ou tema"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>
          {error ? (
            <ErrorBox message={error} />
          ) : !data ? (
            <Loading />
          ) : !rows.length ? (
            <Empty text="Nenhum evento para este período ou pesquisa." />
          ) : view === 'list' ? (
            <div className="event-grid">
              {rows.map((e) => (
                <button key={e.id} className="event-card" onClick={() => setSelected(e)}>
                  <div className="event-card-top">
                    <span className="theme-label">{e.theme?.name}</span>
                    <ArrowUpRight size={20} />
                  </div>
                  <div className="event-date">
                    {date(e.eventDate)} <span>· {e.startTime}</span>
                  </div>
                  <h3>{e.title}</h3>
                  <p>{e.description || e.targetAudience}</p>
                  <div className="card-bottom">
                    <span>
                      <MapPin size={15} />
                      {e.environment?.name}
                    </span>
                    <span>
                      Saiba mais <ChevronRight size={15} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="calendar-grid">
              {months
                .filter(
                  (m) =>
                    month === 'all' ||
                    month === `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
                )
                .map((m) => (
                  <div className="panel" key={+m}>
                    <h3>{m.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
                    <div className="month-grid">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <strong key={i}>{d}</strong>
                      ))}
                      {Array.from({ length: m.getDay() }, (_, i) => (
                        <span key={'b' + i} />
                      ))}
                      {Array.from(
                        { length: new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate() },
                        (_, i) => {
                          const es = rows.filter((e) => {
                            const d = new Date(e.eventDate);
                            return d.getUTCDate() === i + 1 && d.getUTCMonth() === m.getMonth();
                          });
                          return (
                            <div key={i} className={es.length ? 'has-events' : ''}>
                              <span>{i + 1}</span>
                              {es.map((e) => (
                                <button title={e.title} key={e.id} onClick={() => setSelected(e)}>
                                  {e.startTime} {e.title}
                                </button>
                              ))}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
        <section className="public-cta">
          <div>
            <h3>Sua próxima ideia pode virar um encontro.</h3>
            <p>Solicite um evento e faça parte da programação institucional.</p>
          </div>
          <Link className="button secondary" to={user ? '/app/novo' : '/login'}>
            Solicitar um evento <Plus size={17} />
          </Link>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Univille · Gestão de eventos institucionais</span>
        <span>Comitadus © {now.getFullYear()}</span>
      </footer>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="detail-grid">
            <Info label="Data" value={date(selected.eventDate)} />
            <Info label="Horário" value={`${selected.startTime} — ${selected.endTime}`} />
            <Info label="Ambiente" value={selected.environment?.name} />
            <Info label="Localização" value={selected.environment?.location} />
            <Info label="Tema" value={selected.theme?.name} />
            <Info label="Palestrante" value={selected.speaker} />
            <Info label="Realização" value={selected.course?.name} />
            <Info label="Público-alvo" value={selected.targetAudience} />
          </div>
          <p>{selected.description}</p>
          <p className="muted">
            Inscrições e declarações, quando previstas, são organizadas pelo setor de Eventos.
          </p>
        </Modal>
      )}
    </div>
  );
}
function Login() {
  const { user, setUser } = useContext(Auth),
    navigate = useNavigate();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/app" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      setUser(
        await api(
          '/auth/login',
          send('POST', { email: f.get('email'), password: f.get('password') })
        )
      );
      navigate('/app');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div>
          <div className="eyebrow">CONECTAR. ORGANIZAR. REALIZAR.</div>
          <h1>
            Grandes encontros
            <br />
            começam com
            <br />
            <em>uma boa ideia.</em>
          </h1>
          <p>
            Um só lugar para planejar e acompanhar
            <br />
            os eventos da nossa comunidade.
          </p>
        </div>
        <small>UNIVILLE · CAMPUS SÃO BENTO DO SUL</small>
      </div>
      <main className="login-form">
        <Link to="/" className="back">
          <ArrowLeft size={17} />
          Voltar para a agenda
        </Link>
        <div className="login-inner">
          <span className="brand-icon">
            <Users />
          </span>
          <h2>Bem-vindo de volta</h2>
          <p className="muted">Entre com sua conta para acessar o sistema.</p>
          {error && <ErrorBox message={error} />}
          <form onSubmit={submit}>
            <label>
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="seu.email@exemplo.test"
                required
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Sua senha"
              />
            </label>
            <button disabled={busy} className="button full">
              {busy ? 'Entrando…' : 'Entrar no sistema'}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="demo-note">
            Contas de demonstração disponíveis no README do projeto. O acesso é cadastrado pela
            administração.
          </div>
        </div>
      </main>
    </div>
  );
}
function Shell() {
  const { user, setUser } = useContext(Auth),
    notify = useContext(Toast),
    loc = useLocation();
  const [mobile, setMobile] = useState(false);
  const admin = user.role === 'ADMIN';
  const links = [
    ['/app', 'Visão geral', LayoutDashboard],
    ['/app/solicitacoes', admin ? 'Solicitações' : 'Minhas solicitações', ClipboardList],
    ['/app/novo', 'Nova solicitação', Plus],
    ...(admin
      ? [
          ['/app/eventos', 'Eventos aprovados', CalendarDays],
          ['/app/cadastros', 'Cadastros', Settings],
          ['/app/relatorios', 'Relatórios', FileText],
        ]
      : []),
  ];
  return (
    <div className="shell">
      <button
        className="mobile-menu icon-btn"
        aria-label="Abrir menu"
        onClick={() => setMobile(!mobile)}
      >
        <Menu />
      </button>
      <aside className={mobile ? 'open' : ''}>
        <Brand />
        <div className="sidebar-label">ESPAÇO DE TRABALHO</div>
        <nav>
          {links.map(([href, label, Icon]: any) => (
            <Link
              className={loc.pathname === href ? 'active' : ''}
              to={href}
              key={href}
              onClick={() => setMobile(false)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
        </nav>
        <Link to="/" className="agenda-link">
          <ArrowUpRight size={18} />
          Ver agenda pública
        </Link>
        <div className="sidebar-user">
          <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{admin ? 'Administrador' : 'Solicitante'}</small>
          </div>
          <button
            className="icon-btn"
            aria-label="Sair"
            onClick={async () => {
              try {
                await api('/auth/logout', send('POST'));
                setUser(null);
              } catch (e: any) {
                notify(e.message, true);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <span>
            Univille <ChevronRight size={14} /> Gestão de eventos
          </span>
          <span className="header-date">
            {new Date().toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </header>
        <main>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="solicitacoes" element={<RequestList />} />
            <Route path="novo" element={<EventForm />} />
            <Route path="solicitacoes/:id" element={<RequestDetail />} />
            <Route path="solicitacoes/:id/editar" element={<EventForm />} />
            <Route
              path="eventos"
              element={admin ? <RequestList approved /> : <Navigate to="/app" />}
            />
            <Route path="cadastros" element={admin ? <Catalogs /> : <Navigate to="/app" />} />
            <Route path="relatorios" element={admin ? <Reports /> : <Navigate to="/app" />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function PageHead({ eyebrow, title, description, children }: any) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow || 'GESTÃO DE EVENTOS'}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Stats({ rows }: any) {
  return (
    <div className="stats">
      {[
        ['Todas as solicitações', rows.length, ''],
        ['Aguardando análise', rows.filter((e: any) => e.status === 'PENDENTE').length, 'amber'],
        ['Eventos aprovados', rows.filter((e: any) => e.status === 'APROVADO').length, 'green'],
        ['Rejeitadas', rows.filter((e: any) => e.status === 'REJEITADO').length, 'rose'],
        ['Canceladas', rows.filter((e: any) => e.status === 'CANCELADO').length, ''],
        ['Rascunhos', rows.filter((e: any) => e.status === 'RASCUNHO').length, ''],
      ].map(([label, value, color]) => (
        <div className="stat" key={label}>
          <span>{label}</span>
          <strong>
            {value}
            <span className={String(color)}>
              <CalendarDays size={21} />
            </span>
          </strong>
        </div>
      ))}
    </div>
  );
}
function Dashboard() {
  const { user } = useContext(Auth);
  const { data, error } = useLoad<any[]>('/requests');
  return (
    <>
      <PageHead
        eyebrow="SEU ESPAÇO DE TRABALHO"
        title={`Olá, ${user.name.split(' ')[0]}.`}
        description="Acompanhe o que acontece e transforme ideias em encontros."
      >
        <Link className="button" to="/app/novo">
          <Plus size={18} />
          Nova solicitação
        </Link>
      </PageHead>
      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Stats rows={data} />
          <div className="dashboard-banner">
            <div>
              <span className="eyebrow">DA IDEIA À REALIZAÇÃO</span>
              <h2>
                Todo encontro começa
                <br />
                com uma conexão.
              </h2>
              <p>
                Organize seu evento com clareza, do primeiro
                <br />
                rascunho à publicação na agenda.
              </p>
              <Link to="/" className="text-link">
                Explorar agenda pública <ArrowUpRight size={17} />
              </Link>
            </div>
            <CalendarDays size={128} strokeWidth={1} />
          </div>
          <div className="section-heading">
            <h2>Solicitações recentes</h2>
            <Link className="text-link" to="/app/solicitacoes">
              Ver todas <ArrowUpRight size={16} />
            </Link>
          </div>
          <RequestTable rows={data.slice(0, 5)} />
          <div className="section-heading">
            <h2>Próximos eventos aprovados</h2>
          </div>
          <RequestTable
            rows={data
              .filter(
                (e) =>
                  e.status === 'APROVADO' &&
                  e.eventDate?.slice(0, 10) >= new Date().toLocaleDateString('en-CA')
              )
              .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
              .slice(0, 5)}
          />
        </>
      )}
    </>
  );
}
function RequestTable({ rows, report = false }: any) {
  return !rows.length ? (
    <Empty />
  ) : (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Evento / código</th>
            <th>Solicitante / curso</th>
            <th>Data / horário</th>
            <th>Ambiente</th>
            {report && (
              <>
                <th>Tema</th>
                <th>Centro de custo</th>
              </>
            )}
            <th>Status</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e: any) => (
            <tr key={e.id}>
              <td>
                <Link className="table-title" to={'/app/solicitacoes/' + e.id}>
                  {e.title || 'Sem título'}
                </Link>
                <small>
                  #{e.id.slice(0, 8)} · Criado em {date(e.createdAt)}
                </small>
              </td>
              <td>
                {e.requesterName || '—'}
                <small>{e.course?.name || '—'}</small>
              </td>
              <td>
                {date(e.eventDate)}
                <small>
                  {e.startTime || '—'} — {e.endTime || '—'}
                </small>
              </td>
              <td>{e.environment?.name || '—'}</td>
              {report && (
                <>
                  <td>{e.theme?.name || '—'}</td>
                  <td>{e.costCenter?.name || '—'}</td>
                </>
              )}
              <td>
                <Badge status={e.status} />
              </td>
              <td>
                <Link
                  className="icon-link"
                  aria-label={'Detalhes de ' + e.title}
                  to={'/app/solicitacoes/' + e.id}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function RequestList({ approved = false }) {
  const [status, setStatus] = useState(approved ? 'APROVADO' : ''),
    [q, setQ] = useState('');
  const { data, error } = useLoad<any[]>('/requests' + (status ? '?status=' + status : ''));
  const rows = (data || []).filter((e) =>
    `${e.title} ${e.requesterName}`.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <>
      <PageHead
        title={approved ? 'Eventos aprovados' : 'Solicitações'}
        description={
          approved
            ? 'Gerencie os eventos publicados na agenda institucional.'
            : 'Acompanhe cada etapa, do rascunho à aprovação.'
        }
      >
        <Link className="button" to="/app/novo">
          <Plus size={18} />
          Nova solicitação
        </Link>
      </PageHead>
      <div className="toolbar">
        <label className="search">
          <Search size={17} />
          <input
            placeholder="Buscar evento ou solicitante"
            aria-label="Pesquisar solicitações"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {!approved && (
          <select
            aria-label="Filtrar por status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(statuses).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
        <span className="muted">{rows.length} registros</span>
      </div>
      {error ? <ErrorBox message={error} /> : !data ? <Loading /> : <RequestTable rows={rows} />}
    </>
  );
}
function Info({ label, value }: any) {
  return (
    <div className="info">
      <small>{label}</small>
      <strong>{value === true ? 'Sim' : value === false ? 'Não' : (value ?? '—')}</strong>
    </div>
  );
}
function Modal({ title, children, onClose }: any) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', fn);
    const prev = document.activeElement as HTMLElement;
    const el = document.querySelector<HTMLButtonElement>('.modal-close');
    el?.focus();
    return () => {
      document.removeEventListener('keydown', fn);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
            'button,input,textarea,select,a[href]'
          );
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="modal">
        <div className="section-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn modal-close" aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function RequestDetail() {
  const { id } = useParams(),
    { user } = useContext(Auth),
    notify = useContext(Toast),
    navigate = useNavigate();
  const { data: e, error, reload } = useLoad<any>('/requests/' + id);
  const [action, setAction] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState('');
  if (error) return <ErrorBox message={error} />;
  if (!e) return <Loading />;
  const editable =
    (['RASCUNHO', 'REJEITADO'].includes(e.status) &&
      (e.authorUserId === user.id || user.role === 'ADMIN')) ||
    (e.status === 'APROVADO' && user.role === 'ADMIN');
  async function execute() {
    setBusy(true);
    setActionError('');
    try {
      await api(
        '/requests/' + id + (action === 'delete' ? '' : '/' + action),
        send(action === 'delete' ? 'DELETE' : 'POST', action === 'reject' ? { reason } : undefined)
      );
      notify('Operação realizada com sucesso.');
      setAction('');
      if (action === 'delete') navigate('/app/solicitacoes');
      else reload();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link to="/app/solicitacoes" className="back">
        <ArrowLeft size={16} />
        Voltar às solicitações
      </Link>
      <PageHead
        title={e.title || 'Solicitação sem título'}
        description={'Solicitação #' + e.id.slice(0, 8)}
      >
        <Badge status={e.status} />
      </PageHead>
      {e.rejectionReason && (
        <div className="notice">
          <strong>Justificativa da rejeição</strong>
          <p>{e.rejectionReason}</p>
        </div>
      )}
      <div className="panel">
        <div className="detail-grid">
          {[
            ['Solicitante', e.requesterName],
            ['Curso/coordenação', e.course?.name],
            ['Centro de custo', e.costCenter?.name],
            ['Tema', e.theme?.name],
            ['Data', date(e.eventDate)],
            ['Horário', `${e.startTime || '—'} — ${e.endTime || '—'}`],
            ['Ambiente', e.environment?.name],
            ['Palestrante', e.speaker],
            ['Público-alvo', e.targetAudience],
            ['Participantes estimados', e.estimatedAttendees],
            ['Cerimonial', e.ceremonial],
            ['Inscrições', e.registration],
            ['Declarações', e.declarations],
            ['Recursos', e.resources.map((r: any) => r.resource.name).join(', ') || 'Nenhum'],
          ].map(([label, value]) => (
            <Info key={label} label={label} value={value} />
          ))}
        </div>
        {[
          ['Descrição', e.description],
          ['Justificativa', e.justification],
          ['Objetivo', e.objective],
          ['Observações', e.notes],
        ].map(([label, value]) => (
          <div className="detail-text" key={label}>
            <small>{label}</small>
            <p>{value || '—'}</p>
          </div>
        ))}
      </div>
      <div className="actions">
        {editable && (
          <Link className="button secondary" to={'/app/solicitacoes/' + id + '/editar'}>
            Editar solicitação
          </Link>
        )}
        {['RASCUNHO', 'REJEITADO'].includes(e.status) && e.authorUserId === user.id && (
          <button
            className="button"
            onClick={() => {
              setAction('submit');
              setActionError('');
            }}
          >
            Enviar para análise
          </button>
        )}
        {e.status === 'PENDENTE' && user.role === 'ADMIN' && (
          <>
            <button
              className="button"
              onClick={() => {
                setAction('approve');
                setActionError('');
              }}
            >
              <Check size={18} />
              Aprovar
            </button>
            <button
              className="button danger"
              onClick={() => {
                setAction('reject');
                setActionError('');
              }}
            >
              Rejeitar
            </button>
          </>
        )}
        {(e.status === 'PENDENTE' || (e.status === 'APROVADO' && user.role === 'ADMIN')) && (
          <button
            className="button danger secondary"
            onClick={() => {
              setAction('cancel');
              setActionError('');
            }}
          >
            Cancelar solicitação
          </button>
        )}
        {e.status === 'RASCUNHO' && e.authorUserId === user.id && (
          <button
            className="button danger secondary"
            onClick={() => {
              setAction('delete');
              setActionError('');
            }}
          >
            Excluir rascunho
          </button>
        )}
      </div>
      <div className="panel history">
        <h2>Histórico da solicitação</h2>
        {e.history.map((h: any) => (
          <div className="history-item" key={h.id}>
            <CheckCircle2 size={18} />
            <div>
              <strong>{h.action}</strong>
              <p>
                {h.actor?.name} · {new Date(h.createdAt).toLocaleString('pt-BR')}
                {h.details?.reason && ` · ${h.details.reason}`}
              </p>
            </div>
          </div>
        ))}
      </div>
      {action && (
        <Modal
          title={
            (
              {
                submit: 'Enviar para análise',
                approve: 'Aprovar evento',
                reject: 'Rejeitar solicitação',
                cancel: 'Cancelar solicitação',
                delete: 'Excluir rascunho',
              } as any
            )[action]
          }
          onClose={() => !busy && setAction('')}
        >
          <p>Confirme esta operação para “{e.title || 'Sem título'}”.</p>
          {action === 'reject' && (
            <label>
              Justificativa obrigatória
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={5000}
              />
            </label>
          )}
          {actionError && <ErrorBox message={actionError} />}
          <div className="actions">
            <button className="button secondary" disabled={busy} onClick={() => setAction('')}>
              Voltar
            </button>
            <button
              className="button"
              disabled={busy || (action === 'reject' && !reason.trim())}
              onClick={execute}
            >
              {busy ? 'Processando…' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
const blank: any = {
  title: '',
  requesterName: '',
  description: '',
  speaker: '',
  targetAudience: '',
  justification: '',
  objective: '',
  notes: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  courseId: '',
  themeId: '',
  environmentId: '',
  ceremonial: null,
  registration: null,
  declarations: null,
  estimatedAttendees: '',
  resourceIds: [],
};
function EventForm() {
  const { id } = useParams(),
    navigate = useNavigate(),
    notify = useContext(Toast);
  const { data: c, error: catalogError } = useLoad('/catalogs');
  const [recordStatus, setRecordStatus] = useState('RASCUNHO'),
    [form, setForm] = useState<any>({ ...blank }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(!id);
  useEffect(() => {
    if (id)
      api('/requests/' + id)
        .then((e) => {
          const f: any = {};
          for (const k of Object.keys(blank)) f[k] = e[k] ?? blank[k];
          f.eventDate = e.eventDate?.slice(0, 10) || '';
          f.resourceIds = e.resources.map((r: any) => r.resourceId);
          setForm(f);
          setRecordStatus(e.status);
          setLoaded(true);
        })
        .catch((e) => setError(e.message));
  }, [id]);
  const change = (key: string, value: any) =>
    setForm((f: any) => ({
      ...f,
      [key]: value,
      ...(key === 'environmentId' ? { resourceIds: [] } : {}),
    }));
  async function save(submit: boolean) {
    setBusy(true);
    setError('');
    const data = {
      ...form,
      courseId: form.courseId || null,
      themeId: form.themeId || null,
      environmentId: form.environmentId || null,
      eventDate: form.eventDate || null,
      estimatedAttendees: form.estimatedAttendees === '' ? null : Number(form.estimatedAttendees),
    };
    try {
      const saved = await api(
        id ? '/requests/' + id : '/requests',
        send(id ? 'PATCH' : 'POST', data)
      );
      if (submit) {
        try {
          await api('/requests/' + saved.id + '/submit', send('POST'));
        } catch (e: any) {
          if (!id) {
            navigate('/app/solicitacoes/' + saved.id + '/editar', { replace: true });
            setLoaded(true);
          }
          throw new Error('Rascunho salvo. ' + e.message);
        }
      }
      notify(submit ? 'Solicitação enviada para análise.' : 'Alterações salvas.');
      navigate('/app/solicitacoes/' + saved.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (catalogError) return <ErrorBox message={catalogError} />;
  if (!c || !loaded) return error ? <ErrorBox message={error} /> : <Loading />;
  const course = c.courses.find((r: any) => r.id === form.courseId),
    env = c.environments.find((r: any) => r.id === form.environmentId);
  const field = (key: string, label: string, type = 'text', required = true) => (
    <label key={key}>
      {label}
      {required ? ' *' : ''}
      <input
        required={required}
        type={type}
        value={form[key]}
        min={type === 'number' ? 0 : undefined}
        maxLength={type === 'text' ? 200 : undefined}
        onChange={(e) => change(key, e.target.value)}
      />
    </label>
  );
  const select = (key: string, label: string, items: any[]) => (
    <label>
      {label} *
      <select required value={form[key]} onChange={(e) => change(key, e.target.value)}>
        <option value="">Selecione…</option>
        {items.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.active === false ? ' (inativo)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <Link className="back" to="/app/solicitacoes">
        <ArrowLeft size={16} />
        Voltar às solicitações
      </Link>
      <PageHead
        title={id ? 'Editar solicitação' : 'Vamos criar um encontro?'}
        description="Preencha os detalhes ou salve um rascunho para continuar depois."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(recordStatus !== 'APROVADO');
        }}
      >
        <div className="panel form-panel">
          <div className="form-heading">
            <span>01</span>
            <div>
              <h2>Sobre o evento</h2>
              <p>Os campos com * são obrigatórios no envio.</p>
            </div>
          </div>
          <div className="form-grid">
            {field('title', 'Nome do evento')}
            {select('themeId', 'Tema', c.themes)}
            {field('requesterName', 'Nome do solicitante')}
            {field('speaker', 'Palestrante')}
            {select('courseId', 'Curso / coordenação', c.courses)}
            <label>
              Centro de custo automático
              <input readOnly value={course?.costCenter?.name || 'Selecione o curso'} />
            </label>
            {field('targetAudience', 'Público-alvo')}
            {field('estimatedAttendees', 'Participantes estimados', 'number', false)}
          </div>
          {['description', 'justification', 'objective'].map((k, i) => (
            <label key={k}>
              {['Descrição', 'Justificativa *', 'Objetivo *'][i]}
              <textarea
                required={k !== 'description'}
                maxLength={5000}
                value={form[k]}
                onChange={(e) => change(k, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="panel form-panel">
          <div className="form-heading">
            <span>02</span>
            <div>
              <h2>Quando e onde</h2>
              <p>Um único ambiente e um único dia por evento.</p>
            </div>
          </div>
          <div className="form-grid">
            {field('eventDate', 'Data', 'date')}
            {select('environmentId', 'Ambiente', c.environments)}
            {field('startTime', 'Início', 'time')}
            {field('endTime', 'Término', 'time')}
          </div>
          <label>Recursos disponíveis no ambiente</label>
          <div className="checkbox-group">
            {!env ? (
              <p className="muted">Selecione um ambiente para consultar os recursos.</p>
            ) : !env.resources.length ? (
              <p className="muted">Nenhum recurso associado.</p>
            ) : (
              env.resources
                .filter((r: any) => r.resource.active || form.resourceIds.includes(r.resourceId))
                .map((r: any) => (
                  <label key={r.resourceId}>
                    <input
                      type="checkbox"
                      checked={form.resourceIds.includes(r.resourceId)}
                      onChange={(e) =>
                        change(
                          'resourceIds',
                          e.target.checked
                            ? [...form.resourceIds, r.resourceId]
                            : form.resourceIds.filter((v: string) => v !== r.resourceId)
                        )
                      }
                    />
                    {r.resource.name}
                  </label>
                ))
            )}
          </div>
        </div>
        <div className="panel form-panel">
          <div className="form-heading">
            <span>03</span>
            <div>
              <h2>Apoio e informações adicionais</h2>
              <p>Estas informações orientam o trabalho do setor de Eventos.</p>
            </div>
          </div>
          <div className="form-grid">
            {[
              ['ceremonial', 'Precisa de cerimonial?'],
              ['registration', 'Haverá inscrições?'],
              ['declarations', 'Precisa de declarações?'],
            ].map(([key, label]) => (
              <label key={key}>
                {label} *
                <select
                  required
                  value={form[key] === null ? '' : String(form[key])}
                  onChange={(e) =>
                    change(key, e.target.value === '' ? null : e.target.value === 'true')
                  }
                >
                  <option value="">Selecione…</option>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </label>
            ))}
          </div>
          <label>
            Observações
            <textarea
              value={form.notes}
              maxLength={5000}
              onChange={(e) => change('notes', e.target.value)}
            />
          </label>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="actions form-actions">
          <p className="muted">A publicação acontece após a aprovação.</p>
          <button
            type="button"
            disabled={busy}
            className="button secondary"
            onClick={() => save(false)}
          >
            {busy ? 'Salvando…' : id ? 'Salvar alterações' : 'Salvar rascunho'}
          </button>
          {recordStatus !== 'APROVADO' && (
            <button disabled={busy} className="button">
              Enviar para análise <ArrowUpRight size={18} />
            </button>
          )}
        </div>
      </form>
    </>
  );
}
const catalogKinds: any = {
  users: {
    label: 'Usuários',
    fields: [
      ['name', 'Nome'],
      ['email', 'E-mail', 'email'],
      ['password', 'Senha (mínimo 8 caracteres)', 'password'],
      ['role', 'Perfil', 'role'],
    ],
  },
  courses: {
    label: 'Cursos / coordenações',
    fields: [
      ['name', 'Nome'],
      ['costCenterId', 'Centro de custo', 'costCenter'],
    ],
  },
  'cost-centers': {
    label: 'Centros de custo',
    fields: [
      ['name', 'Nome'],
      ['code', 'Código'],
    ],
  },
  themes: {
    label: 'Temas',
    fields: [
      ['name', 'Nome'],
      ['description', 'Descrição'],
    ],
  },
  environments: {
    label: 'Ambientes',
    fields: [
      ['name', 'Nome'],
      ['location', 'Localização'],
      ['capacity', 'Capacidade', 'number'],
      ['description', 'Descrição'],
    ],
  },
  resources: {
    label: 'Recursos',
    fields: [
      ['name', 'Nome'],
      ['description', 'Descrição'],
    ],
  },
};
function Catalogs() {
  const [kind, setKind] = useState('themes'),
    [editing, setEditing] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState('');
  const { data, error: loadError, reload } = useLoad<any[]>('/admin/' + kind);
  const { data: catalogs, reload: reloadCatalogs } = useLoad('/catalogs');
  const notify = useContext(Toast);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload: any = {};
      for (const [key, , type] of catalogKinds[kind].fields) {
        const v = editing[key];
        if (key === 'password' && !v) continue;
        payload[key] = type === 'number' ? Number(v || 0) : v || '';
      }
      payload.active = editing.active ?? true;
      if (kind === 'environments') payload.resourceIds = editing.resourceIds || [];
      await api(
        '/admin/' + kind + (editing.id ? '/' + editing.id : ''),
        send(editing.id ? 'PATCH' : 'POST', payload)
      );
      setEditing(null);
      reload();
      reloadCatalogs();
      notify('Cadastro salvo.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead title="Cadastros" description="Organize a estrutura que dá suporte aos eventos.">
        <button
          className="button"
          onClick={() => {
            setError('');
            setEditing({ active: true, role: 'SOLICITANTE' });
          }}
        >
          <Plus size={18} />
          Novo cadastro
        </button>
      </PageHead>
      <div className="tabs catalog-tabs">
        {Object.entries(catalogKinds).map(([key, c]: any) => (
          <button
            key={key}
            className={kind === key ? 'active' : ''}
            onClick={() => {
              setKind(key);
              setQ('');
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <h2>{catalogKinds[kind].label}</h2>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Filtrar cadastros"
            placeholder="Buscar cadastro"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {loadError ? (
        <ErrorBox message={loadError} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Informações</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data
                .filter((r) => `${r.name} ${r.email || ''}`.toLowerCase().includes(q.toLowerCase()))
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <small>#{r.id.slice(0, 8)}</small>
                    </td>
                    <td>
                      {r.email ||
                        r.code ||
                        r.location ||
                        r.description ||
                        catalogs?.costCenters.find((c: any) => c.id === r.costCenterId)?.name ||
                        '—'}
                      {r.role && (
                        <small>{r.role === 'ADMIN' ? 'Administrador' : 'Solicitante'}</small>
                      )}
                    </td>
                    <td>
                      <span className={'badge ' + (r.active ? 'APROVADO' : 'CANCELADO')}>
                        {r.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="actions compact">
                        <button
                          className="text-link"
                          onClick={() => {
                            setError('');
                            setEditing({
                              ...r,
                              resourceIds:
                                catalogs?.environments
                                  .find((v: any) => v.id === r.id)
                                  ?.resources.map((v: any) => v.resourceId) || [],
                            });
                          }}
                        >
                          Editar
                        </button>
                        {kind !== 'users' && (
                          <button
                            className="text-link danger-text"
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  'Excluir este cadastro? Vínculos existentes impedem a exclusão.'
                                )
                              )
                                return;
                              try {
                                await api('/admin/' + kind + '/' + r.id, send('DELETE'));
                                reload();
                                reloadCatalogs();
                                notify('Cadastro excluído.');
                              } catch (e: any) {
                                notify(e.message, true);
                              }
                            }}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.length && <Empty />}
        </div>
      )}
      {editing && (
        <Modal
          title={(editing.id ? 'Editar ' : 'Novo cadastro · ') + catalogKinds[kind].label}
          onClose={() => !busy && setEditing(null)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              {catalogKinds[kind].fields.map(([key, label, type]: string[]) => (
                <label key={key}>
                  {label}
                  {key === 'password' && editing.id ? ' (opcional)' : ''}
                  {type === 'role' ? (
                    <select
                      value={editing[key] || 'SOLICITANTE'}
                      onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                    >
                      <option value="SOLICITANTE">Solicitante</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  ) : type === 'costCenter' ? (
                    <select
                      required
                      value={editing[key] || ''}
                      onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                    >
                      <option value="">Selecione…</option>
                      {catalogs?.costCenters.map((r: any) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type || 'text'}
                      required={key !== 'description' && !(key === 'password' && editing.id)}
                      min={type === 'number' ? 0 : undefined}
                      minLength={key === 'password' ? 8 : undefined}
                      maxLength={key === 'password' ? 72 : 5000}
                      value={editing[key] ?? ''}
                      onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              Cadastro ativo
            </label>
            {kind === 'environments' && (
              <>
                <h3>Recursos do ambiente</h3>
                <div className="checkbox-group">
                  {catalogs?.resources.map((r: any) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        checked={(editing.resourceIds || []).includes(r.id)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            resourceIds: e.target.checked
                              ? [...(editing.resourceIds || []), r.id]
                              : editing.resourceIds.filter((id: string) => id !== r.id),
                          })
                        }
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              </>
            )}
            {error && <ErrorBox message={error} />}
            <button className="button" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar cadastro'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Reports() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const { data, error } = useLoad<any[]>('/admin/reports?' + params),
    { data: c } = useLoad('/catalogs');
  const group = (key: string) =>
    Object.entries(
      (data || []).reduce((acc: any, r: any) => {
        const name = r[key]?.name || 'Não informado';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {})
    );
  return (
    <>
      <PageHead
        title="Relatórios"
        description="Informações reais para acompanhar e planejar os próximos encontros."
      >
        <a className="button" href={'/api/admin/reports/export?' + params}>
          <Download size={18} />
          Exportar CSV
        </a>
      </PageHead>
      <div className="panel report-filters">
        <div className="form-grid">
          {[
            ['from', 'Data inicial'],
            ['to', 'Data final'],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                type="date"
                value={filters[k] || ''}
                onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Status
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos</option>
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {[
            ['courseId', 'Curso / coordenação', 'courses'],
            ['environmentId', 'Ambiente', 'environments'],
            ['themeId', 'Tema', 'themes'],
          ].map(([key, label, list]) => (
            <label key={key}>
              {label}
              <select
                value={filters[key] || ''}
                onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
              >
                <option value="">Todos</option>
                {c?.[list].map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button className="text-link" onClick={() => setFilters({})}>
          Limpar filtros
        </button>
      </div>
      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Stats rows={data} />
          <div className="report-groups">
            {[
              ['course', 'Eventos por curso'],
              ['environment', 'Utilização dos ambientes'],
            ].map(([key, label]) => (
              <section className="panel" key={key}>
                <h3>{label}</h3>
                {group(key).map(([name, count]) => (
                  <div className="report-bar" key={name}>
                    <span>{name}</span>
                    <b>{String(count)}</b>
                    <div
                      style={{ width: `${(Number(count) / Math.max(data.length, 1)) * 100}%` }}
                    />
                  </div>
                ))}
                {!data.length && <p className="muted">Nenhum resultado.</p>}
              </section>
            ))}
          </div>
          <RequestTable rows={data} report />
        </>
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
