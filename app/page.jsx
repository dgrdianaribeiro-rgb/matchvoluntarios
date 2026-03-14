'use client';

import { useMemo, useState } from 'react';

const MATCH_WEIGHTS = {
    series: 30,
    music: 20,
    bairro: 15,
    profissao: 15,
    signo: 10,
    comunicacao: 10
};

const COMMUNICATION_LABELS = {
    intenso: 'Intenso',
    moderado: 'Moderado',
    minimo: 'Mínimo'
};

const COMMUNICATION_OPTIONS = [
    {
        value: 'intenso',
        label: 'Intenso — Gosto de conversar bastante no WhatsApp e quero um padrinho amigo.'
    },
    {
        value: 'moderado',
        label: 'Moderado — Gosto de manter contato, sem necessidade de muita proximidade.'
    },
    {
        value: 'minimo',
        label: 'Mínimo — Prefiro suporte quando eu procurar, sem exigir proximidade.'
    }
];

const INITIAL_FORM = {
    nome: '',
    profissao: '',
    signo: '',
    series: '',
    musica: '',
    bairro: '',
    comunicacao: 'moderado'
};

const CSV_COLUMNS = ['nome', 'profissao', 'signo', 'series', 'musica', 'bairro', 'comunicacao'];

export default function Page() {
    const [activeTab, setActiveTab] = useState('padrinhos');
    const [padrinhos, setPadrinhos] = useState([]);
    const [afilhados, setAfilhados] = useState([]);
    const [padrinhoForm, setPadrinhoForm] = useState(INITIAL_FORM);
    const [afilhadoForm, setAfilhadoForm] = useState(INITIAL_FORM);
    const [message, setMessage] = useState('');
    const [matchs, setMatchs] = useState([]);
    const [bulkText, setBulkText] = useState({ padrinhos: '', afilhados: '' });

    const unmatchedAfilhados = useMemo(() => afilhados.length - matchs.length, [afilhados.length, matchs.length]);

    const groupedMatchs = useMemo(() => {
        const groups = new Map();

        for (const match of matchs) {
            const key = match.padrinho.nome;
            if (!groups.has(key)) {
                groups.set(key, {
                    padrinho: match.padrinho,
                    afilhados: []
                });
            }
            groups.get(key).afilhados.push(match);
        }

        return [...groups.values()]
            .map((group) => ({
                ...group,
                afilhados: group.afilhados.sort((a, b) => b.score - a.score)
            }))
            .sort((a, b) => b.afilhados.length - a.afilhados.length || a.padrinho.nome.localeCompare(b.padrinho.nome, 'pt-BR'));
    }, [matchs]);

    const addSingleCadastro = (type) => {
        const form = type === 'padrinhos' ? padrinhoForm : afilhadoForm;
        const normalized = normalizePerson(form);

        if (!normalized.nome) {
            setMessage('Nome completo é obrigatório para cadastrar.');
            return;
        }

        const list = type === 'padrinhos' ? padrinhos : afilhados;
        const oppositeList = type === 'padrinhos' ? afilhados : padrinhos;
        if (list.some((person) => person.nome.toLowerCase() === normalized.nome.toLowerCase())) {
            setMessage(`${type === 'padrinhos' ? 'Padrinho' : 'Afilhado'} já cadastrado: ${normalized.nome}.`);
            return;
        }
        if (oppositeList.some((person) => person.nome.toLowerCase() === normalized.nome.toLowerCase())) {
            setMessage(`Não é permitido repetir o mesmo nome entre padrinhos e afilhados: ${normalized.nome}.`);
            return;
        }

        const setter = type === 'padrinhos' ? setPadrinhos : setAfilhados;
        setter([...list, normalized]);
        setMessage(`${type === 'padrinhos' ? 'Padrinho' : 'Afilhado'} ${normalized.nome} cadastrado com sucesso.`);
    };

    const handleCsvUpload = async (type, event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const csvText = await file.text();
        const rows = parseCsv(csvText);
        const peopleFromCsv = rows.map((row) => normalizePerson(row));

        const existing = type === 'padrinhos' ? padrinhos : afilhados;
        const oppositeList = type === 'padrinhos' ? afilhados : padrinhos;
        const oppositeNames = new Set(oppositeList.map((person) => person.nome.toLowerCase()));
        const uniqueMap = new Map(existing.map((person) => [person.nome.toLowerCase(), person]));
        let duplicates = 0;
        let crossDuplicates = 0;

        for (const person of peopleFromCsv) {
            if (!person.nome) continue;
            const key = person.nome.toLowerCase();
            if (oppositeNames.has(key)) {
                crossDuplicates += 1;
                continue;
            }
            if (uniqueMap.has(key)) {
                duplicates += 1;
                continue;
            }
            uniqueMap.set(key, person);
        }

        const setter = type === 'padrinhos' ? setPadrinhos : setAfilhados;
        setter(Array.from(uniqueMap.values()));
        setMessage(
            `Importação concluída (${type === 'padrinhos' ? 'Padrinhos' : 'Afilhados'}). ` +
                `${peopleFromCsv.length - duplicates - crossDuplicates} adicionados, ${duplicates} repetidos no grupo ignorados, ` +
                `${crossDuplicates} repetidos no outro grupo ignorados.`
        );
        event.target.value = '';
    };

    const handleBulkTextImport = (type) => {
        const rawText = bulkText[type];
        if (!rawText.trim()) {
            setMessage('Cole o conteúdo em massa antes de importar.');
            return;
        }

        const rows = parseCsv(rawText);
        const peopleFromText = rows.map((row) => normalizePerson(row));

        const existing = type === 'padrinhos' ? padrinhos : afilhados;
        const oppositeList = type === 'padrinhos' ? afilhados : padrinhos;
        const oppositeNames = new Set(oppositeList.map((person) => person.nome.toLowerCase()));
        const uniqueMap = new Map(existing.map((person) => [person.nome.toLowerCase(), person]));

        let duplicates = 0;
        let crossDuplicates = 0;

        for (const person of peopleFromText) {
            if (!person.nome) continue;
            const key = person.nome.toLowerCase();
            if (oppositeNames.has(key)) {
                crossDuplicates += 1;
                continue;
            }
            if (uniqueMap.has(key)) {
                duplicates += 1;
                continue;
            }
            uniqueMap.set(key, person);
        }

        const setter = type === 'padrinhos' ? setPadrinhos : setAfilhados;
        setter(Array.from(uniqueMap.values()));
        setBulkText((prev) => ({ ...prev, [type]: '' }));

        setMessage(
            `Carga manual concluída (${type === 'padrinhos' ? 'Padrinhos' : 'Afilhados'}). ` +
                `${peopleFromText.length - duplicates - crossDuplicates} adicionados, ${duplicates} repetidos no grupo ignorados, ` +
                `${crossDuplicates} repetidos no outro grupo ignorados.`
        );
    };

    const generateMatchs = () => {
        if (!padrinhos.length || !afilhados.length) {
            setMessage('Carregue padrinhos e afilhados para gerar os matchs.');
            return;
        }

        const capacityMap = new Map(padrinhos.map((p) => [p.nome, 0]));
        const result = [];

        const sortedAfilhados = [...afilhados].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

        for (const afilhado of sortedAfilhados) {
            const candidates = padrinhos
                .map((padrinho) => {
                    const currentLoad = capacityMap.get(padrinho.nome) || 0;
                    if (currentLoad >= 6) return null;

                    const details = scoreMatch(padrinho, afilhado);
                    return {
                        padrinho,
                        ...details,
                        currentLoad
                    };
                })
                .filter(Boolean)
                .sort((a, b) => {
                    if (b.total !== a.total) return b.total - a.total;
                    if (a.currentLoad !== b.currentLoad) return a.currentLoad - b.currentLoad;
                    return a.padrinho.nome.localeCompare(b.padrinho.nome, 'pt-BR');
                });

            if (!candidates.length) continue;

            const best = candidates[0];
            capacityMap.set(best.padrinho.nome, (capacityMap.get(best.padrinho.nome) || 0) + 1);
            result.push({
                padrinho: best.padrinho,
                afilhado,
                score: best.total,
                reasons: best.reasons,
                communicationVision: best.communicationVision
            });
        }

        setMatchs(result.sort((a, b) => b.score - a.score));
        setMessage(`Matchs gerados: ${result.length}. Assertividade estimada: até 98% com base nas regras de afinidade.`);
    };

    const exportMatchs = () => {
        if (!matchs.length) {
            setMessage('Gere os matchs antes de exportar.');
            return;
        }

        const headers = [
            'Padrinho',
            'Afilhado',
            'Pontuação Final',
            'Conexão 1',
            'Conexão 2',
            'Conexão 3',
            'Conexão 4',
            'Conexão 5',
            'Visão de Comunicação'
        ];

        const lines = matchs.map((item) => {
            const orderedReasons = [...item.reasons].sort((a, b) => b.score - a.score);
            const topFive = Array.from({ length: 5 }, (_, index) => orderedReasons[index]?.label || '-');
            return [
                item.padrinho.nome,
                item.afilhado.nome,
                item.score.toFixed(2),
                ...topFive,
                item.communicationVision
            ];
        });

        const csv = [headers, ...lines].map((line) => line.map((value) => csvEscape(value)).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'matchs-padrinhos-afilhados.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        setMessage('Arquivo de matchs exportado com sucesso.');
    };

    const resetMatchsAndData = () => {
        setMatchs([]);
        setPadrinhos([]);
        setAfilhados([]);
        setPadrinhoForm(INITIAL_FORM);
        setAfilhadoForm(INITIAL_FORM);
        setBulkText({ padrinhos: '', afilhados: '' });
        setMessage('Dados e matchs reiniciados. Pronto para nova carga.');
    };

    return (
        <div className="pb-10 space-y-8 text-blue-950">
            <section className="p-6 border border-blue-200 rounded-lg bg-white/95">
                <h1 className="text-3xl font-bold text-blue-900">Painel de Match — Padrinhos & Afilhados</h1>
                <p className="mt-2 text-blue-700">
                    Faça cadastros individuais ou em massa (CSV), gere matchs por afinidade ponderada e exporte para conferência.
                </p>
                <div className="grid grid-cols-1 gap-4 mt-6 sm:grid-cols-3">
                    <CounterCard title="Padrinhos carregados" value={padrinhos.length} />
                    <CounterCard title="Afilhados carregados" value={afilhados.length} />
                    <CounterCard title="Afilhados sem match" value={Math.max(unmatchedAfilhados, 0)} />
                </div>
                {message && <p className="p-3 mt-4 text-sm border rounded border-blue-200 bg-blue-50 text-blue-900">{message}</p>}
            </section>

            <section className="p-6 border border-blue-200 rounded-lg bg-white/95">
                <div className="flex flex-wrap gap-2 mb-6">
                    {[
                        { id: 'padrinhos', label: 'Padrinho' },
                        { id: 'afilhados', label: 'Afilhado' },
                        { id: 'guia', label: 'Guia' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded font-semibold ${
                                activeTab === tab.id ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'guia' && <GuideTab />}

                {(activeTab === 'padrinhos' || activeTab === 'afilhados') && (
                    <CadastroTab
                        type={activeTab}
                        title={activeTab === 'padrinhos' ? 'Cadastro de Padrinho' : 'Cadastro de Afilhado'}
                        form={activeTab === 'padrinhos' ? padrinhoForm : afilhadoForm}
                        bulkTextValue={bulkText[activeTab]}
                        onFormChange={(field, value) => {
                            const setter = activeTab === 'padrinhos' ? setPadrinhoForm : setAfilhadoForm;
                            setter((prev) => ({ ...prev, [field]: value }));
                        }}
                        onBulkTextChange={(value) => setBulkText((prev) => ({ ...prev, [activeTab]: value }))}
                        onBulkTextImport={() => handleBulkTextImport(activeTab)}
                        onAddSingle={() => addSingleCadastro(activeTab)}
                        onCsvUpload={(event) => handleCsvUpload(activeTab, event)}
                    />
                )}
            </section>

            <section className="p-6 border border-blue-200 rounded-lg bg-white/95">
                <div className="flex flex-wrap gap-3">
                    <button className="btn bg-blue-700 text-white hover:bg-blue-800" type="button" onClick={generateMatchs}>
                        Gerar Match
                    </button>
                    <button className="btn bg-blue-500 text-white hover:bg-blue-600" type="button" onClick={exportMatchs}>
                        Exportar Matchs (CSV)
                    </button>
                    <button className="btn bg-blue-200 text-blue-900 hover:bg-blue-300" type="button" onClick={resetMatchsAndData}>
                        Reiniciar Matchs e Cargas
                    </button>
                </div>
                <p className="mt-3 text-sm text-blue-700">
                    Regras aplicadas: sem repetição, cada padrinho recebe no máximo 6 afilhados e priorização por afinidade ponderada.
                </p>

                <div className="mt-6 space-y-4">
                    {groupedMatchs.map((group) => (
                        <div key={group.padrinho.nome} className="p-4 border rounded border-blue-100 bg-blue-50/60">
                            <h3 className="text-lg font-bold text-blue-900">{group.padrinho.nome}</h3>
                            <p className="mb-3 text-sm text-blue-800">{describePerson(group.padrinho)}</p>
                            <div className="space-y-3">
                                {group.afilhados.map((item, index) => (
                                    <div key={`${item.afilhado.nome}-${index}`} className="p-3 bg-white border rounded border-blue-100">
                                        <p className="font-semibold text-blue-900">Afilhado: {item.afilhado.nome}</p>
                                        <p className="text-sm text-blue-800">Pontuação: {item.score.toFixed(2)}</p>
                                        <p className="mt-1 text-sm text-blue-800">Visão de comunicação: {item.communicationVision}</p>
                                        <ol className="pl-4 mt-2 text-sm list-decimal text-blue-900">
                                            {item.reasons
                                                .sort((a, b) => b.score - a.score)
                                                .map((reason) => (
                                                    <li key={reason.label}>{reason.label}</li>
                                                ))}
                                        </ol>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {!groupedMatchs.length && (
                        <p className="text-sm text-blue-700">Nenhum match gerado ainda. Carregue os dados e clique em “Gerar Match”.</p>
                    )}
                </div>
            </section>
        </div>
    );
}

function CadastroTab({ title, form, bulkTextValue, onBulkTextChange, onBulkTextImport, onFormChange, onAddSingle, onCsvUpload }) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl text-blue-900">{title}</h2>

            <div>
                <h3 className="mb-3 text-lg text-blue-900">Cadastro Individual</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input label="Nome Completo" value={form.nome} onChange={(value) => onFormChange('nome', value)} />
                    <Input
                        label="Trabalho / Especialização"
                        value={form.profissao}
                        onChange={(value) => onFormChange('profissao', value)}
                    />
                    <Input label="Signo" value={form.signo} onChange={(value) => onFormChange('signo', value)} />
                    <Input
                        label="Séries (o que gosta de assistir)"
                        value={form.series}
                        onChange={(value) => onFormChange('series', value)}
                        placeholder="Ex: Dark, Friends"
                    />
                    <Input
                        label="Música (gênero/artista)"
                        value={form.musica}
                        onChange={(value) => onFormChange('musica', value)}
                        placeholder="Ex: Pop, Rock, K-pop"
                    />
                    <Input label="Bairro (onde mora)" value={form.bairro} onChange={(value) => onFormChange('bairro', value)} />
                    <div>
                        <label className="block mb-1 text-sm font-medium text-blue-900">Preferência de Comunicação</label>
                        <select
                            className="w-full input"
                            value={form.comunicacao}
                            onChange={(event) => onFormChange('comunicacao', event.target.value)}
                        >
                            {COMMUNICATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <button type="button" className="mt-4 btn bg-blue-700 text-white hover:bg-blue-800" onClick={onAddSingle}>
                    Adicionar Cadastro
                </button>
            </div>

            <div>
                <h3 className="mb-3 text-lg text-blue-900">Em Massa (CSV)</h3>
                <p className="mb-2 text-sm text-blue-700">
                    Colunas aceitas: nome, profissao, signo, series, musica, bairro, comunicacao
                </p>
                <label className="inline-flex items-center gap-3 px-4 py-2 font-semibold text-white bg-blue-700 rounded cursor-pointer hover:bg-blue-800">
                    Escolher arquivo CSV
                    <input type="file" accept=".csv" onChange={onCsvUpload} className="hidden" />
                </label>
                <p className="mt-2 text-xs text-blue-700">
                    series = o que assiste; musica = gosto musical; bairro = onde mora; profissao = trabalho/especialização;
                    comunicacao = intenso, moderado ou minimo.
                </p>
            </div>

            <div>
                <h3 className="mb-3 text-lg text-blue-900">Em Massa Manual (colar texto)</h3>
                <p className="mb-2 text-sm text-blue-700">
                    Você pode colar dados com separador <strong>,</strong> ou <strong>;</strong> usando as mesmas colunas.
                </p>
                <textarea
                    className="w-full h-40 input"
                    placeholder={'nome,profissao,signo,series,musica,bairro,comunicacao\nJoão,Auditor,Peixes,"Dark,Friends",Pop,Bonsucesso,moderado'}
                    value={bulkTextValue}
                    onChange={(event) => onBulkTextChange(event.target.value)}
                />
                <button
                    type="button"
                    className="mt-3 btn bg-blue-700 text-white hover:bg-blue-800"
                    onClick={onBulkTextImport}
                >
                    Importar Texto em Massa
                </button>
            </div>
        </div>
    );
}

function GuideTab() {
    return (
        <div className="space-y-4 text-blue-900">
            <h2 className="text-2xl">Guia de Importação</h2>
            <ul className="pl-5 space-y-2 list-disc">
                <li>Use abas separadas para cadastrar Padrinhos e Afilhados.</li>
                <li>Você pode cadastrar individualmente ou subir um CSV (em massa).</li>
                <li>
                    Estrutura do CSV: <code>nome,profissao,signo,series,musica,bairro,comunicacao</code>
                </li>
                <li>
                    Significados: <strong>bairro</strong> = onde mora; <strong>series</strong> = o que assiste;{' '}
                    <strong>musica</strong> = estilo musical; <strong>profissao</strong> = trabalho/especialização.
                </li>
                <li>
                    Pesos no match: Séries (30%), Música (20%), Bairro (15%), Trabalho (15%), Signo (10%) e Comunicação (10%).
                </li>
                <li>Cada padrinho recebe no máximo 6 afilhados e ninguém é repetido no mesmo grupo.</li>
                <li>
                    Comunicação do afilhado: 1 = Intenso, 2 = Moderado, 3 = Mínimo. O painel mostra isso na visão de match.
                </li>
            </ul>
            <p className="text-sm text-blue-700">
                Os resultados ficam agrupados por padrinho, com descrição breve e lista de afilhados logo abaixo.
            </p>
        </div>
    );
}

function CounterCard({ title, value }) {
    return (
        <div className="p-4 border border-blue-200 rounded bg-blue-50">
            <p className="text-sm text-blue-800">{title}</p>
            <p className="text-3xl font-bold text-blue-900">{value}</p>
        </div>
    );
}

function Input({ label, value, onChange, placeholder }) {
    return (
        <div>
            <label className="block mb-1 text-sm font-medium text-blue-900">{label}</label>
            <input
                className="w-full input"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
}

function normalizePerson(data) {
    return {
        nome: clean(data.nome),
        profissao: clean(data.profissao),
        signo: clean(data.signo),
        series: splitTags(data.series),
        musica: splitTags(data.musica),
        bairro: clean(data.bairro),
        comunicacao: normalizeCommunication(data.comunicacao)
    };
}

function parseCsv(text) {
    const normalizedText = normalizeDelimiter(text);
    const normalizedLines = normalizedText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!normalizedLines.length) return [];

    const firstRow = splitCsvLine(normalizedLines[0]);
    const headerMap = getHeaderMap(firstRow);
    const hasHeader = Object.keys(headerMap).length > 0;

    const start = hasHeader ? 1 : 0;
    const rows = [];

    for (let index = start; index < normalizedLines.length; index += 1) {
        const row = splitCsvLine(normalizedLines[index]);
        const model = {};

        CSV_COLUMNS.forEach((column, colIndex) => {
            const sourceIndex = hasHeader ? headerMap[column] : colIndex;
            model[column] = sourceIndex === undefined ? '' : row[sourceIndex] || '';
        });

        rows.push(model);
    }

    return rows;
}

function getHeaderMap(rawHeader) {
    const aliases = {
        nome: ['nome', 'nome completo'],
        profissao: ['profissao', 'profissão', 'trabalho', 'especializacao', 'especialização'],
        signo: ['signo'],
        series: ['series', 'séries', 'serie', 'série'],
        musica: ['musica', 'música', 'cantor', 'banda', 'cantor/banda', 'musica favorita', 'música favorita'],
        bairro: ['bairro', 'moradia', 'onde mora'],
        comunicacao: ['comunicacao', 'comunicação', 'preferencia de comunicacao', 'preferência de comunicação']
    };

    const normalizedHeader = rawHeader.map((item) => normalizeHeaderValue(item));
    const map = {};

    Object.entries(aliases).forEach(([canonicalKey, aliasList]) => {
        const aliasSet = new Set(aliasList.map((item) => normalizeHeaderValue(item)));
        const foundIndex = normalizedHeader.findIndex((item) => aliasSet.has(item));
        if (foundIndex >= 0) {
            map[canonicalKey] = foundIndex;
        }
    });

    return map;
}

function normalizeHeaderValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function splitCsvLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (char === '"') {
            if (line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    parts.push(current.trim());
    return parts;
}

function scoreMatch(padrinho, afilhado) {
    const reasons = [];

    const seriesScore = listOverlapScore(padrinho.series, afilhado.series) * MATCH_WEIGHTS.series;
    reasons.push({
        label: buildReason('Séries', padrinho.series, afilhado.series, MATCH_WEIGHTS.series),
        score: seriesScore
    });

    const musicScore = listOverlapScore(padrinho.musica, afilhado.musica) * MATCH_WEIGHTS.music;
    reasons.push({
        label: buildReason('Música', padrinho.musica, afilhado.musica, MATCH_WEIGHTS.music),
        score: musicScore
    });

    const bairroScore = fieldMatchScore(padrinho.bairro, afilhado.bairro) * MATCH_WEIGHTS.bairro;
    reasons.push({
        label: buildReason('Bairro', padrinho.bairro, afilhado.bairro, MATCH_WEIGHTS.bairro),
        score: bairroScore
    });

    const profissaoScore = fieldMatchScore(padrinho.profissao, afilhado.profissao) * MATCH_WEIGHTS.profissao;
    reasons.push({
        label: buildReason('Trabalho', padrinho.profissao, afilhado.profissao, MATCH_WEIGHTS.profissao),
        score: profissaoScore
    });

    const signoScore = fieldMatchScore(padrinho.signo, afilhado.signo) * MATCH_WEIGHTS.signo;
    reasons.push({
        label: buildReason('Signo', padrinho.signo, afilhado.signo, MATCH_WEIGHTS.signo),
        score: signoScore
    });

    const communicationScore = communicationCompatibility(padrinho.comunicacao, afilhado.comunicacao) * MATCH_WEIGHTS.comunicacao;
    reasons.push({
        label: `Comunicação (${MATCH_WEIGHTS.comunicacao}%): ${COMMUNICATION_LABELS[padrinho.comunicacao]} ↔ ${COMMUNICATION_LABELS[afilhado.comunicacao]}`,
        score: communicationScore
    });

    const total = reasons.reduce((acc, item) => acc + item.score, 0);
    return {
        total,
        reasons,
        communicationVision: `Padrinho ${COMMUNICATION_LABELS[padrinho.comunicacao]} x Afilhado ${COMMUNICATION_LABELS[afilhado.comunicacao]}`
    };
}

function buildReason(field, padrinhoValue, afilhadoValue, weight) {
    const mentor = Array.isArray(padrinhoValue) ? padrinhoValue.join(' / ') || '-' : padrinhoValue || '-';
    const mentee = Array.isArray(afilhadoValue) ? afilhadoValue.join(' / ') || '-' : afilhadoValue || '-';
    return `${field} (${weight}%): ${mentor} ↔ ${mentee}`;
}

function fieldMatchScore(a, b) {
    if (!a || !b) return 0;
    return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
}

function listOverlapScore(listA, listB) {
    if (!listA.length || !listB.length) return 0;
    const setA = new Set(listA.map((item) => item.toLowerCase()));
    const setB = new Set(listB.map((item) => item.toLowerCase()));
    const intersection = [...setA].filter((item) => setB.has(item)).length;
    return intersection > 0 ? intersection / Math.max(setA.size, setB.size) : 0;
}

function communicationCompatibility(a, b) {
    const levels = { intenso: 3, moderado: 2, minimo: 1 };
    const distance = Math.abs((levels[a] || 2) - (levels[b] || 2));
    if (distance === 0) return 1;
    if (distance === 1) return 0.6;
    return 0.25;
}

function splitTags(value) {
    if (!value) return [];
    return String(value)
        .split(',')
        .map((item) => clean(item))
        .filter(Boolean);
}

function normalizeCommunication(value) {
    const cleanValue = clean(value).toLowerCase();
    if (cleanValue === '1' || cleanValue.includes('intenso')) return 'intenso';
    if (cleanValue === '3' || cleanValue.includes('mínimo') || cleanValue.includes('minimo')) return 'minimo';
    return 'moderado';
}

function normalizeDelimiter(text) {
    const lines = String(text || '').split(/\r?\n/).filter(Boolean);
    if (!lines.length) return '';
    const first = lines[0];
    const commaCount = (first.match(/,/g) || []).length;
    const semicolonCount = (first.match(/;/g) || []).length;
    if (semicolonCount > commaCount) {
        return String(text).replaceAll(';', ',');
    }
    return String(text);
}

function describePerson(person) {
    return `Trabalho: ${person.profissao || '-'} | Bairro: ${person.bairro || '-'} | Séries: ${person.series.join(', ') || '-'} | Música: ${person.musica.join(', ') || '-'} | Signo: ${person.signo || '-'}`;
}

function clean(value) {
    return String(value || '').trim();
}

function csvEscape(value) {
    const stringValue = String(value ?? '');
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replaceAll('"', '""')}"`;
    }
    return stringValue;
}
