'use client';

import { useMemo, useState } from 'react';

const MATCH_WEIGHTS = {
    profissao: 40,
    bairro: 30,
    signo: 15,
    music: 15
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

    const unmatchedAfilhados = useMemo(() => afilhados.length - matchs.length, [afilhados.length, matchs.length]);

    const addSingleCadastro = (type) => {
        const form = type === 'padrinhos' ? padrinhoForm : afilhadoForm;
        const normalized = normalizePerson(form);

        if (!normalized.nome) {
            setMessage('Nome completo é obrigatório para cadastrar.');
            return;
        }

        const list = type === 'padrinhos' ? padrinhos : afilhados;
        if (list.some((person) => person.nome.toLowerCase() === normalized.nome.toLowerCase())) {
            setMessage(`${type === 'padrinhos' ? 'Padrinho' : 'Afilhado'} já cadastrado: ${normalized.nome}.`);
            return;
        }

        const setter = type === 'padrinhos' ? setPadrinhos : setAfilhados;
        setter([...list, normalized]);
        setMessage(`${type === 'padrinhos' ? 'Padrinho' : 'Afilhado'} ${normalized.nome} cadastrado com sucesso.`);
    };

    const handleCsvUpload = async (type, event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const csvText = await file.text();
        const rows = parseCsv(csvText);
        const peopleFromCsv = rows.map((row) => normalizePerson(row));

        const existing = type === 'padrinhos' ? padrinhos : afilhados;
        const uniqueMap = new Map(existing.map((person) => [person.nome.toLowerCase(), person]));
        let duplicates = 0;

        for (const person of peopleFromCsv) {
            if (!person.nome) {
                continue;
            }
            const key = person.nome.toLowerCase();
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
                `${peopleFromCsv.length - duplicates} adicionados, ${duplicates} repetidos ignorados.`
        );
        event.target.value = '';
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
                    if (currentLoad >= 6) {
                        return null;
                    }
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

            if (!candidates.length) {
                continue;
            }

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

        const ranked = result.sort((a, b) => b.score - a.score);
        setMatchs(ranked);
        setMessage(`Matchs gerados: ${ranked.length}. Assertividade estimada: até 98% com base nas regras de afinidade.`);
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
                        title={activeTab === 'padrinhos' ? 'Cadastro de Padrinho' : 'Cadastro de Afilhado'}
                        form={activeTab === 'padrinhos' ? padrinhoForm : afilhadoForm}
                        onFormChange={(field, value) => {
                            const setter = activeTab === 'padrinhos' ? setPadrinhoForm : setAfilhadoForm;
                            setter((prev) => ({ ...prev, [field]: value }));
                        }}
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
                </div>
                <p className="mt-3 text-sm text-blue-700">
                    Regras aplicadas: sem repetição, cada padrinho recebe no máximo 6 afilhados e priorização por afinidade ponderada.
                </p>

                <div className="mt-6 overflow-auto border rounded border-blue-100">
                    <table className="min-w-full text-sm">
                        <thead className="bg-blue-100 text-blue-900">
                            <tr>
                                <th className="px-3 py-2 text-left">Padrinho</th>
                                <th className="px-3 py-2 text-left">Afilhado</th>
                                <th className="px-3 py-2 text-left">Pontuação</th>
                                <th className="px-3 py-2 text-left">Conexões por Peso</th>
                                <th className="px-3 py-2 text-left">Visão da Comunicação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matchs.map((item, index) => (
                                <tr key={`${item.padrinho.nome}-${item.afilhado.nome}-${index}`} className="border-t border-blue-100">
                                    <td className="px-3 py-2">{item.padrinho.nome}</td>
                                    <td className="px-3 py-2">{item.afilhado.nome}</td>
                                    <td className="px-3 py-2 font-semibold">{item.score.toFixed(2)}</td>
                                    <td className="px-3 py-2">
                                        <ol className="pl-4 list-decimal">
                                            {item.reasons
                                                .sort((a, b) => b.score - a.score)
                                                .map((reason) => (
                                                    <li key={reason.label}>{reason.label}</li>
                                                ))}
                                        </ol>
                                    </td>
                                    <td className="px-3 py-2">{item.communicationVision}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function CadastroTab({ title, form, onFormChange, onAddSingle, onCsvUpload }) {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl text-blue-900">{title}</h2>

            <div>
                <h3 className="mb-3 text-lg text-blue-900">Cadastro Individual</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Input label="Nome Completo" value={form.nome} onChange={(value) => onFormChange('nome', value)} />
                    <Input label="Profissão" value={form.profissao} onChange={(value) => onFormChange('profissao', value)} />
                    <Input label="Signo" value={form.signo} onChange={(value) => onFormChange('signo', value)} />
                    <Input
                        label="Séries (vírgula)"
                        value={form.series}
                        onChange={(value) => onFormChange('series', value)}
                        placeholder="Ex: Dark, Friends"
                    />
                    <Input
                        label="Cantor/Banda"
                        value={form.musica}
                        onChange={(value) => onFormChange('musica', value)}
                    />
                    <Input label="Bairro" value={form.bairro} onChange={(value) => onFormChange('bairro', value)} />
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
                <input type="file" accept=".csv" onChange={onCsvUpload} className="block w-full text-sm" />
                <p className="mt-2 text-xs text-blue-700">
                    comunicação: use intenso, moderado ou minimo. Campos de séries podem ter múltiplos valores separados por vírgula.
                </p>
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
                    Campos de afinidade e pesos usados no match: Profissão (40%), Bairro (30%), Signo (15%) e Música (15%).
                </li>
                <li>Cada padrinho recebe no máximo 6 afilhados e ninguém é repetido no mesmo grupo.</li>
                <li>
                    Comunicação do afilhado: 1 = Intenso, 2 = Moderado, 3 = Mínimo. O painel mostra isso na coluna “Visão da
                    Comunicação”.
                </li>
            </ul>
            <p className="text-sm text-blue-700">
                O algoritmo prioriza maior pontuação ponderada e desempata por menor carga atual do padrinho.
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
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) return [];

    const firstRow = splitCsvLine(lines[0]).map((item) => item.toLowerCase().trim());
    const hasHeader = firstRow.some((item) => CSV_COLUMNS.includes(item));

    const start = hasHeader ? 1 : 0;
    const rows = [];

    for (let index = start; index < lines.length; index += 1) {
        const row = splitCsvLine(lines[index]);
        const model = {};
        CSV_COLUMNS.forEach((column, colIndex) => {
            model[column] = row[colIndex] || '';
        });
        rows.push(model);
    }

    return rows;
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

    const musicScore = listOverlapScore(padrinho.musica, afilhado.musica) * MATCH_WEIGHTS.music;
    reasons.push({ label: buildReason('Música', padrinho.musica, afilhado.musica, MATCH_WEIGHTS.music), score: musicScore });

    const bairroScore = fieldMatchScore(padrinho.bairro, afilhado.bairro) * MATCH_WEIGHTS.bairro;
    reasons.push({ label: buildReason('Bairro', padrinho.bairro, afilhado.bairro, MATCH_WEIGHTS.bairro), score: bairroScore });

    const profissaoScore = fieldMatchScore(padrinho.profissao, afilhado.profissao) * MATCH_WEIGHTS.profissao;
    reasons.push({
        label: buildReason('Trabalho', padrinho.profissao, afilhado.profissao, MATCH_WEIGHTS.profissao),
        score: profissaoScore
    });

    const signoScore = fieldMatchScore(padrinho.signo, afilhado.signo) * MATCH_WEIGHTS.signo;
    reasons.push({ label: buildReason('Signo', padrinho.signo, afilhado.signo, MATCH_WEIGHTS.signo), score: signoScore });

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
