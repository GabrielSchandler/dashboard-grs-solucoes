import { readFile } from "node:fs/promises";
import readXlsxFile from "read-excel-file/node";

export type Equipe = "COMERCIAL" | "JURIDICO";

export type Venda = {
  nome: string;
  data: string;
  cliente: string;
  meta: number;
  equipe: Equipe;
  origem: string;
};

export type LeadMarketing = {
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
  statusAcionamento: string;
  dataAcionamento: string;
  responsavelAcionamento: string;
  statusLead: string;
  motivoPerda: string;
  investimentoAgencia: number | null;
  vendeu: boolean | null;
  dataVenda: string;
  valorVenda: number | null;
};

export type MarketingInvestment = {
  empresa: string;
  data: string;
  valor: number;
  observacao: string;
};

export type VendasResponse = {
  vendas: Venda[];
  leads: LeadMarketing[];
  marketingInvestments: MarketingInvestment[];
  meta: number;
  refreshSeconds: number;
  updatedAt: string;
  source: string;
  leadsSource: string;
};

type SheetRow = Record<string, unknown>;

const REQUIRED_COLUMNS = ["DATA", "COLABORADOR", "NOME_CLIENTE", "META", "EQUIPE"];

export async function loadVendas(): Promise<VendasResponse> {
  const { buffer, source } = await fetchWorkbookBuffer();
  const [vendas, leadsResult, marketingInvestments] = await Promise.all([
    parseWorkbook(buffer),
    loadMarketingLeads(buffer, source),
    parseMarketingInvestments(buffer),
  ]);

  return {
    vendas,
    leads: leadsResult.leads,
    marketingInvestments,
    meta: readNumberEnv("DASHBOARD_META", 110000),
    refreshSeconds: readNumberEnv("DASHBOARD_REFRESH_SECONDS", 300),
    updatedAt: new Date().toISOString(),
    source,
    leadsSource: leadsResult.source,
  };
}

async function fetchWorkbookBuffer(): Promise<{ buffer: ArrayBuffer | Buffer; source: string }> {
  const directUrl = process.env.EXCEL_DOWNLOAD_URL?.trim();
  const localPath = process.env.LOCAL_EXCEL_PATH?.trim();

  if (localPath) {
    return {
      buffer: await readFile(localPath),
      source: "LOCAL_EXCEL_PATH",
    };
  }

  if (directUrl) {
    return {
      buffer: await fetchArrayBuffer(directUrl),
      source: "EXCEL_DOWNLOAD_URL",
    };
  }

  const graphUrl = getGraphDownloadUrl();

  if (graphUrl) {
    const token = await getGraphAccessToken();

    return {
      buffer: await fetchArrayBuffer(graphUrl, {
        Authorization: `Bearer ${token}`,
      }),
      source: "Microsoft Graph",
    };
  }

  throw new Error(
    "Configure EXCEL_DOWNLOAD_URL ou as variáveis Microsoft Graph para ler a planilha.",
  );
}

function getGraphDownloadUrl(): string | null {
  const fullUrl = process.env.GRAPH_FILE_DOWNLOAD_URL?.trim();

  if (fullUrl) {
    return fullUrl;
  }

  const driveId = process.env.GRAPH_DRIVE_ID?.trim();
  const filePath = process.env.GRAPH_FILE_PATH?.trim();

  if (!driveId || !filePath) {
    return null;
  }

  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/content`;
}

async function getGraphAccessToken(): Promise<string> {
  const tenantId = requiredEnv("MS_TENANT_ID");
  const clientId = requiredEnv("MS_CLIENT_ID");
  const clientSecret = requiredEnv("MS_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Falha ao autenticar no Microsoft Graph: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };

  if (!data.access_token) {
    throw new Error("Microsoft Graph não retornou access_token.");
  }

  return data.access_token;
}

async function fetchArrayBuffer(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar a planilha: HTTP ${response.status}`);
  }

  return response.arrayBuffer();
}

