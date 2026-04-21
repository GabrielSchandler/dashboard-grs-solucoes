"use client";

import { useEffect, useMemo, useState } from "react";

type Equipe = "COMERCIAL" | "JURIDICO";
type View = "tv" | "operacao" | "gestao" | "marketing";

type Venda = {
  nome: string;
  data: string;
  cliente: string;
  meta: number;
  equipe: Equipe;
};

type MarketingSource = "todos" | "soul" | "growper";

type LeadMarketing = {
  dataRecebimento: string;
  nome: string;
  whatsapp: string;
  cpf: string;
  possuiFinanciamentoAtivo: boolean | null;
  valorParcela: number;
  bancoFinanceira: string;
  caso: string;
  emailDestino: string;
  assunto: string;
  origem: string;
  dataFormulario: string;
  horarioFormulario: string;
};

type ApiResponse = {
  vendas: Venda[];
  leads: LeadMarketing[];
  meta: number;
  refreshSeconds: number;
  updatedAt: string;
  source: string;
  leadsSource: string;
};

type ApiState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "success"; data: ApiResponse; error?: never }
  | { status: "error"; data?: never; error: string };

type Ranking = {
  nome: string;
  total: number;
  vendas: number;
};

type DayRevenue = {
  data: string;
  total: number;
  comercial: number;
  juridico: number;
};

type WeatherState = {
  temp: number | null;
  label: string;
  error?: string;
};

type TeamSummary = {
  label: string;
  total: number;
  vendas: number;
  ticket: number;
  pct: number;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const marketingSourceOptions: Array<{ value: MarketingSource; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "soul", label: "Soul" },
  { value: "growper", label: "Growper" },
];

export default function Dashboard({
  initialView = "operacao",
}: {
  initialView?: View;
}) {
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [activeView, setActiveView] = useState<View>(initialView);

  async function load() {
    try {
      const response = await fetch("/api/vendas", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível carregar os dados.");
      }

      setState({ status: "success", data: payload });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const refreshMs = Math.max(state.data.refreshSeconds, 60) * 1000;
    const timer = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(timer);
  }, [state]);

  if (state.status === "loading") {
    return (
      <main className="dashboardShell">
        <Header activeView={activeView} onViewChange={setActiveView} />
        <section className="statePanel">Carregando dados da planilha...</section>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="dashboardShell">
        <Header activeView={activeView} onViewChange={setActiveView} />
        <section className="statePanel statePanelError">
          <h2>Conexão com a planilha pendente</h2>
          <p>{state.error}</p>
          <p>Confira as variáveis da Vercel e a permissão do Microsoft Graph.</p>
        </section>
      </main>
    );
  }

  return (
    <DashboardReady
      activeView={activeView}
      data={state.data}
      onRefresh={load}
      onViewChange={setActiveView}
    />
  );
}

function DashboardReady({
  activeView,
  data,
  onRefresh,
  onViewChange,
}: {
  activeView: View;
  data: ApiResponse;
  onRefresh: () => void;
  onViewChange: (view: View) => void;
}) {
  const model = useMemo(() => buildDashboardModel(data), [data]);

  if (activeView === "tv") {
    return (
      <main className="dashboardShell tvShell">
        <TvView model={model} updatedAt={data.updatedAt} source={data.source} />
      </main>
    );
  }

  return (
    <main className="dashboardShell">
      <Header
        activeView={activeView}
        updatedAt={data.updatedAt}
        source={data.source}
        onRefresh={onRefresh}
        onViewChange={onViewChange}
      />

      {activeView === "operacao" ? <OperationView model={model} /> : null}
      {activeView === "gestao" ? <ManagementView model={model} /> : null}
      {activeView === "marketing" ? (
        <MarketingView leads={data.leads} source={data.leadsSource} />
      ) : null}
    </main>
  );
}

