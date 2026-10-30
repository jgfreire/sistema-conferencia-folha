// Motor de comparação determinístico (sem IA). Compara, para uma mesma origem
// (EMPREGADOS ou CONTRIBUINTES), os registros do mês anterior contra os do mês atual.
// Regra fixa: EMPREGADOS e CONTRIBUINTES são sempre pró-labore sem variáveis — não existe
// aqui nenhuma classificação de "variável"; toda diferença de valor é só AUMENTO ou REDUÇÃO.
window.CF = window.CF || {};
CF.compare = CF.compare || {};

(function () {
  "use strict";

  function compararOrigem(registrosAnterior, registrosAtual) {
    const buildKey = CF.identity.matcher.buildRecordKey;

    const mapAnterior = new Map();
    registrosAnterior.forEach((r) => mapAnterior.set(buildKey(r), r));
    const mapAtual = new Map();
    registrosAtual.forEach((r) => mapAtual.set(buildKey(r), r));

    const keys = new Set([...mapAnterior.keys(), ...mapAtual.keys()]);
    const resultados = [];

    keys.forEach((key) => {
      const ant = mapAnterior.get(key);
      const atu = mapAtual.get(key);

      if (ant && atu) {
        const diferenca = CF.utils.round2(atu.valor - ant.valor);
        let situacao;
        if (diferenca === 0) situacao = "SEM ALTERAÇÃO";
        else if (diferenca > 0) situacao = "AUMENTO NA FOLHA";
        else situacao = "REDUÇÃO NA FOLHA";

        resultados.push({
          chave: key,
          empresaNome: atu.empresaNome || ant.empresaNome,
          cnpj: atu.cnpj || ant.cnpj,
          codigo: atu.codigo || ant.codigo,
          nome: atu.nome || ant.nome,
          origem: atu.origem || ant.origem,
          valorAnterior: ant.valor,
          valorAtual: atu.valor,
          diferenca,
          situacao,
          correspondenciaPor: ant.codigo && atu.codigo ? "codigo" : "nome"
        });
      } else if (!ant && atu) {
        resultados.push({
          chave: key,
          empresaNome: atu.empresaNome,
          cnpj: atu.cnpj,
          codigo: atu.codigo,
          nome: atu.nome,
          origem: atu.origem,
          valorAnterior: null,
          valorAtual: atu.valor,
          diferenca: null,
          situacao: "NOVO NA FOLHA",
          correspondenciaPor: null
        });
      } else if (ant && !atu) {
        resultados.push({
          chave: key,
          empresaNome: ant.empresaNome,
          cnpj: ant.cnpj,
          codigo: ant.codigo,
          nome: ant.nome,
          origem: ant.origem,
          valorAnterior: ant.valor,
          valorAtual: null,
          diferenca: null,
          situacao: "NÃO IDENTIFICADO NO MÊS ATUAL",
          correspondenciaPor: null
        });
      }
    });

    resultados.sort((a, b) => (a.empresaNome || "").localeCompare(b.empresaNome || "") || a.nome.localeCompare(b.nome));
    return resultados;
  }

  function resumir(resultados) {
    const resumo = {
      totalAnalisado: resultados.length,
      semAlteracao: 0,
      aumentos: 0,
      reducoes: 0,
      novos: 0,
      naoIdentificados: 0
    };
    resultados.forEach((r) => {
      if (r.situacao === "SEM ALTERAÇÃO") resumo.semAlteracao++;
      else if (r.situacao === "AUMENTO NA FOLHA") resumo.aumentos++;
      else if (r.situacao === "REDUÇÃO NA FOLHA") resumo.reducoes++;
      else if (r.situacao === "NOVO NA FOLHA") resumo.novos++;
      else if (r.situacao === "NÃO IDENTIFICADO NO MÊS ATUAL") resumo.naoIdentificados++;
    });
    return resumo;
  }

  // Registros SEM ALTERAÇÃO continuam contados no resumo, mas ficam fora das tabelas
  // exibidas (tela e PDF) — o relatório deve destacar as divergências, não listar todo mundo.
  function apenasDivergencias(resultados) {
    return resultados.filter((r) => r.situacao !== "SEM ALTERAÇÃO");
  }

  function comparar(extracaoAnterior, extracaoAtual) {
    const empregadosAnterior = extracaoAnterior.empresas.flatMap((e) => e.empregados);
    const empregadosAtual = extracaoAtual.empresas.flatMap((e) => e.empregados);
    const contribuintesAnterior = extracaoAnterior.empresas.flatMap((e) => e.contribuintes);
    const contribuintesAtual = extracaoAtual.empresas.flatMap((e) => e.contribuintes);

    const empregados = compararOrigem(empregadosAnterior, empregadosAtual);
    const contribuintes = compararOrigem(contribuintesAnterior, contribuintesAtual);

    return {
      empregados: { resultados: empregados, divergencias: apenasDivergencias(empregados), resumo: resumir(empregados) },
      contribuintes: { resultados: contribuintes, divergencias: apenasDivergencias(contribuintes), resumo: resumir(contribuintes) }
    };
  }

  // ---- Conferência de 3 meses (página /tres-meses) ----
  // Compara M1 → M2 → M3 para a mesma pessoa. Situação decidida pelo padrão de presença
  // nos três meses; com presença nos três, qualquer diferença de valor é VARIAÇÃO NA FOLHA.
  function situacaoTres(presenca, valores) {
    const padrao = presenca.map((p) => (p ? "1" : "0")).join("");
    switch (padrao) {
      case "111":
        return valores[0] === valores[1] && valores[1] === valores[2] ? "SEM ALTERAÇÃO" : "VARIAÇÃO NA FOLHA";
      case "011":
      case "001":
        return "NOVO NA FOLHA";
      case "110":
      case "100":
        return "NÃO IDENTIFICADO NO ÚLTIMO MÊS";
      case "101":
        return "AUSENTE NO MÊS INTERMEDIÁRIO";
      default:
        return "PRESENTE SÓ NO MÊS INTERMEDIÁRIO";
    }
  }

  function compararOrigemTres(registrosPorMes) {
    const buildKey = CF.identity.matcher.buildRecordKey;
    const mapas = registrosPorMes.map((registros) => {
      const m = new Map();
      registros.forEach((r) => m.set(buildKey(r), r));
      return m;
    });

    const keys = new Set(mapas.flatMap((m) => [...m.keys()]));
    const resultados = [];

    keys.forEach((key) => {
      const recs = mapas.map((m) => m.get(key));
      const base = recs.slice().reverse().find(Boolean);
      const valores = recs.map((r) => (r ? r.valor : null));
      const presenca = recs.map(Boolean);
      const dif = (a, b) => (valores[a] == null || valores[b] == null ? null : CF.utils.round2(valores[b] - valores[a]));

      resultados.push({
        chave: key,
        empresaNome: base.empresaNome,
        cnpj: base.cnpj,
        codigo: base.codigo,
        nome: base.nome,
        origem: base.origem,
        valores,
        diferenca12: dif(0, 1),
        diferenca23: dif(1, 2),
        situacao: situacaoTres(presenca, valores)
      });
    });

    resultados.sort((a, b) => (a.empresaNome || "").localeCompare(b.empresaNome || "") || a.nome.localeCompare(b.nome));
    return resultados;
  }

  function resumirTres(resultados) {
    const resumo = {
      totalAnalisado: resultados.length,
      semAlteracao: 0,
      variacoes: 0,
      novos: 0,
      naoIdentificados: 0,
      ausentesIntermediario: 0
    };
    resultados.forEach((r) => {
      if (r.situacao === "SEM ALTERAÇÃO") resumo.semAlteracao++;
      else if (r.situacao === "VARIAÇÃO NA FOLHA") resumo.variacoes++;
      else if (r.situacao === "NOVO NA FOLHA") resumo.novos++;
      else if (r.situacao === "NÃO IDENTIFICADO NO ÚLTIMO MÊS") resumo.naoIdentificados++;
      else resumo.ausentesIntermediario++;
    });
    return resumo;
  }

  function compararTresMeses(extracoes) {
    const porMes = (campo) => extracoes.map((ext) => ext.empresas.flatMap((e) => e[campo]));
    const empregados = compararOrigemTres(porMes("empregados"));
    const contribuintes = compararOrigemTres(porMes("contribuintes"));
    return {
      empregados: { resultados: empregados, divergencias: apenasDivergencias(empregados), resumo: resumirTres(empregados) },
      contribuintes: { resultados: contribuintes, divergencias: apenasDivergencias(contribuintes), resumo: resumirTres(contribuintes) }
    };
  }

  CF.compare.engine = { comparar, apenasDivergencias, compararTresMeses };
})();
