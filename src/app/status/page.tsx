import { loadVendas } from "@/lib/vendas";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const startedAt = new Date();

  try {
    const data = await loadVendas();
    const total = data.vendas.reduce((sum, venda) => sum + venda.meta, 0);

    return (
      <main className="statusPage">
        <section>
          <span className="eyebrow">Diagnóstico</span>
          <h1>Integração ativa</h1>
          <p>A planilha foi lida com sucesso.</p>
        </section>
        <dl>
          <div>
            <dt>Vendas</dt>
            <dd>{data.vendas.length}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>
              {total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </dd>
          </div>
          <div>
            <dt>Meta</dt>
            <dd>
              {data.meta.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </dd>
          </div>
          <div>
            <dt>Fonte</dt>
            <dd>{data.source}</dd>
          </div>
          <div>
            <dt>Atualizado</dt>
            <dd>{new Date(data.updatedAt).toLocaleString("pt-BR")}</dd>
          </div>
          <div>
            <dt>Teste</dt>
            <dd>{startedAt.toLocaleString("pt-BR")}</dd>
          </div>
        </dl>
      </main>
    );
  } catch (error) {
    return (
      <main className="statusPage statusError">
        <section>
          <span className="eyebrow">Diagnóstico</span>
          <h1>Integração com erro</h1>
          <p>{error instanceof Error ? error.message : "Erro desconhecido."}</p>
        </section>
      </main>
    );
  }
}