function OperationView({ model }: { model: DashboardModel }) {
  return (
    <div className="operationScreen">
      <section className="heroGrid" aria-label="Indicadores principais">
        <article className="heroCard heroCardMain">
          <span className="eyebrow">Faturamento total</span>
          <strong>{currency.format(model.total)}</strong>
          <div className="goalLine">
            <span>Meta superação {currency.format(model.meta)}</span>
            <span>{model.goalPct.toFixed(1)}%</span>
          </div>
          <div className="goalTrack" aria-label={`Meta em ${model.goalPct.toFixed(1)}%`}>
            <i style={{ width: `${model.goalPct}%` }} />
          </div>
          <footer>
            {model.remaining > 0
              ? `Faltam ${currency.format(model.remaining)} para a festa da superação`
              : "Festa da superação confirmada"}
          </footer>
        </article>

        <KpiCard
          label="Comercial"
          value={currency.format(model.totalComercial)}
          detail={`${model.comercial.length} vendas`}
          tone="blue"
        />
        <KpiCard
          label="Jurídico"
          value={currency.format(model.totalJuridico)}
          detail={`${model.juridico.length} vendas`}
          tone="green"
        />
        <KpiCard
          label="Por dia útil"
          value={currency.format(model.requiredPerRemainingWorkday)}
          detail={`${model.remainingWorkdays} dias úteis restantes`}
          tone="red"
        />
        <KpiCard
          label="Projeção"
          value={currency.format(model.projectedRevenue)}
          detail={`Média diária ${currency.format(model.averageDailyRevenue)}`}
          tone={model.projectedRevenue >= model.meta ? "green" : "yellow"}
        />
      </section>

      <section className="pulseGrid">
        <MiniMetric
          label="Meta base"
          value={`${model.baseGoalPct.toFixed(1)}%`}
          detail={`${currency.format(model.total)} de ${currency.format(model.baseGoal)}`}
        />
        <MiniMetric
          label={model.rhythmDelta >= 0 ? "Acima do ritmo" : "Abaixo do ritmo"}
          value={currency.format(Math.abs(model.rhythmDelta))}
          detail={`Ideal ate hoje ${currency.format(model.idealRevenueToDate)}`}
        />
        <MiniMetric
          label="Melhor dia"
          value={model.bestDay ? compactCurrency.format(model.bestDay.total) : "R$ 0"}
          detail={model.bestDay ? formatDayMonth(model.bestDay.data) : "Sem movimento"}
        />
        <MiniMetric
          label="Ticket medio"
          value={currency.format(model.averageTicket)}
          detail={`${model.vendas.length} vendas no mês`}
        />
      </section>

      <section className="operationGrid">
        <RankingBoard
          title="Ranking comercial"
          month={model.rankComercialMonth}
          week={model.rankComercialWeek}
        />
        <RankingBoard
          title="Ranking jurídico"
          month={model.rankJuridicoMonth}
          week={model.rankJuridicoWeek}
        />
      </section>

      <section className="wideGrid">
        <DailyRevenuePanel days={model.days} monthLabel={model.monthLabel} />
        <LiveFeed vendas={model.recentSales} />
      </section>
    </div>
  );
}

function TvView({
  model,
  updatedAt,
  source,
}: {
  model: DashboardModel;
  updatedAt: string;
  source: string;
}) {
  const clock = useClock();
  const weather = useWeather();

  return (
    <div className="tvScreen">
      <header className="tvHeader">
        <div>
          <span className="livePill"><i />Ao vivo</span>
          <h2>Central de Vendas</h2>
          <p>Meta base R$ 100 mil / superação R$ 110 mil</p>
        </div>
        <div className="tvTime">
          <strong>{clock.time}</strong>
          <span>{clock.date}</span>
        </div>
        <div className="tvWeather">
          <strong>{weather.temp === null ? "--" : `${Math.round(weather.temp)} C`}</strong>
          <span>{weather.error ?? weather.label}</span>
        </div>
      </header>

      <section className="tvHero">
        <article className="tvTotal">
          <span>Faturamento total</span>
          <strong>{currency.format(model.total)}</strong>
          <div className="tvGoalRail">
            <i style={{ width: `${model.baseGoalPct}%` }} />
            <b style={{ width: `${model.goalPct}%` }} />
          </div>
          <footer>
            <span>Base {model.baseGoalPct.toFixed(1)}%</span>
            <span>Superação {model.goalPct.toFixed(1)}%</span>
          </footer>
        </article>
        <TvMetric label="Por dia útil" value={currency.format(model.requiredPerRemainingWorkday)} detail={`${model.remainingWorkdays} dias restantes`} warn />
        <TvMetric label="Projeção" value={currency.format(model.projectedRevenue)} detail={model.projectedRevenue >= model.meta ? "Ritmo de festa" : "Abaixo da superação"} good={model.projectedRevenue >= model.meta} />
        <TvMetric label="Ritmo hoje" value={currency.format(Math.abs(model.rhythmDelta))} detail={model.rhythmDelta >= 0 ? "Acima do ideal" : "Abaixo do ideal"} good={model.rhythmDelta >= 0} />
      </section>

      <section className="tvBody">
        <TvRankingPanel model={model} />
        <DailyRevenuePanel days={model.days} monthLabel={model.monthLabel} />
        <LiveFeed vendas={model.recentSales.slice(0, 3)} />
      </section>

      <footer className="tvFooter">
        <strong>
          {model.goalPct >= 100
            ? "Festa da superação confirmada"
            : `Faltam ${currency.format(model.remaining)} para a festa`}
        </strong>
        <span>
          Atualizado {new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} / {source}
        </span>
      </footer>
    </div>
  );
}

function TvRankingPanel({ model }: { model: DashboardModel }) {
  const comercialRanking = excludeFromTvRanking(model.rankComercialMonth, ["SILAS", "SILLAS"]);
  const juridicoRanking = excludeFromTvRanking(model.rankJuridicoMonth, ["SILAS", "SILLAS"]);

  return (
    <section className="tvRankings">
      <div className="sectionHeader">
        <h2>Ranking mensal</h2>
        <span>{model.monthLabel}</span>
      </div>
      <CommercialPodium ranking={comercialRanking} />
      <LegalTvList ranking={juridicoRanking} />
    </section>
  );
}

