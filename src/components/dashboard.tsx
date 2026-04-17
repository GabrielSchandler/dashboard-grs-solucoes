"use client";

import { useEffect, useMemo, useState } from "react";

type Equipe = "COMERCIAL" | "JURIDICO";
type View = "operacao" | "gestao" | "marketing";

type Venda = {
  nome: string;
  data: string;
  cliente: string;
  meta: number;
  equipe: Equipe;
};

type ApiResponse = {
  vendas: Venda[];
  meta: number;
  refreshSeconds: number;
  updatedAt: string;
  source: string;
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

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const [state, setState] = useState<ApiState>({ status: "loading" });
  const [activeView, setActiveView] = useState<View>("operacao");

  async function load() {
    try {
      const response = await fetch("/api/vendas", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel carregar os dados.");
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
          <h2>Conexao com a planilha pendente</h2>
          <p>{state.error}</p>
          <p>Confira as variaveis da Vercel e a permissao do Microsoft Graph.</p>
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
      {activeView === "gestao" ? <FutureView title="Gestao" /> : null}
      {activeView === "marketing" ? <FutureView title="Marketing" /> : null}
    </main>
  );
}

function OperationView({ model }: { model: DashboardModel }) {
  return (
    <>
      <section className="heroGrid" aria-label="Indicadores principais">
        <article className="heroCard heroCardMain">
          <span className="eyebrow">Faturamento total</span>
          <strong>{currency.format(model.total)}</strong>
          <div className="goalLine">
            <span>Meta {currency.format(model.meta)}</span>
            <span>{model.goalPct.toFixed(1)}%</span>
          </div>
          <div className="goalTrack" aria-label={`Meta em ${model.goalPct.toFixed(1)}%`}>
            <i style={{ width: `${model.goalPct}%` }} />
          </div>
          <footer>
            {model.remaining > 0
              ? `Faltam ${currency.format(model.remaining)} para bater a meta`
              : "Meta atingida"}
          </footer>
        </article>

        <KpiCard
          label="Comercial"
          value={currency.format(model.totalComercial)}
          detail={`${model.comercial.length} vendas`}
          tone="blue"
        />
        <KpiCard
          label="Juridico"
          value={currency.format(model.totalJuridico)}
          detail={`${model.juridico.length} vendas`}
          tone="green"
        />
        <KpiCard
          label="Ticket medio"
          value={currency.format(model.averageTicket)}
          detail={`${model.vendas.length} vendas no periodo`}
          tone="red"
        />
      </section>

      <section className="operationGrid">
        <RankingBoard
          title="Ranking comercial"
          month={model.rankComercialMonth}
          week={model.rankComercialWeek}
        />
        <RankingBoard
          title="Ranking juridico"
          month={model.rankJuridicoMonth}
          week={model.rankJuridicoWeek}
        />
      </section>

      <section className="wideGrid">
        <DailyRevenuePanel days={model.days} monthLabel={model.monthLabel} />
        <LiveFeed vendas={model.recentSales} />
      </section>
    </>
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
  return (
    <header className="topBar">
      <div className="brandBlock">
        <div className="brandMark">
          <strong>GRS</strong>
          <span>SOLUCOES</span>
        </div>
        <div>
          <h1>Central de Vendas</h1>
          <p>Operacao ao vivo, meta da empresa e performance por equipe</p>
        </div>
      </div>

      <nav className="viewNav" aria-label="Telas do dashboard">
        <button
          className={activeView === "operacao" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("operacao")}
        >
          Operacao
        </button>
        <button
          className={activeView === "gestao" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("gestao")}
        >
          Gestao
        </button>
        <button
          className={activeView === "marketing" ? "active" : ""}
          type="button"
          onClick={() => onViewChange("marketing")}
        >
          Marketing
        </button>
      </nav>

      <div className="statusBlock">
        <span className="livePill">
          <i />
          Ao vivo
        </span>
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

function KpiCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "red";
}) {
  return (
    <article className={`kpiCard ${tone}`}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
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
        <span>Mes e semana</span>
      </div>
      <div className="rankingColumns">
        <RankingList title="Mes" ranking={month} />
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
        <p className="empty">Sem vendas neste periodo.</p>
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
          <p className="empty">Sem vendas no mes selecionado.</p>
        )}
      </div>
    </section>
  );
}

function LiveFeed({ vendas }: { vendas: Venda[] }) {
  return (
    <section className="liveFeed">
      <div className="sectionHeader">
        <h2>Ultimas vendas</h2>
        <span>Entrada mais recente</span>
      </div>
      <div className="feedList">
        {vendas.slice(0, 8).map((venda) => (
          <article className="feedItem" key={`${venda.equipe}-${venda.data}-${venda.nome}-${venda.cliente}`}>
            <div>
              <span className={`teamTag ${venda.equipe === "COMERCIAL" ? "teamCom" : "teamJur"}`}>
                {venda.equipe}
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

function FutureView({ title }: { title: string }) {
  return (
    <section className="futureView">
      <span className="eyebrow">Proxima tela</span>
      <h2>{title}</h2>
      <p>Espaco reservado para novos indicadores sem misturar com a operacao da TV.</p>
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

  return {
    vendas: monthSales,
    comercial,
    juridico,
    total,
    totalComercial,
    totalJuridico,
    meta: data.meta,
    remaining: Math.max(data.meta - total, 0),
    goalPct,
    averageTicket: monthSales.length > 0 ? total / monthSales.length : 0,
    rankComercialMonth: rankBySeller(comercial),
    rankJuridicoMonth: rankBySeller(juridico),
    rankComercialWeek: rankBySeller(weekComercial),
    rankJuridicoWeek: rankBySeller(weekJuridico),
    days: groupByDate(monthSales),
    recentSales: [...monthSales].sort((a, b) => b.data.localeCompare(a.data)),
    monthLabel: activeMonth.label,
  };
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