async function parseWorkbook(buffer: ArrayBuffer | Buffer): Promise<Venda[]> {
  const workbook = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const sheets = await readXlsxFile(workbook);
  const selectedSheet = sheets.find((sheet) => sheet.sheet === "CONSOLIDADO") ?? sheets[0];

  if (!selectedSheet) {
    throw new Error("Nenhuma aba foi encontrada na planilha.");
  }

  const [headerRow, ...dataRows] = selectedSheet.data;

  if (!headerRow) {
    throw new Error("A planilha não possui cabeçalho.");
  }

  const headers = headerRow.map((header) => normalizeHeader(String(header ?? "")));
  const normalizedRows = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
  const columns = Object.keys(normalizedRows[0] ?? {});
  const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));

  if (missing.length > 0) {
    throw new Error(`Colunas ausentes na planilha: ${missing.join(", ")}`);
  }

  return normalizedRows
    .map(rowToVenda)
    .filter((venda): venda is Venda => Boolean(venda))
    .sort((a, b) => `${a.data}${a.nome}`.localeCompare(`${b.data}${b.nome}`));
}

async function loadMarketingLeads(
  fallbackBuffer: ArrayBuffer | Buffer,
  fallbackSource: string,
): Promise<{ leads: LeadMarketing[]; source: string }> {
  const { buffer, source } = await fetchLeadsWorkbookBuffer(
    fallbackBuffer,
    fallbackSource,
  );
  const leads = await parseLeadsWorkbook(buffer);

  return { leads, source };
}

async function fetchLeadsWorkbookBuffer(
  fallbackBuffer: ArrayBuffer | Buffer,
  fallbackSource: string,
): Promise<{
  buffer: ArrayBuffer | Buffer;
  source: string;
}> {
  const localPath = process.env.LOCAL_LEADS_EXCEL_PATH?.trim();
  const directUrl = process.env.LEADS_EXCEL_DOWNLOAD_URL?.trim();

  if (localPath) {
    return {
      buffer: await readFile(localPath),
      source: "LOCAL_LEADS_EXCEL_PATH",
    };
  }

  if (directUrl) {
    return {
      buffer: await fetchArrayBuffer(directUrl),
      source: "LEADS_EXCEL_DOWNLOAD_URL",
    };
  }

  const graphUrl = getLeadsGraphDownloadUrl();

  if (graphUrl) {
    const token = await getGraphAccessToken();

    return {
      buffer: await fetchArrayBuffer(graphUrl, {
        Authorization: `Bearer ${token}`,
      }),
      source: "Microsoft Graph leads",
    };
  }

  return {
    buffer: fallbackBuffer,
    source: `${fallbackSource} / leads_consolidado`,
  };
}

