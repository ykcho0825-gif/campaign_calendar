const DEFAULT_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwAD47l6pov40_kSzTeGlsNTXkOfQC-WRuviTFuQGHVn-8by_mi9anLAZBcIPqHt2WVsM8RaEyBqqe/pub?gid=834849830&single=true&output=csv';

const elements = {
  url: document.querySelector('#csvUrl'),
  load: document.querySelector('#loadCsv'),
  file: document.querySelector('#csvFile'),
  search: document.querySelector('#search'),
  status: document.querySelector('#status'),
  calendar: document.querySelector('#calendar'),
  count: document.querySelector('#campaignCount'),
  monthTemplate: document.querySelector('#monthTemplate'),
};

let campaigns = [];

elements.url.value = DEFAULT_CSV_URL;
elements.load.addEventListener('click', () => loadFromUrl(elements.url.value));
elements.file.addEventListener('change', loadFromFile);
elements.search.addEventListener('input', renderCalendar);
window.addEventListener('DOMContentLoaded', () => loadFromUrl(DEFAULT_CSV_URL));

async function loadFromUrl(url) {
  setStatus('CSV를 불러오는 중입니다...');
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`CSV 요청 실패 (${response.status})`);
    const text = await response.text();
    campaigns = parseCampaigns(text);
    renderCalendar();
    setStatus(`${campaigns.length.toLocaleString('ko-KR')}개의 캠페인을 불러왔습니다.`);
  } catch (error) {
    campaigns = [];
    renderCalendar();
    setStatus(
      `CSV를 불러오지 못했습니다. Google Sheet가 '웹에 게시' 상태인지 확인하거나 CSV 파일 선택을 이용해 주세요. (${error.message})`,
      true,
    );
  }
}

async function loadFromFile(event) {
  const [file] = event.target.files;
  if (!file) return;
  setStatus('CSV 파일을 읽는 중입니다...');
  try {
    const text = await file.text();
    campaigns = parseCampaigns(text);
    renderCalendar();
    setStatus(`${file.name}에서 ${campaigns.length.toLocaleString('ko-KR')}개의 캠페인을 불러왔습니다.`);
  } catch (error) {
    campaigns = [];
    renderCalendar();
    setStatus(`CSV 파일을 읽지 못했습니다. (${error.message})`, true);
  }
}

