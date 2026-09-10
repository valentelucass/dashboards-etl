import AsyncMultiSelect from '../shared/AsyncMultiSelect';
import { combinarFiliaisParceiros, isParceiroLogistico } from '../../utils/filiais';

interface FiliaisPermitidasSplitSelectProps {
  opcoes: string[];
  selecionadas: string[];
  onChange: (filiais: string[]) => void;
  isLoading?: boolean;
}

export default function FiliaisPermitidasSplitSelect({
  opcoes,
  selecionadas,
  onChange,
  isLoading,
}: FiliaisPermitidasSplitSelectProps) {
  const filiaisProprias = opcoes.filter((filial) => !isParceiroLogistico(filial));
  const parceirosLogisticos = opcoes.filter(isParceiroLogistico);
  const filiaisPropriasSelecionadas = selecionadas.filter((filial) => !isParceiroLogistico(filial));
  const parceirosLogisticosSelecionados = selecionadas.filter(isParceiroLogistico);

  function atualizarFiliaisProprias(proximasFiliaisProprias: string[]) {
    onChange(combinarFiliaisParceiros(proximasFiliaisProprias, parceirosLogisticosSelecionados));
  }

  function atualizarParceirosLogisticos(proximosParceirosLogisticos: string[]) {
    onChange(combinarFiliaisParceiros(filiaisPropriasSelecionadas, proximosParceirosLogisticos));
  }

  return (
    <div className="flex w-full flex-col gap-3 md:flex-row [&>div>div]:w-full">
      <div className="min-w-0 flex-1">
        <AsyncMultiSelect
          label="Filiais Próprias Permitidas"
          opcoes={filiaisProprias}
          selecionados={filiaisPropriasSelecionadas}
          onChange={atualizarFiliaisProprias}
          placeholder="Selecione as filiais próprias"
          isLoading={isLoading}
        />
      </div>

      <div className="min-w-0 flex-1">
        <AsyncMultiSelect
          label="Parceiros Logísticos Permitidos"
          opcoes={parceirosLogisticos}
          selecionados={parceirosLogisticosSelecionados}
          onChange={atualizarParceirosLogisticos}
          placeholder="Selecione os parceiros logísticos"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
