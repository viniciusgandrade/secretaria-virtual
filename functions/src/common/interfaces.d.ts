export interface HorarioSugerido {
  texto: string;
  inicio: string; // ou Date, se for manipulado diretamente como objeto Date
  fim: string;
}

export interface RespostaSugestaoHorarios {
  mensagem: string;
  listaHorarios: HorarioSugerido[];
}

export interface ContextoPaciente {
  requerIntervencaoHumana: boolean;
  alternarFormato: boolean;
  cancelarAgendamento: boolean;
  remarcarAgendamento: boolean;
  recusarRemarcacao: boolean;
  horarioEscolhido?: HorarioEscolhido | null;
  preferenciaMedica: string | null;
  tipoConsulta: string | null;
  formato: 'online' | 'presencial' | 'indiferente' | null;
  sugestoesHorarios: HorarioSugerido[];
  nomeConfirmado: boolean | null;
  nome?: string | null;
  diasPreferidos: string[];
  preferenciaInicioDisponibilidade: string | null;
  preferenciaNegativaDeDias: boolean;
}

interface HorarioEscolhido {
  inicio: string; // ou Date
  fim: string;    // ou Date
}

export interface InterpretacaoMensagem {
  requerIntervencaoHumana: boolean;
  cancelarAgendamento: boolean;
  recusarRemarcacao: boolean;
  remarcarAgendamento: boolean;
  alternarFormato: boolean;
  preferenciaNegativaDeDias: boolean;
  preferenciaInicioDisponibilidade: string | null
  diasPreferidos: string[];
  horarioEscolhido: HorarioEscolhido | null;
  preferenciaMedica: string | null;
  tipoConsulta: string | null;
  formato: 'online' | 'presencial' | 'indiferente' | null;
  nomePaciente: string | null;
}

export interface CriarAgendamentoInput {
  pacienteId: Types.ObjectId;
  medicaId: Types.ObjectId;
  formato: 'online' | 'presencial';
  dataHoraInicio: Date;
  dataHoraFim: Date;
  status?: AppointmentStatus; // default: pendente
}