function getLeadsGraphDownloadUrl(): string | null {
  const fullUrl = process.env.LEADS_GRAPH_FILE_DOWNLOAD_URL?.trim();

  if (fullUrl) {
    return fullUrl;
  }

  const driveId = process.env.LEADS_GRAPH_DRIVE_ID?.trim() ?? process.env.GRAPH_DRIVE_ID?.trim();
  const filePath =
    process.env.LEADS_GRAPH_FILE_PATH?.trim() ?? inferLeadsGraphFilePath();

  if (!driveId || !filePath) {
    return null;
  }

  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodedPath}:/content`;
}

function inferLeadsGraphFilePath(): string | null {
  const vendasPath = process.env.GRAPH_FILE_PATH?.trim();

  if (!vendasPath) {
    return null;
  }

  const inferredPath = vendasPath
    .replace(/BASE DE VENDAS/gi, "BASE DE LEADS")
    .replace(/VENDAS/gi, "LEADS");

  return inferredPath === vendasPath ? null : inferredPath;
}

async function parseLeadsWorkbook(buffer: ArrayBuffer | Buffer): Promise<LeadMarketing[]> {
  const workbook = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (!workbook.length) {
    return [];
  }

  const sheets = await readXlsxFile(workbook);
  const selectedSheet =
    sheets.find((sheet) => normalizeHeader(sheet.sheet).includes("LEADS_CONSOLIDADO")) ??
    sheets.find((sheet) => normalizeHeader(sheet.sheet).includes("LEAD")) ??
    sheets[0];

  if (!selectedSheet) {
    return [];
  }

  const [headerRow, ...dataRows] = selectedSheet.data;

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map((header) => normalizeHeader(String(header ?? "")));
  const normalizedRows = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );

  return normalizedRows
    .map((row) => rowToLead(row, selectedSheet.sheet))
    .filter((lead): lead is LeadMarketing => Boolean(lead))
    .sort((a, b) => b.dataRecebimento.localeCompare(a.dataRecebimento));
}

async function parseMarketingInvestments(
  buffer: ArrayBuffer | Buffer,
): Promise<MarketingInvestment[]> {
  const workbook = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (!workbook.length) {
    return [];
  }

  const sheets = await readXlsxFile(workbook);
  const selectedSheet = sheets.find((sheet) =>
    normalizeHeader(sheet.sheet).includes("INVESTIMENTO_MARKETING"),
  );

  if (!selectedSheet) {
    return [];
  }

  const [headerRow, ...dataRows] = selectedSheet.data;

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map((header) => normalizeHeader(String(header ?? "")));
  const normalizedRows = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );

  return normalizedRows
    .map(rowToMarketingInvestment)
    .filter((investment): investment is MarketingInvestment => Boolean(investment));
}

function rowToMarketingInvestment(row: SheetRow): MarketingInvestment | null {
  const empresa = normalizeLeadSource(readRowText(row, ["EMPRESA", "AGENCIA", "AGÊNCIA"]));
  const data =
    parseDate(readRowValue(row, ["DATA", "COMPETENCIA", "COMPETÊNCIA"])) ??
    parseMarketingInvestmentDate(readRowText(row, ["DATA", "COMPETENCIA", "COMPETÊNCIA"])) ??
    "";
  const valor = parseCurrency(readRowValue(row, ["VALOR", "INVESTIMENTO", "CUSTO"]));
  const observacao = readRowText(row, ["OBS", "OBSERVACAO", "OBSERVAÇÃO", "TIPO"]);

  if (!empresa || empresa === "Não informado") {
    return null;
  }

  if (!data || valor <= 0) {
    return null;
  }

  return {
    empresa,
    data,
    valor,
    observacao,
  };
}

function rowToLead(row: SheetRow, sheetName = ""): LeadMarketing | null {
  const nome = readRowText(row, ["NOME", "CLIENTE"]);
  const whatsapp = readRowText(row, ["WHATSAPP", "TELEFONE", "CELULAR"]);
  const cpf = readRowText(row, ["CPF"]);
  const rawSource = readRowText(row, [
    "AGENCIA",
    "AGENCIA MARKETING",
    "AGENCIA DE MARKETING",
    "AGÊNCIA",
    "AGÊNCIA MARKETING",
    "AGÊNCIA DE MARKETING",
    "EMPRESA",
    "EMPRESA MARKETING",
    "EMPRESA DE MARKETING",
    "ORIGEM",
    "FONTE",
    "SOURCE",
  ]);
  const dataRecebimento =
    parseDateTime(
      readRowValue(row, ["DATA RECEBIMENTO", "DATA DO RECEBIMENTO", "CRIADO EM"]),
    ) ?? parseDateTime(readRowValue(row, ["DATA FORMULARIO", "DATA"])) ?? "";

  if (!nome && !whatsapp && !cpf) {
    return null;
  }

  return {
    dataRecebimento,
    nome,
    whatsapp,
    cpf,
    possuiFinanciamentoAtivo: parseBoolean(
      readRowText(row, [
        "POSSUI FINANCIAMENTO ATIVO",
        "FINANCIAMENTO ATIVO",
        "POSSUI FINANCIAMENTO",
      ]),
    ),
    valorParcela: parseCurrency(readRowValue(row, ["VALOR DA PARCELA", "VALOR DE PARCELA"])),
    bancoFinanceira: readRowText(row, [
      "BANCO/FINANCEIRA",
      "BANCO FINANCEIRA",
      "BANCO",
      "FINANCEIRA",
    ]),
    caso: readRowText(row, ["CASO", "EXPLIQUE UM POUCO DO SEU CASO"]),
    emailDestino: readRowText(row, ["EMAIL DESTINO", "DESTINO", "PARA"]),
    assunto: readRowText(row, ["ASSUNTO"]),
    origem: normalizeLeadSource(rawSource || sheetName),
    dataFormulario:
      parseDateTime(readRowValue(row, ["DATA FORMULARIO", "DATA"])) ??
      readRowText(row, ["DATA FORMULARIO", "DATA"]),
    horarioFormulario:
      parseDateTime(readRowValue(row, ["HORARIO FORMULARIO", "HORARIO"])) ??
      readRowText(row, ["HORARIO FORMULARIO", "HORARIO"]),
    statusAcionamento: readRowText(row, [
      "STATUS ACIONAMENTO",
      "STATUS DO ACIONAMENTO",
      "ACIONAMENTO",
      "ACIONADO",
    ]),
    dataAcionamento:
      parseDateTime(readRowValue(row, ["DATA ACIONAMENTO", "DATA DO ACIONAMENTO"])) ??
      readRowText(row, ["DATA ACIONAMENTO", "DATA DO ACIONAMENTO"]),
    responsavelAcionamento: readRowText(row, [
      "RESPONSAVEL ACIONAMENTO",
      "RESPONSAVEL PELO ACIONAMENTO",
      "OPERADOR",
      "VENDEDOR",
    ]),
    statusLead: readRowText(row, ["STATUS DO LEAD", "STATUS LEAD", "STATUS"]),
    motivoPerda: readRowText(row, ["MOTIVO DE PERDA", "MOTIVO PERDA"]),
    investimentoAgencia: parseNullableCurrency(
      readRowValue(row, [
        "INVESTIMENTO AGENCIA",
        "INVESTIMENTO AGÊNCIA",
        "INVESTIMENTO",
        "CUSTO",
      ]),
    ),
    vendeu: parseBoolean(readRowText(row, ["VENDEU", "CONVERTIDO", "FECHOU"])),
    dataVenda:
      parseDateTime(readRowValue(row, ["DATA VENDA", "DATA DA VENDA"])) ??
      readRowText(row, ["DATA VENDA", "DATA DA VENDA"]),
    valorVenda: parseNullableCurrency(
      readRowValue(row, ["VALOR VENDA", "VALOR DA VENDA", "RECEITA", "RETORNO"]),
    ),
  };
}

function readRowValue(row: SheetRow, columns: string[]): unknown {
  for (const column of columns) {
    if (row[column] !== undefined && row[column] !== null && row[column] !== "") {
      return row[column];
    }
  }

  return "";
}

function readRowText(row: SheetRow, columns: string[]): string {
  return String(readRowValue(row, columns) ?? "").trim();
}

function parseBoolean(value: string): boolean | null {
  const text = normalizeHeader(value);

  if (["SIM", "S", "YES", "TRUE"].includes(text)) {
    return true;
  }

  if (["NAO", "N", "NO", "FALSE"].includes(text)) {
    return false;
  }

  return null;
}

function parseNullableCurrency(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = parseCurrency(value);

  return parsed > 0 ? parsed : null;
}

function parseDateTime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return new Date(Date.UTC(1899, 11, 30 + value)).toISOString();
  }

  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (brDate) {
    return `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}T00:00:00.000Z`;
  }

  return null;
}

function normalizeLeadSource(value: string): string {
  const normalized = normalizeHeader(value);

  if (!normalized || normalized.includes("EXPORT_FORMAT") || normalized.includes("GID=")) {
    return "Não informado";
  }

  if (normalized.includes("SOUL")) {
    return "Soul";
  }

  if (normalized.includes("GROWPER") || normalized.includes("GROUPER")) {
    return "Growper";
  }

  return value.trim() || "Não informado";
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function rowToVenda(row: SheetRow): Venda | null {
  const equipe = String(row.EQUIPE ?? "")
    .trim()
    .toUpperCase();

  if (equipe !== "COMERCIAL" && equipe !== "JURIDICO") {
    return null;
  }

  const data = parseDate(row.DATA);
  const nome = String(row.COLABORADOR ?? "").trim();
  const cliente = String(row.NOME_CLIENTE ?? "").trim();
  const meta = parseCurrency(row.META);

  if (!data || !nome || !cliente || meta <= 0) {
    return null;
  }

  return {
    nome,
    data,
    cliente,
    meta,
    equipe,
    origem: normalizeLeadSource(readRowText(row, ["ORIGEM", "EMPRESA", "CANAL"])),
  };
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10);
  }

  const text = String(value ?? "").trim();
  const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (brDate) {
    return `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`;
  }

  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}`;
  }

  return null;
}

function parseMarketingInvestmentDate(value: string): string | null {
  const text = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (!text) {
    return null;
  }

  const ptMonths: Record<string, number> = {
    jan: 1,
    fev: 2,
    mar: 3,
    abr: 4,
    mai: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    set: 9,
    out: 10,
    nov: 11,
    dez: 12,
  };

  const dayMonth = text.match(/^(\d{1,2})\/([a-z]{3})$/i);

  if (dayMonth) {
    const month = ptMonths[dayMonth[2].toLowerCase()];
    const year = new Date().getFullYear();

    if (month) {
      return `${year}-${String(month).padStart(2, "0")}-${dayMonth[1].padStart(2, "0")}`;
    }
  }

  const monthYear = text.match(/^([a-z]{3})\/(\d{2}|\d{4})$/i);

  if (monthYear) {
    const month = ptMonths[monthYear[1].toLowerCase()];
    const rawYear = Number(monthYear[2]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    if (month) {
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }

  return null;
}

function parseCurrency(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
