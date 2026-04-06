import { FormType } from "./types";

export const CRITERIA_A = [
  "Aplicação dos conhecimentos adquiridos no curso quando executa as funções nos canais de inspeção.",
  "Execução de procedimentos de segurança em conformidade com as normas vigentes.",
  "Concentração na realização das atividades nos horários de grande demanda.",
  "Concentração na realização das atividades no atendimento a celebridades ou autoridades.",
  "Atenção na execução dos procedimentos sem interferências de questões pessoais.",
  "Realização de busca pessoal em conformidade com a normativa vigente.",
  "Demonstração de cortesia e educação com o público mantendo postura firme e segura.",
  "Aplicação de técnicas de inspeção veicular em conformidade com as normas vigentes.",
  "Não utilização de equipamentos eletrônicos pessoais (celulares) no exercício das funções.",
  "Impessoalidade no processo de inspeção de segurança.",
  "Evita a interação desnecessária entre colegas que interfira na execução das atividades.",
  "Verificação das credenciais e autorizações para impedir acessos não autorizados às ARS.",
];

export const CRITERIA_B = [
  "Proíbe o acesso de pessoas, veículos e equipamentos às AC e ARS sem credenciais e ATIV necessárias.",
  "Organiza as filas e orienta o público a ser inspecionado de maneira correta.",
  "Garante que pertences de mão sejam posicionados corretamente para inspeção por raios-X.",
  "Classifica corretamente objetos em Grupo I (sem ameaça), II (ameaça possível) ou III (ameaça óbvia).",
  "Interpreta adequadamente a coloração característica de objetos projetados no raios-X.",
  "Adota procedimentos adequados conforme a classificação do objeto inspecionado.",
  "Realiza a inspeção manual de pertences de mão em conformidade com as normas vigentes.",
  "Realiza inspeção com equipamento ETD corretamente.",
  "Proíbe acesso à ARS quando alarme do pórtico é acionado ou passagem inadequada.",
  "Realiza inspeção com scanner corporal corretamente.",
  "Executa procedimentos de inspeção com detector manual de metais em conformidade com a normativa.",
  "Realiza busca pessoal de maneira correta, conforme as normas vigentes.",
  "Identifica adequadamente necessidade de calibração e manutenção dos equipamentos.",
  "Inspeciona veículos e equipamentos adequadamente, vistoriando locais obrigatórios.",
];

export const SCENARIOS_C = [
  "Simulação de arma na bagagem",
  "Munições ocultas no meio de medicação",
  "Passageiro com facas na bagagem, alegando que ganhou de presente",
  "Passageiro com álcool na garrafa de água tentando acessar área restrita",
  "PAX com estilingue alegando ser item religioso",
  "Passageiro alegando ser diplomata querendo passar com bagagem sem inspeção",
  "PAX usando cinto faca",
  "Simulacro de bomba na bagagem de mão",
  "Passageiro com perfume contendo 105ml no voo internacional",
  "Passageiro com perfume simulacro de granada",
  "Busca pessoal: passageiro com caneta faca oculta no bolso",
  "Tesoura maior que 6cm na bagagem de mão",
  "PAX com frasco de spray de pimenta na bagagem de mão",
  "Passageiro com garrafa com água acima de 100ml no voo internacional",
  "Cartão faca dentro da bagagem",
  "Objeto metálico preso nas costas",
  "Passageiro com confetes com cilindro tentando acessar o PDM",
  "Utilizar credencial falsa para acessar ARS",
  "Simulação de bomba na bagagem de mão (2ª ocorrência)",
  "Tesoura oculta na cadeira de rodas",
  "PAX com objeto pontiagudo proibido usado para prender o cabelo",
  "Passageiro com munições na bagagem",
  "PAX portando objeto neutralizante (arma de choque) ao passar pelo pórtico",
  "Funcionário tentando acessar o pátio com credencial sem acesso à ARS",
  "Passageiro com ferramenta na bagagem de mão (chave de fenda ou martelo)",
  "Cartão faca na carteira",
  "Passageiro com bilhete doméstico tentando acessar área internacional",
  "PAX com cinto soco inglês",
  "Passageira alegando estar grávida ou ser portadora de marca-passo",
  "Bagagem com quantidade de isqueiros além do permitido",
];

export const LOCATIONS_AERODROME = [
  "Canal de Inspeção de PAX e Canal de Inspeção de Pessoal em Serviço",
  "Controle de Acesso de Pessoal em Serviço",
  "Controle de Acesso de PAX",
  "Controle de Acesso ao Terminal de Cargas",
  "Canal de Inspeção de Pessoal em Serviço no Terminal de Cargas",
  "Controle de Acesso de Veículos",
];

export const LOCATIONS_AEREO = [
  "Proteção da Aeronave",
  "Raio-X e Esteira de Bagagens Despachadas",
  "Check-in — Atividades de Profiler",
  "Terminal de Cargas",
  "Hangar",
  "Comissaria",
  "BHS",
];

export const ACTIVITIES = [
  "Leitura do RBAC 107, Resolução 515, Resolução 461",
  "Leitura das Instruções de Trabalho do Posto",
  "Orientação sobre a execução das atividades",
  "Observação da execução das atividades pelos demais APAC (Agente Sombra)",
  "Simulador de interpretação de imagens de raios-X",
  "Prática Supervisionada nas funções I, II, III, IV, V e controle de acesso",
  "Prática Avaliada",
];

export const PHASES = [
  {
    id: 1,
    name: "Fase 1 – Orientação",
    durationHours: 4,
    activities: [
      "Leitura do RBAC 107, Resolução 515, Resolução 461",
      "Leitura das Instruções de Trabalho do Posto",
      "Orientação sobre a execução das atividades",
      "Observação da execução das atividades pelos demais APAC (Agente Sombra)",
    ],
  },
  {
    id: 2,
    name: "Fase 2 – Identificação de ameaças",
    durationHours: 32, // 12h simulation + 20h practice
    activities: [
      "Simulador de interpretação de imagens de raios-X",
      "Prática Supervisionada nas funções I, II, III, IV, V e controle de acesso",
    ],
  },
  {
    id: 3,
    name: "Fase 3 – Prática avaliada",
    durationHours: 4,
    activities: ["Prática Avaliada"],
  },
];
