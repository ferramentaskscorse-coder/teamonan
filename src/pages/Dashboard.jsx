import { useState, useMemo } from "react";
import { C } from "../theme";
import { Select, EmptyState, StatCard, SectionTitle, TaxaBar } from "../ui";

export default function Dashboard({ units, students, classes, attendance }) {
  const [mesAno, setMesAno] = useState("");
  const [unitId, setUnitId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");

  const professores = students.filter((s) => s.tipo === "professor");
  const alunos = students.filter((s) => s.tipo !== "professor");

  const hasFilters = mesAno || unitId || teacherId || studentId;

  const studentOptions = unitId ? alunos.filter((s) => s.unitId === unitId) : alunos;

  const scopeClasses = classes.filter(
    (c) =>
      (!mesAno || c.date.slice(0, 7) === mesAno) &&
      (!unitId || c.unitId === unitId) &&
      (!teacherId || c.teacherId === teacherId)
  );
  const scopeClassIds = new Set(scopeClasses.map((c) => c.id));

  const scopeAttendance = attendance.filter((a) => scopeClassIds.has(a.classId) && (!studentId || a.studentId === studentId));

  const totalAulas = scopeClasses.length;
  const totalPresencas = scopeAttendance.length;
  const mediaPorAula = totalAulas ? (totalPresencas / totalAulas).toFixed(1) : "0";

  const unitsInScope = unitId ? units.filter((u) => u.id === unitId) : units;
  const porUnidade = useMemo(() => {
    return unitsInScope.map((u) => {
      const aulasU = scopeClasses.filter((c) => c.unitId === u.id);
      const idsU = new Set(aulasU.map((c) => c.id));
      const presU = scopeAttendance.filter((a) => idsU.has(a.classId));
      return {
        id: u.id,
        name: u.name,
        aulas: aulasU.length,
        presencas: presU.length,
        media: aulasU.length ? (presU.length / aulasU.length).toFixed(1) : "0",
      };
    });
  }, [unitsInScope, scopeClasses, scopeAttendance]);

  const studentsInScope = studentId ? alunos.filter((s) => s.id === studentId) : alunos.filter((s) => !unitId || s.unitId === unitId);
  const porAluno = useMemo(() => {
    return studentsInScope
      .map((s) => {
        const aulasOferecidas = scopeClasses.filter((c) => c.unitId === s.unitId).length;
        const presencas = attendance.filter((a) => a.studentId === s.id && scopeClassIds.has(a.classId)).length;
        const taxa = aulasOferecidas ? Math.round((presencas / aulasOferecidas) * 100) : 0;
        return {
          id: s.id,
          name: s.name,
          unitName: units.find((u) => u.id === s.unitId)?.name || "—",
          aulasOferecidas,
          presencas,
          taxa,
        };
      })
      .sort((a, b) => b.taxa - a.taxa);
  }, [studentsInScope, units, scopeClasses, scopeClassIds, attendance]);

  function limparFiltros() {
    setMesAno("");
    setUnitId("");
    setTeacherId("");
    setStudentId("");
  }

  if (classes.length === 0) {
    return <EmptyState text="Ainda não há aulas registradas. Os números aparecem aqui assim que a primeira presença for marcada." />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            style={{ background: C.bgRaised, borderColor: C.line, color: mesAno ? C.text : C.textFaint }}
            className="border rounded-md px-3 py-2 text-sm outline-none w-full"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Select value={unitId} onChange={setUnitId} placeholder="Todas as unidades" options={units.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Select value={teacherId} onChange={setTeacherId} placeholder="Todos os professores" options={professores.map((t) => ({ value: t.id, label: t.name }))} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Select value={studentId} onChange={setStudentId} placeholder="Todos os alunos" options={studentOptions.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        {hasFilters && (
          <button onClick={limparFiltros} style={{ color: C.textDim }} className="col-span-2 sm:col-span-4 text-xs text-left underline underline-offset-2 hover:opacity-80">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total de aulas" value={totalAulas} />
        <StatCard label="Total de presenças" value={totalPresencas} />
        <StatCard label="Média por aula" value={mediaPorAula} />
      </div>

      {porUnidade.length > 0 && (
        <div>
          <SectionTitle>Por unidade</SectionTitle>
          <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: C.textFaint, borderColor: C.lineSoft }} className="border-b text-left text-xs">
                  <th className="font-medium px-4 py-2">Unidade</th>
                  <th className="font-medium px-4 py-2 text-right">Aulas</th>
                  <th className="font-medium px-4 py-2 text-right">Presenças</th>
                  <th className="font-medium px-4 py-2 text-right">Média/aula</th>
                </tr>
              </thead>
              <tbody>
                {porUnidade.map((u) => (
                  <tr key={u.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0">
                    <td style={{ color: C.text }} className="px-4 py-2.5">
                      {u.name}
                    </td>
                    <td style={{ color: C.textDim }} className="px-4 py-2.5 text-right">
                      {u.aulas}
                    </td>
                    <td style={{ color: C.textDim }} className="px-4 py-2.5 text-right">
                      {u.presencas}
                    </td>
                    <td style={{ color: C.brass }} className="px-4 py-2.5 text-right font-semibold">
                      {u.media}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <SectionTitle>Por aluno — taxa de frequência</SectionTitle>
        <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md overflow-hidden">
          {porAluno.length === 0 && (
            <div style={{ color: C.textFaint }} className="text-sm px-4 py-6 text-center">
              Nenhum aluno nesse recorte.
            </div>
          )}
          {porAluno.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: C.textFaint, borderColor: C.lineSoft }} className="border-b text-left text-xs">
                  <th className="font-medium px-4 py-2">Aluno</th>
                  <th className="font-medium px-4 py-2">Unidade</th>
                  <th className="font-medium px-4 py-2 text-right">Aulas oferecidas</th>
                  <th className="font-medium px-4 py-2 text-right">Presenças</th>
                  <th className="font-medium px-4 py-2 text-right">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {porAluno.map((r) => (
                  <tr key={r.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0">
                    <td style={{ color: C.text }} className="px-4 py-2.5">
                      {r.name}
                    </td>
                    <td style={{ color: C.textDim }} className="px-4 py-2.5">
                      {r.unitName}
                    </td>
                    <td style={{ color: C.textDim }} className="px-4 py-2.5 text-right">
                      {r.aulasOferecidas}
                    </td>
                    <td style={{ color: C.textDim }} className="px-4 py-2.5 text-right">
                      {r.presencas}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <TaxaBar taxa={r.taxa} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