function parseCampaigns(csvText) {
  const rows = parseCsv(csvText).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const nameIndex = findHeader(headers, ['캠페인명', '캠페인', 'campaignname', 'campaign', 'name', 'title']);
  const startIndex = findHeader(headers, ['시작일', '시작날짜', 'startdate', 'start', 'from']);
  const endIndex = findHeader(headers, ['종료일', '종료날짜', '마감일', 'enddate', 'end', 'to']);
  const periodIndex = findHeader(headers, ['캠페인기간', '기간', '일정', 'date', 'period', 'duration']);

  if (nameIndex === -1) throw new Error('캠페인명 컬럼을 찾을 수 없습니다.');
  if (startIndex === -1 && periodIndex === -1) throw new Error('시작일/종료일 또는 기간 컬럼을 찾을 수 없습니다.');

  return rows
    .slice(1)
    .map((row, index) => {
      const name = (row[nameIndex] || '').trim();
      const period = periodIndex > -1 ? parseDateRange(row[periodIndex]) : {};
      const start = parseDate(row[startIndex]) || period.start;
      const end = parseDate(row[endIndex]) || period.end || start;
      if (!name || !start || !end) return null;
      const [safeStart, safeEnd] = start <= end ? [start, end] : [end, start];
      return {
        id: `${index}-${name}`,
        name,
        start: safeStart,
        end: safeEnd,
        color: colorFor(name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name, 'ko'));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function renderCalendar() {
  const keyword = elements.search.value.trim().toLocaleLowerCase('ko-KR');
  const filtered = campaigns.filter((campaign) => campaign.name.toLocaleLowerCase('ko-KR').includes(keyword));
  elements.calendar.replaceChildren();
  elements.count.textContent = filtered.length.toLocaleString('ko-KR');

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = campaigns.length ? '검색 조건에 맞는 캠페인이 없습니다.' : '표시할 캠페인이 없습니다.';
    elements.calendar.append(empty);
    return;
  }

  const months = getMonths(filtered);
  months.forEach((monthDate) => elements.calendar.append(createMonth(monthDate, filtered)));
}

function createMonth(monthDate, visibleCampaigns) {
  const fragment = elements.monthTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.month-card');
  const title = fragment.querySelector('h2');
  const summary = fragment.querySelector('.month-card__header span');
  const grid = fragment.querySelector('.day-grid');
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const firstCell = new Date(year, month, 1 - monthStart.getDay());
  const monthCampaigns = visibleCampaigns.filter((campaign) => campaign.start <= monthEnd && campaign.end >= monthStart);

  title.textContent = monthDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  summary.textContent = `${monthCampaigns.length.toLocaleString('ko-KR')}개 캠페인`;

  for (let offset = 0; offset < 42; offset += 1) {
    const date = addDays(firstCell, offset);
    const day = document.createElement('div');
    day.className = `day${date.getMonth() === month ? '' : ' is-outside'}`;

    const activeCampaigns = monthCampaigns.filter((campaign) => campaign.start <= date && campaign.end >= date);
    day.append(createDayHeader(date, activeCampaigns.length));

    activeCampaigns.slice(0, 3).forEach((campaign) => day.append(createCampaignPill(campaign)));
    if (activeCampaigns.length > 3) {
      const more = document.createElement('div');
      more.className = 'more';
      more.textContent = `+${activeCampaigns.length - 3}개 더`;
      day.append(more);
    }
    grid.append(day);
  }

  return card;
}

function createDayHeader(date, count) {
  const header = document.createElement('div');
  header.className = 'day__number';
  const number = document.createElement('span');
  number.textContent = date.getDate();
  header.append(number);
  if (count) {
    const badge = document.createElement('span');
    badge.className = 'day__count';
    badge.textContent = count;
    header.append(badge);
  }
  return header;
}

function createCampaignPill(campaign) {
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'campaign-pill';
  pill.style.setProperty('--pill-bg', `${campaign.color}22`);
  pill.style.setProperty('--pill-border', campaign.color);
  pill.title = `${campaign.name}\n${formatDate(campaign.start)} ~ ${formatDate(campaign.end)}`;
  pill.textContent = campaign.name;

  const period = document.createElement('small');
  period.textContent = `${formatDate(campaign.start)} ~ ${formatDate(campaign.end)}`;
  pill.append(period);
  return pill;
}

function getMonths(items) {
  const min = new Date(Math.min(...items.map((campaign) => campaign.start)));
  const max = new Date(Math.max(...items.map((campaign) => campaign.end)));
  const months = [];
  for (let cursor = new Date(min.getFullYear(), min.getMonth(), 1); cursor <= max; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    months.push(cursor);
  }
  return months;
}

function parseDateRange(value = '') {
  const normalized = String(value).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = normalized.split(/\s*(?:~|–|—|부터|에서|to|until|\s-\s)\s*/i).filter(Boolean);
  if (parts.length >= 2) return { start: parseDate(parts[0]), end: parseDate(parts.slice(1).join('-')) };

  const matches = normalized.match(/\d{4}[.\-/년\s]+\d{1,2}[.\-/월\s]+\d{1,2}/g) || [];
  return { start: parseDate(matches[0]), end: parseDate(matches[1]) };
}

function parseDate(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const raw = String(value).trim();

  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }

  const match = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (match) return makeDate(match[1], match[2], match[3]);

  const shortMatch = raw.match(/(\d{1,2})\D+(\d{1,2})/);
  if (shortMatch) return makeDate(new Date().getFullYear(), shortMatch[1], shortMatch[2]);

  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function makeDate(year, month, day) {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.valueOf()) ? null : date;
}

function findHeader(headers, candidates) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(normalizeHeader(candidate))));
}

function normalizeHeader(value = '') {
  return String(value).toLocaleLowerCase('ko-KR').replace(/[\s_()\-/]/g, '');
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatDate(date) {
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');
}

function colorFor(text) {
  const palette = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'];
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('error', isError);
}