function excludeFromTvRanking(ranking: Ranking[], hiddenNames: string[]) {
  const hidden = new Set(hiddenNames.map(normalizeName));
  return ranking.filter((seller) => !hidden.has(normalizeName(seller.nome)));
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function CommercialPodium({ ranking }: { ranking: Ranking[] }) {
  const podium = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  const rest = ranking.slice(3);

  return (
    <div className="tvCommercialRank">
      <h3>Comercial</h3>
      <div className="podium">
        {podium.map((seller) => {
          const position = ranking.findIndex((item) => item.nome === seller.nome) + 1;

          return (
            <article className={`podiumPlace p${position}`} key={seller.nome}>
              <span>{position}o</span>
              <strong>{seller.nome}</strong>
              <small>{seller.vendas} vendas</small>
            </article>
          );
        })}
      </div>
      <div className="tvRestList">
        {rest.map((seller, index) => (
          <div key={seller.nome}>
            <span>{index + 4}o</span>
            <strong>{seller.nome}</strong>
            <small>{seller.vendas} vendas</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegalTvList({ ranking }: { ranking: Ranking[] }) {
  return (
    <div className="tvLegalRank">
      <h3>Jurídico</h3>
      <div className="legalList">
        {ranking.slice(0, 2).map((seller, index) => (
          <article className={index < 2 ? "highlight" : ""} key={seller.nome}>
            <span>{index + 1}o</span>
            <strong>{seller.nome}</strong>
            <small>{seller.vendas} vendas</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function TvMetric({
  label,
  value,
  detail,
  good,
  warn,
}: {
  label: string;
  value: string;
  detail: string;
  good?: boolean;
  warn?: boolean;
}) {
  return (
    <article className={`tvMetric ${good ? "good" : ""} ${warn ? "warn" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function Header({
  activeView,
  updatedAt,
  source,
  onRefresh,
  onViewChange,
}: {
  activeView: View;
  updatedAt?: string;
  source?: string;
  onRefresh?: () => void;
  onViewChange: (view: View) => void;
}) {
  const clock = useClock();
  const weather = useWeather();

  return (
    <header className="topBar">
      <div className="brandBlock">
        <div className="brandMark">
          <strong>GRS</strong>
          <span>SOLUCOES</span>
        </div>
        <div>
          <h1>Central de Vendas</h1>
          <p>Operação ao vivo, meta da empresa e performance por equipe</p>
        </div>
      </div>

      <nav className="viewNav" aria-label="Telas do dashboard">
        <button
          className={activeView === "tv" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("tv")}
        >
          TV
        </button>
        <button
          className={activeView === "operacao" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("operacao")}
        >
          Operação
        </button>
        <button
          className={activeView === "gestao" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("gestao")}
        >
          Gestão
        </button>
        <button
          className={activeView === "marketing" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("marketing")}
        >
          Marketing
        </button>
      </nav>

      <div className="opsInfo">
        <div className="clockBox">
          <strong>{clock.time}</strong>
          <span>{clock.date}</span>
        </div>
        <div className="weatherBox">
          <strong>{weather.temp === null ? "--" : `${Math.round(weather.temp)} C`}</strong>
          <span>{weather.error ?? weather.label}</span>
        </div>
      </div>

      <div className="statusBlock">
        <span className="livePill"><i />Ao vivo</span>
        {updatedAt ? (
          <small>
            Atualizado {new Date(updatedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            <br />
            {source}
          </small>
        ) : null}
        {onRefresh ? (
          <button className="refreshButton" type="button" onClick={onRefresh}>
            Atualizar
          </button>
        ) : null}
      </div>
    </header>
  );
}

function ManagementView({ model }: { model: DashboardModel }) {
  const [teamFilter, setTeamFilter] = useState<"TODOS" | Equipe>("TODOS");
  const filteredSales =
    teamFilter === "TODOS"
      ? model.recentSales
      : model.recentSales.filter((venda) => venda.equipe === teamFilter);

  return (
    <div className="managementScreen">
      <section className="managementHero">
        <article>
          <span className="eyebrow">Visao executiva</span>
          <h2>{currency.format(model.total)}</h2>
          <p>{model.baseGoalPct.toFixed(1)}% da meta base / {model.goalPct.toFixed(1)}% da superação</p>
        </article>
        <article>
          <span className="eyebrow">Falta para meta</span>
          <h2>{currency.format(model.remaining)}</h2>
          <p>{currency.format(model.requiredPerRemainingWorkday)} por dia útil restante</p>
        </article>
        <article>
          <span className="eyebrow">Projeção no ritmo atual</span>
          <h2>{currency.format(model.projectedRevenue)}</h2>
          <p>Média diária {currency.format(model.averageDailyRevenue)}</p>
        </article>
        <article>
          <span className="eyebrow">Melhor dia</span>
          <h2>{model.bestDay ? compactCurrency.format(model.bestDay.total) : "R$ 0"}</h2>
          <p>{model.bestDay ? formatDayMonth(model.bestDay.data) : "Sem movimento"}</p>
        </article>
      </section>

      <section className="managementGrid">
        <PacePanel model={model} />
        <SellerTable title="Top vendedores no mês" ranking={model.overallRanking} />
      </section>

      <section className="managementGrid managementGridWide">
        <TeamComparison teams={model.teamSummary} />
        <DailyRevenuePanel days={model.days} monthLabel={model.monthLabel} />
      </section>

      <SalesTable vendas={filteredSales} filter={teamFilter} onFilterChange={setTeamFilter} />
    </div>
  );
}

function PacePanel({ model }: { model: DashboardModel }) {
  return (
    <section className="managementPanel partyPanel">
      <div className="sectionHeader">
        <h2>Ritmo da meta</h2>
        <span>Segunda a sexta</span>
      </div>
      <div className="paceRows">
        <div>
          <span>Média por dia útil</span>
          <strong>{currency.format(model.averageDailyRevenue)}</strong>
        </div>
        <div>
          <span>Necessario por dia</span>
          <strong>{currency.format(model.requiredPerRemainingWorkday)}</strong>
        </div>
        <div>
          <span>Ideal ate hoje</span>
          <strong>{currency.format(model.idealRevenueToDate)}</strong>
        </div>
        <div>
          <span>{model.rhythmDelta >= 0 ? "Acima do ritmo" : "Abaixo do ritmo"}</span>
          <strong>{currency.format(Math.abs(model.rhythmDelta))}</strong>
        </div>
        <div>
          <span>Dias úteis</span>
          <strong>
            {model.elapsedWorkdays}/{model.totalWorkdays}
          </strong>
        </div>
      </div>
      <p className={model.goalPct >= 100 ? "partyMessage on" : "partyMessage"}>
        {model.goalPct >= 100
          ? "Meta de R$ 110 mil batida. Festa liberada."
          : `Faltam ${currency.format(model.remaining)} para liberar a festa.`}
      </p>
    </section>
  );
}

function TeamComparison({ teams }: { teams: TeamSummary[] }) {
  return (
    <section className="managementPanel">
      <div className="sectionHeader">
        <h2>Comercial x Jurídico</h2>
        <span>Participação na receita</span>
      </div>
      <div className="teamRows">
        {teams.map((team) => (
          <div className="teamRow" key={team.label}>
            <div>
              <strong>{team.label}</strong>
              <small>{team.vendas} vendas / ticket {currency.format(team.ticket)}</small>
            </div>
            <div className="teamTrack">
              <i style={{ width: `${Math.max(team.pct, 4)}%` }} />
            </div>
            <span>{currency.format(team.total)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SellerTable({ title, ranking }: { title: string; ranking: Ranking[] }) {
  return (
    <section className="managementPanel">
      <div className="sectionHeader">
        <h2>{title}</h2>
        <span>Geral</span>
      </div>
      <div className="sellerTable">
        {ranking.slice(0, 8).map((seller, index) => (
          <div className="sellerTableRow" key={seller.nome}>
            <span>{index + 1}</span>
            <strong>{seller.nome}</strong>
            <small>{seller.vendas} vendas</small>
            <em>{currency.format(seller.total)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function SalesTable({
  vendas,
  filter,
  onFilterChange,
}: {
  vendas: Venda[];
  filter: "TODOS" | Equipe;
  onFilterChange: (filter: "TODOS" | Equipe) => void;
}) {
  return (
    <section className="managementPanel">
      <div className="sectionHeader">
        <h2>Movimento recente</h2>
        <div className="filterTabs">
          {(["TODOS", "COMERCIAL", "JURIDICO"] as const).map((item) => (
            <button
              className={filter === item ? "active" : ""}
              key={item}
              type="button"
              onClick={() => onFilterChange(item)}
            >
              {item === "TODOS" ? "Todos" : formatTeamName(item)}
            </button>
          ))}
        </div>
      </div>
      <div className="remoteTable">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Equipe</th>
              <th>Vendedor</th>
              <th>Cliente</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {vendas.slice(0, 14).map((venda) => (
              <tr key={`${venda.data}-${venda.equipe}-${venda.nome}-${venda.cliente}`}>
                <td>{formatDayMonth(venda.data)}</td>
                <td>{formatTeamName(venda.equipe)}</td>
                <td>{venda.nome}</td>
                <td>{venda.cliente}</td>
                <td>{currency.format(venda.meta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "red" | "yellow";
}) {
  return (
    <article className={`kpiCard ${tone}`}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function MiniMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="miniMetric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function formatTeamName(team: "TODOS" | Equipe) {
  if (team === "TODOS") {
    return "Todos";
  }

  return team === "JURIDICO" ? "Jurídico" : "Comercial";
}

function RankingBoard({
  title,
  month,
  week,
}: {
  title: string;
  month: Ranking[];
  week: Ranking[];
}) {
  return (
    <section className="rankingBoard">
      <div className="sectionHeader">
        <h2>{title}</h2>
        <span>Mês e semana</span>
      </div>
      <div className="rankingColumns">
        <RankingList title="Mês" ranking={month} />
        <RankingList title="Semana" ranking={week} compact />
      </div>
    </section>
  );
}

function RankingList({
  title,
  ranking,
  compact,
}: {
  title: string;
  ranking: Ranking[];
  compact?: boolean;
}) {
  const max = ranking[0]?.total ?? 1;
  const visible = ranking.slice(0, compact ? 5 : 6);

  return (
    <div className="rankingList">
      <h3>{title}</h3>
      {visible.length > 0 ? (
        visible.map((item, index) => (
          <div className="rankItem" key={`${title}-${item.nome}`}>
            <span className="position">{index + 1}</span>
            <div className="seller">
              <strong>{item.nome}</strong>
              <small>{item.vendas} vendas</small>
              <i style={{ width: `${Math.max((item.total / max) * 100, 5)}%` }} />
            </div>
            <span className="rankValue">{compactCurrency.format(item.total)}</span>
          </div>
        ))
      ) : (
        <p className="empty">Sem vendas neste período.</p>
      )}
    </div>
  );
}

function DailyRevenuePanel({
  days,
  monthLabel,
}: {
  days: DayRevenue[];
  monthLabel: string;
}) {
  const max = Math.max(...days.map((day) => day.total), 1);

  return (
    <section className="dailyPanel">
      <div className="sectionHeader">
        <h2>Venda por dia</h2>
        <span>{monthLabel}</span>
      </div>
      <div className="dailyRows">
        {days.length > 0 ? (
          days.map((day) => (
            <div className="dailyRow" key={day.data}>
              <span>{formatDayMonth(day.data)}</span>
              <div className="dailyBar">
                <i style={{ width: `${Math.max((day.total / max) * 100, 4)}%` }} />
              </div>
              <strong>{compactCurrency.format(day.total)}</strong>
              <small>
                C {compactCurrency.format(day.comercial)} / J {compactCurrency.format(day.juridico)}
              </small>
            </div>
          ))
        ) : (
          <p className="empty">Sem vendas no mês selecionado.</p>
        )}
      </div>
    </section>
  );
}

function LiveFeed({ vendas }: { vendas: Venda[] }) {
  return (
    <section className="liveFeed">
      <div className="sectionHeader">
        <h2>Últimas vendas</h2>
        <span>Entrada mais recente</span>
      </div>
      <div className="feedList">
        {vendas.slice(0, 8).map((venda) => (
          <article className="feedItem" key={`${venda.equipe}-${venda.data}-${venda.nome}-${venda.cliente}`}>
            <div>
              <span className={`teamTag ${venda.equipe === "COMERCIAL" ? "teamCom" : "teamJur"}`}>
                {formatTeamName(venda.equipe)}
              </span>
              <strong>{venda.nome}</strong>
              <p>{venda.cliente}</p>
            </div>
            <div>
              <strong>{compactCurrency.format(venda.meta)}</strong>
              <small>{formatDayMonth(venda.data)}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MarketingView({
  leads,
  source,
}: {
  leads: LeadMarketing[];
  source: string;
}) {
  const [sourceFilter, setSourceFilter] = useState<MarketingSource>("todos");
  const [monthFilter, setMonthFilter] = useState(() => getCurrentMonthKey());
  const [dayFilter, setDayFilter] = useState("");
  const dateFilteredLeads = leads.filter((lead) => {
    const leadDay = getDateKey(lead.dataRecebimento);

    if (!leadDay) {
      return false;
    }

    if (dayFilter) {
      return leadDay === dayFilter;
    }

    return leadDay.startsWith(monthFilter);
  });
  const filteredLeads =
    sourceFilter === "todos"
      ? dateFilteredLeads
      : dateFilteredLeads.filter((lead) => getLeadSource(lead) === sourceFilter);
  const todayLeads = filteredLeads.filter((lead) => isToday(lead.dataRecebimento)).length;
  const activeFinancing = filteredLeads.filter(
    (lead) => lead.possuiFinanciamentoAtivo === true,
  ).length;
  const contactableLeads = filteredLeads.filter((lead) => hasContactInfo(lead)).length;
  const qualificationRate = filteredLeads.length
    ? Math.round((activeFinancing / filteredLeads.length) * 100)
    : 0;
  const dailyRows = buildLeadDailyRows(filteredLeads);
  const peakDay = dailyRows[0] ?? null;
  const peakHour = getPeakHour(filteredLeads);
  const sourceInsights = marketingSourceOptions.slice(1).map((item) =>
    buildLeadSourceInsight(item.value, dateFilteredLeads),
  );
  const bestSource = [...sourceInsights].sort((a, b) => b.total - a.total)[0] ?? null;
  const sourceCounts = {
    todos: dateFilteredLeads.length,
    soul: dateFilteredLeads.filter((lead) => getLeadSource(lead) === "soul").length,
    growper: dateFilteredLeads.filter((lead) => getLeadSource(lead) === "growper").length,
  };

  return (
    <div className="marketingScreen">
      <section className="marketingHeader">
        <div>
          <span className="eyebrow">Marketing</span>
          <h2>Marketing</h2>
          <p>{source}</p>
        </div>
        <div className="marketingControls">
          <div className="dateFilters" aria-label="Filtros de data">
            <label>
              Mês
              <input
                type="month"
                value={monthFilter}
                onChange={(event) => {
                  setMonthFilter(event.target.value || getCurrentMonthKey());
                  setDayFilter("");
                }}
              />
            </label>
            <label>
              Dia
              <input
                type="date"
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => setDayFilter(getRelativeDateKey(0))}>
              Hoje
            </button>
            <button type="button" onClick={() => setDayFilter(getRelativeDateKey(-1))}>
              Ontem
            </button>
            <button type="button" onClick={() => setDayFilter("")}>
              Ver mês
            </button>
          </div>
          <div className="filterTabs marketingTabs">
            {marketingSourceOptions.map((item) => (
              <button
                className={sourceFilter === item.value ? "active" : ""}
                key={item.value}
                type="button"
                onClick={() => setSourceFilter(item.value)}
              >
                {item.label}
                <span>{sourceCounts[item.value]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="marketingKpis">
        <KpiCard
          label="Leads recebidos"
          value={String(filteredLeads.length)}
          detail="Base captada"
          tone="blue"
        />
        <KpiCard
          label="Leads hoje"
          value={String(todayLeads)}
          detail="Entrada do dia"
          tone="green"
        />
        <KpiCard
          label="Qualificados"
          value={String(activeFinancing)}
          detail={`${qualificationRate}% com financiamento ativo`}
          tone="yellow"
        />
        <KpiCard
          label="Com contato"
          value={String(contactableLeads)}
          detail={`${filteredLeads.length - contactableLeads} precisam revisão`}
          tone="red"
        />
      </section>

      <section className="marketingInsightGrid">
        <MiniMetric
          label="Melhor origem"
          value={bestSource && bestSource.total > 0 ? bestSource.label : "-"}
          detail={bestSource ? `${bestSource.total} leads no período` : "Sem leads"}
        />
        <MiniMetric
          label="Pico de captação"
          value={peakDay ? formatDayMonth(peakDay.date) : "-"}
          detail={peakDay ? `${peakDay.total} leads` : "Sem movimento"}
        />
        <MiniMetric
          label="Horário forte"
          value={peakHour ? `${peakHour.hour}h` : "-"}
          detail={peakHour ? `${peakHour.total} leads recebidos` : "Sem horário"}
        />
        <MiniMetric
          label="Média diária"
          value={dailyRows.length ? (filteredLeads.length / dailyRows.length).toFixed(1) : "0"}
          detail="Leads por dia com movimento"
        />
      </section>

      <section className="marketingGrid">
        <LeadTable leads={filteredLeads} />
        <LeadSourcePanel insights={sourceInsights} total={dateFilteredLeads.length} />
      </section>

      <section className="marketingGrid marketingGridWide">
        <LeadDailyPanel rows={dailyRows} />
        <LeadQualityPanel leads={filteredLeads} />
      </section>
    </div>
  );
}

function LeadTable({ leads }: { leads: LeadMarketing[] }) {
  return (
    <section className="managementPanel">
      <div className="sectionHeader">
        <h2>Leads recentes</h2>
        <span>Últimas entradas</span>
      </div>
      <div className="remoteTable">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Nome</th>
              <th>WhatsApp</th>
              <th>Origem</th>
              <th>Banco</th>
              <th>Perfil</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 14).map((lead, index) => (
              <tr key={`${lead.cpf}-${lead.whatsapp}-${index}`}>
                <td>{formatDateTimeShort(lead.dataRecebimento)}</td>
                <td>{lead.nome || "-"}</td>
                <td>{lead.whatsapp || "-"}</td>
                <td>{lead.origem || "-"}</td>
                <td>{lead.bancoFinanceira || "-"}</td>
                <td>{lead.possuiFinanciamentoAtivo === true ? "Qualificado" : "Triagem"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads.length === 0 ? (
        <p className="empty marketingEmpty">
          Nenhum lead encontrado para esse filtro.
        </p>
      ) : null}
    </section>
  );
}

function LeadSourcePanel({
  insights,
  total,
}: {
  insights: LeadSourceInsight[];
  total: number;
}) {
  return (
    <section className="managementPanel">
      <div className="sectionHeader">
        <h2>Origem dos leads</h2>
        <span>Soul x Growper</span>
      </div>
      <div className="teamRows">
        {insights.map((source) => {
          const pct = total > 0 ? (source.total / total) * 100 : 0;

          return (
            <div className="teamRow" key={source.value}>
              <div>
                <strong>{source.label}</strong>
                <small>
                  {source.qualified} qualificados / {source.contactable} com contato
                </small>
              </div>
              <div className="teamTrack">
                <i style={{ width: `${Math.max(pct, source.total > 0 ? 4 : 0)}%` }} />
              </div>
              <span>{source.total}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

type LeadDailyRow = {
  date: string;
  total: number;
  soul: number;
  growper: number;
};

type LeadSourceInsight = {
  value: MarketingSource;
  label: string;
  total: number;
  qualified: number;
  contactable: number;
};

function LeadDailyPanel({ rows }: { rows: LeadDailyRow[] }) {
  const visibleRows = rows.slice(0, 10);
  const max = Math.max(...visibleRows.map((row) => row.total), 1);

  return (
    <section className="dailyPanel">
      <div className="sectionHeader">
        <h2>Leads por dia</h2>
        <span>Ritmo de captação</span>
      </div>
      <div className="dailyRows leadDailyRows">
        {visibleRows.length > 0 ? (
          visibleRows.map((row) => (
            <div className="dailyRow" key={row.date}>
              <span>{formatDayMonth(row.date)}</span>
              <div className="dailyBar">
                <i style={{ width: `${Math.max((row.total / max) * 100, 4)}%` }} />
              </div>
              <strong>{row.total}</strong>
              <small>
                Soul {row.soul} / Growper {row.growper}
              </small>
            </div>
          ))
        ) : (
          <p className="empty">Sem leads no periodo selecionado.</p>
        )}
      </div>
    </section>
  );
}

function LeadQualityPanel({ leads }: { leads: LeadMarketing[] }) {
  const withContact = leads.filter(hasContactInfo).length;
  const withCpf = leads.filter((lead) => onlyDigits(lead.cpf).length >= 11).length;
  const withBank = leads.filter((lead) => lead.bancoFinanceira.trim()).length;
  const withCase = leads.filter((lead) => lead.caso.trim().length >= 12).length;
  const rows = [
    { label: "WhatsApp ou CPF", value: withContact },
    { label: "CPF preenchido", value: withCpf },
    { label: "Banco informado", value: withBank },
    { label: "Caso explicado", value: withCase },
  ];
  const max = Math.max(leads.length, 1);

  return (
    <section className="managementPanel">
      <div className="sectionHeader">
        <h2>Qualidade da base</h2>
        <span>Pronto para atendimento</span>
      </div>
      <div className="qualityRows">
        {rows.map((row) => {
          const pct = leads.length ? (row.value / leads.length) * 100 : 0;

          return (
            <div className="qualityRow" key={row.label}>
              <div>
                <strong>{row.label}</strong>
                <small>{pct.toFixed(1)}% da base filtrada</small>
              </div>
              <div className="teamTrack">
                <i style={{ width: `${Math.max((row.value / max) * 100, row.value ? 4 : 0)}%` }} />
              </div>
              <span>{row.value}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getLeadSource(lead: LeadMarketing): MarketingSource {
  const source = normalizeText(lead.origem);

  if (source.includes("soul")) {
    return "soul";
  }

  if (source.includes("growper") || source.includes("grouper")) {
    return "growper";
  }

  return "todos";
}

function buildLeadSourceInsight(
  source: MarketingSource,
  leads: LeadMarketing[],
): LeadSourceInsight {
  const label =
    marketingSourceOptions.find((item) => item.value === source)?.label ?? source;
  const sourceLeads = leads.filter((lead) => getLeadSource(lead) === source);

  return {
    value: source,
    label,
    total: sourceLeads.length,
    qualified: sourceLeads.filter((lead) => lead.possuiFinanciamentoAtivo === true)
      .length,
    contactable: sourceLeads.filter(hasContactInfo).length,
  };
}

function buildLeadDailyRows(leads: LeadMarketing[]): LeadDailyRow[] {
  const rows = new Map<string, LeadDailyRow>();

  leads.forEach((lead) => {
    const date = getDateKey(lead.dataRecebimento);

    if (!date) {
      return;
    }

    const row = rows.get(date) ?? { date, total: 0, soul: 0, growper: 0 };
    const source = getLeadSource(lead);
    row.total += 1;

    if (source === "soul") {
      row.soul += 1;
    }

    if (source === "growper") {
      row.growper += 1;
    }

    rows.set(date, row);
  });

  return [...rows.values()].sort((a, b) => b.total - a.total);
}

function getPeakHour(leads: LeadMarketing[]) {
  const hours = new Map<number, number>();

  leads.forEach((lead) => {
    const date = new Date(lead.dataRecebimento);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const hour = date.getHours();
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  });

  const [hour, total] =
    [...hours.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  if (hour === undefined || total === undefined) {
    return null;
  }

  return { hour: String(hour).padStart(2, "0"), total };
}

function hasContactInfo(lead: LeadMarketing) {
  return onlyDigits(lead.whatsapp).length >= 10 || onlyDigits(lead.cpf).length >= 11;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isToday(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatDateTimeShort(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getCurrentMonthKey() {
  return getRelativeDateKey(0).slice(0, 7);
}

function getRelativeDateKey(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDateKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function FutureView({ title }: { title: string }) {
  return (
    <section className="futureView">
      <span className="eyebrow">Proxima tela</span>
      <h2>{title}</h2>
      <p>Espaço reservado para novos indicadores sem misturar com a operação da TV.</p>
    </section>
  );
}

type DashboardModel = ReturnType<typeof buildDashboardModel>;

function buildDashboardModel(data: ApiResponse) {
  const activeMonth = getActiveMonth(data.vendas);
  const monthSales = data.vendas.filter((venda) => venda.data.startsWith(activeMonth.key));
  const comercial = monthSales.filter((venda) => venda.equipe === "COMERCIAL");
  const juridico = monthSales.filter((venda) => venda.equipe === "JURIDICO");
  const totalComercial = sum(comercial);
  const totalJuridico = sum(juridico);
  const total = totalComercial + totalJuridico;
  const goalPct = Math.min((total / data.meta) * 100, 100);
  const week = getWeekBounds();
  const weekSales = monthSales.filter((venda) => venda.data >= week.start && venda.data <= week.end);
  const weekComercial = weekSales.filter((venda) => venda.equipe === "COMERCIAL");
  const weekJuridico = weekSales.filter((venda) => venda.equipe === "JURIDICO");
  const days = groupByDate(monthSales);
  const bestDay = days.length > 0 ? [...days].sort((a, b) => b.total - a.total)[0] : null;
  const overallRanking = rankBySeller(monthSales);
  const workdays = getWorkdayStats(activeMonth.key);
  const averageDailyRevenue = workdays.elapsed > 0 ? total / workdays.elapsed : 0;
  const projectedRevenue = averageDailyRevenue * workdays.total;
  const baseGoal = 100000;
  const idealRevenueToDate =
    workdays.total > 0 ? data.meta * (workdays.elapsed / workdays.total) : 0;
  const rhythmDelta = total - idealRevenueToDate;
  const requiredPerRemainingWorkday =
    workdays.remaining > 0 ? Math.max(data.meta - total, 0) / workdays.remaining : 0;
  const teamSummary = [
    makeTeamSummary("Comercial", totalComercial, comercial.length, total),
    makeTeamSummary("Jurídico", totalJuridico, juridico.length, total),
  ];

  return {
    vendas: monthSales,
    comercial,
    juridico,
    total,
    totalComercial,
    totalJuridico,
    baseGoal,
    meta: data.meta,
    baseGoalPct: Math.min((total / baseGoal) * 100, 100),
    remaining: Math.max(data.meta - total, 0),
    goalPct,
    averageTicket: monthSales.length > 0 ? total / monthSales.length : 0,
    rankComercialMonth: rankBySeller(comercial),
    rankJuridicoMonth: rankBySeller(juridico),
    rankComercialWeek: rankBySeller(weekComercial),
    rankJuridicoWeek: rankBySeller(weekJuridico),
    days,
    recentSales: [...monthSales].sort((a, b) => b.data.localeCompare(a.data)),
    monthLabel: activeMonth.label,
    bestDay,
    overallRanking,
    teamSummary,
    totalWorkdays: workdays.total,
    elapsedWorkdays: workdays.elapsed,
    remainingWorkdays: workdays.remaining,
    averageDailyRevenue,
    projectedRevenue,
    idealRevenueToDate,
    rhythmDelta,
    requiredPerRemainingWorkday,
  };
}

function makeTeamSummary(
  label: string,
  total: number,
  vendas: number,
  grandTotal: number,
): TeamSummary {
  return {
    label,
    total,
    vendas,
    ticket: vendas > 0 ? total / vendas : 0,
    pct: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
  };
}

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    time: now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: now.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }),
  };
}

function useWeather(): WeatherState {
  const [weather, setWeather] = useState<WeatherState>({
    temp: null,
    label: "Temperatura",
  });

  useEffect(() => {
    const latitude = process.env.NEXT_PUBLIC_WEATHER_LAT ?? "-23.5505";
    const longitude = process.env.NEXT_PUBLIC_WEATHER_LON ?? "-46.6333";
    const label = process.env.NEXT_PUBLIC_WEATHER_LABEL ?? "São Paulo";
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`;

    async function loadWeather() {
      try {
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Clima indisponivel");
        }

        const payload = (await response.json()) as {
          current?: { temperature_2m?: number };
        };

        setWeather({
          temp: payload.current?.temperature_2m ?? null,
          label,
        });
      } catch {
        setWeather({
          temp: null,
          label,
          error: "Clima offline",
        });
      }
    }

    void loadWeather();
    const timer = window.setInterval(() => void loadWeather(), 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return weather;
}

function getActiveMonth(vendas: Venda[]) {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const hasCurrentMonth = vendas.some((venda) => venda.data.startsWith(currentKey));
  const key =
    hasCurrentMonth || vendas.length === 0
      ? currentKey
      : [...vendas].sort((a, b) => b.data.localeCompare(a.data))[0].data.slice(0, 7);
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return { key, label };
}

function getWorkdayStats(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const today = new Date();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month - 1;
  const elapsedEnd = isCurrentMonth ? minDate(today, monthEnd) : monthEnd;
  const remainingStart = isCurrentMonth ? maxDate(today, monthStart) : monthStart;

  return {
    total: countWeekdays(monthStart, monthEnd),
    elapsed: countWeekdays(monthStart, elapsedEnd),
    remaining: isCurrentMonth ? countWeekdays(remainingStart, monthEnd) : 0,
  };
}

function countWeekdays(start: Date, end: Date) {
  if (start > end) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();

    if (day >= 1 && day <= 5) {
      count += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function minDate(a: Date, b: Date) {
  return a < b ? a : b;
}

function maxDate(a: Date, b: Date) {
  return a > b ? a : b;
}

function sum(vendas: Venda[]) {
  return vendas.reduce((total, venda) => total + venda.meta, 0);
}

function rankBySeller(vendas: Venda[]): Ranking[] {
  const map = new Map<string, Ranking>();

  for (const venda of vendas) {
    const current = map.get(venda.nome) ?? {
      nome: venda.nome,
      total: 0,
      vendas: 0,
    };

    current.total += venda.meta;
    current.vendas += 1;
    map.set(venda.nome, current);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

function groupByDate(vendas: Venda[]): DayRevenue[] {
  const map = new Map<string, DayRevenue>();

  for (const venda of vendas) {
    const current = map.get(venda.data) ?? {
      data: venda.data,
      total: 0,
      comercial: 0,
      juridico: 0,
    };

    current.total += venda.meta;

    if (venda.equipe === "COMERCIAL") {
      current.comercial += venda.meta;
    } else {
      current.juridico += venda.meta;
    }

    map.set(venda.data, current);
  }

  return [...map.values()].sort((a, b) => a.data.localeCompare(b.data));
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function formatDayMonth(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}
